/**
 * Basic Usage Example
 *
 * Demonstrates how to initialize and use the Elevay core system.
 */

import { initElevayCore, getDefaultAgentHooks } from "../src/factory";
import type { AgentConfig, ExecutionContext } from "../src/agent-engine";

async function main() {
  console.log("=== Elevay Core - Basic Usage Example ===\n");

  // 1. Initialize the system with API keys
  const { scanEngine, agentEngine, dependencies } = await initElevayCore({
    composioApiKey: process.env.COMPOSIO_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    scanEngineConfig: {
      maxConcurrentScans: 5,
      timeoutMs: 30000,
    },
  });

  // 2. Register lifecycle hooks for the agent engine
  const hooks = getDefaultAgentHooks();
  agentEngine.onBefore(hooks.loggingHook);
  agentEngine.onAfter(hooks.costTrackingHook);
  agentEngine.onError(hooks.errorLoggingHook);

  console.log("\n=== Running Scan Engine Example ===\n");

  // 3. Run a scan for the SALES category
  try {
    const scanContext = {
      workspaceId: "workspace_demo",
      credentials: new Map([
        ["hubspot", { accessToken: "demo_token" }],
        ["salesforce", { accessToken: "demo_token" }],
      ]),
    };

    const scanResult = await scanEngine.scan("SALES", scanContext);

    console.log(`✓ Scan completed for ${scanResult.category}`);
    console.log(`  Workspace: ${scanResult.workspaceId}`);
    console.log(`  Signals detected: ${scanResult.signals.length}`);
    console.log(`  Scanned at: ${scanResult.scannedAt.toISOString()}`);

    // Show critical signals
    const criticalSignals = scanResult.signals.filter(
      (s) => s.severity === "critical" || s.severity === "high"
    );
    if (criticalSignals.length > 0) {
      console.log(`\n  Critical/High signals (${criticalSignals.length}):`);
      criticalSignals.forEach((signal) => {
        console.log(`    - [${signal.severity.toUpperCase()}] ${signal.title}`);
      });
    }
  } catch (error) {
    console.error(
      "✗ Scan failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  console.log("\n=== Running Agent Engine Example ===\n");

  // 4. Run an agent
  try {
    const agentConfig: AgentConfig = {
      id: "agent_demo_001",
      name: "Demo Agent",
      systemPrompt:
        "You are a helpful assistant that processes data and responds professionally.",
      llmTier: "smart", // Use Claude Sonnet
      temperature: 0.7,
      maxStepsPerRun: 5,
      fetchSources: [
        {
          source: "hubspot",
          query: "search_deals",
          filters: { status: "open" },
        },
      ],
      actions: [
        {
          type: "draft_email",
          requireApproval: true,
        },
      ],
      evalRules: {
        l1: {
          assertions: [
            { check: "contains_recipient_name", severity: "block" },
            { check: "no_placeholders", severity: "block" },
          ],
        },
        l2: {
          criteria: ["professional_tone", "clarity", "conciseness"],
          minScore: 60,
        },
        l3: {
          trigger: "on_irreversible_action",
          minConfidence: 0.7,
        },
        requireApproval: true,
        autoSendThreshold: 0.85,
      },
    };

    const executionContext: ExecutionContext = {
      agentId: "agent_demo_001",
      userId: "user_demo",
      workspaceId: "workspace_demo",
      triggeredBy: "manual",
      userMessage: "Analyze the open deals and suggest next actions.",
    };

    const result = await agentEngine.execute(agentConfig, executionContext);

    console.log(`✓ Agent execution completed`);
    console.log(`  Run ID: ${result.runId}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Output type: ${result.output.type}`);
    console.log(`  Model: ${result.llmUsage.model}`);
    console.log(
      `  Tokens: ${result.llmUsage.tokensIn} in / ${result.llmUsage.tokensOut} out`
    );
    console.log(`  Cost: $${result.llmUsage.cost.toFixed(4)}`);
    console.log(`  Latency: ${result.llmUsage.latencyMs}ms`);
    console.log(
      `\n  Eval Results:\n    L1 Passed: ${result.evalResult.l1Passed}\n    L2 Score: ${result.evalResult.l2Score}/100\n    L3 Triggered: ${result.evalResult.l3Triggered}`
    );
    console.log(`\n  Output:\n    ${result.output.content.substring(0, 200)}...`);
  } catch (error) {
    console.error(
      "✗ Agent execution failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  console.log("\n=== Example Complete ===\n");
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
