import {
  ConfidentialClientApplication,
  Configuration,
  AuthorizationUrlRequest,
  AuthorizationCodeRequest,
} from "@azure/msal-node";
import prisma from "@/lib/db";
import type { IntegrationType } from "@/generated/prisma";

// Microsoft Graph API scopes for each integration type
export const MICROSOFT_SCOPES: Record<string, string[]> = {
  OUTLOOK: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "Mail.Read",
    "Mail.Send",
    "Mail.ReadWrite",
  ],
  OUTLOOK_CALENDAR: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "Calendars.Read",
    "Calendars.ReadWrite",
  ],
  MICROSOFT_TEAMS: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "Chat.Read",
    "Chat.ReadWrite",
    "ChannelMessage.Read.All",
    "ChannelMessage.Send",
    "Team.ReadBasic.All",
  ],
};

// MSAL configuration
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/common`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  },
};

// Create MSAL client
function getMsalClient() {
  return new ConfidentialClientApplication(msalConfig);
}

// Get Microsoft auth URL for user to authenticate
export function getMicrosoftAuthUrl(
  userId: string,
  integrationType: string
): string {
  const msalClient = getMsalClient();
  const scopes = MICROSOFT_SCOPES[integrationType];

  if (!scopes) {
    throw new Error(`Invalid integration type: ${integrationType}`);
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`;

  const authCodeUrlParameters: AuthorizationUrlRequest = {
    scopes,
    redirectUri,
    state: `${userId}:${integrationType}`,
  };

  // Generate URL synchronously by building it manually
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scopes.join(" "),
    state: authCodeUrlParameters.state!,
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

// Get Microsoft auth URL async (with MSAL)
export async function getMicrosoftAuthUrlAsync(
  userId: string,
  integrationType: string
): Promise<string> {
  const msalClient = getMsalClient();
  const scopes = MICROSOFT_SCOPES[integrationType];

  if (!scopes) {
    throw new Error(`Invalid integration type: ${integrationType}`);
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`;

  const authCodeUrlParameters: AuthorizationUrlRequest = {
    scopes,
    redirectUri,
    state: `${userId}:${integrationType}`,
  };

  return await msalClient.getAuthCodeUrl(authCodeUrlParameters);
}

// Exchange authorization code for tokens
export async function exchangeMicrosoftCode(
  code: string,
  integrationType: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  email?: string;
  name?: string;
}> {
  const msalClient = getMsalClient();
  const scopes = MICROSOFT_SCOPES[integrationType];

  if (!scopes) {
    throw new Error(`Invalid integration type: ${integrationType}`);
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`;

  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes,
    redirectUri,
  };

  const response = await msalClient.acquireTokenByCode(tokenRequest);

  return {
    accessToken: response.accessToken,
    expiresAt: response.expiresOn ? new Date(response.expiresOn) : undefined,
    email: response.account?.username,
    name: response.account?.name,
  };
}

// Get Microsoft integration for a user
export async function getMicrosoftIntegration(
  userId: string,
  type: IntegrationType
) {
  return prisma.integration.findUnique({
    where: {
      userId_type: {
        userId,
        type,
      },
    },
  });
}

// Refresh Microsoft tokens using refresh token
export async function refreshMicrosoftTokens(
  userId: string,
  type: IntegrationType
) {
  const integration = await getMicrosoftIntegration(userId, type);

  if (!integration?.refreshToken) {
    throw new Error("No refresh token available");
  }

  const scopes = MICROSOFT_SCOPES[type];
  if (!scopes) {
    throw new Error(`Invalid integration type: ${type}`);
  }

  // Use refresh token to get new access token
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: integration.refreshToken,
      grant_type: "refresh_token",
      scope: scopes.join(" "),
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  // Update tokens in database
  await prisma.integration.update({
    where: {
      userId_type: {
        userId,
        type,
      },
    },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || integration.refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
    },
  });

  return data.access_token;
}

// Get a valid access token (refreshes if needed)
export async function getMicrosoftAccessToken(
  userId: string,
  type: IntegrationType
): Promise<string> {
  const integration = await getMicrosoftIntegration(userId, type);

  if (!integration) {
    throw new Error(`No ${type} integration found`);
  }

  // Check if token is expired
  if (integration.expiresAt && integration.expiresAt < new Date()) {
    return await refreshMicrosoftTokens(userId, type);
  }

  return integration.accessToken;
}

// Microsoft Graph API helper
export async function callMicrosoftGraphAPI<T = unknown>(
  userId: string,
  type: IntegrationType,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getMicrosoftAccessToken(userId, type);

  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Microsoft Graph API error");
  }

  return response.json();
}

// Outlook specific functions
export async function sendOutlookEmail(
  userId: string,
  to: string[],
  subject: string,
  body: string,
  isHtml = false
) {
  return callMicrosoftGraphAPI(userId, "OUTLOOK", "/me/sendMail", {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: isHtml ? "HTML" : "Text",
          content: body,
        },
        toRecipients: to.map((email) => ({
          emailAddress: { address: email },
        })),
      },
    }),
  });
}

export async function getOutlookEmails(
  userId: string,
  options: { top?: number; filter?: string } = {}
) {
  const params = new URLSearchParams();
  if (options.top) params.set("$top", options.top.toString());
  if (options.filter) params.set("$filter", options.filter);

  const query = params.toString() ? `?${params.toString()}` : "";
  return callMicrosoftGraphAPI(userId, "OUTLOOK", `/me/messages${query}`);
}

// Calendar specific functions
export async function getOutlookCalendarEvents(
  userId: string,
  options: { top?: number; startDateTime?: string; endDateTime?: string } = {}
) {
  const params = new URLSearchParams();
  if (options.top) params.set("$top", options.top.toString());
  if (options.startDateTime && options.endDateTime) {
    params.set(
      "$filter",
      `start/dateTime ge '${options.startDateTime}' and end/dateTime le '${options.endDateTime}'`
    );
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  return callMicrosoftGraphAPI(userId, "OUTLOOK_CALENDAR", `/me/events${query}`);
}

export async function createOutlookCalendarEvent(
  userId: string,
  event: {
    subject: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    body?: { contentType: string; content: string };
    attendees?: Array<{ emailAddress: { address: string; name?: string } }>;
  }
) {
  return callMicrosoftGraphAPI(userId, "OUTLOOK_CALENDAR", "/me/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

// Teams specific functions
export async function getTeamsChats(userId: string) {
  return callMicrosoftGraphAPI(userId, "MICROSOFT_TEAMS", "/me/chats");
}

export async function sendTeamsMessage(
  userId: string,
  chatId: string,
  message: string
) {
  return callMicrosoftGraphAPI(
    userId,
    "MICROSOFT_TEAMS",
    `/me/chats/${chatId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        body: {
          content: message,
        },
      }),
    }
  );
}

export async function getTeams(userId: string) {
  return callMicrosoftGraphAPI(userId, "MICROSOFT_TEAMS", "/me/joinedTeams");
}

export async function getTeamChannels(userId: string, teamId: string) {
  return callMicrosoftGraphAPI(
    userId,
    "MICROSOFT_TEAMS",
    `/teams/${teamId}/channels`
  );
}
