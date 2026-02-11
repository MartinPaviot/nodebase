"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// src/eval/index.ts
var eval_exports = {};
__export(eval_exports, {
  getEvalRegistry: () => getEvalRegistry,
  registerL1Assertion: () => registerL1Assertion,
  registerL2Criterion: () => registerL2Criterion,
  runL1Eval: () => runL1Eval,
  runL2Eval: () => runL2Eval,
  runL3Eval: () => runL3Eval
});
function runL1Eval(content, assertions) {
  const results = [];
  let allPassed = true;
  for (const assertion of assertions) {
    const result = runAssertion(content, assertion);
    results.push(result);
    if (!result.passed && assertion.severity === "block") {
      allPassed = false;
    }
  }
  return { passed: allPassed, assertions: results };
}
function runAssertion(content, assertion) {
  const { check, params } = assertion;
  switch (check) {
    case "contains_recipient_name":
      return checkContainsRecipientName(content, params);
    case "no_placeholders":
      return checkNoPlaceholders(content);
    case "no_hallucination":
      return checkNoHallucination(content, params);
    case "correct_language":
      return checkCorrectLanguage(content, params);
    case "min_length":
      return checkMinLength(content, params);
    case "max_length":
      return checkMaxLength(content, params);
    case "no_profanity":
      return checkNoProfanity(content);
    case "contains_cta":
      return checkContainsCTA(content);
    case "no_competitor_mentions":
      return checkNoCompetitorMentions(content, params);
    case "references_real_exchange":
      return checkReferencesRealExchange(content, params);
    default:
      return { check, passed: true, message: `Unknown assertion: ${check}` };
  }
}
function checkContainsRecipientName(content, params) {
  const name = params?.name;
  if (!name) {
    return { check: "contains_recipient_name", passed: true, message: "No name provided to check" };
  }
  const passed = content.toLowerCase().includes(name.toLowerCase());
  return {
    check: "contains_recipient_name",
    passed,
    message: passed ? void 0 : `Content does not mention recipient name: ${name}`
  };
}
function checkNoPlaceholders(content) {
  const placeholderPatterns = [
    /\[.*?\]/g,
    // [PLACEHOLDER]
    /\{.*?\}/g,
    // {placeholder}
    /<<.*?>>/g,
    // <<placeholder>>
    /\[INSERT.*?\]/gi,
    // [INSERT NAME]
    /\[YOUR.*?\]/gi,
    // [YOUR COMPANY]
    /XXX+/g
    // XXXX
  ];
  for (const pattern of placeholderPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      return {
        check: "no_placeholders",
        passed: false,
        message: `Found placeholder(s): ${matches.join(", ")}`
      };
    }
  }
  return { check: "no_placeholders", passed: true };
}
function checkNoHallucination(content, params) {
  const knownFacts = params?.knownFacts ?? [];
  const suspiciousPatterns = [
    /\d{1,3}% (increase|decrease|growth|reduction)/i,
    /\$\d+[,\d]* (saved|earned|revenue)/i,
    /\d+ (customers|users|clients) (using|love|trust)/i
  ];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content) && knownFacts.length === 0) {
      return {
        check: "no_hallucination",
        passed: false,
        message: "Content may contain unverified statistics"
      };
    }
  }
  return { check: "no_hallucination", passed: true };
}
function checkCorrectLanguage(content, params) {
  const expectedLanguage = params?.language ?? "en";
  const languagePatterns = {
    en: [/\b(the|and|is|are|to|for)\b/gi],
    fr: [/\b(le|la|les|et|est|sont|pour)\b/gi],
    de: [/\b(der|die|das|und|ist|sind|für)\b/gi],
    es: [/\b(el|la|los|las|y|es|son|para)\b/gi]
  };
  const patterns = languagePatterns[expectedLanguage];
  if (!patterns) {
    return { check: "correct_language", passed: true, message: "Unknown language" };
  }
  const matches = patterns.reduce((count, pattern) => {
    const m = content.match(pattern);
    return count + (m?.length ?? 0);
  }, 0);
  const passed = matches > 5;
  return {
    check: "correct_language",
    passed,
    message: passed ? void 0 : `Content may not be in ${expectedLanguage}`
  };
}
function checkMinLength(content, params) {
  const minLength = params?.min ?? 50;
  const passed = content.length >= minLength;
  return {
    check: "min_length",
    passed,
    message: passed ? void 0 : `Content is ${content.length} chars, minimum is ${minLength}`
  };
}
function checkMaxLength(content, params) {
  const maxLength = params?.max ?? 5e3;
  const passed = content.length <= maxLength;
  return {
    check: "max_length",
    passed,
    message: passed ? void 0 : `Content is ${content.length} chars, maximum is ${maxLength}`
  };
}
function checkNoProfanity(content) {
  const profanityPatterns = [
    /\b(damn|hell|crap)\b/gi
    // Mild
    // Add more patterns as needed
  ];
  for (const pattern of profanityPatterns) {
    if (pattern.test(content)) {
      return {
        check: "no_profanity",
        passed: false,
        message: "Content may contain inappropriate language"
      };
    }
  }
  return { check: "no_profanity", passed: true };
}
function checkContainsCTA(content) {
  const ctaPatterns = [
    /\b(click|call|contact|reply|schedule|book|sign up|register|learn more|get started)\b/gi,
    /\?$/m,
    // Ends with a question
    /let me know/gi,
    /would you like/gi
  ];
  for (const pattern of ctaPatterns) {
    if (pattern.test(content)) {
      return { check: "contains_cta", passed: true };
    }
  }
  return {
    check: "contains_cta",
    passed: false,
    message: "Content does not contain a clear call-to-action"
  };
}
function checkNoCompetitorMentions(content, params) {
  const competitors = params?.competitors ?? [];
  for (const competitor of competitors) {
    if (content.toLowerCase().includes(competitor.toLowerCase())) {
      return {
        check: "no_competitor_mentions",
        passed: false,
        message: `Content mentions competitor: ${competitor}`
      };
    }
  }
  return { check: "no_competitor_mentions", passed: true };
}
function checkReferencesRealExchange(content, params) {
  const conversationHistory = params?.history ?? [];
  if (conversationHistory.length === 0) {
    return { check: "references_real_exchange", passed: true };
  }
  const referencePhrases = [
    /as (you|we) (mentioned|discussed)/gi,
    /following up on/gi,
    /regarding (your|our)/gi,
    /as per (your|our)/gi
  ];
  for (const pattern of referencePhrases) {
    if (pattern.test(content)) {
      return { check: "references_real_exchange", passed: true };
    }
  }
  return {
    check: "references_real_exchange",
    passed: false,
    message: "Content does not reference previous conversation"
  };
}
async function runL2Eval(content, criteria) {
  const breakdown = {};
  let totalScore = 0;
  for (const criterion of criteria) {
    const score = await scoreCriterion(content, criterion);
    breakdown[criterion] = score;
    totalScore += score;
  }
  return {
    score: criteria.length > 0 ? totalScore / criteria.length : 1,
    breakdown
  };
}
async function scoreCriterion(content, criterion) {
  const criterionLower = criterion.toLowerCase();
  if (criterionLower.includes("professional")) {
    return scoreForProfessionalTone(content);
  }
  if (criterionLower.includes("empathetic") || criterionLower.includes("empathy")) {
    return scoreForEmpathy(content);
  }
  if (criterionLower.includes("concise")) {
    return scoreForConciseness(content);
  }
  if (criterionLower.includes("clear") || criterionLower.includes("clarity")) {
    return scoreForClarity(content);
  }
  return 0.7;
}
function scoreForProfessionalTone(content) {
  let score = 0.7;
  if (/\b(thank|appreciate|pleased|happy to)\b/gi.test(content)) score += 0.1;
  if (/\b(best regards|sincerely|regards)\b/gi.test(content)) score += 0.1;
  if (/!!+/.test(content)) score -= 0.1;
  if (/\b(lol|omg|btw)\b/gi.test(content)) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}
function scoreForEmpathy(content) {
  let score = 0.5;
  if (/\b(understand|sorry|apologize|appreciate)\b/gi.test(content)) score += 0.2;
  if (/\b(frustrating|difficult|challenging)\b/gi.test(content)) score += 0.1;
  if (/\b(help|assist|support)\b/gi.test(content)) score += 0.1;
  return Math.max(0, Math.min(1, score));
}
function scoreForConciseness(content) {
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 50) return 0.6;
  if (wordCount <= 200) return 1;
  if (wordCount <= 300) return 0.8;
  if (wordCount <= 500) return 0.6;
  return 0.4;
}
function scoreForClarity(content) {
  let score = 0.7;
  if (content.includes("\n\n")) score += 0.1;
  if (/^\d+\.|^-|^\*/m.test(content)) score += 0.1;
  const avgWordLength = content.length / content.split(/\s+/).length;
  if (avgWordLength > 7) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}
async function runL3Eval(content, triggerConditions) {
  const evalPrompt = buildL3EvalPrompt(content, triggerConditions);
  try {
    return {
      blocked: false,
      confidence: 0.9,
      reason: "Mock L3 eval - not connected to AIClient yet"
    };
  } catch (error) {
    console.error("L3 eval failed:", error);
    return {
      blocked: true,
      confidence: 0,
      reason: `L3 eval error: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}
function buildL3EvalPrompt(content, triggerConditions) {
  return `You are evaluating whether an AI agent's output is safe to execute.

## Trigger Conditions
The following conditions triggered this L3 evaluation:
${triggerConditions.map((c) => `- ${c}`).join("\n")}

## Agent Output to Evaluate
\`\`\`
${content}
\`\`\`

## Your Task
Evaluate whether this output should be **blocked** or **allowed** to execute.

Consider:
- Could this output cause harm, loss, or unintended consequences?
- Does it contain sensitive information that shouldn't be sent?
- Is it attempting an irreversible action (deleting data, sending money, etc.)?
- Does it respect user privacy and data protection?
- Are there any hallucinations or factual errors?

Respond with:
1. **blocked**: true if the output should be blocked, false if allowed
2. **confidence**: 0.0 to 1.0 (how confident you are in your decision)
3. **reason**: Brief explanation of your decision`;
}
function registerL1Assertion(name, fn) {
  evalRegistry.l1Assertions.set(name, fn);
}
function registerL2Criterion(name, fn) {
  evalRegistry.l2Criteria.set(name, fn);
}
function getEvalRegistry() {
  return evalRegistry;
}
var evalRegistry;
var init_eval = __esm({
  "src/eval/index.ts"() {
    "use strict";
    evalRegistry = {
      l1Assertions: /* @__PURE__ */ new Map(),
      l2Criteria: /* @__PURE__ */ new Map()
    };
  }
});

// src/agent-engine/index.ts
var agent_engine_exports = {};
__export(agent_engine_exports, {
  AgentEngine: () => AgentEngine,
  costTrackingHook: () => costTrackingHook,
  errorLoggingHook: () => errorLoggingHook,
  getAgentEngine: () => getAgentEngine,
  initAgentEngine: () => initAgentEngine,
  loggingHook: () => loggingHook
});
module.exports = __toCommonJS(agent_engine_exports);
var import_nanoid2 = require("nanoid");
var import_types = require("@nodebase/types");

// src/observability/index.ts
var import_nanoid = require("nanoid");
var AgentTracer = class {
  constructor(input, onSave) {
    this.input = input;
    this.onSave = onSave;
    this.traceId = `trace_${(0, import_nanoid.nanoid)(12)}`;
    this.startTime = Date.now();
  }
  traceId;
  steps = [];
  startTime;
  metrics = {
    totalDurationMs: 0,
    llmCalls: 0,
    toolCalls: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
    stepsCount: 0
  };
  /**
   * Get the trace ID
   */
  getTraceId() {
    return this.traceId;
  }
  /**
   * Log a step in the trace
   */
  logStep(step) {
    const stepId = `step_${(0, import_nanoid.nanoid)(10)}`;
    const fullStep = {
      ...step,
      id: stepId,
      timestamp: /* @__PURE__ */ new Date()
    };
    this.steps.push(fullStep);
    this.metrics.stepsCount++;
    if (step.type === "llm_call") {
      this.metrics.llmCalls++;
      if (step.metadata?.tokensIn) {
        this.metrics.totalTokensIn += step.metadata.tokensIn;
      }
      if (step.metadata?.tokensOut) {
        this.metrics.totalTokensOut += step.metadata.tokensOut;
      }
      if (step.metadata?.cost) {
        this.metrics.totalCost += step.metadata.cost;
      }
    } else if (step.type === "tool_call") {
      this.metrics.toolCalls++;
    }
    if (step.durationMs) {
      this.metrics.totalDurationMs += step.durationMs;
    }
    return stepId;
  }
  /**
   * Log an LLM call
   */
  logLLMCall(params) {
    return this.logStep({
      type: "llm_call",
      input: typeof params.input === "string" ? { prompt: params.input } : params.input,
      output: typeof params.output === "string" ? { response: params.output } : params.output,
      durationMs: params.durationMs,
      metadata: {
        model: params.model,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
        cost: params.cost
      }
    });
  }
  /**
   * Log a tool call
   */
  logToolCall(params) {
    return this.logStep({
      type: "tool_call",
      input: params.input,
      output: params.output,
      durationMs: params.durationMs,
      error: params.error ? { message: params.error } : void 0,
      metadata: {
        toolName: params.toolName,
        success: params.success
      }
    });
  }
  /**
   * Log an agent decision
   */
  logDecision(params) {
    return this.logStep({
      type: "decision",
      input: { reasoning: params.reasoning },
      output: { decision: params.decision },
      metadata: params.metadata
    });
  }
  /**
   * Log an error
   */
  logError(error) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : void 0;
    return this.logStep({
      type: "error",
      error: {
        message: errorMessage,
        stack: errorStack
      }
    });
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalDurationMs: Date.now() - this.startTime
    };
  }
  /**
   * Get all steps
   */
  getSteps() {
    return [...this.steps];
  }
  /**
   * Complete the trace and save
   */
  async complete(params) {
    const finalMetrics = this.getMetrics();
    const trace = {
      id: this.traceId,
      agentId: this.input.agentId,
      conversationId: this.input.conversationId,
      userId: this.input.userId,
      workspaceId: this.input.workspaceId,
      triggeredBy: this.input.triggeredBy,
      userMessage: this.input.userMessage,
      status: params?.status || "completed",
      output: params?.output,
      steps: this.steps,
      metrics: finalMetrics,
      startedAt: new Date(this.startTime),
      completedAt: /* @__PURE__ */ new Date(),
      durationMs: finalMetrics.totalDurationMs
    };
    if (this.onSave) {
      await this.onSave(trace);
    }
  }
};
function createTracer(input, onSave) {
  return new AgentTracer(input, onSave);
}

// src/agent-engine/index.ts
var AgentEngine = class {
  hooks = {
    before: [],
    after: [],
    onError: []
  };
  aiClient;
  // AIClient from @nodebase/ai
  composioClient;
  // ComposioClient from @nodebase/connectors
  connectorRegistry;
  // ConnectorRegistry from @nodebase/connectors
  constructor(dependencies) {
    this.aiClient = dependencies?.aiClient;
    this.composioClient = dependencies?.composioClient;
    this.connectorRegistry = dependencies?.connectorRegistry;
  }
  /**
   * Register a before hook.
   */
  onBefore(hook) {
    this.hooks.before.push(hook);
  }
  /**
   * Register an after hook.
   */
  onAfter(hook) {
    this.hooks.after.push(hook);
  }
  /**
   * Register an error hook.
   */
  onError(hook) {
    this.hooks.onError.push(hook);
  }
  /**
   * Execute an agent.
   */
  async execute(config, context) {
    const runId = `run_${(0, import_nanoid2.nanoid)(10)}`;
    const startTime = Date.now();
    const tracer = createTracer({
      agentId: context.agentId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      triggeredBy: context.triggeredBy,
      metadata: {
        agentName: config.name,
        llmTier: config.llmTier,
        temperature: config.temperature,
        maxStepsPerRun: config.maxStepsPerRun
      }
    });
    try {
      for (const hook of this.hooks.before) {
        await hook(context);
      }
      tracer.logDecision({
        reasoning: `Fetching data from ${config.fetchSources.length} sources`,
        decision: "fetch_data",
        metadata: { sources: config.fetchSources.map((s) => s.source) }
      });
      const fetchedData = await this.fetchData(config.fetchSources, context, tracer);
      const prompt = this.buildPrompt(config, context, fetchedData);
      const llmStartTime = Date.now();
      const llmResult = await this.executeLLM(config, prompt, context);
      const llmDuration = Date.now() - llmStartTime;
      tracer.logLLMCall({
        model: llmResult.model,
        input: prompt,
        output: llmResult.content,
        tokensIn: llmResult.tokensIn,
        tokensOut: llmResult.tokensOut,
        cost: llmResult.cost,
        durationMs: llmDuration
      });
      const evalResult = await this.runEval(config.evalRules, llmResult.content, context);
      tracer.logDecision({
        reasoning: `Eval: L1=${evalResult.l1Passed}, L2=${evalResult.l2Score}, L3=${evalResult.l3Triggered ? "triggered" : "skipped"}`,
        decision: evalResult.finalDecision,
        metadata: {
          l1Passed: evalResult.l1Passed,
          l2Score: evalResult.l2Score,
          l3Triggered: evalResult.l3Triggered,
          l3Blocked: evalResult.l3Blocked
        }
      });
      const status = this.determineStatus(evalResult, config.evalRules);
      const result = {
        runId,
        output: {
          type: "text",
          content: llmResult.content,
          metadata: { fetchedData }
        },
        llmUsage: {
          model: llmResult.model,
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
          cost: llmResult.cost,
          latencyMs: Date.now() - startTime
        },
        evalResult,
        status
      };
      await tracer.complete({
        output: llmResult.content,
        status
      });
      for (const hook of this.hooks.after) {
        await hook(context, result);
      }
      return result;
    } catch (error) {
      tracer.logError(error);
      await tracer.complete({ status: "failed" });
      for (const hook of this.hooks.onError) {
        await hook(context, error);
      }
      throw new import_types.AgentExecutionError(
        context.agentId,
        runId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  /**
   * Fetch data from all configured sources.
   */
  async fetchData(sources, context, tracer) {
    const results = {};
    for (const source of sources) {
      const toolStartTime = Date.now();
      try {
        if (this.composioClient && source.query) {
          try {
            const data = await this.composioClient.executeAction(
              context.workspaceId,
              {
                name: `${source.source}_${source.query}`,
                input: source.filters || {}
              }
            );
            results[source.source] = data;
            tracer.logToolCall({
              toolName: source.source,
              input: source.filters || {},
              output: data,
              durationMs: Date.now() - toolStartTime,
              success: true
            });
          } catch (composioError) {
            console.error(
              `Composio fetch failed for ${source.source}:`,
              composioError
            );
            results[source.source] = { error: "fetch_failed" };
            tracer.logToolCall({
              toolName: source.source,
              input: source.filters || {},
              output: null,
              durationMs: Date.now() - toolStartTime,
              success: false,
              error: composioError instanceof Error ? composioError.message : String(composioError)
            });
          }
        } else {
          results[source.source] = {
            _mock: true,
            message: "Inject ComposioClient for real data"
          };
          tracer.logToolCall({
            toolName: source.source,
            input: source.filters || {},
            output: results[source.source],
            durationMs: Date.now() - toolStartTime,
            success: true
          });
        }
      } catch (error) {
        console.error(`Failed to fetch from ${source.source}:`, error);
        results[source.source] = { error: "fetch_failed" };
        tracer.logToolCall({
          toolName: source.source,
          input: source.filters || {},
          output: null,
          durationMs: Date.now() - toolStartTime,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return results;
  }
  /**
   * Build the prompt with system prompt, fetched data, and user context.
   */
  buildPrompt(config, context, fetchedData) {
    const parts = [];
    parts.push(config.systemPrompt);
    if (Object.keys(fetchedData).length > 0) {
      parts.push("\n## Available Data\n");
      for (const [source, data] of Object.entries(fetchedData)) {
        parts.push(`### ${source}
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`);
      }
    }
    if (context.additionalContext) {
      parts.push("\n## Additional Context\n");
      parts.push(JSON.stringify(context.additionalContext, null, 2));
    }
    if (context.userMessage) {
      parts.push("\n## User Request\n");
      parts.push(context.userMessage);
    }
    return parts.join("\n");
  }
  /**
   * Execute the LLM call.
   */
  async executeLLM(config, prompt, context) {
    try {
      const modelMap = {
        haiku: "claude-3-5-haiku-20241022",
        sonnet: "claude-sonnet-4-20250514",
        opus: "claude-opus-4-20250514"
      };
      if (this.aiClient) {
        try {
          const result = await this.aiClient.message({
            tier: config.llmTier,
            systemPrompt: prompt,
            messages: [
              {
                role: "user",
                content: context.userMessage || "Process the data and respond."
              }
            ],
            temperature: config.temperature,
            maxTokens: 4096
          });
          return {
            content: result.content,
            model: result.model,
            tokensIn: result.usage.inputTokens,
            tokensOut: result.usage.outputTokens,
            cost: this.calculateCost(
              config.llmTier,
              result.usage.inputTokens,
              result.usage.outputTokens
            )
          };
        } catch (aiError) {
          console.error("AIClient execution failed:", aiError);
        }
      }
      return {
        content: "This is a mock response from the agent. Inject AIClient for real responses.",
        model: modelMap[config.llmTier],
        tokensIn: prompt.length / 4,
        // Rough estimation
        tokensOut: 100,
        // Mock value
        cost: this.calculateCost(config.llmTier, prompt.length / 4, 100)
      };
    } catch (error) {
      throw new import_types.AgentExecutionError(
        config.id,
        context.userId,
        `LLM execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Calculate cost based on tier and token usage.
   */
  calculateCost(tier, tokensIn, tokensOut) {
    const pricing = {
      haiku: { input: 1e-3, output: 5e-3 },
      // $1 / $5 per million tokens
      sonnet: { input: 3e-3, output: 0.015 },
      // $3 / $15 per million tokens
      opus: { input: 0.015, output: 0.075 }
      // $15 / $75 per million tokens
    };
    const rates = pricing[tier];
    return (tokensIn * rates.input + tokensOut * rates.output) / 1e6;
  }
  /**
   * Run evaluation on the output.
   */
  async runEval(rules, content, context) {
    const { runL1Eval: runL1Eval2, runL2Eval: runL2Eval2, runL3Eval: runL3Eval2 } = await Promise.resolve().then(() => (init_eval(), eval_exports));
    const l1Result = runL1Eval2(content, rules.l1.assertions);
    let l2Score = 0;
    let l2Breakdown = {};
    if (l1Result.passed) {
      const l2Result = await runL2Eval2(content, rules.l2.criteria);
      l2Score = l2Result.score;
      l2Breakdown = l2Result.breakdown;
    }
    const l3Triggered = this.shouldTriggerL3(rules, l1Result.passed, l2Score);
    let l3Blocked = false;
    let l3Reason;
    if (l3Triggered) {
      const l3Result = await runL3Eval2(content, rules.l3.triggerConditions);
      l3Blocked = l3Result.blocked;
      l3Reason = l3Result.reason;
    }
    const finalDecision = this.determineFinalDecision(
      l1Result.passed,
      l2Score,
      l3Blocked,
      rules
    );
    return {
      runId: `run_${(0, import_nanoid2.nanoid)(10)}`,
      l1Passed: l1Result.passed,
      l1Assertions: l1Result.assertions,
      l2Score,
      l2Breakdown,
      l3Triggered,
      l3Blocked,
      l3Reason,
      finalDecision
    };
  }
  /**
   * Determine if L3 evaluation should trigger.
   */
  shouldTriggerL3(rules, l1Passed, l2Score) {
    if (!l1Passed) return true;
    if (l2Score < rules.minConfidence) return true;
    if (rules.requireApproval) return true;
    return false;
  }
  /**
   * Determine final decision based on all eval results.
   */
  determineFinalDecision(l1Passed, l2Score, l3Blocked, rules) {
    if (l3Blocked) return "blocked";
    if (!l1Passed) return "blocked";
    if (l2Score >= rules.autoSendThreshold && !rules.requireApproval) {
      return "auto_send";
    }
    return "needs_review";
  }
  /**
   * Determine run status based on eval result.
   */
  determineStatus(evalResult, rules) {
    switch (evalResult.finalDecision) {
      case "auto_send":
        return "completed";
      case "needs_review":
        return "pending_review";
      case "blocked":
        return "blocked";
      default:
        return "pending_review";
    }
  }
};
var _agentEngine = null;
function initAgentEngine() {
  _agentEngine = new AgentEngine();
  return _agentEngine;
}
function getAgentEngine() {
  if (!_agentEngine) {
    _agentEngine = new AgentEngine();
  }
  return _agentEngine;
}
var loggingHook = async (context, result) => {
  console.log(`[Agent ${context.agentId}] Run ${result.runId} completed`, {
    status: result.status,
    cost: result.llmUsage.cost,
    latency: result.llmUsage.latencyMs
  });
};
var costTrackingHook = async (context, result) => {
  console.log(`[Cost] Agent ${context.agentId}: $${result.llmUsage.cost.toFixed(4)}`);
};
var errorLoggingHook = async (context, error) => {
  console.error(`[Agent ${context.agentId}] Error:`, error.message);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentEngine,
  costTrackingHook,
  errorLoggingHook,
  getAgentEngine,
  initAgentEngine,
  loggingHook
});
