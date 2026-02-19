/**
 * Variable Resolver
 *
 * Resolves {{nodeId.fieldId}} tokens in strings at runtime by looking up
 * actual values from FlowState.nodeOutputs.
 *
 * Supports:
 * - Simple field access: {{nodeId.content}} → string value
 * - Nested field access: {{nodeId.data.email}} → traverses into objects
 * - All NodeOutput kinds: trigger, ai-response, integration, condition, etc.
 * - Graceful fallback for unresolved tokens
 */

import type { NodeOutput, FlowState } from "./types";

/** Pattern: {{nodeId.field}} or {{nodeId.field.nested.path}} */
const TOKEN_PATTERN = /\{\{([^.}]+)\.([^}]+)\}\}/g;

/**
 * Resolve all {{nodeId.fieldId}} tokens in a string.
 * Returns the string with tokens replaced by actual values.
 */
export function resolveVariables(
  text: string,
  nodeOutputs: Map<string, NodeOutput>,
): string {
  if (!text || !text.includes("{{")) return text;

  return text.replace(TOKEN_PATTERN, (match, nodeId: string, fieldPath: string) => {
    const output = nodeOutputs.get(nodeId);
    if (!output) {
      console.warn(`[variable-resolver] Unresolved node: ${nodeId} (token: ${match})`);
      return match; // Leave as-is
    }

    const value = extractField(output, fieldPath);
    if (value === undefined) {
      console.warn(`[variable-resolver] Unresolved field: ${fieldPath} on node ${nodeId} (kind: ${output.kind})`);
      return match; // Leave as-is
    }

    // Stringify objects/arrays, return primitives as-is
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Resolve variables in all string values of an object (shallow).
 * Useful for resolving all fields of a node's data before execution.
 */
export function resolveVariablesInObject(
  obj: Record<string, unknown>,
  nodeOutputs: Map<string, NodeOutput>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      resolved[key] = resolveVariables(value, nodeOutputs);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Check if a string contains any {{nodeId.field}} tokens.
 */
export function hasVariableTokens(text: string): boolean {
  return TOKEN_PATTERN.test(text);
}

// ── Field extraction ──────────────────────────────────────────────

/**
 * Extract a field value from a NodeOutput.
 * Supports dotted paths for nested access (e.g., "data.email").
 */
function extractField(output: NodeOutput, fieldPath: string): unknown {
  // Split path for nested access (e.g., "data.email" → ["data", "email"])
  const parts = fieldPath.split(".");
  const topField = parts[0];

  // First, get the top-level value from the output based on its kind
  let value = getTopLevelField(output, topField);

  // If the top-level field didn't match any known field, try treating the
  // entire output as a record and access the field directly
  if (value === undefined) {
    value = (output as Record<string, unknown>)[topField];
  }

  // Traverse nested path (e.g., data.contacts[0].email)
  if (parts.length > 1 && value !== undefined && value !== null) {
    value = traversePath(value, parts.slice(1));
  }

  return value;
}

/**
 * Get a top-level field value from a NodeOutput based on its kind.
 */
function getTopLevelField(output: NodeOutput, field: string): unknown {
  switch (output.kind) {
    case "trigger":
      if (field === "message") return output.message;
      return undefined;

    case "ai-response":
      if (field === "content") return output.content;
      if (field === "model") return output.model;
      if (field === "tokensIn") return output.tokensIn;
      if (field === "tokensOut") return output.tokensOut;
      return undefined;

    case "condition":
      if (field === "selectedBranch") return output.selectedBranch;
      if (field === "reasoning") return output.reasoning;
      if (field === "branchIndex") return output.branchIndex;
      if (field === "method") return output.method;
      return undefined;

    case "loop":
      if (field === "currentIndex") return output.currentIndex;
      if (field === "collectionSize") return output.collectionSize;
      if (field === "completed") return output.completed;
      if (field === "loopNumber") return output.loopNumber;
      // "item" is resolved from loop stack, not output
      return undefined;

    case "integration":
      if (field === "data") return output.data;
      if (field === "service") return output.service;
      if (field === "action") return output.action;
      if (field === "success") return output.success;
      // Allow accessing nested data fields directly: {{nodeId.response}} → output.data.response
      if (output.data && typeof output.data === "object") {
        const dataValue = (output.data as Record<string, unknown>)[field];
        if (dataValue !== undefined) return dataValue;
      }
      return undefined;

    case "knowledge-search":
      if (field === "context") return output.context;
      if (field === "resultCount") return output.resultCount;
      return undefined;

    case "passthrough":
      if (field === "nodeType") return output.nodeType;
      return undefined;

    case "error":
      if (field === "error") return output.error;
      if (field === "nodeType") return output.nodeType;
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Traverse a dotted path into an object.
 * Supports array index access: "items.0.name"
 */
function traversePath(value: unknown, parts: string[]): unknown {
  let current = value;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index)) return undefined;
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}
