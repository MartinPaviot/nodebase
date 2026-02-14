import { z } from 'zod';
import { ConnectorCategory, ConnectorConfig } from '@nodebase/types';
import { Composio } from 'composio-core';

/**
 * Base Connector Interface
 *
 * All connectors must implement this interface.
 */

interface ConnectorContext {
    workspaceId: string;
    userId: string;
    credentialId: string;
    accessToken?: string;
}
interface ActionResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: {
        requestId?: string;
        rateLimitRemaining?: number;
        rateLimitReset?: Date;
    };
}
interface ActionDefinition<TInput = unknown, TOutput = unknown> {
    id: string;
    name: string;
    description: string;
    inputSchema: z.ZodType<TInput>;
    outputSchema: z.ZodType<TOutput>;
    execute: (input: TInput, context: ConnectorContext) => Promise<ActionResult<TOutput>>;
}
interface TriggerDefinition<TOutput = unknown> {
    id: string;
    name: string;
    description: string;
    outputSchema: z.ZodType<TOutput>;
}
declare abstract class BaseConnector {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly category: ConnectorCategory;
    abstract readonly icon: string;
    abstract readonly pipedreamAppSlug?: string;
    abstract readonly requiredScopes: string[];
    abstract readonly optionalScopes?: string[];
    protected actions: Map<string, ActionDefinition>;
    protected triggers: Map<string, TriggerDefinition>;
    /**
     * Register an action.
     */
    protected registerAction<TInput, TOutput>(action: ActionDefinition<TInput, TOutput>): void;
    /**
     * Register a trigger.
     */
    protected registerTrigger<TOutput>(trigger: TriggerDefinition<TOutput>): void;
    /**
     * Get all actions.
     */
    getActions(): ActionDefinition[];
    /**
     * Get all triggers.
     */
    getTriggers(): TriggerDefinition[];
    /**
     * Get an action by ID.
     */
    getAction(actionId: string): ActionDefinition | undefined;
    /**
     * Get a trigger by ID.
     */
    getTrigger(triggerId: string): TriggerDefinition | undefined;
    /**
     * Execute an action.
     */
    executeAction<TInput, TOutput>(actionId: string, input: TInput, context: ConnectorContext): Promise<ActionResult<TOutput>>;
    /**
     * Test the connection with current credentials.
     */
    abstract testConnection(context: ConnectorContext): Promise<ActionResult<boolean>>;
    /**
     * Get the OAuth URL for connecting this connector.
     */
    abstract getOAuthUrl(state: string, redirectUri: string): string;
    /**
     * Exchange OAuth code for tokens.
     */
    abstract exchangeOAuthCode(code: string, redirectUri: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    /**
     * Refresh the access token.
     */
    abstract refreshAccessToken(refreshToken: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    /**
     * Get connector config for display.
     */
    toConfig(): ConnectorConfig;
}

/**
 * Composio Client
 *
 * Wrapper for Composio SDK that handles:
 * - OAuth flows for 800+ APIs (free tier: 100 users)
 * - Tool calling native support for LLMs (Claude, OpenAI, etc.)
 * - Pre-built actions for mainstream tools
 * - Token management and refresh (automatic)
 */

interface ComposioConfig {
    apiKey: string;
    baseUrl?: string;
}
interface ComposioApp {
    key: string;
    name: string;
    description: string;
    logo: string;
    categories: string[];
    auth_schemes: Array<{
        mode: "OAUTH2" | "OAUTH1" | "API_KEY" | "BASIC";
        name: string;
    }>;
}
interface ComposioConnection {
    id: string;
    integrationId: string;
    connectionParams: Record<string, unknown>;
    appName: string;
    status: "ACTIVE" | "EXPIRED" | "INVALID";
    createdAt: string;
}
interface ComposioToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
}
declare class ComposioClient {
    private client;
    private config;
    constructor(config: ComposioConfig);
    /**
     * Get all available apps.
     */
    getApps(): Promise<ComposioApp[]>;
    /**
     * Search apps by name.
     */
    searchApps(query: string): Promise<ComposioApp[]>;
    /**
     * Get app details by key.
     */
    getApp(appKey: string): Promise<ComposioApp | null>;
    /**
     * Initiate connection flow for a user.
     * Returns the OAuth URL to redirect the user to.
     */
    initiateConnection(options: {
        userId: string;
        appName: string;
        redirectUrl?: string;
        labels?: string[];
    }): Promise<{
        redirectUrl: string;
        connectionId: string;
    }>;
    /**
     * Get all connected accounts for a user (entity).
     */
    getConnections(userId: string): Promise<ComposioConnection[]>;
    /**
     * Get a specific connection by ID.
     */
    getConnection(connectionId: string): Promise<ComposioConnection | null>;
    /**
     * Delete a connection.
     */
    deleteConnection(connectionId: string): Promise<void>;
    /**
     * Get tools (actions) available for the user, formatted for LLM tool calling.
     * Composio natively supports Claude, OpenAI, LangChain, CrewAI, etc.
     *
     * @param userId - The user entity ID
     * @param options - Filter by apps or specific actions
     * @returns Array of tool definitions compatible with Claude/OpenAI tool calling
     */
    getTools(userId: string, options?: {
        apps?: string[];
        actions?: string[];
        useCase?: string;
    }): Promise<ComposioToolDefinition[]>;
    /**
     * Execute a tool (action) on behalf of a user.
     * Composio handles the OAuth token, API call, rate limiting, retries, etc.
     *
     * @param userId - The user entity ID
     * @param toolCall - The tool call from the LLM (name + input)
     * @returns The result of the action
     */
    executeAction<T = unknown>(userId: string, toolCall: {
        name: string;
        input: Record<string, unknown>;
    }): Promise<T>;
    /**
     * Get available actions for an app.
     * Useful for discovering what actions are available.
     */
    getActionsForApp(appKey: string): Promise<Array<{
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    }>>;
    /**
     * Get the raw Composio client for advanced usage.
     */
    getRawClient(): Composio;
}
declare function initComposio(config: ComposioConfig): ComposioClient;
declare function getComposio(): ComposioClient;

/**
 * Pipedream Connect Client
 *
 * Wrapper for Pipedream Connect API that handles:
 * - OAuth flows for 2,800+ APIs
 * - Token management and refresh
 * - Rate limiting
 */
interface PipedreamConfig {
    publicKey: string;
    secretKey: string;
    projectId: string;
    baseUrl?: string;
}
interface PipedreamAccount {
    id: string;
    name: string;
    app: string;
    healthy: boolean;
    dead: boolean;
    createdAt: string;
    updatedAt: string;
}
interface PipedreamApp {
    id: string;
    name_slug: string;
    name: string;
    description: string;
    img_src: string;
    categories: string[];
    auth_type: "oauth" | "keys" | "none";
}
declare class PipedreamClient {
    private config;
    constructor(config: PipedreamConfig);
    /**
     * Get all available apps.
     */
    getApps(): Promise<PipedreamApp[]>;
    /**
     * Search apps by name.
     */
    searchApps(query: string): Promise<PipedreamApp[]>;
    /**
     * Get app details.
     */
    getApp(appSlug: string): Promise<PipedreamApp | null>;
    /**
     * Get connected accounts for the project.
     */
    getAccounts(externalUserId?: string): Promise<PipedreamAccount[]>;
    /**
     * Get a specific account.
     */
    getAccount(accountId: string): Promise<PipedreamAccount | null>;
    /**
     * Delete an account.
     */
    deleteAccount(accountId: string): Promise<void>;
    /**
     * Get the OAuth connect URL for an app.
     */
    getConnectUrl(options: {
        app: string;
        externalUserId: string;
        redirectUri: string;
        state?: string;
    }): string;
    /**
     * Get auth credentials for an account.
     * Returns the access token that can be used to make API calls.
     */
    getAuthCredentials(accountId: string): Promise<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>;
    /**
     * Execute a Pipedream action.
     */
    executeAction<T = unknown>(accountId: string, actionSlug: string, input: Record<string, unknown>): Promise<T>;
    /**
     * Make an authenticated API request.
     */
    private request;
}

/**
 * Connector Registry
 *
 * Central registry for all available connectors.
 */

declare class ConnectorRegistry {
    private connectors;
    /**
     * Register a connector.
     */
    register(connector: BaseConnector): void;
    /**
     * Get a connector by ID.
     */
    get(connectorId: string): BaseConnector | undefined;
    /**
     * Get all connectors.
     */
    getAll(): BaseConnector[];
    /**
     * Get connectors by category.
     */
    getByCategory(category: ConnectorCategory): BaseConnector[];
    /**
     * Get all connector configs for display.
     */
    getAllConfigs(): ConnectorConfig[];
    /**
     * Search connectors by name.
     */
    search(query: string): BaseConnector[];
    /**
     * Check if a connector is registered.
     */
    has(connectorId: string): boolean;
    /**
     * Get connector count.
     */
    count(): number;
}
declare function getConnectorRegistry(): ConnectorRegistry;
/**
 * Initialize the registry with default connectors.
 */
declare function initConnectorRegistry(): ConnectorRegistry;

/**
 * HubSpot Connector
 *
 * CRM connector for HubSpot API.
 */

declare class HubSpotConnector extends BaseConnector {
    readonly id = "hubspot";
    readonly name = "HubSpot";
    readonly description = "CRM, marketing, and sales platform";
    readonly category: "CRM";
    readonly icon = "logos:hubspot";
    readonly pipedreamAppSlug = "hubspot";
    readonly requiredScopes: string[];
    readonly optionalScopes: string[];
    constructor();
    private registerActions;
    private searchContacts;
    private getDeal;
    private searchDeals;
    private createContact;
    private updateDeal;
    testConnection(context: ConnectorContext): Promise<ActionResult<boolean>>;
    getOAuthUrl(state: string, redirectUri: string): string;
    exchangeOAuthCode(code: string, redirectUri: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    refreshAccessToken(refreshToken: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    private apiRequest;
}

/**
 * Gmail Connector
 *
 * Email connector for Gmail API.
 */

declare class GmailConnector extends BaseConnector {
    readonly id = "gmail";
    readonly name = "Gmail";
    readonly description = "Google email service";
    readonly category: "EMAIL";
    readonly icon = "logos:google-gmail";
    readonly pipedreamAppSlug = "gmail";
    readonly requiredScopes: string[];
    readonly optionalScopes: string[];
    constructor();
    private registerActions;
    private sendEmail;
    private searchEmails;
    private getEmail;
    private replyEmail;
    private sendColdEmail;
    private searchReplies;
    private searchBounces;
    testConnection(context: ConnectorContext): Promise<ActionResult<boolean>>;
    getOAuthUrl(state: string, redirectUri: string): string;
    exchangeOAuthCode(code: string, redirectUri: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    refreshAccessToken(refreshToken: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    private createMimeMessage;
    private detectBounceType;
    private extractOriginalRecipient;
    private extractOriginalSubject;
    private apiRequest;
}

/**
 * Slack Connector
 *
 * Messaging connector for Slack API.
 */

declare class SlackConnector extends BaseConnector {
    readonly id = "slack";
    readonly name = "Slack";
    readonly description = "Team communication platform";
    readonly category: "MESSAGING";
    readonly icon = "logos:slack-icon";
    readonly pipedreamAppSlug = "slack";
    readonly requiredScopes: string[];
    readonly optionalScopes: string[];
    constructor();
    private registerActions;
    private sendMessage;
    private listChannels;
    private getChannelHistory;
    testConnection(context: ConnectorContext): Promise<ActionResult<boolean>>;
    getOAuthUrl(state: string, redirectUri: string): string;
    exchangeOAuthCode(code: string, redirectUri: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    refreshAccessToken(refreshToken: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    private apiRequest;
}

/**
 * Google Calendar Connector
 *
 * Calendar connector for Google Calendar API.
 */

declare class CalendarConnector extends BaseConnector {
    readonly id = "google-calendar";
    readonly name = "Google Calendar";
    readonly description = "Google calendar and scheduling";
    readonly category: "CALENDAR";
    readonly icon = "logos:google-calendar";
    readonly pipedreamAppSlug = "google_calendar";
    readonly requiredScopes: string[];
    readonly optionalScopes: string[];
    constructor();
    private registerActions;
    private createEvent;
    private listEvents;
    private getFreeBusy;
    private updateEvent;
    private deleteEvent;
    testConnection(context: ConnectorContext): Promise<ActionResult<boolean>>;
    getOAuthUrl(state: string, redirectUri: string): string;
    exchangeOAuthCode(code: string, redirectUri: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    refreshAccessToken(refreshToken: string): Promise<ActionResult<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>>;
    private apiRequest;
}

export { type ActionResult, BaseConnector, CalendarConnector, ComposioClient, type ComposioConfig, type ConnectorContext, ConnectorRegistry, GmailConnector, HubSpotConnector, PipedreamClient, type PipedreamConfig, SlackConnector, getComposio, getConnectorRegistry, initComposio, initConnectorRegistry };
