"use strict";
/**
 * Self-Modifier - Agents that propose their own improvements
 * Analyzes performance and suggests modifications (prompt, model, tools)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfModifier = void 0;
const client_1 = require("@prisma/client");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const date_fns_1 = require("date-fns");
const types_1 = require("./types");
const prisma = new client_1.PrismaClient();
const anthropic = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});
class SelfModifier {
    /**
     * Analyze agent performance and propose modifications
     */
    async proposeModifications(agentId) {
        console.log(`[SelfModifier] Analyzing agent ${agentId}...`);
        // 1. Analyze agent performance
        const analysis = await this.analyzePerformance(agentId);
        // 2. Check if modifications are needed
        if (this.isPerformingWell(analysis)) {
            console.log('[SelfModifier] Agent performing well, no modifications needed');
            return {
                agentId,
                analysis,
                proposals: [],
                recommendation: 'Agent is performing well. Continue monitoring.',
            };
        }
        // 3. Generate improvement proposals
        const proposals = await this.generateProposals(agentId, analysis);
        // 4. Save proposals to database
        await this.saveProposals(agentId, proposals);
        // 5. Generate recommendation
        const recommendation = this.generateRecommendation(analysis, proposals);
        console.log(`[SelfModifier] Generated ${proposals.length} modification proposal(s)`);
        return {
            agentId,
            analysis,
            proposals,
            recommendation,
        };
    }
    /**
     * Analyze agent performance over last 30 days
     */
    async analyzePerformance(agentId) {
        const since = (0, date_fns_1.subDays)(new Date(), 30);
        // Get traces
        const traces = await prisma.agentTrace.findMany({
            where: {
                agentId,
                startedAt: { gte: since },
            },
            include: {
                conversation: {
                    select: {
                        id: true,
                        messages: {
                            select: { role: true, content: true },
                            take: 10,
                        },
                    },
                },
            },
        });
        if (traces.length === 0) {
            return {
                totalConversations: 0,
                successRate: 0,
                avgSatisfaction: 3,
                avgCost: 0,
                avgLatency: 0,
                commonFailures: [],
                toolUsage: [],
                topUserComplaints: [],
                hallucinationRate: 0,
            };
        }
        // Get evaluations
        const evals = await prisma.conversationEvaluation.findMany({
            where: {
                conversation: {
                    agentId,
                },
                evaluatedAt: { gte: since },
            },
        });
        // Calculate metrics
        const successRate = traces.filter((t) => t.status === 'COMPLETED').length / traces.length;
        const avgSatisfaction = evals.length > 0
            ? evals.reduce((sum, e) => sum + e.userSatisfactionScore, 0) / evals.length
            : 3;
        const avgCost = traces.reduce((sum, t) => sum + t.totalCost, 0) / traces.length;
        const avgLatency = traces
            .filter((t) => t.latencyMs !== null)
            .reduce((sum, t) => sum + (t.latencyMs || 0), 0) / traces.length;
        // Extract common failures
        const commonFailures = this.extractCommonFailures(evals);
        // Analyze tool usage
        const toolUsage = this.analyzeToolUsage(traces);
        // Extract user complaints
        const topUserComplaints = this.extractUserComplaints(traces);
        // Calculate hallucination rate
        const hallucinationRate = evals.filter((e) => e.failureModes.includes('hallucination')).length / Math.max(evals.length, 1);
        return {
            totalConversations: traces.length,
            successRate,
            avgSatisfaction,
            avgCost,
            avgLatency,
            commonFailures,
            toolUsage,
            topUserComplaints,
            hallucinationRate,
        };
    }
    /**
     * Check if agent is performing well
     */
    isPerformingWell(analysis) {
        return (analysis.avgSatisfaction >= 4.0 &&
            analysis.successRate >= 0.8 &&
            analysis.hallucinationRate < 0.1 &&
            analysis.commonFailures.length === 0);
    }
    /**
     * Generate modification proposals based on analysis
     */
    async generateProposals(agentId, analysis) {
        const proposals = [];
        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            include: {
                agentTools: true,
            },
        });
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }
        // Proposal 1: Prompt refinement (if low satisfaction)
        if (analysis.avgSatisfaction < 3.5) {
            const refinedPrompt = await this.refinePrompt(agent.systemPrompt, analysis);
            proposals.push({
                type: types_1.ModificationType.PROMPT_REFINEMENT,
                current: agent.systemPrompt || '',
                proposed: refinedPrompt,
                rationale: `Current satisfaction: ${analysis.avgSatisfaction.toFixed(1)}/5. Refined prompt addresses: ${analysis.commonFailures.join(', ')}`,
                impact: 'Improve user satisfaction by addressing common failure modes',
                requiresApproval: true,
            });
        }
        // Proposal 2: Model downgrade (if high satisfaction + high cost)
        if (analysis.avgSatisfaction > 4.0 && analysis.avgCost > 0.5 && agent.model === types_1.AgentModel.ANTHROPIC) {
            proposals.push({
                type: types_1.ModificationType.MODEL_DOWNGRADE,
                current: agent.model,
                proposed: types_1.AgentModel.ANTHROPIC, // Keep ANTHROPIC for now (could use Haiku variant in future)
                rationale: `High satisfaction (${analysis.avgSatisfaction.toFixed(1)}/5) with expensive model ($${analysis.avgCost.toFixed(3)}/conversation). Cheaper model may suffice.`,
                impact: `Reduce cost by ~70% (estimated $${(analysis.avgCost * 0.3).toFixed(3)}/conversation)`,
                requiresApproval: true,
                estimatedSavings: analysis.avgCost * 0.7 * analysis.totalConversations,
            });
        }
        // Proposal 3: Remove unused tools
        const underusedTools = analysis.toolUsage.filter((t) => t.usageRate < 0.05); // <5% usage
        if (underusedTools.length > 0 && agent.agentTools.length > 2) {
            proposals.push({
                type: types_1.ModificationType.REMOVE_TOOL,
                current: agent.agentTools.map((t) => t.id).join(', '),
                proposed: agent.agentTools
                    .filter((t) => !underusedTools.some((ut) => ut.toolName === t.id))
                    .map((t) => t.id)
                    .join(', '),
                rationale: `These tools are rarely used (<5%): ${underusedTools.map((t) => t.toolName).join(', ')}`,
                impact: 'Reduce complexity and prompt size',
                requiresApproval: true,
            });
        }
        // Proposal 4: Add RAG (if hallucinations detected)
        if (analysis.hallucinationRate > 0.1) {
            proposals.push({
                type: types_1.ModificationType.ADD_RAG,
                current: 'No knowledge base',
                proposed: 'Connect to knowledge base with similarityThreshold=0.7',
                rationale: `${(analysis.hallucinationRate * 100).toFixed(1)}% of conversations show hallucination markers. RAG can ground responses in facts.`,
                impact: 'Improve accuracy and reduce hallucinations',
                requiresApproval: true,
            });
        }
        // Proposal 5: Adjust temperature (if too creative or too robotic)
        if (analysis.topUserComplaints.includes('too_creative') && agent.temperature > 0.5) {
            proposals.push({
                type: types_1.ModificationType.ADJUST_TEMPERATURE,
                current: agent.temperature.toString(),
                proposed: Math.max(0.3, agent.temperature - 0.2).toString(),
                rationale: 'Users report outputs are too creative/unpredictable. Lower temperature for more consistency.',
                impact: 'More consistent, factual outputs',
                requiresApproval: true,
            });
        }
        return proposals;
    }
    /**
     * Refine prompt using Claude
     */
    async refinePrompt(currentPrompt, analysis) {
        const prompt = `Refine this AI agent system prompt based on performance analysis.

Current System Prompt:
${currentPrompt}

Performance Issues:
- Average satisfaction: ${analysis.avgSatisfaction.toFixed(1)}/5
- Common failures: ${analysis.commonFailures.join(', ')}
- User complaints: ${analysis.topUserComplaints.join(', ')}
- Hallucination rate: ${(analysis.hallucinationRate * 100).toFixed(1)}%

Instructions:
1. Address the identified issues
2. Maintain the core agent purpose
3. Add specific guidelines to prevent failures
4. Be clear and actionable
5. Keep under 500 words

Respond with the refined system prompt ONLY, no preamble.`;
        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            temperature: 0.5,
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
        return content.text.trim();
    }
    /**
     * Save proposals to database
     */
    async saveProposals(agentId, proposals) {
        for (const proposal of proposals) {
            await prisma.modificationProposal.create({
                data: {
                    agentId,
                    type: this.mapProposalType(proposal.type),
                    current: proposal.current,
                    proposed: proposal.proposed,
                    rationale: proposal.rationale,
                    impact: proposal.impact,
                    status: types_1.ProposalStatus.PENDING,
                },
            });
        }
    }
    /**
     * Map proposal type to Prisma enum
     */
    mapProposalType(type) {
        const map = {
            prompt_refinement: types_1.ModificationType.PROMPT_REFINEMENT,
            model_downgrade: types_1.ModificationType.MODEL_DOWNGRADE,
            model_upgrade: types_1.ModificationType.MODEL_UPGRADE,
            add_tool: types_1.ModificationType.ADD_TOOL,
            remove_tool: types_1.ModificationType.REMOVE_TOOL,
            add_rag: types_1.ModificationType.ADD_RAG,
            adjust_temperature: types_1.ModificationType.ADJUST_TEMPERATURE,
        };
        return map[type] || types_1.ModificationType.PROMPT_REFINEMENT;
    }
    /**
     * Apply approved modification
     */
    async applyModification(proposalId, approved) {
        const proposal = await prisma.modificationProposal.findUnique({
            where: { id: proposalId },
        });
        if (!proposal) {
            throw new Error(`Proposal ${proposalId} not found`);
        }
        if (!approved) {
            await prisma.modificationProposal.update({
                where: { id: proposalId },
                data: { status: types_1.ProposalStatus.REJECTED, reviewedAt: new Date() },
            });
            console.log(`[SelfModifier] Proposal ${proposalId} rejected`);
            return;
        }
        console.log(`[SelfModifier] Applying ${proposal.type} modification...`);
        // Apply based on type
        switch (proposal.type) {
            case types_1.ModificationType.PROMPT_REFINEMENT:
                await prisma.agent.update({
                    where: { id: proposal.agentId },
                    data: { systemPrompt: proposal.proposed },
                });
                break;
            case types_1.ModificationType.MODEL_DOWNGRADE:
            case types_1.ModificationType.MODEL_UPGRADE:
                await prisma.agent.update({
                    where: { id: proposal.agentId },
                    data: { model: proposal.proposed },
                });
                break;
            case types_1.ModificationType.ADJUST_TEMPERATURE:
                await prisma.agent.update({
                    where: { id: proposal.agentId },
                    data: { temperature: parseFloat(proposal.proposed) },
                });
                break;
            case types_1.ModificationType.ADD_RAG:
                await prisma.knowledgeSettings.upsert({
                    where: { agentId: proposal.agentId },
                    create: {
                        agentId: proposal.agentId,
                        enabled: true,
                        similarityThreshold: 0.7,
                        maxResults: 5,
                    },
                    update: {
                        enabled: true,
                        similarityThreshold: 0.7,
                    },
                });
                break;
            default:
                console.warn(`[SelfModifier] Unknown modification type: ${proposal.type}`);
        }
        // Mark as applied
        await prisma.modificationProposal.update({
            where: { id: proposalId },
            data: {
                status: types_1.ProposalStatus.APPLIED,
                reviewedAt: new Date(),
                appliedAt: new Date(),
            },
        });
        console.log(`[SelfModifier] Modification applied successfully`);
    }
    /**
     * Extract common failures from evaluations
     */
    extractCommonFailures(evals) {
        const failureCount = {};
        evals.forEach((e) => {
            e.failureModes.forEach((mode) => {
                failureCount[mode] = (failureCount[mode] || 0) + 1;
            });
        });
        return Object.entries(failureCount)
            .filter(([, count]) => count >= evals.length * 0.1) // >10% frequency
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([mode]) => mode);
    }
    /**
     * Analyze tool usage from traces
     */
    analyzeToolUsage(traces) {
        const toolStats = {};
        traces.forEach((trace) => {
            const toolCalls = trace.toolCalls;
            if (Array.isArray(toolCalls)) {
                toolCalls.forEach((call) => {
                    const toolName = call.toolName || 'unknown';
                    if (!toolStats[toolName]) {
                        toolStats[toolName] = { count: 0, success: 0, latency: [] };
                    }
                    toolStats[toolName].count++;
                    if (call.success)
                        toolStats[toolName].success++;
                    if (call.latency)
                        toolStats[toolName].latency.push(call.latency);
                });
            }
        });
        const totalToolCalls = Object.values(toolStats).reduce((sum, s) => sum + s.count, 0);
        return Object.entries(toolStats).map(([toolName, stats]) => ({
            toolId: toolName,
            toolName,
            usageCount: stats.count,
            usageRate: stats.count / Math.max(totalToolCalls, 1),
            successRate: stats.success / Math.max(stats.count, 1),
            avgLatency: stats.latency.length > 0
                ? stats.latency.reduce((sum, l) => sum + l, 0) / stats.latency.length
                : 0,
        }));
    }
    /**
     * Extract user complaints from conversation content
     */
    extractUserComplaints(traces) {
        // Simple keyword matching for common complaints
        const complaints = new Set();
        traces.forEach((trace) => {
            const messages = trace.conversation?.messages || [];
            const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content.toLowerCase());
            userMessages.forEach((content) => {
                if (content.includes('too long') || content.includes('verbose'))
                    complaints.add('too_verbose');
                if (content.includes('too short') || content.includes('more detail'))
                    complaints.add('too_brief');
                if (content.includes('creative') || content.includes('unpredictable'))
                    complaints.add('too_creative');
                if (content.includes('robotic') || content.includes('generic'))
                    complaints.add('too_robotic');
                if (content.includes('wrong') || content.includes('incorrect'))
                    complaints.add('inaccurate');
            });
        });
        return Array.from(complaints);
    }
    /**
     * Generate overall recommendation
     */
    generateRecommendation(analysis, proposals) {
        if (proposals.length === 0) {
            return 'Agent is performing well. Continue monitoring performance metrics.';
        }
        const priorityProposals = proposals.slice(0, 2); // Top 2 most important
        return `Review and approve ${proposals.length} proposed modification(s). Priority actions: ${priorityProposals.map((p) => p.type).join(', ')}. Expected impact: ${priorityProposals.map((p) => p.impact).join('; ')}.`;
    }
}
exports.SelfModifier = SelfModifier;
