"use strict";
/**
 * Intent Analyzer - Natural Language → Structured Agent Intent
 * Uses Claude to parse user descriptions and extract agent specifications
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentAnalyzer = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const zod_1 = require("zod");
const anthropic = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});
// Zod schema for validating LLM output
const AgentIntentSchema = zod_1.z.object({
    agentName: zod_1.z.string(),
    purpose: zod_1.z.string(),
    capabilities: zod_1.z.array(zod_1.z.string()),
    category: zod_1.z.enum([
        'SALES',
        'SUPPORT',
        'MARKETING',
        'HR',
        'FINANCE',
        'OPERATIONS',
        'RESEARCH',
        'PRODUCTIVITY',
    ]),
    dataSources: zod_1.z.array(zod_1.z.string()),
    outputFormat: zod_1.z.string(),
    triggers: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['schedule', 'webhook', 'email', 'chat', 'manual']),
        config: zod_1.z.record(zod_1.z.any()).optional(),
        description: zod_1.z.string(),
    })),
    tone: zod_1.z.enum(['professional', 'casual', 'friendly', 'formal']).optional(),
    language: zod_1.z.string().optional(),
});
class IntentAnalyzer {
    /**
     * Analyze user description and extract structured agent intent
     */
    async analyzeIntent(description, requirements) {
        console.log(`[IntentAnalyzer] Analyzing intent for: "${description.slice(0, 100)}..."`);
        const prompt = this.buildAnalysisPrompt(description, requirements);
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            temperature: 0.3,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });
        const content = message.content[0];
        if (content.type !== 'text') {
            throw new Error('Expected text response from Claude');
        }
        // Parse JSON from LLM response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error(`Failed to extract JSON from LLM response: ${content.text}`);
        }
        const rawIntent = JSON.parse(jsonMatch[0]);
        const validatedIntent = AgentIntentSchema.parse(rawIntent);
        console.log(`[IntentAnalyzer] Detected category: ${validatedIntent.category}`);
        console.log(`[IntentAnalyzer] Detected ${validatedIntent.dataSources.length} data sources`);
        return validatedIntent;
    }
    /**
     * Build the analysis prompt for Claude
     */
    buildAnalysisPrompt(description, requirements) {
        const requirementsText = requirements && requirements.length > 0
            ? `\nAdditional requirements:\n${requirements.map((r) => `- ${r}`).join('\n')}`
            : '';
        return `Analyze this agent description and extract structured information.

Description: "${description}"
${requirementsText}

Extract:
1. **Agent name** (short, descriptive, 2-4 words)
2. **Core purpose** (1-2 sentences explaining what this agent does)
3. **Key capabilities** needed (list of 3-5 specific things the agent must be able to do)
4. **Category** (exactly one of: SALES, SUPPORT, MARKETING, HR, FINANCE, OPERATIONS, RESEARCH, PRODUCTIVITY)
5. **Required data sources** (from: crm, email, calendar, documents, spreadsheets, support_tickets, tasks, meetings, slack, notion)
6. **Output format** (from: email, report, notification, task, summary, chat_response, form_submission)
7. **Triggers** (when should this agent run? Options: schedule/cron, webhook, email, chat, manual)
8. **Tone** (professional, casual, friendly, or formal)
9. **Language** (if specified, otherwise "en")

Respond with JSON matching this exact structure:
{
  "agentName": "...",
  "purpose": "...",
  "capabilities": ["...", "...", "..."],
  "category": "...",
  "dataSources": ["...", "..."],
  "outputFormat": "...",
  "triggers": [
    {
      "type": "schedule",
      "config": { "cron": "0 9 * * *" },
      "description": "Daily at 9am"
    }
  ],
  "tone": "professional",
  "language": "en"
}

Rules:
- Category must be EXACTLY one of the 8 options (SALES, SUPPORT, etc.)
- Data sources must be from the predefined list
- Output format must be from the predefined list
- Triggers should be realistic and match the agent's purpose
- If the description is vague, make reasonable assumptions

Respond with ONLY the JSON object, no additional text.`;
    }
    /**
     * Suggest tools based on detected intent
     */
    suggestTools(intent) {
        const tools = [];
        // Map data sources to tool types
        if (intent.dataSources.includes('crm')) {
            tools.push('hubspot_search', 'hubspot_update');
        }
        if (intent.dataSources.includes('email')) {
            tools.push('gmail_search', 'gmail_send');
        }
        if (intent.dataSources.includes('calendar')) {
            tools.push('calendar_search', 'calendar_create');
        }
        if (intent.dataSources.includes('documents')) {
            tools.push('knowledge_base_search');
        }
        if (intent.dataSources.includes('spreadsheets')) {
            tools.push('sheets_read', 'sheets_write');
        }
        if (intent.dataSources.includes('support_tickets')) {
            tools.push('zendesk_search', 'zendesk_update');
        }
        if (intent.dataSources.includes('tasks')) {
            tools.push('asana_search', 'asana_create');
        }
        if (intent.dataSources.includes('slack')) {
            tools.push('slack_send', 'slack_search');
        }
        if (intent.dataSources.includes('notion')) {
            tools.push('notion_search', 'notion_create');
        }
        // Always add memory tool
        tools.push('memory_store', 'memory_retrieve');
        // Category-specific tools
        if (intent.category === 'SALES' || intent.category === 'SUPPORT') {
            tools.push('sentiment_analysis');
        }
        if (intent.category === 'RESEARCH') {
            tools.push('web_search', 'web_scrape');
        }
        return Array.from(new Set(tools)); // Deduplicate
    }
    /**
     * Map category to default model tier
     */
    getRecommendedModelTier(intent) {
        // Complex tasks need smarter models
        if (intent.category === 'RESEARCH' ||
            intent.category === 'HR' ||
            intent.capabilities.length > 5) {
            return 'sonnet';
        }
        // Simple notification/task agents can use Haiku
        if (intent.outputFormat === 'notification' ||
            intent.outputFormat === 'task' ||
            (intent.capabilities.length <= 2 && !intent.dataSources.includes('crm'))) {
            return 'haiku';
        }
        // Default to Sonnet
        return 'sonnet';
    }
}
exports.IntentAnalyzer = IntentAnalyzer;
