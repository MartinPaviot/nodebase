# Eval Layer - Complete Guide

## Overview

3-tier evaluation system for AI output quality and safety:

| Level | Type | Speed | Cost | When to use |
|-------|------|-------|------|-------------|
| **L1** | Deterministic assertions | Instant | Free | Always (blocking) |
| **L2** | Rule-based scoring | Fast | Free | Always (quality) |
| **L3** | LLM as Judge | Slow | $0.001-0.01 | Irreversible actions only |

---

## Quick Start

```typescript
import { evaluateContent } from "@/lib/eval";

const result = await evaluateContent({
  text: "Dear John, I hope this email finds you well...",
  userId: "user_123",
  action: "send_email",
  enableL1: true,
  enableL2: true,
  enableL3: true,
  l1Assertions: [
    { check: "no_placeholders", severity: "block" },
    { check: "contains_recipient_name", severity: "block" },
  ],
  l2MinScore: 60,
});

if (!result.passed) {
  console.log("Blocked:", result.blockReason);
  console.log("Suggestions:", result.suggestions);
} else if (result.canAutoSend) {
  // Auto-send (score >= 85 and all checks passed)
  await sendEmail(text);
} else if (result.requiresApproval) {
  // Show to user for approval
  await showApprovalUI(text, result);
}
```

---

## L1: Deterministic Assertions

Fast, rule-based checks. Block immediately if failed.

### Available Assertions

```typescript
const assertions: Assertion[] = [
  // Block placeholders like {{name}}, [Name], {variable}
  { check: "no_placeholders", severity: "block" },

  // Ensure recipient name is present
  { check: "contains_recipient_name", severity: "block" },

  // Block generic greetings
  { check: "no_generic_greeting", severity: "warn" },

  // Respect length limits
  { check: "respects_max_length", severity: "warn", params: { maxLength: 5000 } },
  { check: "respects_min_length", severity: "warn", params: { minLength: 50 } },

  // Language check
  { check: "correct_language", severity: "warn", params: { language: "en" } },

  // Profanity filter
  { check: "no_profanity", severity: "block" },

  // Email validation
  { check: "has_valid_email", severity: "warn", params: { requireEmail: true } },

  // Content check
  { check: "has_real_content", severity: "block" },
];
```

### Example Usage

```typescript
import { evaluateL1 } from "@/lib/eval";

const result = await evaluateL1(
  text,
  [
    { check: "no_placeholders", severity: "block" },
    { check: "contains_recipient_name", severity: "block" },
  ],
  { recipientName: "John Doe" }
);

if (!result.passed) {
  console.log("Failed assertions:", result.failedAssertions);
  // Output: [{ check: "contains_recipient_name", passed: false, message: "..." }]
}

console.log("Warnings:", result.warnings);
```

---

## L2: Rule-Based Scoring

Scores quality (0-100) across 4 dimensions:

### Dimensions

1. **Relevance** (30%) - Is response on-topic?
2. **Quality** (25%) - Grammar, structure, clarity
3. **Tone** (20%) - Professional, friendly, appropriate
4. **Completeness** (25%) - All info present

### Example Usage

```typescript
import { evaluateL2 } from "@/lib/eval";

const result = await evaluateL2(
  text,
  { minScore: 70 },
  {
    query: "How do I reset my password?",
    expectedTone: "professional",
    requiredElements: ["password", "reset", "email"],
  }
);

console.log("Score:", result.score); // 0-100
console.log("Passed:", result.passed); // score >= 70
console.log("Breakdown:", result.breakdown);
// [
//   { dimension: "relevance", score: 85, weight: 0.3, issues: [] },
//   { dimension: "quality", score: 75, weight: 0.25, issues: ["Run-on sentences detected"] },
//   { dimension: "tone", score: 90, weight: 0.2, issues: [] },
//   { dimension: "completeness", score: 70, weight: 0.25, issues: ["Missing closing"] }
// ]

console.log("Recommendations:", result.recommendations);
// ["Improve quality: Run-on sentences detected, Sentences too long"]
```

### Custom Weights

```typescript
const result = await evaluateL2(
  text,
  {
    minScore: 60,
    weights: {
      relevance: 0.5, // Prioritize relevance
      quality: 0.2,
      tone: 0.1,
      completeness: 0.2,
    },
  }
);
```

---

## L3: LLM as Judge

Use LLM to evaluate LLM output. Most accurate, but costs $ and takes time.

### When to Use

- **Irreversible actions**: Send email, post social media, delete data
- **High-stakes content**: Legal, financial, medical
- **L2 failures**: When rule-based score is too low

### Example Usage

```typescript
import { evaluateL3 } from "@/lib/eval";

const result = await evaluateL3(
  text,
  {
    action: "send_email",
    context: { recipientName: "John", company: "Acme Corp" },
    tier: "fast", // Use Haiku (cheap)
    autoSendThreshold: 85,
  },
  userId
);

console.log("Score:", result.score); // 0-100
console.log("Should block:", result.shouldBlock); // Hard block
console.log("Should warn:", result.shouldWarn); // Needs review
console.log("Can auto-send:", result.canAutoSend); // score >= 85
console.log("Reason:", result.reason);
console.log("Suggestions:", result.suggestions);
console.log("Confidence:", result.confidence); // 0-1
```

### Cost

- **Haiku** (fast tier): ~$0.001 per eval (~500 tokens)
- **Sonnet** (smart tier): ~$0.005 per eval
- **Opus** (deep tier): ~$0.025 per eval

**Recommendation**: Use Haiku for most cases.

---

## Complete Evaluation Pipeline

Orchestrate L1 → L2 → L3 with smart triggering.

### Progressive Evaluation

```typescript
import { evaluateContent } from "@/lib/eval";

const result = await evaluateContent({
  text: draftEmail,
  userId: "user_123",
  action: "send_email",
  context: { recipientName: "John Doe" },

  // L1: Block if assertions fail
  enableL1: true,
  l1Assertions: [
    { check: "no_placeholders", severity: "block" },
    { check: "contains_recipient_name", severity: "block" },
    { check: "no_profanity", severity: "block" },
    { check: "has_real_content", severity: "block" },
  ],

  // L2: Score quality
  enableL2: true,
  l2MinScore: 60,

  // L3: LLM judge (only for irreversible actions)
  enableL3: true,
  l3Trigger: "on_irreversible_action", // or "always" or "on_l2_fail"
  l3AutoSendThreshold: 85,
});

// Decision tree
if (!result.passed) {
  // Hard block
  console.error("Blocked:", result.blockReason);
  showError(result.blockReason, result.suggestions);
} else if (result.canAutoSend) {
  // Auto-send (all checks passed, score >= 85)
  await sendEmail(draftEmail);
  showSuccess("Email sent!");
} else if (result.requiresApproval) {
  // Show to user for approval
  showApprovalDialog({
    text: draftEmail,
    score: result.l2Score,
    suggestions: result.suggestions,
    onApprove: () => sendEmail(draftEmail),
    onEdit: () => openEditor(draftEmail, result.suggestions),
  });
}
```

### L3 Trigger Strategies

```typescript
// Strategy 1: Always run L3 (most secure, but expensive)
l3Trigger: "always"

// Strategy 2: Only for irreversible actions (recommended)
l3Trigger: "on_irreversible_action"
// Irreversible: send_email, post_social, delete_data, transfer_money, etc.

// Strategy 3: Only when L2 fails (cheapest, less secure)
l3Trigger: "on_l2_fail"
```

---

## Agent Template Integration

Configure eval rules in agent templates.

```typescript
const dealRevivalAgent: AgentTemplate = {
  name: "Deal Revival Agent",
  systemPrompt: "...",

  // Eval configuration
  evalRules: {
    // L1 assertions
    assertions: [
      { check: "contains_recipient_name", severity: "block" },
      { check: "no_placeholders", severity: "block" },
      { check: "no_profanity", severity: "block" },
      { check: "has_real_content", severity: "block" },
      { check: "correct_language", severity: "warn", params: { language: "en" } },
    ],

    // L2 config
    min_confidence: 0.6, // L2 minScore
    l2_weights: {
      relevance: 0.4,
      quality: 0.3,
      tone: 0.1,
      completeness: 0.2,
    },

    // L3 config
    l3_trigger: "on_irreversible_action",
    auto_send_threshold: 0.85,
    require_approval: true,
  },

  actions: [
    {
      type: "draft_email",
      require_approval: true, // Always require approval for emails
    },
  ],
};
```

---

## Performance & Cost

### L1 Performance

- **Latency**: <5ms
- **Cost**: $0
- **Always run**: Yes

### L2 Performance

- **Latency**: 10-50ms
- **Cost**: $0
- **Always run**: Yes

### L3 Performance

| Tier | Model | Latency | Cost per eval | When to use |
|------|-------|---------|---------------|-------------|
| Fast | Haiku | 1-2s | $0.001 | Default |
| Smart | Sonnet | 2-5s | $0.005 | Complex evals |
| Deep | Opus | 5-10s | $0.025 | Critical only |

**Cost calculation (1000 evals/day):**
- L1 + L2: $0/month
- + L3 (Haiku, 10% trigger): $3/month
- + L3 (Haiku, 100% trigger): $30/month
- + L3 (Sonnet, 100% trigger): $150/month

---

## Best Practices

### 1. Always run L1 + L2

```typescript
// ✅ Good
enableL1: true,
enableL2: true,
```

### 2. Use L3 selectively

```typescript
// ✅ Good - only for irreversible actions
l3Trigger: "on_irreversible_action"

// ❌ Bad - expensive
l3Trigger: "always"
```

### 3. Set appropriate thresholds

```typescript
// ✅ Good - balanced
l2MinScore: 60,  // Require review if < 60
l3AutoSendThreshold: 85,  // Auto-send if >= 85

// ❌ Too strict - everything needs approval
l2MinScore: 90

// ❌ Too loose - poor quality auto-sent
l2MinScore: 30
```

### 4. Use context

```typescript
// ✅ Good - provide context
context: {
  recipientName: "John Doe",
  company: "Acme Corp",
  previousConversation: "...",
}

// ❌ Bad - no context
context: {}
```

---

## Testing

```typescript
import { evaluateContent } from "@/lib/eval";

describe("Eval Layer", () => {
  it("should block placeholder text", async () => {
    const result = await evaluateContent({
      text: "Dear {{name}}, ...",
      userId: "test",
      action: "send_email",
      enableL1: true,
      l1Assertions: [{ check: "no_placeholders", severity: "block" }],
    });

    expect(result.passed).toBe(false);
    expect(result.blockReason).toContain("placeholder");
  });

  it("should pass high quality content", async () => {
    const result = await evaluateContent({
      text: "Dear John, I hope this email finds you well. I wanted to follow up on our conversation about the Q4 roadmap...",
      userId: "test",
      action: "send_email",
      enableL1: true,
      enableL2: true,
      l1Assertions: [
        { check: "no_placeholders", severity: "block" },
        { check: "contains_recipient_name", severity: "block" },
      ],
      l2MinScore: 60,
      context: { recipientName: "John" },
    });

    expect(result.passed).toBe(true);
    expect(result.l2Score).toBeGreaterThan(70);
  });
});
```

---

## Migration from Current Code

**Before (no eval):**
```typescript
const draft = await generateEmail(input);
await sendEmail(draft); // 🔴 No validation
```

**After (with eval):**
```typescript
const draft = await generateEmail(input);

const evalResult = await evaluateContent({
  text: draft,
  userId,
  action: "send_email",
  enableL1: true,
  enableL2: true,
  enableL3: true,
  l1Assertions: [
    { check: "no_placeholders", severity: "block" },
    { check: "contains_recipient_name", severity: "block" },
  ],
  l2MinScore: 60,
  context: { recipientName: input.recipientName },
});

if (!evalResult.passed) {
  throw new Error(evalResult.blockReason);
}

if (evalResult.canAutoSend) {
  await sendEmail(draft); // ✅ Safe to auto-send
} else {
  await requestUserApproval(draft, evalResult); // ⚠️ Needs review
}
```

---

## Next Steps

1. Configure eval rules in agent templates
2. Wire eval into agent chat route
3. Add approval UI for low-scoring content
4. Monitor eval scores in analytics
