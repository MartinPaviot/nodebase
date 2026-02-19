/**
 * Agent Tester - Test built agents against sample inputs
 * Validates agent behavior before deployment
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BuiltAgent, TestResult, TestResults } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export class AgentTester {
  /**
   * Test an agent configuration against sample inputs/outputs
   */
  async testAgent(
    agentConfig: Pick<BuiltAgent, 'systemPrompt' | 'model' | 'temperature'>,
    sampleInputs: string[],
    expectedOutputs: string[]
  ): Promise<TestResults> {
    if (sampleInputs.length !== expectedOutputs.length) {
      throw new Error('Sample inputs and expected outputs must have same length');
    }

    if (sampleInputs.length === 0) {
      return {
        results: [],
        avgScore: 0,
        passRate: 0,
      };
    }

    console.log(`[AgentTester] Testing agent with ${sampleInputs.length} sample(s)...`);

    const results: TestResult[] = [];

    for (let i = 0; i < sampleInputs.length; i++) {
      const input = sampleInputs[i];
      const expected = expectedOutputs[i];

      try {
        // Run agent with sample input
        const output = await this.runTestAgent(agentConfig, input);

        // Score output vs. expected
        const score = await this.scoreOutput(output, expected);

        results.push({
          input,
          expected,
          actual: output,
          score,
          passed: score >= 0.7, // 70% threshold
        });

        console.log(`[AgentTester] Test ${i + 1}/${sampleInputs.length}: Score ${(score * 100).toFixed(1)}%`);
      } catch (error) {
        console.error(`[AgentTester] Test ${i + 1} failed:`, error);
        results.push({
          input,
          expected,
          actual: `ERROR: ${error instanceof Error ? error.message : String(error)}`,
          score: 0,
          passed: false,
        });
      }
    }

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const passRate = results.filter((r) => r.passed).length / results.length;

    console.log(`[AgentTester] Overall: ${(avgScore * 100).toFixed(1)}% avg score, ${(passRate * 100).toFixed(1)}% pass rate`);

    return {
      results,
      avgScore,
      passRate,
    };
  }

  /**
   * Run agent with test input (simplified - no tools)
   */
  private async runTestAgent(
    agentConfig: Pick<BuiltAgent, 'systemPrompt' | 'model' | 'temperature'>,
    input: string
  ): Promise<string> {
    const modelMap = {
      ANTHROPIC_HAIKU: 'claude-3-5-haiku-20241022',
      ANTHROPIC_SONNET: 'claude-3-5-sonnet-20241022',
      ANTHROPIC: 'claude-3-5-sonnet-20241022',
      OPENAI: 'claude-3-5-sonnet-20241022', // Fallback
      GEMINI: 'claude-3-5-sonnet-20241022', // Fallback
    };

    const model = modelMap[agentConfig.model] || 'claude-3-5-sonnet-20241022';

    const message = await anthropic.messages.create({
      model,
      max_tokens: 1000,
      temperature: agentConfig.temperature,
      system: agentConfig.systemPrompt,
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Claude');
    }

    return content.text;
  }

  /**
   * Score output against expected output using LLM-as-Judge
   */
  private async scoreOutput(generated: string, expected: string): Promise<number> {
    const prompt = `Rate how well the generated output matches the expected output on a scale of 0-100.

Consider:
- Semantic similarity (does it convey the same meaning?)
- Tone and style (is the tone appropriate?)
- Completeness (does it cover all key points?)
- Accuracy (is the information correct?)

Generated Output:
${generated}

Expected Output:
${expected}

Respond with JSON: { "score": 0-100, "reasoning": "brief explanation" }

Respond with ONLY the JSON object, no additional text.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Claude');
    }

    // Parse JSON from LLM response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[AgentTester] Failed to parse judge response, defaulting to 0.5');
      return 0.5;
    }

    try {
      const result = JSON.parse(jsonMatch[0]);
      const score = result.score / 100; // Convert 0-100 to 0-1

      console.log(`[AgentTester] Judge score: ${result.score}/100 - ${result.reasoning}`);

      return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
    } catch (error) {
      console.warn('[AgentTester] Failed to parse judge score, defaulting to 0.5');
      return 0.5;
    }
  }

  /**
   * Refine agent based on test failures
   */
  async refineAgentPrompt(
    originalPrompt: string,
    testResults: TestResults
  ): Promise<string> {
    if (testResults.passRate >= 0.7) {
      // Already passing, no need to refine
      return originalPrompt;
    }

    console.log('[AgentTester] Refining prompt based on test failures...');

    // Get only failing tests
    const failures = testResults.results.filter((r) => !r.passed);

    const prompt = `Refine this AI agent system prompt based on test failures.

Current System Prompt:
${originalPrompt}

Test Failures (${failures.length} failed tests):
${failures
  .map(
    (f, i) => `
Test ${i + 1}:
- Input: ${f.input}
- Expected: ${f.expected}
- Actual: ${f.actual}
- Score: ${(f.score * 100).toFixed(1)}%
`
  )
  .join('\n---\n')}

Instructions:
1. Analyze what's causing the failures
2. Refine the system prompt to address these specific issues
3. Maintain the core agent purpose
4. Be clear and actionable
5. Keep it under 500 words

Respond with the refined system prompt ONLY. No explanations or preamble.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Claude');
    }

    console.log('[AgentTester] Prompt refined');

    return content.text.trim();
  }
}
