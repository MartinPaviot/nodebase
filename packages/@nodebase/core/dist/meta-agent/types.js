"use strict";
/**
 * Types for Meta-Agent system (Phase 4)
 * - Agent Builder: Natural language-driven agent creation
 * - Self-Modifier: Agents that propose their own improvements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProposalStatus = exports.ModificationType = exports.AgentModel = void 0;
// Local enum definitions (mirroring Prisma schema)
var AgentModel;
(function (AgentModel) {
    AgentModel["ANTHROPIC"] = "ANTHROPIC";
    AgentModel["OPENAI"] = "OPENAI";
    AgentModel["GEMINI"] = "GEMINI";
})(AgentModel || (exports.AgentModel = AgentModel = {}));
var ModificationType;
(function (ModificationType) {
    ModificationType["PROMPT_REFINEMENT"] = "PROMPT_REFINEMENT";
    ModificationType["MODEL_UPGRADE"] = "MODEL_UPGRADE";
    ModificationType["MODEL_DOWNGRADE"] = "MODEL_DOWNGRADE";
    ModificationType["ADD_TOOL"] = "ADD_TOOL";
    ModificationType["REMOVE_TOOL"] = "REMOVE_TOOL";
    ModificationType["ADD_RAG"] = "ADD_RAG";
    ModificationType["ADJUST_TEMPERATURE"] = "ADJUST_TEMPERATURE";
})(ModificationType || (exports.ModificationType = ModificationType = {}));
var ProposalStatus;
(function (ProposalStatus) {
    ProposalStatus["PENDING"] = "PENDING";
    ProposalStatus["APPROVED"] = "APPROVED";
    ProposalStatus["REJECTED"] = "REJECTED";
    ProposalStatus["APPLIED"] = "APPLIED";
})(ProposalStatus || (exports.ProposalStatus = ProposalStatus = {}));
