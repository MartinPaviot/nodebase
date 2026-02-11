"use strict";
/**
 * Enhanced Agent Builder (Phase 4)
 * Build complete agents from natural language descriptions
 * Inspired by LangChain Agent Builder
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentBuilder = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const intent_analyzer_1 = require("./intent-analyzer");
const agent_tester_1 = require("./agent-tester");
const types_1 = require("./types");
const anthropic = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});
class AgentBuilder {
    intentAnalyzer;
    agentTester;
    constructor() {
        this.intentAnalyzer = new intent_analyzer_1.IntentAnalyzer();
        this.agentTester = new agent_tester_1.AgentTester();
    }
    /**
     * Build a complete agent from natural language description
     */
    async buildAgent(request) {
        console.log(`[AgentBuilder] Building agent: "${request.description.slice(0, 100)}..."`);
        // 1. Analyze intent
        const intent = await this.intentAnalyzer.analyzeIntent(request.description, request.requirements);
        // 2. Determine tools
        const tools = this.selectTools(intent, request.integrations);
        // 3. Generate system prompt
        const systemPrompt = await this.generatePrompt(intent, tools);
        // 4. Configure evaluation rules
        const evalRules = this.configureEvalRules(intent);
        // 5. Determine actions
        const actions = this.determineActions(intent);
        // 6. Select model
        const model = this.selectModel(intent);
        // 7. Test on sample inputs (if provided)
        let testResults = null;
        if (request.sampleInputs && request.expectedOutputs) {
            testResults = await this.agentTester.testAgent({
                systemPrompt,
                model,
                temperature: this.getTemperature(intent),
            }, request.sampleInputs, request.expectedOutputs);
            // 8. Refine if tests fail
            if (testResults.passRate < 0.7) {
                console.log(`[AgentBuilder] Pass rate ${(testResults.passRate * 100).toFixed(1)}% - refining prompt...`);
                const refinedPrompt = await this.agentTester.refineAgentPrompt(systemPrompt, testResults);
                // Re-test with refined prompt
                testResults = await this.agentTester.testAgent({
                    systemPrompt: refinedPrompt,
                    model,
                    temperature: this.getTemperature(intent),
                }, request.sampleInputs, request.expectedOutputs);
                return {
                    name: intent.agentName,
                    description: intent.purpose,
                    systemPrompt: refinedPrompt, // Use refined prompt
                    model,
                    temperature: this.getTemperature(intent),
                    tools,
                    integrations: this.getIntegrations(tools),
                    evalRules,
                    actions,
                    suggestedTriggers: intent.triggers,
                    testResults,
                };
            }
        }
        return {
            name: intent.agentName,
            description: intent.purpose,
            systemPrompt,
            model,
            temperature: this.getTemperature(intent),
            tools,
            integrations: this.getIntegrations(tools),
            evalRules,
            actions,
            suggestedTriggers: intent.triggers,
            testResults,
        };
    }
    /**
     * Select tools based on intent and suggested integrations
     */
    selectTools(intent, suggestedIntegrations) {
        const tools = [];
        // Get base tools from intent analyzer
        const toolTypes = this.intentAnalyzer.suggestTools(intent);
        // Convert tool types to Tool objects
        toolTypes.forEach((toolType) => {
            const tool = this.createToolConfig(toolType);
            if (tool)
                tools.push(tool);
        });
        // Add integration-specific tools
        if (suggestedIntegrations) {
            suggestedIntegrations.forEach((integration) => {
                const integrationTools = this.getIntegrationTools(integration);
                tools.push(...integrationTools);
            });
        }
        return tools;
    }
    /**
     * Create tool configuration from tool type
     */
    createToolConfig(toolType) {
        const toolConfigs = {
            hubspot_search: {
                type: 'hubspot',
                name: 'Search HubSpot',
                description: 'Search contacts, deals, and companies in HubSpot',
                config: { action: 'search' },
                integration: 'hubspot',
            },
            hubspot_update: {
                type: 'hubspot',
                name: 'Update HubSpot',
                description: 'Update records in HubSpot',
                config: { action: 'update' },
                integration: 'hubspot',
            },
            gmail_search: {
                type: 'gmail',
                name: 'Search Gmail',
                description: 'Search emails in Gmail',
                config: { action: 'search' },
                integration: 'gmail',
            },
            gmail_send: {
                type: 'gmail',
                name: 'Send Email',
                description: 'Send emails via Gmail',
                config: { action: 'send' },
                integration: 'gmail',
            },
            calendar_search: {
                type: 'calendar',
                name: 'Search Calendar',
                description: 'Search calendar events',
                config: { action: 'search' },
                integration: 'google_calendar',
            },
            calendar_create: {
                type: 'calendar',
                name: 'Create Calendar Event',
                description: 'Create calendar events',
                config: { action: 'create' },
                integration: 'google_calendar',
            },
            knowledge_base_search: {
                type: 'knowledge_base',
                name: 'Search Knowledge Base',
                description: 'Search internal knowledge base documents',
                config: { similarityThreshold: 0.7, maxResults: 5 },
            },
            memory_store: {
                type: 'memory',
                name: 'Store Memory',
                description: 'Store information for future reference',
                config: { category: 'general' },
            },
            memory_retrieve: {
                type: 'memory',
                name: 'Retrieve Memory',
                description: 'Retrieve stored information',
                config: { category: 'general' },
            },
            web_search: {
                type: 'web_search',
                name: 'Web Search',
                description: 'Search the web for information',
                config: {},
            },
            sentiment_analysis: {
                type: 'sentiment',
                name: 'Analyze Sentiment',
                description: 'Analyze sentiment of text',
                config: {},
            },
        };
        return toolConfigs[toolType] || null;
    }
    /**
     * Get tools for a specific integration
     */
    getIntegrationTools(integration) {
        const integrationMap = {
            hubspot: ['hubspot_search', 'hubspot_update'],
            salesforce: ['salesforce_search', 'salesforce_update'],
            gmail: ['gmail_search', 'gmail_send'],
            zendesk: ['zendesk_search', 'zendesk_update'],
            slack: ['slack_send', 'slack_search'],
            notion: ['notion_search', 'notion_create'],
        };
        const toolTypes = integrationMap[integration.toLowerCase()] || [];
        return toolTypes
            .map((type) => this.createToolConfig(type))
            .filter((tool) => tool !== null);
    }
    /**
     * Generate system prompt using Claude
     */
    async generatePrompt(intent, tools) {
        const prompt = `Generate a comprehensive system prompt for an AI agent with these specifications:

**Agent Details:**
- Name: ${intent.agentName}
- Purpose: ${intent.purpose}
- Category: ${intent.category}
- Capabilities: ${intent.capabilities.join(', ')}
- Available tools: ${tools.map((t) => t.name).join(', ')}
- Output format: ${intent.outputFormat}
- Tone: ${intent.tone || 'professional'}

**Instructions:**
The system prompt should:
1. Clearly define the agent's role and responsibilities
2. Explain when and how to use each tool
3. Specify output format requirements
4. Include quality guidelines (accuracy, completeness, tone)
5. Define boundaries (what NOT to do)
6. Be concise but comprehensive (200-400 words)

Generate the system prompt. Respond with ONLY the prompt text, no preamble.`;
        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            temperature: 0.7,
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
        console.log(`[AgentBuilder] Generated system prompt (${content.text.length} chars)`);
        return content.text.trim();
    }
    /**
     * Configure evaluation rules based on agent category and output type
     */
    configureEvalRules(intent) {
        const l1Assertions = [];
        const l2Criteria = [];
        // Category-specific L1 assertions
        if (intent.category === 'SALES' || intent.category === 'SUPPORT') {
            l1Assertions.push({ check: 'contains_recipient_name', severity: 'block' }, { check: 'professional_tone', severity: 'warn' });
        }
        // Output format-specific L1 assertions
        if (intent.outputFormat === 'email') {
            l1Assertions.push({ check: 'has_subject', severity: 'block' }, { check: 'has_greeting', severity: 'warn' }, { check: 'has_signature', severity: 'warn' }, { check: 'no_placeholders', severity: 'block' });
        }
        // Common L1 assertions
        l1Assertions.push({ check: 'no_hallucination_markers', severity: 'block' });
        // L2 criteria
        l2Criteria.push({ name: 'accuracy', description: 'Factual correctness', weight: 0.4 }, { name: 'completeness', description: 'Covers all required points', weight: 0.3 }, { name: 'relevance', description: 'Relevant to the request', weight: 0.2 }, { name: 'tone', description: 'Appropriate tone and style', weight: 0.1 });
        // Approval requirements based on output type
        const requireApproval = ['email', 'report', 'form_submission'].includes(intent.outputFormat);
        return {
            l1: { assertions: l1Assertions },
            l2: { criteria: l2Criteria, minScore: 60 },
            l3: {
                trigger: intent.outputFormat === 'email' ? 'on_irreversible_action' : 'never',
                minConfidence: 0.7,
            },
            requireApproval,
            autoSendThreshold: 0.85,
        };
    }
    /**
     * Determine actions based on intent
     */
    determineActions(intent) {
        const actions = [];
        switch (intent.outputFormat) {
            case 'email':
                actions.push({ type: 'draft_email', requireApproval: true });
                break;
            case 'notification':
                actions.push({ type: 'send_notification', requireApproval: false });
                break;
            case 'task':
                actions.push({ type: 'create_task', requireApproval: false });
                break;
            case 'chat_response':
                // No action needed, just respond
                break;
            default:
                break;
        }
        // CRM updates for sales/support agents
        if ((intent.category === 'SALES' || intent.category === 'SUPPORT') &&
            intent.dataSources.includes('crm')) {
            actions.push({ type: 'update_crm', requireApproval: false });
        }
        return actions;
    }
    /**
     * Select appropriate model for agent
     */
    selectModel(intent) {
        const tier = this.intentAnalyzer.getRecommendedModelTier(intent);
        switch (tier) {
            case 'haiku':
                return types_1.AgentModel.ANTHROPIC; // Using ANTHROPIC (could specify Haiku variant in future)
            case 'opus':
                return types_1.AgentModel.ANTHROPIC; // Using ANTHROPIC
            case 'sonnet':
            default:
                return types_1.AgentModel.ANTHROPIC;
        }
    }
    /**
     * Get temperature based on intent
     */
    getTemperature(intent) {
        // Creative tasks = higher temperature
        if (intent.category === 'MARKETING' || intent.outputFormat === 'report') {
            return 0.7;
        }
        // Factual tasks = lower temperature
        if (intent.category === 'FINANCE' || intent.category === 'HR') {
            return 0.3;
        }
        // Default
        return 0.5;
    }
    /**
     * Extract unique integrations from tools
     */
    getIntegrations(tools) {
        const integrations = tools
            .map((t) => t.integration)
            .filter((i) => i !== undefined);
        return Array.from(new Set(integrations));
    }
}
exports.AgentBuilder = AgentBuilder;
