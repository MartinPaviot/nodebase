/**
 * Enhanced Agent Builder (Phase 4)
 * Build complete agents from natural language descriptions
 * Inspired by LangChain Agent Builder
 */
import type { AgentBuildRequest, BuiltAgent } from './types';
export declare class AgentBuilder {
    private intentAnalyzer;
    private agentTester;
    constructor();
    /**
     * Build a complete agent from natural language description
     */
    buildAgent(request: AgentBuildRequest): Promise<BuiltAgent>;
    /**
     * Select tools based on intent and suggested integrations
     */
    private selectTools;
    /**
     * Create tool configuration from tool type
     */
    private createToolConfig;
    /**
     * Get tools for a specific integration
     */
    private getIntegrationTools;
    /**
     * Generate system prompt using Claude
     */
    private generatePrompt;
    /**
     * Configure evaluation rules based on agent category and output type
     */
    private configureEvalRules;
    /**
     * Determine actions based on intent
     */
    private determineActions;
    /**
     * Select appropriate model for agent
     */
    private selectModel;
    /**
     * Get temperature based on intent
     */
    private getTemperature;
    /**
     * Extract unique integrations from tools
     */
    private getIntegrations;
}
//# sourceMappingURL=agent-builder.d.ts.map