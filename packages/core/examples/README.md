# @elevay/core - Examples

This directory contains examples demonstrating how to use the Elevay core system.

## Prerequisites

1. **API Keys** - You'll need:
   - `COMPOSIO_API_KEY` - Get from [Composio](https://composio.dev) (free tier available)
   - `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com)

2. **Environment Variables**:
   ```bash
   # Create a .env file in the root of the monorepo
   COMPOSIO_API_KEY=your_composio_key_here
   ANTHROPIC_API_KEY=your_anthropic_key_here
   ```

## Examples

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates the complete initialization and usage of both ScanEngine and AgentEngine.

**Run:**
```bash
# From the monorepo root
pnpm --filter @elevay/core tsx examples/basic-usage.ts
```

**What it does:**
- Initializes the system with dependency injection
- Runs a SALES scan to detect dormant deals and stale leads
- Executes an agent that analyzes open deals
- Shows eval results (L1/L2/L3)
- Logs cost and token usage

**Expected output:**
```
=== Elevay Core - Basic Usage Example ===

✓ Composio initialized
✓ AIClient initialized

=== Running Scan Engine Example ===

✓ Scan completed for SALES
  Workspace: workspace_demo
  Signals detected: 0
  Scanned at: 2026-02-10T...

=== Running Agent Engine Example ===

[Agent agent_demo_001] Starting execution for user user_demo
✓ Agent execution completed
  Run ID: run_abc123
  Status: pending_review
  Model: claude-3-5-sonnet-20241022
  Tokens: 250 in / 100 out
  Cost: $0.0023
  Latency: 1250ms

  Eval Results:
    L1 Passed: true
    L2 Score: 75/100
    L3 Triggered: false

[Agent agent_demo_001] Execution completed:
  Model: claude-3-5-sonnet-20241022
  Tokens: 250 in / 100 out
  Cost: $0.0023
  Latency: 1250ms
  Status: pending_review
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Your Application                     │
│  (Next.js, Express, CLI, etc.)                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ├─── initElevayCore()
                          │
         ┌────────────────┴────────────────┐
         │                                 │
    ┌────▼─────┐                     ┌────▼──────┐
    │  Scan    │                     │  Agent    │
    │  Engine  │                     │  Engine   │
    └────┬─────┘                     └────┬──────┘
         │                                │
         ├─── Composio ◄─────────────────┤
         │                                │
         └─────────────────────────────── AIClient
```

## Dependency Injection

The system uses constructor-based dependency injection:

```typescript
// Manual initialization (for advanced use cases)
import { ScanEngine, AgentEngine } from "@elevay/core";
import { initComposio, getConnectorRegistry } from "@elevay/connectors";
import { AIClient } from "@elevay/ai";

const composio = initComposio({ apiKey: "..." });
const registry = getConnectorRegistry();
const aiClient = new AIClient({ apiKey: "..." });

const scanEngine = new ScanEngine(
  { maxConcurrentScans: 5 },
  { composioClient: composio, connectorRegistry: registry }
);

const agentEngine = new AgentEngine({
  composioClient: composio,
  connectorRegistry: registry,
  aiClient: aiClient,
});
```

Or use the convenience factory:

```typescript
// Simple initialization (recommended)
import { initElevayCore } from "@elevay/core";

const { scanEngine, agentEngine } = await initElevayCore({
  composioApiKey: process.env.COMPOSIO_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});
```

## Testing Without API Keys

If you don't have API keys yet, the system will fall back to mock implementations:

```typescript
// Initialize without API keys (uses mocks)
const { scanEngine, agentEngine } = await initElevayCore({});

// Engines will work but return mock data
const result = await scanEngine.scan("SALES", context);
// Returns empty signals array

const agentResult = await agentEngine.execute(config, context);
// Returns mock LLM response
```

## Next Steps

1. **Connect OAuth** - Use Composio to connect real accounts (Gmail, HubSpot, etc.)
2. **Run Real Scans** - Execute scans against production data
3. **Deploy Agents** - Set up agents with triggers (cron, webhooks)
4. **Monitor Costs** - Track LLM usage and costs via lifecycle hooks

## Troubleshooting

**Issue:** "Composio client not initialized"
- **Solution:** Make sure `COMPOSIO_API_KEY` is set in `.env`

**Issue:** "AIClient not initialized"
- **Solution:** Make sure `ANTHROPIC_API_KEY` is set in `.env`

**Issue:** "Module not found: @elevay/connectors"
- **Solution:** Run `pnpm install` from the monorepo root

**Issue:** "Permission denied" errors
- **Solution:** OAuth flow not completed. Use Composio's `initiateConnection()` first.

## Documentation

- [Composio Docs](https://docs.composio.dev)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Elevay Architecture](.claude/integration_improvements.md)
