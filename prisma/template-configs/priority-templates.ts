/**
 * Priority Templates Configuration
 *
 * Ces 10 templates sont prioritaires pour la V1.
 * Chaque template a besoin de:
 * - fetchSources: d'où l'agent récupère les données
 * - evalRules: critères d'évaluation L1/L2/L3
 * - actions: ce que l'agent peut faire
 * - llmTier: niveau de modèle (haiku/sonnet/opus)
 * - maxStepsPerRun: limite de steps par exécution
 */

import { AgentModel } from "@prisma/client";

// ============================================
// CATEGORY PRESETS (Automatisables)
// ============================================

export const EVAL_PRESETS = {
  SALES: {
    L1: { // Automated checks
      responseTime: { max: 30000 }, // 30s max
      sentimentPositive: { min: 0.6 },
      containsCallToAction: true,
    },
    L2: { // LLM judge
      criteria: [
        "Response addresses the lead's specific pain points",
        "Tone is professional yet personable",
        "No over-promising or misleading claims",
        "Clear next steps are provided",
      ],
      passingScore: 0.7,
    },
    L3: { // Human review triggers
      triggerConditions: [
        "Deal value > $10,000",
        "Lead from enterprise segment",
        "Negative sentiment detected",
      ],
    },
  },
  SUPPORT: {
    L1: {
      responseTime: { max: 60000 }, // 60s max
      resolutionAttempted: true,
      noHallucinatedInfo: true,
    },
    L2: {
      criteria: [
        "Answer is factually correct based on knowledge base",
        "Empathetic tone maintained",
        "Escalation offered when appropriate",
        "No sensitive data exposed",
      ],
      passingScore: 0.8,
    },
    L3: {
      triggerConditions: [
        "Customer marked as VIP",
        "Issue involves billing/refund",
        "Multiple failed resolution attempts",
      ],
    },
  },
  MARKETING: {
    L1: {
      brandGuidelinesCompliant: true,
      contentLength: { min: 100, max: 5000 },
      noCompetitorMentions: true,
    },
    L2: {
      criteria: [
        "Content aligns with brand voice",
        "SEO keywords naturally integrated",
        "Call-to-action is clear and compelling",
        "No grammatical errors",
      ],
      passingScore: 0.75,
    },
    L3: {
      triggerConditions: [
        "Content for paid advertising",
        "Press release or official statement",
        "Content mentions legal/compliance topics",
      ],
    },
  },
  HR: {
    L1: {
      noDiscriminatoryLanguage: true,
      complianceCheckPassed: true,
      responseTime: { max: 120000 },
    },
    L2: {
      criteria: [
        "Evaluation is objective and criteria-based",
        "No bias indicators present",
        "Candidate privacy respected",
        "Consistent with job requirements",
      ],
      passingScore: 0.85,
    },
    L3: {
      triggerConditions: [
        "Senior/executive position",
        "Candidate requests human review",
        "Edge case in evaluation criteria",
      ],
    },
  },
  OPERATIONS: {
    L1: {
      dataAccuracyVerified: true,
      noMissingFields: true,
      formatCorrect: true,
    },
    L2: {
      criteria: [
        "Summary captures all key points",
        "Priorities correctly identified",
        "Actionable items are clear",
        "No critical information omitted",
      ],
      passingScore: 0.8,
    },
    L3: {
      triggerConditions: [
        "Critical system alert",
        "Budget-impacting decision",
        "Cross-team escalation needed",
      ],
    },
  },
  RESEARCH: {
    L1: {
      sourcesProvided: true,
      noHallucination: true,
      recencyCheck: { maxAgeDays: 30 },
    },
    L2: {
      criteria: [
        "Sources are credible and verifiable",
        "Analysis is balanced and objective",
        "Conclusions are supported by evidence",
        "Limitations are acknowledged",
      ],
      passingScore: 0.8,
    },
    L3: {
      triggerConditions: [
        "Competitive intelligence",
        "Market-moving information",
        "Legal/regulatory research",
      ],
    },
  },
} as const;

// ============================================
// PRIORITY TEMPLATE CONFIGURATIONS
// ============================================

export const PRIORITY_TEMPLATES = {
  // ----------------------------------------
  // 1. LEAD QUALIFIER (SALES)
  // ----------------------------------------
  "lead-qualifier": {
    name: "Lead Qualifier",
    category: "SALES",
    llmTier: "sonnet", // Balance cost/quality for high volume
    maxStepsPerRun: 10,

    fetchSources: [
      {
        type: "CRM",
        provider: "hubspot", // ou salesforce, pipedrive
        dataPoints: ["contact_info", "company", "deal_history", "engagement"],
      },
      {
        type: "ENRICHMENT",
        provider: "people-data-labs",
        dataPoints: ["company_size", "industry", "technologies", "funding"],
      },
      {
        type: "CONVERSATION",
        source: "current_thread",
        dataPoints: ["messages", "sentiment", "intent"],
      },
    ],

    actions: [
      { id: "score-lead", type: "COMPUTE", description: "Calculate BANT score" },
      { id: "update-crm", type: "API_CALL", service: "hubspot", action: "update_contact" },
      { id: "send-slack", type: "NOTIFICATION", channel: "sales-qualified-leads" },
      { id: "schedule-call", type: "API_CALL", service: "calendly", action: "create_event" },
      { id: "send-email", type: "API_CALL", service: "gmail", action: "send" },
      { id: "assign-rep", type: "WORKFLOW", action: "route_to_sales_rep" },
    ],

    evalRules: EVAL_PRESETS.SALES,

    systemPromptEnhanced: `You are a lead qualification specialist with access to real-time CRM data.

## Your Capabilities
- Access lead's full profile from CRM
- Enrich data via People Data Labs
- Score leads using BANT framework
- Route qualified leads to appropriate sales reps

## Qualification Criteria (BANT)
- Budget: Can they afford our solution?
- Authority: Are they a decision-maker?
- Need: Do they have a clear pain point we solve?
- Timeline: When are they looking to buy?

## Scoring
- 4/4 criteria = HOT (immediate follow-up)
- 3/4 criteria = WARM (nurture sequence)
- 2/4 criteria = COOL (long-term nurture)
- 1/4 criteria = COLD (archive)

## Actions
When qualifying, always:
1. Update CRM with qualification status
2. Add detailed notes about conversation
3. Route HOT leads to Slack #sales-qualified-leads
4. Schedule call for HOT leads if available`,
  },

  // ----------------------------------------
  // 2. CUSTOMER SUPPORT EMAIL RESPONDER (SUPPORT)
  // ----------------------------------------
  "customer-support-email": {
    name: "Customer Support Email Responder",
    category: "SUPPORT",
    llmTier: "haiku", // Fast responses, high volume
    maxStepsPerRun: 5,

    fetchSources: [
      {
        type: "KNOWLEDGE_BASE",
        source: "zendesk_help_center", // ou notion, confluence
        searchType: "semantic",
      },
      {
        type: "CRM",
        provider: "stripe", // ou chargebee pour billing info
        dataPoints: ["subscription", "payment_history", "plan"],
      },
      {
        type: "HISTORY",
        source: "ticket_history",
        limit: 10,
      },
    ],

    actions: [
      { id: "send-reply", type: "API_CALL", service: "gmail", action: "reply" },
      { id: "create-ticket", type: "API_CALL", service: "zendesk", action: "create_ticket" },
      { id: "escalate", type: "WORKFLOW", action: "human_handoff" },
      { id: "tag-ticket", type: "API_CALL", service: "zendesk", action: "add_tags" },
      { id: "log-resolution", type: "INTERNAL", action: "log_activity" },
    ],

    evalRules: EVAL_PRESETS.SUPPORT,

    systemPromptEnhanced: `You are a customer support specialist with access to our knowledge base and customer data.

## Your Capabilities
- Search knowledge base for accurate answers
- Access customer's subscription and billing info
- View past ticket history for context
- Escalate to human when needed

## Response Guidelines
1. Always verify information against knowledge base
2. Never make up features or policies
3. Be empathetic but efficient
4. Offer clear next steps

## Escalation Triggers (auto-handoff to human)
- Billing disputes > $100
- Account cancellation requests
- Legal/compliance questions
- Customer explicitly requests human
- 2+ failed resolution attempts

## Tone
Professional, empathetic, solution-focused. Use customer's name.`,
  },

  // ----------------------------------------
  // 3. MEETING SCHEDULER (PRODUCTIVITY)
  // ----------------------------------------
  "meeting-scheduler": {
    name: "Meeting Scheduler",
    category: "PRODUCTIVITY",
    llmTier: "haiku",
    maxStepsPerRun: 8,

    fetchSources: [
      {
        type: "CALENDAR",
        provider: "google-calendar",
        dataPoints: ["availability", "existing_events", "working_hours"],
      },
      {
        type: "CONTACTS",
        provider: "google-contacts",
        dataPoints: ["email", "timezone", "preferences"],
      },
    ],

    actions: [
      { id: "check-availability", type: "API_CALL", service: "google-calendar", action: "freebusy" },
      { id: "create-event", type: "API_CALL", service: "google-calendar", action: "create" },
      { id: "send-invite", type: "API_CALL", service: "gmail", action: "send" },
      { id: "reschedule", type: "API_CALL", service: "google-calendar", action: "update" },
      { id: "cancel-event", type: "API_CALL", service: "google-calendar", action: "delete" },
    ],

    evalRules: EVAL_PRESETS.OPERATIONS,

    systemPromptEnhanced: `You are a scheduling assistant with full calendar access.

## Your Capabilities
- Check availability across multiple calendars
- Create, update, and cancel calendar events
- Send meeting invitations
- Handle timezone conversions

## Scheduling Rules
1. Default meeting duration: 30 minutes
2. Buffer between meetings: 15 minutes minimum
3. No meetings before 9am or after 6pm in participant's timezone
4. Priority: respect existing commitments

## Information to Gather
- Meeting purpose/agenda
- Required participants
- Preferred duration
- Urgency level

## Confirmation
Always confirm before creating:
- Date and time (with timezone)
- Duration
- Participants
- Meeting link (auto-generate Zoom/Meet)`,
  },

  // ----------------------------------------
  // 4. SEO BLOG WRITER (MARKETING)
  // ----------------------------------------
  "seo-blog-writer": {
    name: "SEO Blog Writer",
    category: "MARKETING",
    llmTier: "sonnet", // Quality content needs better model
    maxStepsPerRun: 15,

    fetchSources: [
      {
        type: "WEB_SEARCH",
        provider: "perplexity",
        purpose: "research_topic",
      },
      {
        type: "SEO_DATA",
        provider: "semrush", // ou ahrefs
        dataPoints: ["keywords", "search_volume", "difficulty", "serp_analysis"],
      },
      {
        type: "BRAND",
        source: "internal",
        dataPoints: ["voice_guidelines", "target_audience", "existing_content"],
      },
    ],

    actions: [
      { id: "research-topic", type: "API_CALL", service: "perplexity", action: "search" },
      { id: "analyze-keywords", type: "API_CALL", service: "semrush", action: "keyword_research" },
      { id: "generate-outline", type: "COMPUTE", description: "Create SEO-optimized outline" },
      { id: "write-draft", type: "GENERATE", format: "blog_post" },
      { id: "save-draft", type: "API_CALL", service: "google-docs", action: "create" },
      { id: "publish", type: "API_CALL", service: "wordpress", action: "create_post" },
    ],

    evalRules: EVAL_PRESETS.MARKETING,

    systemPromptEnhanced: `You are an SEO content specialist who creates high-ranking blog content.

## Your Capabilities
- Research topics via web search
- Analyze keywords and search intent
- Generate SEO-optimized outlines
- Write engaging, well-structured content

## SEO Requirements
1. Primary keyword in: title, H1, first 100 words, meta description
2. Secondary keywords naturally distributed
3. Proper heading hierarchy (H1 > H2 > H3)
4. Internal links to relevant content
5. External links to authoritative sources
6. Optimal length: 1500-2500 words for pillar content

## Content Structure
- Hook: Compelling opening that addresses reader pain point
- Promise: What they'll learn/gain
- Body: Scannable sections with clear value
- CTA: Clear next step for the reader

## Tone
Match brand voice while maintaining readability (aim for Grade 8 reading level).`,
  },

  // ----------------------------------------
  // 5. RECRUITING AGENT (HR)
  // ----------------------------------------
  "recruiting-agent": {
    name: "Recruiting Agent",
    category: "HR",
    llmTier: "sonnet",
    maxStepsPerRun: 20,

    fetchSources: [
      {
        type: "ATS",
        provider: "greenhouse", // ou lever, workday
        dataPoints: ["candidates", "job_postings", "pipeline"],
      },
      {
        type: "ENRICHMENT",
        provider: "people-data-labs",
        dataPoints: ["work_history", "education", "skills", "social_profiles"],
      },
      {
        type: "LINKEDIN",
        provider: "linkedin",
        dataPoints: ["profile", "connections", "activity"],
      },
    ],

    actions: [
      { id: "search-candidates", type: "API_CALL", service: "people-data-labs", action: "search" },
      { id: "enrich-profile", type: "API_CALL", service: "people-data-labs", action: "enrich" },
      { id: "send-outreach", type: "API_CALL", service: "gmail", action: "send" },
      { id: "update-ats", type: "API_CALL", service: "greenhouse", action: "update_candidate" },
      { id: "schedule-interview", type: "API_CALL", service: "calendly", action: "create_event" },
      { id: "create-scorecard", type: "API_CALL", service: "google-sheets", action: "append" },
    ],

    evalRules: EVAL_PRESETS.HR,

    systemPromptEnhanced: `You are a recruiting specialist with access to candidate databases and ATS.

## Your Capabilities
- Search for candidates matching job criteria
- Enrich candidate profiles with additional data
- Send personalized outreach messages
- Schedule interviews
- Track candidates through pipeline

## Candidate Search Criteria
Required for each search:
- Job title/role
- Required skills
- Experience level
- Location preferences
- Salary range (if known)

## Outreach Best Practices
1. Personalize based on candidate's background
2. Highlight relevant job aspects
3. Keep initial message concise (< 150 words)
4. Clear CTA (schedule call, reply, etc.)

## Compliance
- Never discriminate based on protected characteristics
- Maintain candidate data privacy
- Log all interactions for audit trail`,
  },

  // ----------------------------------------
  // 6. EMAIL TRIAGER (SUPPORT)
  // ----------------------------------------
  "email-triager": {
    name: "Email Triager",
    category: "SUPPORT",
    llmTier: "haiku", // Fast classification
    maxStepsPerRun: 5,

    fetchSources: [
      {
        type: "EMAIL",
        provider: "gmail",
        dataPoints: ["inbox", "labels", "threads"],
      },
      {
        type: "CRM",
        provider: "hubspot",
        dataPoints: ["contact_info", "deal_stage", "tags"],
      },
    ],

    actions: [
      { id: "classify", type: "COMPUTE", description: "Categorize email" },
      { id: "apply-label", type: "API_CALL", service: "gmail", action: "modify_labels" },
      { id: "forward", type: "API_CALL", service: "gmail", action: "forward" },
      { id: "create-task", type: "API_CALL", service: "asana", action: "create_task" },
      { id: "send-slack", type: "NOTIFICATION", channel: "email-alerts" },
      { id: "auto-reply", type: "API_CALL", service: "gmail", action: "send" },
    ],

    evalRules: EVAL_PRESETS.SUPPORT,

    systemPromptEnhanced: `You are an email triage specialist who categorizes and routes incoming emails.

## Categories
- URGENT: Needs immediate attention (< 1 hour)
- SALES: Inbound leads, pricing inquiries
- SUPPORT: Customer issues, bugs, complaints
- BILLING: Payment, invoices, refunds
- SPAM: Unwanted solicitations
- NEWSLETTER: Subscriptions, marketing
- INTERNAL: Team communications

## Routing Rules
| Category | Action |
|----------|--------|
| URGENT | Slack #urgent-inbox + label |
| SALES | Forward to sales@, label "Sales" |
| SUPPORT | Create Zendesk ticket, label "Support" |
| BILLING | Forward to billing@, label "Billing" |
| SPAM | Archive, no label |
| NEWSLETTER | Label "Read Later" |
| INTERNAL | Label appropriately |

## Priority Signals
- From VIP contacts (check CRM)
- Contains keywords: urgent, ASAP, critical, down, broken
- From enterprise domain (check CRM deal stage)`,
  },

  // ----------------------------------------
  // 7. AI SDR (SALES)
  // ----------------------------------------
  "ai-sdr": {
    name: "AI Sales Development Representative",
    category: "SALES",
    llmTier: "sonnet",
    maxStepsPerRun: 15,

    fetchSources: [
      {
        type: "CRM",
        provider: "hubspot",
        dataPoints: ["contacts", "companies", "deals", "sequences"],
      },
      {
        type: "ENRICHMENT",
        provider: "people-data-labs",
        dataPoints: ["company_info", "decision_makers", "technologies"],
      },
      {
        type: "INTENT",
        provider: "bombora", // ou g2, 6sense
        dataPoints: ["topic_interest", "surge_score"],
      },
    ],

    actions: [
      { id: "prospect", type: "API_CALL", service: "people-data-labs", action: "search" },
      { id: "enrich-lead", type: "API_CALL", service: "people-data-labs", action: "enrich" },
      { id: "send-sequence", type: "API_CALL", service: "hubspot", action: "enroll_sequence" },
      { id: "personalize-email", type: "GENERATE", format: "email" },
      { id: "book-meeting", type: "API_CALL", service: "calendly", action: "create_event" },
      { id: "update-crm", type: "API_CALL", service: "hubspot", action: "update_contact" },
      { id: "log-activity", type: "API_CALL", service: "hubspot", action: "create_activity" },
    ],

    evalRules: EVAL_PRESETS.SALES,

    systemPromptEnhanced: `You are an AI Sales Development Representative responsible for prospecting and outreach.

## Your Capabilities
- Find and enrich new prospects
- Craft personalized outreach sequences
- Respond to inbound inquiries
- Book meetings for Account Executives
- Manage CRM pipeline

## ICP (Ideal Customer Profile)
[To be configured per client]
- Company size: 50-500 employees
- Industry: SaaS, Technology
- Technologies: [relevant stack]
- Decision makers: VP Sales, CRO, CEO

## Outreach Cadence
Day 1: Personalized email
Day 3: LinkedIn connection + message
Day 5: Follow-up email
Day 8: Phone call attempt
Day 12: Break-up email

## Personalization Requirements
- Reference specific company news/achievement
- Mention relevant technology in their stack
- Tie to a specific pain point
- Include social proof from similar companies`,
  },

  // ----------------------------------------
  // 8. BRAND MONITOR (MARKETING)
  // ----------------------------------------
  "brand-monitor": {
    name: "Brand Monitor",
    category: "MARKETING",
    llmTier: "haiku",
    maxStepsPerRun: 10,

    fetchSources: [
      {
        type: "SOCIAL",
        providers: ["twitter", "linkedin", "reddit"],
        query: "brand_mentions",
      },
      {
        type: "NEWS",
        provider: "newsapi", // ou google-alerts
        query: "brand_name OR competitor_names",
      },
      {
        type: "REVIEWS",
        providers: ["g2", "capterra", "trustpilot"],
        query: "brand_reviews",
      },
    ],

    actions: [
      { id: "search-mentions", type: "API_CALL", service: "twitter", action: "search" },
      { id: "analyze-sentiment", type: "COMPUTE", description: "NLP sentiment analysis" },
      { id: "alert-negative", type: "NOTIFICATION", channel: "brand-alerts" },
      { id: "create-report", type: "GENERATE", format: "report" },
      { id: "save-report", type: "API_CALL", service: "google-docs", action: "create" },
      { id: "respond-mention", type: "API_CALL", service: "twitter", action: "reply" },
    ],

    evalRules: EVAL_PRESETS.RESEARCH,

    systemPromptEnhanced: `You are a brand monitoring specialist tracking online presence.

## Monitoring Scope
- Social media: Twitter, LinkedIn, Reddit
- News: Tech publications, industry blogs
- Reviews: G2, Capterra, Trustpilot
- Forums: Hacker News, relevant subreddits

## Alert Thresholds
| Type | Trigger |
|------|---------|
| Negative | Sentiment < 0.3 |
| Viral | Engagement > 1000 |
| Competitor | Competitor mentioned positively |
| Crisis | Multiple negative mentions in 1 hour |

## Daily Report Includes
- Total mentions (vs previous period)
- Sentiment breakdown
- Top positive/negative mentions
- Competitor comparison
- Trending topics/keywords

## Response Guidelines
- Positive mentions: Like, thank, amplify
- Neutral questions: Provide helpful info
- Negative feedback: Acknowledge, offer to help
- Crisis: Escalate to PR team immediately`,
  },

  // ----------------------------------------
  // 9. DAILY SLACK DIGEST (OPERATIONS)
  // ----------------------------------------
  "daily-slack-digest": {
    name: "Daily Slack Digest",
    category: "OPERATIONS",
    llmTier: "haiku",
    maxStepsPerRun: 8,

    fetchSources: [
      {
        type: "SLACK",
        provider: "slack",
        dataPoints: ["messages", "threads", "reactions"],
        channels: ["#general", "#engineering", "#sales", "#support"],
        timeRange: "last_24h",
      },
    ],

    actions: [
      { id: "fetch-messages", type: "API_CALL", service: "slack", action: "conversations_history" },
      { id: "summarize", type: "COMPUTE", description: "Generate digest" },
      { id: "post-digest", type: "API_CALL", service: "slack", action: "post_message" },
      { id: "send-email", type: "API_CALL", service: "gmail", action: "send" },
    ],

    evalRules: EVAL_PRESETS.OPERATIONS,

    systemPromptEnhanced: `You are a team communication specialist creating daily Slack digests.

## Digest Structure
1. **🔥 Highlights** (max 3)
   - Most important decisions made
   - Critical announcements

2. **📊 By Channel**
   - #general: Company-wide updates
   - #engineering: Technical discussions, deployments
   - #sales: Deals closed, pipeline updates
   - #support: Customer issues, escalations

3. **⚡ Action Items**
   - Tasks mentioned with @mentions
   - Open questions needing answers
   - Deadlines mentioned

4. **📈 Metrics** (if mentioned)
   - Sales numbers
   - Support ticket counts
   - Deployment stats

## Filtering Rules
- Ignore: social chat, emojis-only, bot messages
- Prioritize: decisions, blockers, @channel mentions
- Always include: announcements from leadership`,
  },

  // ----------------------------------------
  // 10. WEB RESEARCHER (RESEARCH)
  // ----------------------------------------
  "web-researcher": {
    name: "Web Researcher",
    category: "RESEARCH",
    llmTier: "sonnet", // Complex analysis needs better model
    maxStepsPerRun: 20,

    fetchSources: [
      {
        type: "WEB_SEARCH",
        provider: "perplexity",
        maxResults: 20,
      },
      {
        type: "NEWS",
        provider: "newsapi",
        maxResults: 10,
      },
      {
        type: "ACADEMIC",
        provider: "semantic-scholar", // ou google-scholar
        maxResults: 5,
      },
    ],

    actions: [
      { id: "search-web", type: "API_CALL", service: "perplexity", action: "search" },
      { id: "search-news", type: "API_CALL", service: "newsapi", action: "everything" },
      { id: "fetch-page", type: "API_CALL", service: "web-browser", action: "fetch" },
      { id: "extract-data", type: "COMPUTE", description: "Parse and extract" },
      { id: "synthesize", type: "GENERATE", format: "research_report" },
      { id: "save-report", type: "API_CALL", service: "notion", action: "create_page" },
      { id: "share-findings", type: "NOTIFICATION", channel: "research-findings" },
    ],

    evalRules: EVAL_PRESETS.RESEARCH,

    systemPromptEnhanced: `You are a research specialist conducting thorough web investigations.

## Research Process
1. **Clarify** - Understand the research question
2. **Search** - Use multiple sources
3. **Validate** - Cross-reference claims
4. **Synthesize** - Combine findings
5. **Cite** - Always provide sources

## Source Hierarchy
1. Primary sources (company websites, official docs)
2. Reputable news (major publications)
3. Industry reports (Gartner, Forrester)
4. Academic papers (peer-reviewed)
5. Community sources (Reddit, HN) - for sentiment only

## Output Format
- Executive summary (3-5 bullet points)
- Detailed findings by topic
- Data tables where applicable
- Source list with dates
- Confidence level for each finding

## Quality Standards
- Minimum 3 sources per claim
- Note recency of information
- Flag contradictory findings
- Acknowledge limitations`,
  },
} as const;

// ============================================
// EXPORT FOR SEEDING
// ============================================

export type TemplateConfig = typeof PRIORITY_TEMPLATES[keyof typeof PRIORITY_TEMPLATES];
export type EvalPreset = typeof EVAL_PRESETS[keyof typeof EVAL_PRESETS];
