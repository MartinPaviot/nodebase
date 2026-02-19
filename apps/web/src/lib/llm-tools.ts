import { z } from "zod";
import type { ClaudeTool } from "@/lib/ai/claude-client";

// ============================================
// TOOL DEFINITION INTERFACE
// ============================================

export interface ToolDef {
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any) => Promise<Record<string, unknown>>;
}

// ============================================
// ZOD → JSON SCHEMA CONVERTER (for Anthropic API)
// ============================================

export function zodToInputSchema(schema: z.ZodTypeAny): ClaudeTool["input_schema"] {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const { jsonSchema, isOptional } = convertZodType(value as z.ZodTypeAny);
      properties[key] = jsonSchema;
      if (!isOptional) {
        required.push(key);
      }
    }

    return { type: "object", properties, ...(required.length > 0 ? { required } : {}) };
  }

  return { type: "object", properties: {} };
}

function convertZodType(zodType: z.ZodTypeAny): { jsonSchema: Record<string, unknown>; isOptional: boolean } {
  let isOptional = false;
  let current = zodType;

  // Unwrap optional and default wrappers
  while (true) {
    if (current instanceof z.ZodOptional) {
      isOptional = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodDefault) {
      isOptional = true;
      current = current.removeDefault();
    } else {
      break;
    }
  }

  const description = current.description;
  let schema: Record<string, unknown> = {};

  if (current instanceof z.ZodString) {
    schema = { type: "string" };
  } else if (current instanceof z.ZodNumber) {
    schema = { type: "number" };
  } else if (current instanceof z.ZodBoolean) {
    schema = { type: "boolean" };
  } else if (current instanceof z.ZodArray) {
    const itemSchema = convertZodType(current.element);
    schema = { type: "array", items: itemSchema.jsonSchema };
  } else if (current instanceof z.ZodEnum) {
    schema = { type: "string", enum: current.options };
  } else if (current instanceof z.ZodObject) {
    schema = zodToInputSchema(current);
  } else {
    schema = { type: "string" };
  }

  if (description) {
    schema.description = description;
  }

  return { jsonSchema: schema, isOptional };
}

// ============================================
// TOOL NAME SANITIZER
// ============================================

export function sanitizeToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ============================================
// TOOL MAP → CLAUDE TOOLS CONVERTER
// ============================================

export function toolMapToClaudeTools(toolMap: Record<string, ToolDef>): ClaudeTool[] {
  return Object.entries(toolMap).map(([name, tool]) => ({
    name,
    description: tool.description,
    input_schema: zodToInputSchema(tool.parameters),
  }));
}
