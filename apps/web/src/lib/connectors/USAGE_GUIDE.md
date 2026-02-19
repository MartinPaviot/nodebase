# Connectors - Usage Guide

## Quick Start

### 1. Get a connector

```typescript
import { getConnector } from "@/lib/connectors";

const gmail = getConnector("gmail");
```

### 2. Check authentication

```typescript
const isAuth = await gmail.isAuthenticated(userId);

if (!isAuth) {
  // Redirect user to OAuth flow
  const authUrl = await gmail.getAuthUrl(userId, "https://app.com/callback");
  // Redirect to authUrl...
}
```

### 3. Execute tool

```typescript
const result = await gmail.executeTool(
  "GMAIL_SEND_EMAIL",
  {
    to: "user@example.com",
    subject: "Hello from Elevay",
    body: "This is a test email",
  },
  userId
);

if (result.success) {
  console.log("Email sent:", result.data);
} else {
  console.error("Failed:", result.error);
}
```

---

## Authentication Flow

### Initiate OAuth

```typescript
import { getConnector } from "@/lib/connectors";

export async function initiateGmailAuth(userId: string) {
  const gmail = getConnector("gmail");

  const authUrl = await gmail.getAuthUrl(
    userId,
    `${process.env.NEXT_PUBLIC_BASE_URL}/integrations/gmail/callback`
  );

  // Redirect user
  return Response.redirect(authUrl);
}
```

### Handle OAuth callback

```typescript
export async function handleGmailCallback(
  userId: string,
  code: string,
  state?: string
) {
  const gmail = getConnector("gmail");

  await gmail.handleCallback(userId, code, state);

  console.log("Gmail connected!");
}
```

### Check status

```typescript
const status = await gmail.getAuthStatus(userId);

console.log({
  isAuthenticated: status.isAuthenticated,
  connectedAt: status.connectedAt,
  expiresAt: status.expiresAt,
});
```

### Disconnect

```typescript
await gmail.disconnect(userId);
```

---

## List Available Tools

```typescript
const tools = await gmail.listAvailableTools();

tools.forEach((tool) => {
  console.log(`${tool.name}: ${tool.description}`);
  console.log("Input schema:", tool.inputSchema);
});

// Example output:
// GMAIL_SEND_EMAIL: Send an email via Gmail
// Input schema: {
//   type: "object",
//   properties: {
//     to: { type: "string" },
//     subject: { type: "string" },
//     body: { type: "string" },
//   },
//   required: ["to", "subject", "body"]
// }
```

---

## Search & Discovery

### List all connectors

```typescript
import { listConnectors } from "@/lib/connectors";

const all = listConnectors();
console.log("Available connectors:", all.length);
// Output: Available connectors: 24 (all COMPOSIO_APPS)

all.forEach((c) => {
  console.log(`- ${c.name} (${c.id})`);
});
```

### Search connectors

```typescript
import { searchConnectors } from "@/lib/connectors";

const emailConnectors = searchConnectors("mail");
// Returns: Gmail, Outlook

const projectTools = searchConnectors("project");
// Returns: Asana, Trello, Linear, Notion
```

### List by provider

```typescript
import { listConnectorsByProvider } from "@/lib/connectors";

const composioApps = listConnectorsByProvider("composio");
console.log(`Composio apps: ${composioApps.length}`);
```

---

## Complete Example: Send Email Tool

```typescript
import { getConnector } from "@/lib/connectors";
import { ConnectorError } from "@/lib/errors";

export async function sendEmailTool(
  userId: string,
  input: {
    to: string;
    subject: string;
    body: string;
  }
) {
  const gmail = getConnector("gmail");

  // 1. Check authentication
  const isAuth = await gmail.isAuthenticated(userId);
  if (!isAuth) {
    throw ConnectorError.connectionNotFound("gmail", userId, "Gmail");
  }

  // 2. Execute tool
  try {
    const result = await gmail.executeTool(
      "GMAIL_SEND_EMAIL",
      {
        to: input.to,
        subject: input.subject,
        body: input.body,
      },
      userId
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    if (error instanceof ConnectorError) {
      // Handle rate limiting
      if (error.code === "CONNECTOR_ERROR" && error.context.action === "rate_limited") {
        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return sendEmailTool(userId, input); // Retry
      }
    }

    throw error;
  }
}
```

---

## Migration from Custom Integrations

### Before (Custom Gmail)

```typescript
// src/lib/integrations/google.ts
import { google } from "googleapis";

export async function sendGmailEmail(userId: string, data: EmailData) {
  // 1. Fetch credential (20 lines)
  const cred = await prisma.credential.findFirst({ ... });

  // 2. Decrypt token (5 lines)
  const token = decrypt(cred.value);

  // 3. Refresh if expired (30 lines)
  if (isExpired(token)) { ... }

  // 4. Initialize Gmail client (10 lines)
  const auth = new google.auth.OAuth2(...);
  auth.setCredentials(token);
  const gmail = google.gmail({ version: 'v1', auth });

  // 5. Send email (15 lines)
  const result = await gmail.users.messages.send({ ... });

  // 6. Handle errors (20 lines)
  // ...

  return result;
}
```

**Total: ~100 lignes par intégration**

### After (BaseConnector)

```typescript
import { getConnector } from "@/lib/connectors";

export async function sendGmailEmail(userId: string, data: EmailData) {
  const gmail = getConnector("gmail");

  const result = await gmail.executeTool("GMAIL_SEND_EMAIL", data, userId);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
}
```

**Total: ~10 lignes**

**Reduction: 90% less code**

---

## Error Handling

### ConnectorError types

```typescript
import { ConnectorError } from "@/lib/errors";

try {
  await connector.executeTool(toolName, input, userId);
} catch (error) {
  if (error instanceof ConnectorError) {
    switch (error.code) {
      case "CONNECTOR_ERROR":
        if (error.context.action === "rate_limited") {
          // Rate limit hit, wait and retry
          await wait(error.context.retryAfter * 1000);
        } else if (error.context.action === "authenticate") {
          // Auth failed, reconnect
          await connector.getAuthUrl(userId, redirectUrl);
        }
        break;
    }
  }
}
```

### Automatic retry with exponential backoff

```typescript
async function executeToolWithRetry(
  connector: BaseConnector,
  toolName: string,
  input: Record<string, unknown>,
  userId: string,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await connector.executeTool(toolName, input, userId);
    } catch (error) {
      if (error instanceof ConnectorError && error.isRetryable) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
}
```

---

## Available Composio Apps (24 total)

### Email & Calendar
- **gmail** - Gmail
- **outlook** - Outlook
- **googleCalendar** - Google Calendar

### Communication
- **slack** - Slack
- **discord** - Discord
- **teams** - Microsoft Teams

### Project Management
- **notion** - Notion
- **asana** - Asana
- **trello** - Trello
- **linear** - Linear

### Dev Tools
- **github** - GitHub
- **gitlab** - GitLab
- **jira** - Jira

### CRM
- **hubspot** - HubSpot
- **salesforce** - Salesforce
- **pipedrive** - Pipedrive

### Support
- **zendesk** - Zendesk
- **freshdesk** - Freshdesk
- **intercom** - Intercom

### Storage
- **googleDrive** - Google Drive
- **dropbox** - Dropbox
- **onedrive** - OneDrive

---

## Next Steps

1. **Add custom connector**: Extend `BaseConnector` for specific needs
2. **Add Pipedream**: Support 2800+ more APIs
3. **Add caching**: Cache tool lists, auth status
4. **Add webhooks**: Listen to events from connected apps
