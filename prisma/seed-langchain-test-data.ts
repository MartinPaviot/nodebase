/**
 * Seed test data for LangChain-inspired features
 * Creates fake traces, evaluations, feedback, insights for testing dashboards
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// Helper to generate random date in last N days
function randomDateInLastNDays(days: number): Date {
  const now = Date.now();
  const daysInMs = days * 24 * 60 * 60 * 1000;
  const randomMs = Math.random() * daysInMs;
  return new Date(now - randomMs);
}

// Helper to generate random number in range
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to generate random float
function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function main() {
  console.log('🌱 Seeding LangChain test data...');

  // Find or create a test workspace and user
  let testUser = await prisma.user.findFirst({
    where: { email: 'test@elevay.ai' }
  });

  if (!testUser) {
    console.log('Creating test user...');
    testUser = await prisma.user.create({
      data: {
        id: nanoid(),
        email: 'test@elevay.ai',
        name: 'Test User',
        emailVerified: true,
      }
    });
  }

  // Find or create a test agent
  let testAgent = await prisma.agent.findFirst({
    where: {
      name: 'Test Agent for Analytics',
      userId: testUser.id
    }
  });

  if (!testAgent) {
    console.log('Creating test agent...');
    testAgent = await prisma.agent.create({
      data: {
        id: nanoid(),
        name: 'Test Agent for Analytics',
        systemPrompt: 'You are a helpful assistant for testing analytics.',
        model: 'ANTHROPIC',
        temperature: 0.7,
        userId: testUser.id,
        workspaceId: testUser.id, // Using userId as workspaceId for simplicity
        isEnabled: true,
      }
    });
  }

  console.log(`✅ Test agent: ${testAgent.id}`);

  // Create 50 fake traces
  console.log('Creating 50 fake traces...');
  const traces: any[] = [];

  for (let i = 0; i < 50; i++) {
    const startedAt = randomDateInLastNDays(30);
    const latencyMs = randomInt(500, 5000);
    const completedAt = new Date(startedAt.getTime() + latencyMs);

    const tokensIn = randomInt(100, 1500);
    const tokensOut = randomInt(50, 800);
    const totalTokens = tokensIn + tokensOut;

    // Rough cost calculation (Claude Sonnet pricing)
    const costPerInputToken = 0.003 / 1000; // $3 per MTok
    const costPerOutputToken = 0.015 / 1000; // $15 per MTok
    const totalCost = (tokensIn * costPerInputToken) + (tokensOut * costPerOutputToken);

    const totalSteps = randomInt(1, 5);
    const toolSuccesses = randomInt(0, 3);
    const toolFailures = Math.random() > 0.8 ? randomInt(1, 2) : 0;

    const l1Passed = toolFailures === 0 && Math.random() > 0.1;
    const l2Score = randomFloat(0.6, 0.95);
    const l3Triggered = Math.random() > 0.85;
    const l3Blocked = l3Triggered && Math.random() > 0.7;

    const status = l3Blocked ? 'FAILED' : (toolFailures > 1 ? 'FAILED' : 'COMPLETED');

    // Create a conversation first
    const conversation = await prisma.conversation.create({
      data: {
        id: nanoid(),
        agentId: testAgent.id,
        source: 'CHAT',
        title: `Test Conversation ${i + 1}`,
      }
    });

    const trace = await prisma.agentTrace.create({
      data: {
        id: nanoid(),
        agentId: testAgent.id,
        conversationId: conversation.id,
        userId: testUser.id,
        workspaceId: testUser.id,
        startedAt,
        completedAt,
        status,
        steps: [
          { step: 1, action: 'reasoning', latencyMs: randomInt(200, 1000) },
          { step: 2, action: 'tool_call', toolName: 'search', latencyMs: randomInt(300, 1500) },
          { step: 3, action: 'response', latencyMs: randomInt(400, 1200) },
        ],
        totalSteps,
        maxSteps: 5,
        totalTokensIn: tokensIn,
        totalTokensOut: tokensOut,
        totalCost,
        latencyMs,
        toolCalls: [
          { tool: 'search', success: true },
          { tool: 'memory', success: true },
        ],
        toolSuccesses,
        toolFailures,
        l1Passed,
        l1Failures: l1Passed ? Prisma.JsonNull : ['contains_recipient_name', 'no_placeholders'],
        l2Score,
        l2Breakdown: {
          relevance: randomFloat(0.6, 1),
          accuracy: randomFloat(0.6, 1),
          completeness: randomFloat(0.6, 1),
          tone: randomFloat(0.7, 1),
        },
        l3Triggered,
        l3Blocked,
        feedbackScore: Math.random() > 0.3 ? randomInt(3, 5) : null,
        userEdited: Math.random() > 0.7,
        editDiff: null,
      }
    });

    traces.push({ trace, conversation });

    // Create some AI events for this trace
    for (let step = 0; step < totalSteps; step++) {
      await prisma.aiEvent.create({
        data: {
          id: nanoid(),
          traceId: trace.id,
          agentId: testAgent.id,
          userId: testUser.id,
          workspaceId: testUser.id,
          model: 'claude-sonnet-4',
          tier: 'sonnet',
          tokensIn: Math.floor(tokensIn / totalSteps),
          tokensOut: Math.floor(tokensOut / totalSteps),
          cost: totalCost / totalSteps,
          latencyMs: Math.floor(latencyMs / totalSteps),
          stepNumber: step + 1,
          action: step === 0 ? 'reasoning' : (step === totalSteps - 1 ? 'response' : 'tool_call'),
          toolName: step > 0 && step < totalSteps - 1 ? 'search' : null,
          toolInput: step > 0 && step < totalSteps - 1 ? { query: 'test query' } : Prisma.JsonNull,
          toolOutput: step > 0 && step < totalSteps - 1 ? { results: ['result 1'] } : Prisma.JsonNull,
          timestamp: new Date(startedAt.getTime() + (step * latencyMs / totalSteps)),
        }
      });
    }
  }

  console.log('✅ Created 50 traces with AI events');

  // Create evaluations for some conversations
  console.log('Creating conversation evaluations...');
  const conversationsToEvaluate = traces.slice(0, 30);

  for (const { conversation, trace } of conversationsToEvaluate) {
    await prisma.conversationEvaluation.create({
      data: {
        id: nanoid(),
        conversationId: conversation.id,
        goalCompleted: Math.random() > 0.3,
        goalCompletionConfidence: randomFloat(0.5, 0.95),
        userSatisfactionScore: randomFloat(2, 5),
        categories: ['sales', 'support'].filter(() => Math.random() > 0.5),
        failureModes: trace.status === 'FAILED' ? ['tool_error', 'hallucination'].filter(() => Math.random() > 0.5) : [],
        improvementSuggestions: [
          'Add more context to prompts',
          'Improve tool error handling',
        ].filter(() => Math.random() > 0.6),
        metadata: { evaluator: 'auto', version: '1.0' },
      }
    });
  }

  console.log('✅ Created 30 conversation evaluations');

  // Create feedback samples
  console.log('Creating feedback samples...');
  const feedbackTypes = ['THUMBS_UP', 'THUMBS_DOWN', 'USER_EDIT', 'EXPLICIT_CORRECTION'] as const;

  for (let i = 0; i < 20; i++) {
    const { trace, conversation } = traces[i];
    const type = feedbackTypes[randomInt(0, feedbackTypes.length - 1)];

    await prisma.agentFeedback.create({
      data: {
        id: nanoid(),
        traceId: trace.id,
        conversationId: conversation.id,
        userId: testUser.id,
        agentId: testAgent.id,
        type,
        timestamp: randomDateInLastNDays(30),
        originalOutput: 'This is the original agent output.',
        userEdit: type === 'USER_EDIT' ? 'This is the edited version by user.' : null,
        correctionText: type === 'EXPLICIT_CORRECTION' ? 'The correct answer should be...' : null,
        stepNumber: randomInt(1, 3),
        metadata: {},
      }
    });
  }

  console.log('✅ Created 20 feedback samples');

  // Create an insight
  console.log('Creating agent insight...');
  await prisma.agentInsight.create({
    data: {
      id: nanoid(),
      agentId: testAgent.id,
      timeframeStart: randomDateInLastNDays(30),
      timeframeEnd: new Date(),
      clusters: [
        { id: 'cluster-1', label: 'Simple queries', size: 25, representative: 'What is X?' },
        { id: 'cluster-2', label: 'Complex analysis', size: 15, representative: 'Analyze and compare...' },
        { id: 'cluster-3', label: 'Data requests', size: 10, representative: 'Show me data for...' },
      ],
      patterns: [
        { pattern: 'Users often ask for comparisons', frequency: 12, category: 'usage' },
        { pattern: 'High tool failure rate on Mondays', frequency: 5, category: 'performance' },
      ],
      anomalies: [
        { type: 'high_cost', traceId: traces[0].trace.id, value: 0.15, severity: 'medium' },
        { type: 'high_latency', traceId: traces[1].trace.id, value: 8000, severity: 'low' },
      ],
      opportunities: [
        {
          type: 'model_downgrade',
          impact: 'Reduce cost by 70% for simple queries',
          suggestion: 'Use Haiku for cluster-1',
          estimatedSavings: 0.45,
        },
        {
          type: 'caching',
          impact: 'Reduce latency by 80% for frequent queries',
          suggestion: 'Cache top 10 queries',
          estimatedSavings: null,
        },
      ],
    }
  });

  console.log('✅ Created agent insight');

  // Create an A/B test
  console.log('Creating A/B test...');
  await prisma.agentABTest.create({
    data: {
      id: nanoid(),
      agentId: testAgent.id,
      variantAPrompt: testAgent.systemPrompt,
      variantBPrompt: `${testAgent.systemPrompt}\n\nAdditional context: Always be concise.`,
      trafficSplit: 0.2,
      status: 'RUNNING',
      startedAt: randomDateInLastNDays(7),
      variantATraces: 40,
      variantBTraces: 10,
      variantAScore: 0.75,
      variantBScore: 0.82,
    }
  });

  console.log('✅ Created A/B test');

  // Create an optimization run
  console.log('Creating optimization run...');
  await prisma.optimizationRun.create({
    data: {
      id: nanoid(),
      agentId: testAgent.id,
      triggeredBy: 'accumulated_feedback',
      editPatterns: [
        { pattern: 'Users remove unnecessary pleasantries', frequency: 8, category: 'tone' },
        { pattern: 'Users add specific context', frequency: 5, category: 'content' },
      ],
      promptVariations: [
        {
          id: 'var-1',
          prompt: 'Improved prompt version 1',
          rationale: 'More concise and direct',
          addressedPatterns: ['tone'],
        },
      ],
      testResults: [
        {
          variationId: 'var-1',
          avgScore: 0.85,
          improvements: ['Better tone', 'More relevant'],
        },
      ],
      recommendation: 'Deploy variation 1 via A/B test',
      status: 'COMPLETED',
    }
  });

  console.log('✅ Created optimization run');

  // Create a modification proposal
  console.log('Creating modification proposal...');
  await prisma.modificationProposal.create({
    data: {
      id: nanoid(),
      agentId: testAgent.id,
      type: 'PROMPT_REFINEMENT',
      current: testAgent.systemPrompt,
      proposed: `${testAgent.systemPrompt}\n\nFocus on being concise and actionable.`,
      rationale: 'Users often edit outputs to be more concise. This addresses that pattern.',
      impact: 'Improve user satisfaction by 15%',
      status: 'PENDING',
    }
  });

  console.log('✅ Created modification proposal');

  console.log('\n🎉 Seed data creation complete!');
  console.log(`Test Agent ID: ${testAgent.id}`);
  console.log(`Test User ID: ${testUser.id}`);
  console.log('\nYou can now view the analytics dashboard at:');
  console.log(`/agents/${testAgent.id}/analytics`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
