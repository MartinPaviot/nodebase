import {
  PrismaClient,
  prisma
} from "./chunk-UQ7FQ3YR.mjs";

// src/resources/base.ts
import { PermissionError } from "@elevay/types";
function canRead(auth, resourceWorkspaceId) {
  return auth.workspaceId === resourceWorkspaceId;
}
function canWrite(auth, resourceWorkspaceId) {
  return auth.workspaceId === resourceWorkspaceId && ["owner", "admin", "member"].includes(auth.role);
}
function canDelete(auth, resourceWorkspaceId) {
  return auth.workspaceId === resourceWorkspaceId && ["owner", "admin"].includes(auth.role);
}
var BaseResource = class {
  _data;
  _auth;
  constructor(data, auth) {
    this._data = data;
    this._auth = auth;
  }
  /**
   * Get the underlying data (read-only).
   */
  get data() {
    return Object.freeze({ ...this._data });
  }
  /**
   * Get the resource ID.
   */
  get id() {
    return this._data.id;
  }
  /**
   * Check if the current user can read this resource.
   */
  canRead() {
    const wsId = this._data.workspaceId ?? this._auth.workspaceId;
    return canRead(this._auth, wsId);
  }
  /**
   * Check if the current user can write to this resource.
   */
  canWrite() {
    const wsId = this._data.workspaceId ?? this._auth.workspaceId;
    return canWrite(this._auth, wsId);
  }
  /**
   * Check if the current user can delete this resource.
   */
  canDelete() {
    const wsId = this._data.workspaceId ?? this._auth.workspaceId;
    return canDelete(this._auth, wsId);
  }
  /**
   * Assert read permission or throw.
   */
  assertRead() {
    if (!this.canRead()) {
      throw new PermissionError(this._auth.userId, this.constructor.name, "read");
    }
  }
  /**
   * Assert write permission or throw.
   */
  assertWrite() {
    if (!this.canWrite()) {
      throw new PermissionError(this._auth.userId, this.constructor.name, "write");
    }
  }
  /**
   * Assert delete permission or throw.
   */
  assertDelete() {
    if (!this.canDelete()) {
      throw new PermissionError(this._auth.userId, this.constructor.name, "delete");
    }
  }
};
function buildQueryOptions(options = {}) {
  return {
    ...options.limit && { take: options.limit },
    ...options.offset && { skip: options.offset },
    ...options.orderBy && { orderBy: options.orderBy }
  };
}
function workspaceScope(auth) {
  return { workspaceId: auth.workspaceId };
}

// src/resources/agent.ts
import { PermissionError as PermissionError2 } from "@elevay/types";
var AgentResource = class _AgentResource extends BaseResource {
  // ============================================
  // Static Factory Methods
  // ============================================
  /**
   * Find an agent by ID with permission check.
   */
  static async findById(id, auth) {
    const agent = await prisma.agent.findUnique({
      where: { id }
    });
    if (!agent) return null;
    if (agent.workspaceId && agent.workspaceId !== auth.workspaceId) {
      throw new PermissionError2(auth.userId, "Agent", "read");
    }
    return new _AgentResource(agent, auth);
  }
  /**
   * Find all agents in the workspace.
   */
  static async findAll(auth, options) {
    const agents = await prisma.agent.findMany({
      where: { userId: auth.userId },
      ...buildQueryOptions(options)
    });
    return agents.map((agent) => new _AgentResource(agent, auth));
  }
  /**
   * Find active agents in the workspace.
   */
  static async findActive(auth, options) {
    const agents = await prisma.agent.findMany({
      where: {
        userId: auth.userId,
        isEnabled: true
      },
      ...buildQueryOptions(options)
    });
    return agents.map((agent) => new _AgentResource(agent, auth));
  }
  /**
   * Create a new agent.
   */
  static async create(auth, data) {
    const agent = await prisma.agent.create({
      data: {
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        model: data.model ?? "ANTHROPIC",
        temperature: data.temperature ?? 0.7,
        maxStepsPerRun: data.maxStepsPerRun ?? 10,
        workspaceId: auth.workspaceId,
        userId: auth.userId
      }
    });
    return new _AgentResource(agent, auth);
  }
  /**
   * Count agents in the workspace.
   */
  static async count(auth) {
    return prisma.agent.count({
      where: { userId: auth.userId }
    });
  }
  // ============================================
  // Instance Methods
  // ============================================
  /**
   * Update the agent.
   */
  async update(data) {
    this.assertWrite();
    const updated = await prisma.agent.update({
      where: { id: this.id },
      data
    });
    this._data = updated;
    return this;
  }
  /**
   * Soft delete the agent (set isEnabled to false).
   */
  async deactivate() {
    this.assertWrite();
    const updated = await prisma.agent.update({
      where: { id: this.id },
      data: { isEnabled: false }
    });
    this._data = updated;
    return this;
  }
  /**
   * Hard delete the agent.
   */
  async delete() {
    this.assertDelete();
    await prisma.agent.delete({
      where: { id: this.id }
    });
  }
  /**
   * Get agent's conversations.
   */
  async getConversations(options) {
    this.assertRead();
    return prisma.conversation.findMany({
      where: { agentId: this.id },
      ...buildQueryOptions(options)
    });
  }
  /**
   * Get agent's triggers.
   */
  async getTriggers() {
    this.assertRead();
    return prisma.agentTrigger.findMany({
      where: { agentId: this.id }
    });
  }
  // ============================================
  // Getters
  // ============================================
  get name() {
    return this._data.name;
  }
  get description() {
    return this._data.description;
  }
  get systemPrompt() {
    return this._data.systemPrompt;
  }
  get model() {
    return this._data.model;
  }
  get temperature() {
    return this._data.temperature;
  }
  get maxStepsPerRun() {
    return this._data.maxStepsPerRun;
  }
  get isEnabled() {
    return this._data.isEnabled;
  }
  get workspaceId() {
    return this._data.workspaceId;
  }
  // ============================================
  // Serialization
  // ============================================
  toJSON() {
    this.assertRead();
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      systemPrompt: this.systemPrompt,
      model: this.model,
      temperature: this.temperature,
      maxStepsPerRun: this.maxStepsPerRun,
      isEnabled: this.isEnabled,
      workspaceId: this.workspaceId,
      createdAt: this._data.createdAt.toISOString(),
      updatedAt: this._data.updatedAt.toISOString()
    };
  }
};

// src/resources/scan.ts
import { PermissionError as PermissionError3 } from "@elevay/types";
function toScanResultData(scan) {
  return {
    id: scan.id,
    workspaceId: scan.workspaceId,
    category: scan.category,
    signals: scan.signals,
    scannedAt: scan.scannedAt
  };
}
var ScanResource = class _ScanResource extends BaseResource {
  // ============================================
  // Static Factory Methods
  // ============================================
  /**
   * Find a scan result by ID with permission check.
   */
  static async findById(id, auth) {
    const scan = await prisma.scanResult.findUnique({
      where: { id }
    });
    if (!scan) return null;
    if (scan.workspaceId !== auth.workspaceId) {
      throw new PermissionError3(auth.userId, "ScanResult", "read");
    }
    return new _ScanResource(toScanResultData(scan), auth);
  }
  /**
   * Find all scan results in the workspace.
   */
  static async findAll(auth, options) {
    const scans = await prisma.scanResult.findMany({
      where: workspaceScope(auth),
      ...buildQueryOptions(options)
    });
    return scans.map(
      (scan) => new _ScanResource(toScanResultData(scan), auth)
    );
  }
  /**
   * Find latest scan results by category.
   */
  static async findLatestByCategory(auth, category) {
    const scan = await prisma.scanResult.findFirst({
      where: {
        ...workspaceScope(auth),
        category
      },
      orderBy: { scannedAt: "desc" }
    });
    if (!scan) return null;
    return new _ScanResource(toScanResultData(scan), auth);
  }
  /**
   * Create a new scan result.
   */
  static async create(auth, data) {
    const scan = await prisma.scanResult.create({
      data: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        category: data.category,
        signals: JSON.parse(JSON.stringify(data.signals))
      }
    });
    return new _ScanResource(toScanResultData(scan), auth);
  }
  // ============================================
  // Instance Methods
  // ============================================
  /**
   * Get signals filtered by severity.
   */
  getSignalsBySeverity(severity) {
    this.assertRead();
    return this._data.signals.filter((s) => s.severity === severity);
  }
  /**
   * Get critical signals (high and critical severity).
   */
  getCriticalSignals() {
    this.assertRead();
    return this._data.signals.filter(
      (s) => s.severity === "high" || s.severity === "critical"
    );
  }
  /**
   * Delete the scan result.
   */
  async delete() {
    this.assertDelete();
    await prisma.scanResult.delete({
      where: { id: this.id }
    });
  }
  // ============================================
  // Getters
  // ============================================
  get category() {
    return this._data.category;
  }
  get signals() {
    return this._data.signals;
  }
  get signalCount() {
    return this._data.signals.length;
  }
  get scannedAt() {
    return this._data.scannedAt;
  }
  get workspaceId() {
    return this._data.workspaceId;
  }
  // ============================================
  // Serialization
  // ============================================
  toJSON() {
    this.assertRead();
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      category: this.category,
      signals: this.signals,
      signalCount: this.signalCount,
      scannedAt: this.scannedAt.toISOString()
    };
  }
};

// src/resources/credential.ts
import { PermissionError as PermissionError4 } from "@elevay/types";
var CredentialResource = class _CredentialResource extends BaseResource {
  // ============================================
  // Static Factory Methods
  // ============================================
  /**
   * Find a credential by ID with permission check.
   */
  static async findById(id, auth) {
    const credential = await prisma.credential.findUnique({
      where: { id }
    });
    if (!credential) return null;
    if (credential.userId !== auth.userId) {
      throw new PermissionError4(auth.userId, "Credential", "read");
    }
    return new _CredentialResource(credential, auth);
  }
  /**
   * Find all credentials for the user.
   */
  static async findAll(auth, options) {
    const credentials = await prisma.credential.findMany({
      where: { userId: auth.userId },
      ...buildQueryOptions(options)
    });
    return credentials.map(
      (cred) => new _CredentialResource(cred, auth)
    );
  }
  /**
   * Find credentials by type.
   */
  static async findByType(auth, type, options) {
    const credentials = await prisma.credential.findMany({
      where: {
        userId: auth.userId,
        type
      },
      ...buildQueryOptions(options)
    });
    return credentials.map(
      (cred) => new _CredentialResource(cred, auth)
    );
  }
  /**
   * Create a new credential.
   * NOTE: Value should already be encrypted before calling this.
   */
  static async create(auth, data) {
    const credential = await prisma.credential.create({
      data: {
        name: data.name,
        type: data.type,
        value: data.value,
        userId: auth.userId
      }
    });
    return new _CredentialResource(credential, auth);
  }
  /**
   * Check if a credential exists for a type.
   */
  static async exists(auth, type) {
    const count = await prisma.credential.count({
      where: {
        userId: auth.userId,
        type
      }
    });
    return count > 0;
  }
  // ============================================
  // Instance Methods
  // ============================================
  /**
   * Update credential name.
   */
  async updateName(name) {
    this.assertWrite();
    const updated = await prisma.credential.update({
      where: { id: this.id },
      data: { name }
    });
    this._data = updated;
    return this;
  }
  /**
   * Update the encrypted value (for key rotation).
   */
  async updateValue(value) {
    this.assertWrite();
    const updated = await prisma.credential.update({
      where: { id: this.id },
      data: { value }
    });
    this._data = updated;
    return this;
  }
  /**
   * Delete the credential.
   */
  async delete() {
    this.assertDelete();
    await prisma.credential.delete({
      where: { id: this.id }
    });
  }
  // ============================================
  // Getters
  // ============================================
  get name() {
    return this._data.name;
  }
  get type() {
    return this._data.type;
  }
  get userId() {
    return this._data.userId;
  }
  /**
   * Get encrypted value for decryption.
   * Should only be used by the connector/crypto layer.
   */
  getEncryptedValue() {
    this.assertRead();
    return this._data.value;
  }
  // ============================================
  // Serialization
  // ============================================
  /**
   * Returns metadata only - NEVER includes encrypted value.
   */
  toJSON() {
    this.assertRead();
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      userId: this.userId,
      createdAt: this._data.createdAt.toISOString(),
      updatedAt: this._data.updatedAt.toISOString()
    };
  }
};

// src/resources/agent-run.ts
import { PermissionError as PermissionError5 } from "@elevay/types";
var AgentRunResource = class _AgentRunResource extends BaseResource {
  // ============================================
  // Static Factory Methods
  // ============================================
  /**
   * Find a run by ID with permission check.
   */
  static async findById(id, auth) {
    const run = await prisma.agentRun.findUnique({
      where: { id }
    });
    if (!run) return null;
    if (run.workspaceId !== auth.workspaceId) {
      throw new PermissionError5(auth.userId, "AgentRun", "read");
    }
    return new _AgentRunResource(run, auth);
  }
  /**
   * Find all runs for an agent.
   */
  static async findByAgent(auth, agentId, options) {
    const runs = await prisma.agentRun.findMany({
      where: {
        ...workspaceScope(auth),
        agentId
      },
      ...buildQueryOptions(options)
    });
    return runs.map((run) => new _AgentRunResource(run, auth));
  }
  /**
   * Find runs pending review.
   */
  static async findPendingReview(auth, options) {
    const runs = await prisma.agentRun.findMany({
      where: {
        ...workspaceScope(auth),
        status: "pending_review"
      },
      orderBy: { triggeredAt: "desc" },
      ...buildQueryOptions(options)
    });
    return runs.map((run) => new _AgentRunResource(run, auth));
  }
  /**
   * Create a new agent run.
   */
  static async create(auth, data) {
    const run = await prisma.agentRun.create({
      data: {
        agentId: data.agentId,
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        triggeredBy: data.triggeredBy,
        dataSources: data.dataSources ?? [],
        llmModel: data.llmModel,
        llmTokensUsed: 0,
        llmCost: 0,
        l1Assertions: [],
        l1Passed: false,
        l2Score: 0,
        l2Breakdown: {},
        l3Triggered: false,
        status: "running"
      }
    });
    return new _AgentRunResource(run, auth);
  }
  // ============================================
  // Instance Methods
  // ============================================
  /**
   * Update run with output.
   */
  async setOutput(data) {
    this.assertWrite();
    const updated = await prisma.agentRun.update({
      where: { id: this.id },
      data
    });
    this._data = updated;
    return this;
  }
  /**
   * Update run with eval results.
   */
  async setEvalResult(eval_) {
    this.assertWrite();
    const updated = await prisma.agentRun.update({
      where: { id: this.id },
      data: {
        l1Assertions: eval_.l1Assertions,
        l1Passed: eval_.l1Passed,
        l2Score: eval_.l2Score,
        l2Breakdown: eval_.l2Breakdown,
        l3Triggered: eval_.l3Triggered,
        l3Blocked: eval_.l3Blocked,
        l3Reason: eval_.l3Reason,
        status: eval_.status
      }
    });
    this._data = updated;
    return this;
  }
  /**
   * Record user action on the run.
   */
  async setUserAction(data) {
    this.assertWrite();
    const updated = await prisma.agentRun.update({
      where: { id: this.id },
      data: {
        ...data,
        finalAt: /* @__PURE__ */ new Date(),
        status: "completed"
      }
    });
    this._data = updated;
    return this;
  }
  /**
   * Mark as failed.
   */
  async setFailed(reason) {
    this.assertWrite();
    const updated = await prisma.agentRun.update({
      where: { id: this.id },
      data: {
        status: "failed",
        l3Reason: reason
      }
    });
    this._data = updated;
    return this;
  }
  // ============================================
  // Getters
  // ============================================
  get agentId() {
    return this._data.agentId;
  }
  get triggeredAt() {
    return this._data.triggeredAt;
  }
  get triggeredBy() {
    return this._data.triggeredBy;
  }
  get status() {
    return this._data.status;
  }
  get outputType() {
    return this._data.outputType;
  }
  get outputContent() {
    return this._data.outputContent;
  }
  get llmUsage() {
    return {
      model: this._data.llmModel,
      tier: this.getLLMTier(),
      tokensIn: 0,
      // Not tracked separately
      tokensOut: this._data.llmTokensUsed,
      cost: this._data.llmCost,
      latencyMs: 0
      // Not tracked
    };
  }
  get evalSummary() {
    return {
      l1Passed: this._data.l1Passed,
      l2Score: this._data.l2Score,
      l3Triggered: this._data.l3Triggered,
      l3Blocked: this._data.l3Blocked
    };
  }
  get userAction() {
    return this._data.userAction;
  }
  get workspaceId() {
    return this._data.workspaceId;
  }
  getLLMTier() {
    if (this._data.llmModel.includes("haiku")) return "haiku";
    if (this._data.llmModel.includes("opus")) return "opus";
    return "sonnet";
  }
  // ============================================
  // Serialization
  // ============================================
  toJSON() {
    this.assertRead();
    return {
      id: this.id,
      agentId: this.agentId,
      userId: this._data.userId,
      workspaceId: this.workspaceId,
      triggeredAt: this.triggeredAt.toISOString(),
      triggeredBy: this.triggeredBy,
      status: this.status,
      outputType: this.outputType,
      outputContent: this.outputContent,
      llmUsage: this.llmUsage,
      evalSummary: this.evalSummary,
      userAction: this.userAction,
      finalAt: this._data.finalAt?.toISOString() ?? null,
      createdAt: this._data.createdAt.toISOString()
    };
  }
};
export {
  AgentResource,
  AgentRunResource,
  BaseResource,
  CredentialResource,
  PrismaClient,
  ScanResource,
  prisma
};
