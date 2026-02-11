import { ScanCategory, ScanSignal, WorkspaceId, ScanResult } from '@nodebase/types';

/**
 * Scan Engine
 *
 * Detects signals across connected services:
 * - Dormant deals in CRM
 * - Tickets approaching SLA
 * - Unprocessed applications
 * - Overdue invoices
 */

interface ScanConfig {
    category: ScanCategory;
    connectorIds: string[];
    rules: ScanRule[];
}
interface ScanRule {
    id: string;
    name: string;
    description: string;
    connector: string;
    query: string;
    severity: ScanSignal["severity"];
    transform: (data: unknown) => ScanSignal[];
}
interface ScanContext {
    workspaceId: WorkspaceId;
    credentials: Map<string, {
        accessToken: string;
    }>;
}
interface ScanEngineConfig {
    maxConcurrentScans?: number;
    timeoutMs?: number;
    retryAttempts?: number;
}
declare const DEFAULT_SCAN_RULES: Record<ScanCategory, ScanRule[]>;
declare class ScanEngine {
    private config;
    private composioClient?;
    private connectorRegistry?;
    constructor(config?: ScanEngineConfig, dependencies?: {
        composioClient?: any;
        connectorRegistry?: any;
    });
    /**
     * Run a scan for a specific category.
     */
    scan(category: ScanCategory, context: ScanContext, options?: {
        rules?: ScanRule[];
    }): Promise<ScanResult>;
    /**
     * Run scans for all categories.
     */
    scanAll(context: ScanContext): Promise<ScanResult[]>;
    /**
     * Get signals by severity across all results.
     */
    getSignalsBySeverity(results: ScanResult[], severity: ScanSignal["severity"]): ScanSignal[];
    /**
     * Get critical signals (high + critical) across all results.
     */
    getCriticalSignals(results: ScanResult[]): ScanSignal[];
    /**
     * Execute a single scan rule.
     */
    private executeRule;
    /**
     * Parse a pseudo-query into a Composio action and filters.
     * Example: "deals.where(lastActivity < 7d AND stage != 'closed')"
     * Returns: { action: "hubspot_search_deals", filters: { ... } }
     */
    private parseQuery;
    /**
     * Get mock data for testing.
     * In production, this would be removed and actual Composio calls would be used.
     */
    private getMockDataForRule;
}
declare function initScanEngine(config?: ScanEngineConfig): ScanEngine;
declare function getScanEngine(): ScanEngine;

export { DEFAULT_SCAN_RULES, type ScanConfig, type ScanContext, ScanEngine, type ScanEngineConfig, type ScanRule, getScanEngine, initScanEngine };
