/**
 * Middleware System - Composable hooks for agent execution
 * Inspired by LangGraph's extensibility patterns
 */
import type { Middleware } from './types';
/**
 * Tracing Middleware - Logs LLM calls to AiEvent
 */
export declare const TracingMiddleware: Middleware;
/**
 * Cost Guard Middleware - Prevents execution if monthly limit exceeded
 */
export declare const CostGuardMiddleware: Middleware;
/**
 * Context Compression Middleware - Compresses old messages
 */
export declare const ContextCompressionMiddleware: Middleware;
/**
 * PII Redaction Middleware - Redacts PII from outputs before logging
 */
export declare const PiiRedactionMiddleware: Middleware;
/**
 * Safe Mode Middleware - Blocks side-effect actions if safe mode enabled
 */
export declare const SafeModeMiddleware: Middleware;
/**
 * Logging Middleware - Logs execution steps to console
 */
export declare const LoggingMiddleware: Middleware;
export declare class CostLimitError extends Error {
    constructor(message: string);
}
export declare class SafeModeBlockError extends Error {
    constructor(message: string);
}
export declare const DefaultMiddleware: Middleware[];
export declare const ProductionMiddleware: Middleware[];
//# sourceMappingURL=middleware.d.ts.map