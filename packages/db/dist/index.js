"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AgentResource: () => AgentResource,
  AgentRunResource: () => AgentRunResource,
  BaseResource: () => BaseResource,
  CredentialResource: () => CredentialResource,
  PrismaClient: () => import_client.PrismaClient,
  ScanResource: () => ScanResource,
  prisma: () => prisma
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var import_client = require("@prisma/client");
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new import_client.PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// src/resources/base.ts
var import_types = require("@nodebase/types");
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
      throw new import_types.PermissionError(this._auth.userId, this.constructor.name, "read");
    }
  }
  /**
   * Assert write permission or throw.
   */
  assertWrite() {
    if (!this.canWrite()) {
      throw new import_types.PermissionError(this._auth.userId, this.constructor.name, "write");
    }
  }
  /**
   * Assert delete permission or throw.
   */
  assertDelete() {
    if (!this.canDelete()) {
      throw new import_types.PermissionError(this._auth.userId, this.constructor.name, "delete");
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
var import_types2 = require("@nodebase/types");
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
    if (agent.workspaceId !== auth.workspaceId) {
      throw new import_types2.PermissionError(auth.userId, "Agent", "read");
    }
    return new _AgentResource(agent, auth);
  }
  /**
   * Find all agents in the workspace.
   */
  static async findAll(auth, options) {
    const agents = await prisma.agent.findMany({
      where: workspaceScope(auth),
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
        ...workspaceScope(auth),
        isActive: true
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
        ...data,
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        model: data.model ?? "ANTHROPIC",
        temperature: data.temperature ?? 0.7,
        maxStepsPerRun: data.maxStepsPerRun ?? 10
      }
    });
    return new _AgentResource(agent, auth);
  }
  /**
   * Count agents in the workspace.
   */
  static async count(auth) {
    return prisma.agent.count({
      where: workspaceScope(auth)
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
   * Soft delete the agent (set isActive to false).
   */
  async deactivate() {
    this.assertWrite();
    const updated = await prisma.agent.update({
      where: { id: this.id },
      data: { isActive: false }
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
  get isActive() {
    return this._data.isActive;
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
      isActive: this.isActive,
      workspaceId: this.workspaceId,
      createdAt: this._data.createdAt.toISOString(),
      updatedAt: this._data.updatedAt.toISOString()
    };
  }
};

// src/resources/scan.ts
var import_types3 = require("@nodebase/types");
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
      throw new import_types3.PermissionError(auth.userId, "ScanResult", "read");
    }
    return new _ScanResource(
      {
        ...scan,
        category: scan.category,
        signals: scan.signals
      },
      auth
    );
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
      (scan) => new _ScanResource(
        {
          ...scan,
          category: scan.category,
          signals: scan.signals
        },
        auth
      )
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
    return new _ScanResource(
      {
        ...scan,
        category: scan.category,
        signals: scan.signals
      },
      auth
    );
  }
  /**
   * Create a new scan result.
   */
  static async create(auth, data) {
    const scan = await prisma.scanResult.create({
      data: {
        workspaceId: auth.workspaceId,
        category: data.category,
        signals: data.signals
      }
    });
    return new _ScanResource(
      {
        ...scan,
        category: scan.category,
        signals: scan.signals
      },
      auth
    );
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
var import_types4 = require("@nodebase/types");
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
    if (credential.workspaceId !== auth.workspaceId) {
      throw new import_types4.PermissionError(auth.userId, "Credential", "read");
    }
    return new _CredentialResource(credential, auth);
  }
  /**
   * Find all credentials in the workspace.
   */
  static async findAll(auth, options) {
    const credentials = await prisma.credential.findMany({
      where: workspaceScope(auth),
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
        ...workspaceScope(auth),
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
   * NOTE: Data should already be encrypted before calling this.
   */
  static async create(auth, data) {
    const credential = await prisma.credential.create({
      data: {
        ...data,
        workspaceId: auth.workspaceId,
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
        ...workspaceScope(auth),
        type
      }
    });
    return count > 0;
  }
  // ============================================
  // Instance Methods
  // ============================================
  /**
   * Update credential metadata (not the encrypted data).
   */
  async updateMetadata(data) {
    this.assertWrite();
    const updated = await prisma.credential.update({
      where: { id: this.id },
      data
    });
    this._data = updated;
    return this;
  }
  /**
   * Update the encrypted data (for key rotation).
   */
  async updateEncryptedData(encryptedData) {
    this.assertWrite();
    const updated = await prisma.credential.update({
      where: { id: this.id },
      data: { encryptedData }
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
  /**
   * Check if the credential is expired.
   */
  isExpired() {
    if (!this._data.expiresAt) return false;
    return this._data.expiresAt < /* @__PURE__ */ new Date();
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
  get workspaceId() {
    return this._data.workspaceId;
  }
  get userId() {
    return this._data.userId;
  }
  get expiresAt() {
    return this._data.expiresAt;
  }
  /**
   * Get encrypted data for decryption.
   * Should only be used by the connector layer.
   */
  getEncryptedData() {
    this.assertRead();
    return this._data.encryptedData;
  }
  // ============================================
  // Serialization
  // ============================================
  /**
   * Returns metadata only - NEVER includes encrypted data.
   */
  toJSON() {
    this.assertRead();
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      workspaceId: this.workspaceId,
      userId: this.userId,
      expiresAt: this._data.expiresAt?.toISOString() ?? null,
      isExpired: this.isExpired(),
      createdAt: this._data.createdAt.toISOString(),
      updatedAt: this._data.updatedAt.toISOString()
    };
  }
};

// src/resources/agent-run.ts
var import_types5 = require("@nodebase/types");
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
      throw new import_types5.PermissionError(auth.userId, "AgentRun", "read");
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
      data: eval_
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentResource,
  AgentRunResource,
  BaseResource,
  CredentialResource,
  PrismaClient,
  ScanResource,
  prisma
});
