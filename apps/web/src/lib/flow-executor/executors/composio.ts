/**
 * Composio Action Executor
 *
 * Executes Composio actions (800+ integrations) within flow workflows.
 * Uses the same ComposioClient as chat mode (route-v2.ts).
 *
 * Two entry points:
 * 1. executeComposioAction — for composioAction nodes (have composioAppKey/composioActionName)
 * 2. executeComposioFromIcon — for action nodes routed by icon (perplexity, google, youtube, etc.)
 */

import { getComposio } from "@/lib/composio-server";
import { executeAIAction } from "./ai-action";
import { withRetry } from "../retry";
import type { NodeExecContext, NodeExecResult, NodeOutput } from "../types";
import { resolveVariables, resolveVariablesInObject } from "../variable-resolver";

/** JSON.stringify wrapper that catches errors from Composio SDK response objects with getters */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return JSON.stringify(value, (_key, val) => {
        if (typeof val === "function" || typeof val === "symbol") return undefined;
        return val;
      }, 2);
    } catch {
      return String(value);
    }
  }
}

/** Deep-clone a Composio SDK result to a plain object, stripping getters/proxies */
function sanitizeResult(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    try {
      return JSON.parse(JSON.stringify(value, (_key, val) => {
        if (typeof val === "function" || typeof val === "symbol") return undefined;
        return val;
      }));
    } catch {
      return { _sanitized: true, value: String(value) };
    }
  }
}

/** Check if a Composio result indicates an API-level failure */
function isComposioFailure(result: unknown): { failed: boolean; error: string } {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.successful === false || r.successfull === false) {
      const errMsg = (r.error as string) || (r.data as Record<string, unknown>)?.message as string || "Action failed";
      return { failed: true, error: typeof errMsg === "string" ? errMsg : String(errMsg) };
    }
    // Also catch { error: true, message: "..." } pattern from Composio SDK
    if (r.error === true && typeof r.message === "string") {
      return { failed: true, error: r.message };
    }
  }
  return { failed: false, error: "" };
}

/**
 * Extract structured person context from previous outputs for Perplexity searches.
 * Instead of dumping raw JSON, this extracts the most relevant person/company fields
 * so Perplexity receives a clear, targeted research query.
 */
function extractPersonContext(
  previousOutputs: Record<string, unknown>,
  currentLoopItem: unknown,
  userMessage: string,
): string {
  const parts: string[] = [];

  // 1. Extract person name/company from loop item (most reliable source)
  if (currentLoopItem && typeof currentLoopItem === "object") {
    const item = currentLoopItem as Record<string, unknown>;
    const personParts: string[] = [];

    const name = item.name || item.fullName || item.full_name ||
      [item.firstName || item.first_name, item.lastName || item.last_name].filter(Boolean).join(" ");
    if (name) personParts.push(`Name: ${name}`);

    const company = item.company || item.organization || item.companyName || item.job_company_name;
    if (company) personParts.push(`Company: ${company}`);

    const title = item.title || item.role || item.jobTitle || item.job_title || item.headline;
    if (title) personParts.push(`Role: ${title}`);

    const email = item.email || item.emailAddress || item.work_email;
    if (email) personParts.push(`Known email: ${email}`);

    const linkedin = item.linkedin || item.linkedinUrl || item.linkedin_url || item.linkedin_id;
    if (linkedin) personParts.push(`LinkedIn: ${linkedin}`);

    if (personParts.length > 0) {
      parts.push("## Target Person\n" + personParts.join("\n"));
    }
  }

  // 2. Extract key findings from previous outputs (condensed, not raw JSON)
  for (const [nodeId, output] of Object.entries(previousOutputs)) {
    if (!output || typeof output !== "object") continue;
    const out = output as Record<string, unknown>;

    // AI response — include the text content (truncated)
    if (out.kind === "ai-response" && out.content) {
      const content = String(out.content);
      if (content.length > 500) {
        parts.push(`## Previous analysis (${nodeId})\n${content.slice(0, 500)}...`);
      } else {
        parts.push(`## Previous analysis (${nodeId})\n${content}`);
      }
    }

    // Integration data — extract key fields only
    if (out.kind === "integration" && out.data) {
      const data = out.data as Record<string, unknown>;
      const summary = extractKeyFields(data);
      if (summary) {
        parts.push(`## Data from ${nodeId}\n${summary}`);
      }
    }
  }

  // 3. User message as fallback context
  if (userMessage) {
    parts.push(`## User request\n${userMessage}`);
  }

  return parts.join("\n\n");
}

/** Priority keys to extract from integration data for Perplexity context */
const PERSON_PRIORITY_KEYS = new Set([
  "name", "fullName", "full_name", "firstName", "lastName",
  "email", "emailAddress", "work_email", "personal_emails",
  "phone", "phoneNumber", "mobile_phone",
  "company", "organization", "companyName", "job_company_name",
  "title", "role", "jobTitle", "job_title", "headline",
  "linkedin", "linkedinUrl", "linkedin_url", "linkedin_id",
  "twitter", "github", "website",
  "location", "city", "country",
  "summary", "bio", "about",
]);

/** Extract only the most relevant fields from integration data */
function extractKeyFields(data: Record<string, unknown>, maxDepth = 2): string {
  const lines: string[] = [];

  function walk(obj: Record<string, unknown>, prefix: string, depth: number) {
    if (depth > maxDepth) return;
    for (const [key, value] of Object.entries(obj)) {
      if (value == null || value === "") continue;
      if (PERSON_PRIORITY_KEYS.has(key)) {
        const val = typeof value === "object" ? JSON.stringify(value) : String(value);
        lines.push(`- ${prefix}${key}: ${val.slice(0, 200)}`);
      } else if (typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, `${prefix}${key}.`, depth + 1);
      }
    }
  }

  walk(data, "", 0);
  return lines.join("\n");
}

/** Valid Perplexity model identifiers (used in both executeComposioAction and buildActionInput) */
const VALID_PERPLEXITY_MODELS = new Set(["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro"]);

/** Map invalid/legacy Perplexity model names to the best valid alternative */
const PERPLEXITY_MODEL_ALIASES: Record<string, string> = {
  "sonar-deep-research": "sonar-pro",
};

/** Metadata keys to exclude from the action input */
const META_KEYS = new Set([
  "label",
  "icon",
  "subtitle",
  "credits",
  "description",
  "hasOutgoingEdge",
  "hasWarning",
  "warningText",
  "fieldsMode",
  "model",
  "composioAppKey",
  "composioActionName",
  "composioConfig",
  "onSelectAction",
  "onOpenReplaceModal",
  "onRename",
  "onDelete",
  "onAddErrorHandling",
  "onSetFieldsMode",
  "executionStatus",
]);

export async function executeComposioAction(
  ctx: NodeExecContext,
): Promise<NodeExecResult> {
  const { node, userId } = ctx;

  const appKey = node.data?.composioAppKey as string | undefined;
  const actionName = node.data?.composioActionName as string | undefined;

  if (!appKey || !actionName) {
    return {
      output: {
        kind: "error",
        error: `Composio action not configured: missing ${!appKey ? "appKey" : "actionName"}`,
        nodeType: "composioAction",
      },
    };
  }

  // LinkedIn → route to Apify actor (Composio doesn't have LinkedIn profile scraping)
  if (appKey === "linkedin") {
    return executeApifyLinkedIn(ctx);
  }

  // Build input from node data, excluding metadata keys
  const input: Record<string, unknown> = {};
  if (node.data) {
    for (const [key, value] of Object.entries(node.data)) {
      if (!META_KEYS.has(key) && typeof value !== "function") {
        input[key] = value;
      }
    }
  }

  // Resolve {{nodeId.field}} tokens in all string input values
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      input[key] = resolveVariables(value, ctx.state.nodeOutputs);
    }
  }

  // Inject loop context into prompt-like fields when inside a loop
  if (ctx.state.currentLoopItem) {
    const loopContext = `Current item: ${safeStringify(ctx.state.currentLoopItem)}`;
    if (input.prompt) {
      input.prompt = `${input.prompt}\n\n${loopContext}`;
    }
    if (input.userContent) {
      input.userContent = `${input.userContent}\n\n${loopContext}`;
    }
  }

  // Remap UI field names to Composio API field names for known actions
  if (appKey === "perplexityai") {
    // Ensure model is a valid Perplexity model (never leak agent-level model like "claude-haiku")
    const rawModel = (input.perplexityModel as string) || (input.model as string) || "";
    const requestedModel = PERPLEXITY_MODEL_ALIASES[rawModel] || rawModel;
    input.model = VALID_PERPLEXITY_MODELS.has(requestedModel) ? requestedModel : "sonar";
    delete input.perplexityModel;

    // Map prompt to userContent if not already set
    if (input.prompt && !input.userContent) {
      input.userContent = input.prompt;
      delete input.prompt;
      if (!input.systemContent) {
        input.systemContent = "You are a research assistant. Be concise and direct. Only include the most important findings. No filler phrases, no preamble. Use short paragraphs, not excessive bullet points.";
      }
    }
  }

  try {
    const composio = getComposio();

    const result = await withRetry(() =>
      composio.executeAction(userId, {
        name: actionName,
        input,
      }),
    );

    // Check for API-level failures (successful HTTP but action failed)
    const failure = isComposioFailure(result);
    if (failure.failed) {
      return {
        output: {
          kind: "error",
          error: `Composio action "${actionName}" (${appKey}) failed: ${failure.error}`,
          nodeType: "composioAction",
        },
      };
    }

    const output: NodeOutput = {
      kind: "integration",
      service: appKey,
      action: actionName,
      success: true,
      data: sanitizeResult(result),
    };

    return { output };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Composio error";

    return {
      output: {
        kind: "error",
        error: `Composio action "${actionName}" (${appKey}) failed: ${message}`,
        nodeType: "composioAction",
      },
    };
  }
}

// ============================================
// ICON-BASED COMPOSIO ROUTING
// ============================================

/**
 * Map action node icons to Composio app/action pairs.
 * Action names should match Composio's catalog — verify via composio.getActionsForApp().
 */
const ICON_TO_COMPOSIO: Record<string, { appKey: string; actionName: string }> = {
  perplexity: { appKey: "perplexityai", actionName: "PERPLEXITYAI_PERPLEXITY_AI_SEARCH" },
  youtube: { appKey: "youtube", actionName: "YOUTUBE_FETCH_TRANSCRIPT" },
};

/**
 * Build action-specific input from the node's UI fields.
 * Maps UI field names (prompt, perplexityModel, maxResults) to the names
 * the Composio action actually expects (query, messages, model, max_results, etc.).
 */
function buildActionInput(
  icon: string,
  nodeData: Record<string, unknown>,
  contextSummary: string,
): Record<string, unknown> {
  // Combine context (user message + previous outputs + loop item) with static prompt (instructions).
  // The static prompt is the TASK, contextSummary is the DATA — both are needed.
  const staticPrompt = (nodeData.prompt as string) || "";
  const prompt = contextSummary
    ? (staticPrompt ? `${contextSummary}\n\nInstructions: ${staticPrompt}` : contextSummary)
    : staticPrompt || "Perform the requested action";

  switch (icon) {
    case "perplexity": {
      const rawModel = (nodeData.perplexityModel as string) || (nodeData.model as string) || "";
      const requestedModel = PERPLEXITY_MODEL_ALIASES[rawModel] || rawModel;

      const result: Record<string, unknown> = {
        userContent: prompt,
        systemContent:
          "You are a research assistant specializing in finding detailed information about people and companies. " +
          "Always try to find: contact information (email, phone, social profiles), professional background, " +
          "recent activities, and key achievements. Be precise with names and data. " +
          "Structure your response with clear sections. If you cannot find specific information, say so explicitly.",
        model: VALID_PERPLEXITY_MODELS.has(requestedModel) ? requestedModel : "sonar",
      };

      // Pass through additional Perplexity API fields from node data
      if (nodeData.temperature != null) result.temperature = Number(nodeData.temperature);
      if (nodeData.searchMode) result.search_mode = nodeData.searchMode;
      if (nodeData.domainFilter) result.search_domain_filter = nodeData.domainFilter;
      if (nodeData.recencyFilter) result.search_recency_filter = nodeData.recencyFilter;
      if (nodeData.returnImages != null) result.return_images = Boolean(nodeData.returnImages);
      if (nodeData.returnRelatedQuestions != null) result.return_related_questions = Boolean(nodeData.returnRelatedQuestions);

      return result;
    }
    case "google":
      return {
        query: prompt,
        ...(nodeData.maxResults != null ? { max_results: nodeData.maxResults } : {}),
      };
    case "youtube":
      return {
        video_url: prompt,
      };
    default:
      return { query: prompt };
  }
}

/**
 * Execute an Apify LinkedIn profile lookup via the harvestapi/linkedin-profile-search actor.
 * $0.004/profile, no cookies, no LinkedIn account required.
 * Uses the synchronous run endpoint (300s timeout, returns dataset items directly).
 */
async function executeApifyLinkedIn(ctx: NodeExecContext): Promise<NodeExecResult> {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    return {
      output: {
        kind: "error",
        error: "APIFY_API_KEY is not set in environment variables",
        nodeType: "composioAction",
      },
    };
  }

  try {
    // Extract LinkedIn URL from previous node outputs or loop item
    const linkedinUrl = extractLinkedInUrl(ctx);
    if (!linkedinUrl) {
      return {
        output: {
          kind: "error",
          error: "No LinkedIn profile URL found in previous step outputs",
          nodeType: "composioAction",
        },
      };
    }

    // Apify synchronous run — returns dataset items directly (300s timeout)
    const endpoint = `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/run-sync-get-dataset-items?token=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileUrls: [linkedinUrl] }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Apify API error (${response.status}): ${errorBody}`);
    }

    const items = await response.json();
    // Apify returns an array of dataset items — take the first profile
    const result = Array.isArray(items) && items.length > 0 ? items[0] : items;

    return {
      output: {
        kind: "integration",
        service: "apify",
        action: "linkedin_profile_search",
        success: true,
        data: sanitizeResult(result),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Apify error";
    return {
      output: {
        kind: "error",
        error: `Apify LinkedIn lookup failed: ${message}`,
        nodeType: "composioAction",
      },
    };
  }
}

/** Extract a LinkedIn profile URL from context (previous outputs, loop item, or user message) */
function extractLinkedInUrl(ctx: NodeExecContext): string | null {
  const linkedinUrlPattern = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/;

  // 1. Check current loop item
  if (ctx.state.currentLoopItem) {
    const itemStr = typeof ctx.state.currentLoopItem === "string"
      ? ctx.state.currentLoopItem
      : safeStringify(ctx.state.currentLoopItem);
    const match = itemStr.match(linkedinUrlPattern);
    if (match) return match[0];
  }

  // 2. Check previous node outputs (most recent first)
  const outputs = Array.from(ctx.state.nodeOutputs.values()).reverse();
  for (const output of outputs) {
    const outputStr = safeStringify(output);
    const match = outputStr.match(linkedinUrlPattern);
    if (match) return match[0];
  }

  // 3. Check user message
  const msgMatch = ctx.state.userMessage.match(linkedinUrlPattern);
  if (msgMatch) return msgMatch[0];

  return null;
}

/**
 * Execute a Tavily search directly via their REST API (bypasses Composio auth bug).
 */
async function executeTavilySearch(query: string, maxResults = 5): Promise<unknown> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set in environment variables");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Tavily API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

/**
 * Use Claude Haiku to generate a focused search query from the flow context.
 * The static prompt is an instruction (e.g. "find the lead's LinkedIn profile URL"),
 * not search terms — so we need AI to turn it into a proper query like "Patrick Collison Stripe CEO LinkedIn".
 */
async function buildTavilyQuery(ctx: NodeExecContext): Promise<string> {
  // Gather context pieces
  const loopItem = ctx.state.currentLoopItem
    ? (typeof ctx.state.currentLoopItem === "string"
      ? ctx.state.currentLoopItem
      : safeStringify(ctx.state.currentLoopItem))
    : "";
  const userMessage = ctx.state.userMessage || "";
  const staticPrompt = (ctx.node.data?.prompt as string) || "";

  // Collect last few node outputs (keep it short for Haiku)
  const recentOutputs: string[] = [];
  for (const [, output] of ctx.state.nodeOutputs.entries()) {
    if (output.kind === "ai-response") {
      recentOutputs.push(output.content.slice(0, 500));
    } else if (output.kind === "integration" && output.data) {
      recentOutputs.push(safeStringify(output.data).slice(0, 500));
    }
  }

  try {
    const response = await ctx.claudeClient.chat({
      model: "fast",
      messages: [{
        role: "user",
        content: `Generate a short web search query (max 100 characters) for Tavily/Google search.

Context:
${loopItem ? `Current item: ${loopItem.slice(0, 300)}` : ""}
${userMessage ? `User request: ${userMessage}` : ""}
${recentOutputs.length > 0 ? `Previous results:\n${recentOutputs.join("\n").slice(0, 800)}` : ""}

Task: ${staticPrompt || "Search the web for relevant information"}

Respond with ONLY the search query text. No quotes, no explanation. Keep it short and focused on the key search terms.`,
      }],
      temperature: 0,
      maxSteps: 1,
      userId: ctx.userId,
    });

    const query = (response.content || "").trim().slice(0, 390);
    if (query.length > 5) return query;
  } catch {
    // Haiku failed — fall back to simple concatenation
  }

  // Fallback: simple concatenation without the instruction prompt
  const fallbackParts = [loopItem, userMessage].filter(Boolean);
  return fallbackParts.join(" ").slice(0, 390) || "Search the web";
}

/**
 * Execute a Tavily search as a flow node (builds context, returns NodeExecResult).
 * Uses Claude Haiku to generate a proper search query from the context + instruction prompt,
 * since raw concatenation produces bad queries (instruction text isn't search terms).
 */
async function executeTavilyDirect(ctx: NodeExecContext): Promise<NodeExecResult> {
  try {
    const query = await buildTavilyQuery(ctx);

    const maxResults = (ctx.node.data?.maxResults as number) ?? 5;
    const result = await withRetry(() => executeTavilySearch(query, maxResults));

    return {
      output: {
        kind: "integration",
        service: "tavily",
        action: "TAVILY_SEARCH",
        success: true,
        data: sanitizeResult(result),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Tavily error";
    return {
      output: {
        kind: "error",
        error: `Tavily search failed: ${message}`,
        nodeType: "action",
      },
    };
  }
}

/**
 * Execute a Composio action based on the node's icon field.
 * Used by executeActionDispatch for non-AI action nodes (perplexity, google, youtube, etc.).
 * Falls back to executeAIAction for unknown icons.
 * Note: "google" icon uses Tavily directly (Composio has an auth bug with Tavily).
 */
export async function executeComposioFromIcon(
  ctx: NodeExecContext,
): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const icon = node.data?.icon as string;

  // Google icon → direct Tavily search (bypasses Composio)
  if (icon === "google") {
    return executeTavilyDirect(ctx);
  }

  const mapping = ICON_TO_COMPOSIO[icon];

  if (!mapping) {
    // Unknown icon — fallback to AI action
    return executeAIAction(ctx);
  }

  try {
    // Build context summary from previous step outputs + current loop item
    // Use safeStringify to handle Composio SDK response objects with getters
    const previousOutputs: Record<string, unknown> = {};
    for (const [id, output] of ctx.state.nodeOutputs.entries()) {
      previousOutputs[id] = output;
    }
    // Build context — use smart extraction for Perplexity, raw for others
    const contextSummary = icon === "perplexity"
      ? extractPersonContext(previousOutputs, ctx.state.currentLoopItem, ctx.state.userMessage || "")
      : [
          ctx.state.userMessage || "",
          ctx.state.currentLoopItem ? `Current item: ${safeStringify(ctx.state.currentLoopItem)}` : "",
          Object.keys(previousOutputs).length > 0
            ? `Previous step outputs: ${safeStringify(previousOutputs)}`
            : "",
        ].filter(Boolean).join("\n\n");

    // Resolve {{nodeId.field}} tokens in node data before building input
    const resolvedData = resolveVariablesInObject(
      (node.data || {}) as Record<string, unknown>,
      ctx.state.nodeOutputs,
    );
    // Build action-specific input (maps UI fields to API fields)
    const input = buildActionInput(icon, resolvedData, contextSummary);
    const composio = getComposio();

    const result = await withRetry(() =>
      composio.executeAction(userId, {
        name: mapping.actionName,
        input,
      }),
    );

    // Check for API-level failures
    const failure = isComposioFailure(result);
    if (failure.failed) {
      return {
        output: {
          kind: "error",
          error: `Composio action "${mapping.actionName}" (${mapping.appKey}) failed: ${failure.error}`,
          nodeType: "composioAction",
        },
      };
    }

    const output: NodeOutput = {
      kind: "integration",
      service: mapping.appKey,
      action: mapping.actionName,
      success: true,
      data: sanitizeResult(result),
    };

    return { output };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Composio error";

    return {
      output: {
        kind: "error",
        error: `Composio action "${mapping.actionName}" (${mapping.appKey}) failed: ${message}`,
        nodeType: "composioAction",
      },
    };
  }
}

/**
 * Execute People Data Labs actions via Composio.
 *
 * Action routing:
 * - find-by-email/phone/social → ENRICH_PERSON_DATA (has a unique identifier)
 * - find-by-name (full/partial) → ENRICH if company/location available, else PEOPLE_SEARCH_ELASTIC
 * - search-*                    → *_SEARCH_ELASTIC  (elasticsearch DSL query)
 */

/**
 * Build the correct Composio action + input from node UI fields and context.
 *
 * ENRICH_PERSON_DATA needs: a primary ID (email, phone, profile) OR name + secondary (company, location, school).
 * PEOPLE_SEARCH_ELASTIC needs: query (elasticsearch DSL JSON string), size.
 */
/** Extract a field from the current loop item by trying multiple key names */
function extractFromLoopItem(ctx: NodeExecContext, keys: string[]): string {
  const item = ctx.state.currentLoopItem;
  if (!item || typeof item !== "object") return "";
  const obj = item as Record<string, unknown>;

  for (const key of keys) {
    const val = obj[key];
    if (val && typeof val === "string") return val.trim();
  }

  // Try composing name from firstName + lastName
  if (keys.includes("name") || keys.includes("fullName")) {
    const first = (obj.firstName || obj.first_name) as string | undefined;
    const last = (obj.lastName || obj.last_name) as string | undefined;
    if (first || last) return [first, last].filter(Boolean).join(" ").trim();
  }

  return "";
}

function resolvePdlAction(
  actionType: string,
  nodeData: Record<string, unknown>,
  ctx: NodeExecContext,
): { actionName: string; input: Record<string, unknown> } {
  switch (actionType) {
    // Unique identifier actions → always ENRICH
    case "pdl-find-by-email":
      return {
        actionName: "PEOPLEDATALABS_ENRICH_PERSON_DATA",
        input: {
          email: nodeData.email as string,
          ...(nodeData.company ? { company: nodeData.company } : {}),
          ...(nodeData.location ? { location: nodeData.location } : {}),
        },
      };
    case "pdl-find-by-phone":
      return {
        actionName: "PEOPLEDATALABS_ENRICH_PERSON_DATA",
        input: {
          phone: nodeData.phone as string,
          ...(nodeData.company ? { company: nodeData.company } : {}),
        },
      };
    case "pdl-find-by-social":
      return {
        actionName: "PEOPLEDATALABS_ENRICH_PERSON_DATA",
        input: {
          profile: nodeData.socialNetworkUrl as string,
          ...(nodeData.company ? { company: nodeData.company } : {}),
        },
      };

    // Name-based actions → always PEOPLE_SEARCH_ELASTIC (ENRICH requires strict secondary fields)
    case "pdl-find-by-full-name": {
      // Try node data first, then loop item, then extract from previous outputs
      const name = (nodeData.fullName as string)
        || extractFromLoopItem(ctx, ["name", "fullName", "full_name"])
        || extractFieldFromContext(ctx, "full_name")
        || extractFieldFromContext(ctx, "name")
        || "";

      if (!name) {
        return {
          actionName: "PEOPLEDATALABS_PEOPLE_SEARCH_ELASTIC",
          input: { _error: "No person name found in node data or previous step outputs" },
        };
      }

      const company = (nodeData.company as string)
        || extractFromLoopItem(ctx, ["company", "organization", "companyName", "job_company_name"])
        || extractFieldFromContext(ctx, "company")
        || "";

      const location = (nodeData.location as string)
        || extractFromLoopItem(ctx, ["location", "city", "country"])
        || "";

      const must: Record<string, unknown>[] = [{ match: { full_name: name } }];
      if (company) must.push({ match: { job_company_name: company } });
      if (location) must.push({ match: { location_name: location } });

      return {
        actionName: "PEOPLEDATALABS_PEOPLE_SEARCH_ELASTIC",
        input: {
          query: JSON.stringify({ bool: { must } }),
          size: (nodeData.limit as number) || 1,
        },
      };
    }
    case "pdl-find-by-partial-name": {
      const firstName = (nodeData.firstName as string)
        || extractFromLoopItem(ctx, ["firstName", "first_name"])
        || "";
      const lastName = (nodeData.lastName as string)
        || extractFromLoopItem(ctx, ["lastName", "last_name"])
        || "";
      const company = (nodeData.company as string)
        || extractFromLoopItem(ctx, ["company", "organization", "companyName", "job_company_name"])
        || extractFieldFromContext(ctx, "company")
        || "";
      const location = (nodeData.location as string)
        || extractFromLoopItem(ctx, ["location", "city", "country"])
        || "";

      const must: Record<string, unknown>[] = [];
      if (firstName) must.push({ match: { first_name: firstName } });
      if (lastName) must.push({ match: { last_name: lastName } });
      if (company) must.push({ match: { job_company_name: company } });
      if (location) must.push({ match: { location_name: location } });

      if (must.length === 0) {
        return {
          actionName: "PEOPLEDATALABS_PEOPLE_SEARCH_ELASTIC",
          input: { _error: "No name or identifying fields found in node data or previous step outputs" },
        };
      }

      return {
        actionName: "PEOPLEDATALABS_PEOPLE_SEARCH_ELASTIC",
        input: {
          query: JSON.stringify({ bool: { must } }),
          size: (nodeData.limit as number) || 1,
        },
      };
    }

    // Broad search actions → always SEARCH_ELASTIC
    case "search-companies":
      return {
        actionName: "PEOPLEDATALABS_COMPANY_SEARCH_ELASTIC",
        input: {
          query: (nodeData.searchQuery as string) || "",
          size: (nodeData.limit as number) || 5,
        },
      };
    case "search-people":
      return {
        actionName: "PEOPLEDATALABS_PEOPLE_SEARCH_ELASTIC",
        input: {
          query: (nodeData.searchQuery as string) || "",
          size: (nodeData.limit as number) || 5,
        },
      };
    default:
      return { actionName: "", input: {} };
  }
}

/** Try to extract a field value (company, location) from previous node outputs */
function extractFieldFromContext(ctx: NodeExecContext, field: string): string {
  const pattern = new RegExp(`(?:"${field}"\\s*:\\s*"([^"]+)"|${field}[:\\s]+([^,\\n"}{]+))`, "i");
  for (const output of Array.from(ctx.state.nodeOutputs.values()).reverse()) {
    const str = safeStringify(output);
    const match = str.match(pattern);
    if (match) return (match[1] || match[2] || "").trim();
  }
  return "";
}

export async function executePeopleDataLabsViaComposio(
  ctx: NodeExecContext,
): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const actionType =
    (node.data?.actionType as string) || "pdl-find-by-full-name";

  // Resolve action + input (may switch between ENRICH and SEARCH depending on available data)
  const { actionName, input } = resolvePdlAction(actionType, node.data || {}, ctx);
  if (!actionName) {
    return {
      output: {
        kind: "error",
        error: `Unknown People Data Labs action type: "${actionType}"`,
        nodeType: "peopleDataLabs",
      },
    };
  }

  // Check for extraction errors (e.g. no name found in context)
  if (input._error) {
    return {
      output: {
        kind: "error",
        error: input._error as string,
        nodeType: "peopleDataLabs",
      },
    };
  }

  try {
    const composio = getComposio();

    const result = await withRetry(() =>
      composio.executeAction(userId, {
        name: actionName,
        input,
      }),
    );

    // Check for API-level failures
    const failure = isComposioFailure(result);
    if (failure.failed) {
      return {
        output: {
          kind: "error",
          error: `People Data Labs "${actionType}" via Composio failed: ${failure.error}`,
          nodeType: "peopleDataLabs",
        },
      };
    }

    return {
      output: {
        kind: "integration",
        service: "peopledatalabs",
        action: actionName,
        success: true,
        data: sanitizeResult(result),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Composio error";

    return {
      output: {
        kind: "error",
        error: `People Data Labs "${actionType}" via Composio failed: ${message}`,
        nodeType: "peopleDataLabs",
      },
    };
  }
}
