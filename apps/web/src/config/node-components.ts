import { InitialNode } from "@/components/initial-node";
import { AnthropicNode } from "@/features/executions/components/anthropic/node";
import { DiscordNode } from "@/features/executions/components/discord/node";
import { GeminiNode } from "@/features/executions/components/gemini/node";
import { HttpRequestNode } from "@/features/executions/components/http-request/node";
import { OpenAiNode } from "@/features/executions/components/openai/node";
import { SlackNode } from "@/features/executions/components/slack/node";
import { CalendarTriggerNode } from "@/features/executions/components/calendar-trigger/node";
import { ConditionNode } from "@/features/executions/components/condition/node";
import { MeetingRecorderNode } from "@/features/executions/components/meeting-recorder/node";
import { GoogleDocsNode } from "@/features/executions/components/google-docs/node";
import { GmailNode } from "@/features/executions/components/gmail/node";
import { GoogleFormTrigger } from "@/features/triggers/components/google-form-trigger/node";
import { ManualTriggerNode } from "@/features/triggers/components/manual-trigger/node";
import { StripeTriggerNode } from "@/features/triggers/components/stripe-trigger/node";
import { NodeType } from "@prisma/client"
import type { NodeTypes } from "@xyflow/react"

export const nodeComponents = {
    [NodeType.INITIAL] : InitialNode,
    [NodeType.HTTP_REQUEST]: HttpRequestNode,
    [NodeType.MANUAL_TRIGGER] : ManualTriggerNode,
    [NodeType.GOOGLE_FORM_TRIGGER] : GoogleFormTrigger,
    [NodeType.STRIPE_TRIGGER] : StripeTriggerNode,
    [NodeType.CALENDAR_TRIGGER] : CalendarTriggerNode,
    [NodeType.GEMINI] : GeminiNode,
    [NodeType.OPENAI] : OpenAiNode,
    [NodeType.ANTHROPIC] : AnthropicNode,
    [NodeType.DISCORD] : DiscordNode,
    [NodeType.SLACK] : SlackNode,
    [NodeType.CONDITION] : ConditionNode,
    [NodeType.MEETING_RECORDER] : MeetingRecorderNode,
    [NodeType.GOOGLE_DOCS] : GoogleDocsNode,
    [NodeType.GMAIL] : GmailNode,
} as const satisfies NodeTypes;

export type RegisteredNodeType = keyof typeof nodeComponents;