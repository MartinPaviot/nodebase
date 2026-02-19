/**
 * Integration Test Script
 *
 * Tests the Elevay core integration with the Next.js app.
 * Run with: pnpm --filter @elevay/web tsx scripts/test-integration.ts
 */

import { getElevayCore, getScanEngine, getAgentEngine } from "../src/lib/elevay";
import type { ScanCategory } from "@elevay/types";

async function main() {
  console.log("=== Elevay Integration Test ===\n");

  // Test 1: Initialize core
  console.log("[Test 1] Initializing Elevay core...");
  try {
    const core = await getElevayCore();
    console.log("✓ Core initialized successfully");
    console.log(`  Scan Engine: ${core.scanEngine ? "✓" : "✗"}`);
    console.log(`  Agent Engine: ${core.agentEngine ? "✓" : "✗"}`);
  } catch (error) {
    console.error("✗ Core initialization failed:", error);
    process.exit(1);
  }

  // Test 2: Run a scan
  console.log("\n[Test 2] Running SALES scan...");
  try {
    const scanEngine = await getScanEngine();
    const result = await scanEngine.scan("SALES" as ScanCategory, {
      workspaceId: "test_workspace",
      credentials: new Map([
        ["hubspot", { accessToken: "test_token" }],
      ]),
    });

    console.log("✓ Scan completed successfully");
    console.log(`  Category: ${result.category}`);
    console.log(`  Signals: ${result.signals.length}`);
    console.log(`  Scanned at: ${result.scannedAt.toISOString()}`);

    if (result.signals.length > 0) {
      console.log("\n  Sample signals:");
      result.signals.slice(0, 3).forEach((signal) => {
        console.log(`    - [${signal.severity}] ${signal.title}`);
      });
    } else {
      console.log("  (No signals detected - using mock data)");
    }
  } catch (error) {
    console.error("✗ Scan failed:", error);
  }

  // Test 3: Execute an agent
  console.log("\n[Test 3] Executing test agent...");
  try {
    const agentEngine = await getAgentEngine();
    const result = await agentEngine.execute(
      {
        id: "test_agent",
        name: "Test Agent",
        systemPrompt: "You are a helpful assistant that analyzes data.",
        llmTier: "smart",
        temperature: 0.7,
        maxStepsPerRun: 3,
        fetchSources: [
          {
            source: "hubspot",
            query: "search_deals",
            filters: { status: "open" },
          },
        ],
        actions: [{ type: "draft_email", requireApproval: true }],
        evalRules: {
          l1: {
            assertions: [
              { check: "no_placeholders", severity: "block" },
            ],
          },
          l2: {
            criteria: ["professional_tone", "clarity"],
            minScore: 60,
          },
          l3: {
            trigger: "on_irreversible_action",
            minConfidence: 0.7,
          },
          requireApproval: true,
          autoSendThreshold: 0.85,
        },
      },
      {
        agentId: "test_agent",
        userId: "test_user",
        workspaceId: "test_workspace",
        triggeredBy: "manual",
        userMessage: "Analyze the open deals.",
      }
    );

    console.log("✓ Agent execution completed successfully");
    console.log(`  Run ID: ${result.runId}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Model: ${result.llmUsage.model}`);
    console.log(`  Tokens: ${result.llmUsage.tokensIn} in / ${result.llmUsage.tokensOut} out`);
    console.log(`  Cost: $${result.llmUsage.cost.toFixed(4)}`);
    console.log(`  Latency: ${result.llmUsage.latencyMs}ms`);
    console.log(`\n  Eval Results:`);
    console.log(`    L1 Passed: ${result.evalResult.l1Passed}`);
    console.log(`    L2 Score: ${result.evalResult.l2Score}/100`);
    console.log(`    L3 Triggered: ${result.evalResult.l3Triggered}`);
    console.log(`\n  Output: ${result.output.content.substring(0, 150)}...`);
  } catch (error) {
    console.error("✗ Agent execution failed:", error);
  }

  console.log("\n=== Integration Test Complete ===\n");
}

// Run tests
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
