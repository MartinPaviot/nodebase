/**
 * Executor Registry
 *
 * Maps node types to their executor functions.
 * Pattern from features/executions/lib/executor-registry.ts.
 */

import type { NodeExecutorFn } from "../types";
import { executePassthrough } from "./passthrough";
import { executeAIAction } from "./ai-action";
import { executeConditionNode } from "./condition";
import { executeEnterLoop, executeExitLoop } from "./loop";
import { executeKnowledgeBaseSearch } from "./knowledge-base";
import {
  executeComposioAction,
  executeComposioFromIcon,
  executePeopleDataLabsViaComposio,
} from "./composio";
import { executeChatAgentNode } from "./chat-agent";
import {
  executeGmailNode,
  executeGoogleCalendarNode,
  executeGoogleSheetsNode,
  executeGoogleDriveNode,
  executeGoogleDocsNode,
  executeSlackNode,
  executeNotionNode,
  executeMicrosoftOutlookNode,
  executeMicrosoftCalendarNode,
  executeMicrosoftTeamsNode,
} from "./integrations";

const registry: Record<string, NodeExecutorFn> = {
  // Passthrough / structural
  messageReceived: executePassthrough,
  trigger: executePassthrough,
  webhookTrigger: executePassthrough,
  chatOutcome: executePassthrough,
  conditionBranch: executePassthrough,
  addNode: executePassthrough,
  selectAction: executePassthrough,
  loop: executePassthrough,
  loopContainer: executePassthrough,

  // Logic
  condition: executeConditionNode,
  enterLoop: executeEnterLoop,
  exitLoop: executeExitLoop,

  // AI
  action: executeActionDispatch,
  agentStep: executeAIAction,

  // Knowledge
  searchKnowledgeBase: executeKnowledgeBaseSearch,

  // Integrations — Google
  sendEmail: executeGmailNode,
  gmail: executeGmailNode,
  googleCalendar: executeGoogleCalendarNode,
  googleSheets: executeGoogleSheetsNode,
  googleDrive: executeGoogleDriveNode,
  googleDocs: executeGoogleDocsNode,

  // Integrations — Slack/Notion
  slack: executeSlackNode,
  notion: executeNotionNode,

  // Integrations — Microsoft
  outlook: executeMicrosoftOutlookNode,
  outlookCalendar: executeMicrosoftCalendarNode,
  microsoftTeams: executeMicrosoftTeamsNode,

  // Chat agent — sends/observes messages via AI
  chatAgent: executeChatAgentNode,

  // Composio — 800+ integrations via Composio SDK
  composioAction: executeComposioAction,

  // People Data Labs — routed via Composio
  peopleDataLabs: executePeopleDataLabsViaComposio,
};

/**
 * Action node dispatch: check if it's an AI action or non-AI (icon-based).
 * AI actions go to Claude, non-AI icons route via Composio.
 */
async function executeActionDispatch(ctx: import("../types").NodeExecContext): Promise<import("../types").NodeExecResult> {
  const icon = ctx.node.data?.icon as string;
  // AI action: icon is "ai" or undefined
  if (icon === "ai" || !icon) {
    return executeAIAction(ctx);
  }
  // Non-AI action icons (perplexity, google, youtube, etc.) — route via Composio
  return executeComposioFromIcon(ctx);
}

export function getFlowNodeExecutor(nodeType: string): NodeExecutorFn {
  return registry[nodeType] ?? executePassthrough;
}
