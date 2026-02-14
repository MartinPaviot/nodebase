/**
 * Campaign module — Agent-native cold email outreach.
 *
 * Re-exports every public function from the campaign sub-modules.
 */

// Engine — core orchestration
export {
  getNextLeadsToContact,
  selectMailbox,
  selectMailboxForLead,
  calculateNextSendAt,
  selectVariant,
  updateLeadAfterSend,
  incrementMailboxDailyCount,
} from "./engine";

export type {
  CampaignStep,
  CampaignStepVariant,
  SendingSchedule,
  GeneratedEmail,
} from "./engine";

// Prompt builder
export { buildEmailPrompt } from "./agent-email-prompt";
export type { BuildEmailPromptParams, LeadContext } from "./agent-email-prompt";

// Reply handler
export { classifyReply, extractReplyMetadata } from "./reply-handler";
export type { ReplyMetadata } from "./reply-handler";

// Style learner
export { captureStyleCorrection, getStyleSamples } from "./style-learner";
