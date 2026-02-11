/**
 * Meta-Agent - Self-Modification & Auto-Building
 *
 * Enables agents to:
 * - Modify themselves based on performance data
 * - Propose improvements to their own prompts/tools
 * - Build new agents from natural language descriptions
 */

import { nanoid } from "nanoid";

// ============================================
// Types
// ============================================

export interface ModificationProposal {
  id: string;
  agentId: string;
  workspaceId: string;
  type: "prompt_update" | "tool_addition" | "tool_removal" | "parameter_tuning";
  status: "pending" | "approved" | "rejected" | "applied";

  current: {
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    tools?: string[];
  };

  proposed: {
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    tools?: string[];
  };

  rationale: string;
  expectedImpact: {
    metric: string;
    currentValue: number;
    expectedValue: number;
    confidence: number; // 0-1
  }[];

  evidence: {
    insights: string[]; // Insight IDs that triggered this proposal
    feedback: string[]; // Feedback IDs
    metrics: Record<string, number>;
  };

  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  appliedAt?: Date;
}

export interface AgentBuildRequest {
  name: string;
  description: string;
  goals: string[];
  constraints?: {
    maxCost?: number;
    maxLatency?: number;
  };
  domain?: string; // e.g., "sales", "support", "marketing"
  style?: string; // e.g., "professional", "friendly", "technical"
}

export interface BuildAgentResult {
  systemPrompt: string;
  model: string;
  temperature: number;
  suggestedTools: string[];
  suggestedTriggers: string[];
  rationale: string;
}

// ============================================
// Self-Modifier Class
// ============================================

export class SelfModifier {
  constructor(
    private llmGenerate?: (prompt: string) => Promise<string>
  ) {}

  /**
   * Analyze agent performance and propose modifications
   */
  async proposeModifications(params: {
    agentId: string;
    workspaceId: string;
    currentConfig: {
      systemPrompt: string;
      model: string;
      temperature: number;
      tools: string[];
    };
    insights: Array<{
      id: string;
      type: string;
      severity: string;
      description: string;
      recommendations: string[];
    }>;
    feedback: Array<{
      id: string;
      type: string;
      correctedText?: string;
    }>;
    metrics: Record<string, number>;
  }): Promise<ModificationProposal[]> {
    const proposals: ModificationProposal[] = [];

    // Analyze insights for modification opportunities
    const criticalInsights = params.insights.filter(i =>
      i.severity === "critical" || i.severity === "high"
    );

    for (const insight of criticalInsights) {
      if (insight.type === "failure_pattern") {
        // Propose prompt update to fix failures
        const proposal = await this.proposePromptUpdate(params, insight);
        if (proposal) proposals.push(proposal);
      } else if (insight.type === "cost_optimization") {
        // Propose model tier change
        const proposal = await this.proposeModelChange(params, insight);
        if (proposal) proposals.push(proposal);
      } else if (insight.type === "performance_bottleneck") {
        // Propose tool additions for efficiency
        const proposal = await this.proposeToolAddition(params, insight);
        if (proposal) proposals.push(proposal);
      }
    }

    // Analyze feedback for style improvements
    const corrections = params.feedback.filter(f => f.correctedText);
    if (corrections.length > 5) {
      const proposal = await this.proposeStyleUpdate(params, corrections);
      if (proposal) proposals.push(proposal);
    }

    return proposals;
  }

  /**
   * Propose prompt update based on insight
   */
  private async proposePromptUpdate(
    params: any,
    insight: any
  ): Promise<ModificationProposal | null> {
    if (!this.llmGenerate) return null;

    const modificationPrompt = `You are an AI agent optimization expert.

Current system prompt:
"""
${params.currentConfig.systemPrompt}
"""

Problem identified:
${insight.description}

Recommendations:
${insight.recommendations.join("\n- ")}

Generate an improved system prompt that addresses this problem.
Include specific instructions to prevent the identified failure pattern.
Return ONLY the improved prompt, no explanation.`;

    try {
      const improvedPrompt = await this.llmGenerate(modificationPrompt);

      return {
        id: `proposal_${nanoid(12)}`,
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        type: "prompt_update",
        status: "pending",
        current: {
          systemPrompt: params.currentConfig.systemPrompt,
        },
        proposed: {
          systemPrompt: improvedPrompt.trim(),
        },
        rationale: `Addresses ${insight.type}: ${insight.description}`,
        expectedImpact: [
          {
            metric: "success_rate",
            currentValue: params.metrics.success_rate || 0.5,
            expectedValue: (params.metrics.success_rate || 0.5) * 1.3, // 30% improvement
            confidence: 0.7,
          },
        ],
        evidence: {
          insights: [insight.id],
          feedback: [],
          metrics: params.metrics,
        },
        createdAt: new Date(),
      };
    } catch (error) {
      console.error("[SelfModifier] Prompt update proposal failed:", error);
      return null;
    }
  }

  /**
   * Propose model tier change
   */
  private async proposeModelChange(
    params: any,
    insight: any
  ): Promise<ModificationProposal | null> {
    // Determine target model based on cost optimization
    const tierDowngrade: Record<string, string> = {
      "claude-opus-4-20250514": "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022",
    };

    const currentModel = params.currentConfig.model;
    const proposedModel = tierDowngrade[currentModel];

    if (!proposedModel || proposedModel === currentModel) {
      return null; // Already at lowest tier or can't downgrade
    }

    return {
      id: `proposal_${nanoid(12)}`,
      agentId: params.agentId,
      workspaceId: params.workspaceId,
      type: "parameter_tuning",
      status: "pending",
      current: {
        model: currentModel,
      },
      proposed: {
        model: proposedModel,
      },
      rationale: `Reduce costs while maintaining quality. ${insight.description}`,
      expectedImpact: [
        {
          metric: "cost",
          currentValue: params.metrics.cost || 0,
          expectedValue: (params.metrics.cost || 0) * 0.3, // 70% cost reduction
          confidence: 0.9,
        },
      ],
      evidence: {
        insights: [insight.id],
        feedback: [],
        metrics: params.metrics,
      },
      createdAt: new Date(),
    };
  }

  /**
   * Propose tool addition
   */
  private async proposeToolAddition(
    params: any,
    insight: any
  ): Promise<ModificationProposal | null> {
    // Analyze recommendations for tool suggestions
    const toolSuggestions = insight.recommendations
      .filter((r: string) => r.includes("cache") || r.includes("parallel") || r.includes("optimize"))
      .map((r: string) => {
        if (r.includes("cache")) return "caching_tool";
        if (r.includes("parallel")) return "parallel_executor";
        return "optimization_tool";
      });

    if (toolSuggestions.length === 0) return null;

    return {
      id: `proposal_${nanoid(12)}`,
      agentId: params.agentId,
      workspaceId: params.workspaceId,
      type: "tool_addition",
      status: "pending",
      current: {
        tools: params.currentConfig.tools,
      },
      proposed: {
        tools: [...params.currentConfig.tools, ...toolSuggestions],
      },
      rationale: `Add tools to improve performance: ${insight.description}`,
      expectedImpact: [
        {
          metric: "latency",
          currentValue: params.metrics.latency || 0,
          expectedValue: (params.metrics.latency || 0) * 0.6, // 40% latency reduction
          confidence: 0.6,
        },
      ],
      evidence: {
        insights: [insight.id],
        feedback: [],
        metrics: params.metrics,
      },
      createdAt: new Date(),
    };
  }

  /**
   * Propose style update based on corrections
   */
  private async proposeStyleUpdate(
    params: any,
    corrections: Array<{ correctedText?: string }>
  ): Promise<ModificationProposal | null> {
    if (!this.llmGenerate) return null;

    const examples = corrections
      .slice(0, 5)
      .map(c => c.correctedText)
      .join("\n\n");

    const stylePrompt = `Analyze these corrected responses and extract the preferred writing style:

${examples}

Describe the style in 2-3 sentences (tone, structure, formality level, etc.).`;

    try {
      const styleDescription = await this.llmGenerate(stylePrompt);

      const updatedPrompt = `${params.currentConfig.systemPrompt}

## Writing Style

${styleDescription}

Follow this style in all your responses.`;

      return {
        id: `proposal_${nanoid(12)}`,
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        type: "prompt_update",
        status: "pending",
        current: {
          systemPrompt: params.currentConfig.systemPrompt,
        },
        proposed: {
          systemPrompt: updatedPrompt,
        },
        rationale: "Incorporate user's preferred writing style based on corrections",
        expectedImpact: [
          {
            metric: "satisfaction",
            currentValue: params.metrics.satisfaction || 0.5,
            expectedValue: 0.85,
            confidence: 0.8,
          },
        ],
        evidence: {
          insights: [],
          feedback: corrections.map((_, i) => `feedback_${i}`),
          metrics: params.metrics,
        },
        createdAt: new Date(),
      };
    } catch (error) {
      console.error("[SelfModifier] Style update proposal failed:", error);
      return null;
    }
  }

  /**
   * Apply an approved modification
   */
  async applyModification(
    proposalId: string,
    approved: boolean
  ): Promise<void> {
    // This would update the agent configuration in the database
    // Implementation depends on the specific database schema
    console.log(`[SelfModifier] ${approved ? "Applying" : "Rejecting"} proposal ${proposalId}`);
  }
}

// ============================================
// Agent Builder Class
// ============================================

export class AgentBuilder {
  constructor(
    private llmGenerate?: (prompt: string) => Promise<string>
  ) {}

  /**
   * Build an agent from natural language description
   */
  async buildAgent(request: AgentBuildRequest): Promise<BuildAgentResult> {
    if (!this.llmGenerate) {
      throw new Error("LLM generation required for agent building");
    }

    const buildPrompt = `You are an AI agent architect. Build a complete agent specification from this request:

Name: ${request.name}
Description: ${request.description}
Goals:
${request.goals.map(g => `- ${g}`).join("\n")}

${request.constraints ? `Constraints:
${request.constraints.maxCost ? `- Max cost: $${request.constraints.maxCost}/conversation` : ""}
${request.constraints.maxLatency ? `- Max latency: ${request.constraints.maxLatency}ms` : ""}` : ""}

${request.domain ? `Domain: ${request.domain}` : ""}
${request.style ? `Communication style: ${request.style}` : ""}

Generate a complete agent specification with:
1. System prompt (detailed instructions for the agent)
2. Recommended model (haiku/sonnet/opus based on complexity)
3. Temperature (0-1)
4. Suggested tools (composio apps that would be useful)
5. Suggested triggers (when the agent should run)
6. Rationale for your choices

Return a JSON object with this structure:
{
  "systemPrompt": "...",
  "model": "claude-3-5-haiku-20241022",
  "temperature": 0.7,
  "suggestedTools": ["gmail", "calendar"],
  "suggestedTriggers": ["scheduled", "webhook"],
  "rationale": "..."
}`;

    try {
      const response = await this.llmGenerate(buildPrompt);
      const result = JSON.parse(response);

      return {
        systemPrompt: result.systemPrompt,
        model: result.model || "claude-3-5-sonnet-20241022",
        temperature: result.temperature || 0.7,
        suggestedTools: result.suggestedTools || [],
        suggestedTriggers: result.suggestedTriggers || [],
        rationale: result.rationale || "Agent built based on requirements",
      };
    } catch (error) {
      console.error("[AgentBuilder] Agent building failed:", error);
      throw new Error(`Failed to build agent: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

// ============================================
// Factory Functions
// ============================================

export function createSelfModifier(
  llmGenerate?: (prompt: string) => Promise<string>
): SelfModifier {
  return new SelfModifier(llmGenerate);
}

export function createAgentBuilder(
  llmGenerate?: (prompt: string) => Promise<string>
): AgentBuilder {
  return new AgentBuilder(llmGenerate);
}

// Types are already exported with their definitions above
