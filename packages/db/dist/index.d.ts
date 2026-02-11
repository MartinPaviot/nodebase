export { default as prisma } from './client.js';
import { UserId, WorkspaceId, ScanCategory, ScanSignal, LLMUsage } from '@nodebase/types';
export { PrismaClient } from '@prisma/client';

/**
 * Base Resource Pattern
 *
 * All database models must be accessed through Resource classes that:
 * 1. Check permissions before any operation
 * 2. Provide a clean API for common operations
 * 3. Handle soft deletes and workspace scoping
 */

interface ResourceAuth {
    userId: UserId;
    workspaceId: WorkspaceId;
    role: "owner" | "admin" | "member" | "viewer";
}
declare abstract class BaseResource<T extends {
    id: string;
    workspaceId?: string;
}> {
    protected _data: T;
    protected _auth: ResourceAuth;
    constructor(data: T, auth: ResourceAuth);
    /**
     * Get the underlying data (read-only).
     */
    get data(): Readonly<T>;
    /**
     * Get the resource ID.
     */
    get id(): string;
    /**
     * Check if the current user can read this resource.
     */
    canRead(): boolean;
    /**
     * Check if the current user can write to this resource.
     */
    canWrite(): boolean;
    /**
     * Check if the current user can delete this resource.
     */
    canDelete(): boolean;
    /**
     * Assert read permission or throw.
     */
    protected assertRead(): void;
    /**
     * Assert write permission or throw.
     */
    protected assertWrite(): void;
    /**
     * Assert delete permission or throw.
     */
    protected assertDelete(): void;
    /**
     * Convert to a plain object safe for JSON serialization.
     */
    abstract toJSON(): Record<string, unknown>;
}
interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: Record<string, "asc" | "desc">;
}

/**
 * Agent Resource
 *
 * Provides permission-checked access to Agent records.
 */

interface AgentData {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    systemPrompt: string;
    model: string;
    temperature: number;
    maxStepsPerRun: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare class AgentResource extends BaseResource<AgentData> {
    /**
     * Find an agent by ID with permission check.
     */
    static findById(id: string, auth: ResourceAuth): Promise<AgentResource | null>;
    /**
     * Find all agents in the workspace.
     */
    static findAll(auth: ResourceAuth, options?: QueryOptions): Promise<AgentResource[]>;
    /**
     * Find active agents in the workspace.
     */
    static findActive(auth: ResourceAuth, options?: QueryOptions): Promise<AgentResource[]>;
    /**
     * Create a new agent.
     */
    static create(auth: ResourceAuth, data: {
        name: string;
        description?: string;
        systemPrompt: string;
        model?: string;
        temperature?: number;
        maxStepsPerRun?: number;
    }): Promise<AgentResource>;
    /**
     * Count agents in the workspace.
     */
    static count(auth: ResourceAuth): Promise<number>;
    /**
     * Update the agent.
     */
    update(data: Partial<{
        name: string;
        description: string;
        systemPrompt: string;
        model: string;
        temperature: number;
        maxStepsPerRun: number;
        isActive: boolean;
    }>): Promise<AgentResource>;
    /**
     * Soft delete the agent (set isActive to false).
     */
    deactivate(): Promise<AgentResource>;
    /**
     * Hard delete the agent.
     */
    delete(): Promise<void>;
    /**
     * Get agent's conversations.
     */
    getConversations(options?: QueryOptions): Promise<any>;
    /**
     * Get agent's triggers.
     */
    getTriggers(): Promise<any>;
    get name(): string;
    get description(): string | null;
    get systemPrompt(): string;
    get model(): string;
    get temperature(): number;
    get maxStepsPerRun(): number;
    get isActive(): boolean;
    get workspaceId(): string;
    toJSON(): Record<string, unknown>;
}

/**
 * Scan Resource
 *
 * Provides permission-checked access to ScanResult records.
 */

interface ScanResultData {
    id: string;
    workspaceId: string;
    category: ScanCategory;
    signals: ScanSignal[];
    scannedAt: Date;
}
declare class ScanResource extends BaseResource<ScanResultData> {
    /**
     * Find a scan result by ID with permission check.
     */
    static findById(id: string, auth: ResourceAuth): Promise<ScanResource | null>;
    /**
     * Find all scan results in the workspace.
     */
    static findAll(auth: ResourceAuth, options?: QueryOptions): Promise<ScanResource[]>;
    /**
     * Find latest scan results by category.
     */
    static findLatestByCategory(auth: ResourceAuth, category: ScanCategory): Promise<ScanResource | null>;
    /**
     * Create a new scan result.
     */
    static create(auth: ResourceAuth, data: {
        category: ScanCategory;
        signals: ScanSignal[];
    }): Promise<ScanResource>;
    /**
     * Get signals filtered by severity.
     */
    getSignalsBySeverity(severity: ScanSignal["severity"]): ScanSignal[];
    /**
     * Get critical signals (high and critical severity).
     */
    getCriticalSignals(): ScanSignal[];
    /**
     * Delete the scan result.
     */
    delete(): Promise<void>;
    get category(): ScanCategory;
    get signals(): ScanSignal[];
    get signalCount(): number;
    get scannedAt(): Date;
    get workspaceId(): string;
    toJSON(): Record<string, unknown>;
}

/**
 * Credential Resource
 *
 * Provides permission-checked access to encrypted credentials.
 * NEVER returns decrypted credentials - use getCrypto() separately.
 */

interface CredentialData {
    id: string;
    workspaceId: string;
    userId: string;
    name: string;
    type: string;
    encryptedData: string;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
declare class CredentialResource extends BaseResource<CredentialData> {
    /**
     * Find a credential by ID with permission check.
     */
    static findById(id: string, auth: ResourceAuth): Promise<CredentialResource | null>;
    /**
     * Find all credentials in the workspace.
     */
    static findAll(auth: ResourceAuth, options?: QueryOptions): Promise<CredentialResource[]>;
    /**
     * Find credentials by type.
     */
    static findByType(auth: ResourceAuth, type: string, options?: QueryOptions): Promise<CredentialResource[]>;
    /**
     * Create a new credential.
     * NOTE: Data should already be encrypted before calling this.
     */
    static create(auth: ResourceAuth, data: {
        name: string;
        type: string;
        encryptedData: string;
        expiresAt?: Date;
    }): Promise<CredentialResource>;
    /**
     * Check if a credential exists for a type.
     */
    static exists(auth: ResourceAuth, type: string): Promise<boolean>;
    /**
     * Update credential metadata (not the encrypted data).
     */
    updateMetadata(data: {
        name?: string;
        expiresAt?: Date;
    }): Promise<CredentialResource>;
    /**
     * Update the encrypted data (for key rotation).
     */
    updateEncryptedData(encryptedData: string): Promise<CredentialResource>;
    /**
     * Delete the credential.
     */
    delete(): Promise<void>;
    /**
     * Check if the credential is expired.
     */
    isExpired(): boolean;
    get name(): string;
    get type(): string;
    get workspaceId(): string;
    get userId(): string;
    get expiresAt(): Date | null;
    /**
     * Get encrypted data for decryption.
     * Should only be used by the connector layer.
     */
    getEncryptedData(): string;
    /**
     * Returns metadata only - NEVER includes encrypted data.
     */
    toJSON(): Record<string, unknown>;
}

/**
 * AgentRun Resource
 *
 * Provides permission-checked access to agent execution records.
 */

interface AgentRunData {
    id: string;
    agentId: string;
    userId: string;
    workspaceId: string;
    triggeredAt: Date;
    triggeredBy: string;
    dataSources: Record<string, unknown>[];
    outputType: string | null;
    outputContent: string | null;
    llmModel: string;
    llmTokensUsed: number;
    llmCost: number;
    l1Assertions: Record<string, unknown>[];
    l1Passed: boolean;
    l2Score: number;
    l2Breakdown: Record<string, unknown>;
    l3Triggered: boolean;
    l3Blocked: boolean | null;
    l3Reason: string | null;
    userAction: string | null;
    draftDiff: string | null;
    finalAction: string | null;
    finalAt: Date | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
declare class AgentRunResource extends BaseResource<AgentRunData> {
    /**
     * Find a run by ID with permission check.
     */
    static findById(id: string, auth: ResourceAuth): Promise<AgentRunResource | null>;
    /**
     * Find all runs for an agent.
     */
    static findByAgent(auth: ResourceAuth, agentId: string, options?: QueryOptions): Promise<AgentRunResource[]>;
    /**
     * Find runs pending review.
     */
    static findPendingReview(auth: ResourceAuth, options?: QueryOptions): Promise<AgentRunResource[]>;
    /**
     * Create a new agent run.
     */
    static create(auth: ResourceAuth, data: {
        agentId: string;
        triggeredBy: string;
        dataSources?: Record<string, unknown>[];
        llmModel: string;
    }): Promise<AgentRunResource>;
    /**
     * Update run with output.
     */
    setOutput(data: {
        outputType: string;
        outputContent: string;
        llmTokensUsed: number;
        llmCost: number;
    }): Promise<AgentRunResource>;
    /**
     * Update run with eval results.
     */
    setEvalResult(eval_: {
        l1Assertions: Record<string, unknown>[];
        l1Passed: boolean;
        l2Score: number;
        l2Breakdown: Record<string, unknown>;
        l3Triggered: boolean;
        l3Blocked?: boolean;
        l3Reason?: string;
        status: "pending_review" | "completed" | "blocked";
    }): Promise<AgentRunResource>;
    /**
     * Record user action on the run.
     */
    setUserAction(data: {
        userAction: "approved" | "edited" | "rejected";
        draftDiff?: string;
        finalAction?: string;
    }): Promise<AgentRunResource>;
    /**
     * Mark as failed.
     */
    setFailed(reason: string): Promise<AgentRunResource>;
    get agentId(): string;
    get triggeredAt(): Date;
    get triggeredBy(): string;
    get status(): string;
    get outputType(): string | null;
    get outputContent(): string | null;
    get llmUsage(): LLMUsage;
    get evalSummary(): {
        l1Passed: boolean;
        l2Score: number;
        l3Triggered: boolean;
        l3Blocked: boolean | null;
    };
    get userAction(): string | null;
    get workspaceId(): string;
    private getLLMTier;
    toJSON(): Record<string, unknown>;
}

export { AgentResource, AgentRunResource, BaseResource, CredentialResource, type ResourceAuth, ScanResource };
