import { NodeType } from "@prisma/client";
import { NodeExecutor } from "../types";
import { manualTriggerExecutor } from "@/features/triggers/components/manual-trigger/executor";
import { httpRequestExecutor } from "../components/http-request/executor";
import { GoogleFormTriggerExecutor } from "@/features/triggers/components/google-form-trigger/executor";
import { stripeTriggerExecutor } from "@/features/triggers/components/stripe-trigger/executor";
import { geminiExecutor } from "../components/gemini/executor";
import { openAiExecutor } from "../components/openai/executor";
import { anthropicExecutor } from "../components/anthropic/executor";
import { discordExecutor } from "../components/discord/executor";
import { slackExecutor } from "../components/slack/executor";
import { slackDMExecutor } from "../components/slack-dm/executor";
import { calendarTriggerExecutor } from "../components/calendar-trigger/executor";
import { conditionExecutor } from "../components/condition/executor";
import { meetingRecorderExecutor } from "../components/meeting-recorder/executor";
import { googleDocsExecutor } from "../components/google-docs/executor";
import { gmailExecutor } from "../components/gmail/executor";

export const executorRegistry: Record<NodeType, NodeExecutor> = {
    [NodeType.MANUAL_TRIGGER]: manualTriggerExecutor,
    [NodeType.INITIAL]: manualTriggerExecutor,
    [NodeType.HTTP_REQUEST]: httpRequestExecutor,
    [NodeType.GOOGLE_FORM_TRIGGER]: GoogleFormTriggerExecutor,
    [NodeType.STRIPE_TRIGGER]: stripeTriggerExecutor,
    [NodeType.GEMINI]: geminiExecutor,
    [NodeType.ANTHROPIC]: anthropicExecutor,
    [NodeType.OPENAI]: openAiExecutor,
    [NodeType.DISCORD]: discordExecutor,
    [NodeType.SLACK]: async (params) => {
        // Route to DM executor if target is user_dm
        const data = params.data as Record<string, unknown>;
        if (data.target === "user_dm") {
            return slackDMExecutor(params);
        }
        return slackExecutor(params);
    },
    [NodeType.CALENDAR_TRIGGER]: calendarTriggerExecutor,
    [NodeType.CONDITION]: conditionExecutor as NodeExecutor,
    [NodeType.MEETING_RECORDER]: meetingRecorderExecutor,
    [NodeType.GOOGLE_DOCS]: googleDocsExecutor,
    [NodeType.GMAIL]: gmailExecutor,
};

export const getExecutor = (type: NodeType): NodeExecutor => {
    const executor = executorRegistry[type];
    if (!executor) {
        throw new Error(`No executor found for node type: ${type}`);
    }

    return executor;
};