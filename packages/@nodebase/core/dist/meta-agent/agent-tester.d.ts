/**
 * Agent Tester - Test built agents against sample inputs
 * Validates agent behavior before deployment
 */
import type { BuiltAgent, TestResults } from './types';
export declare class AgentTester {
    /**
     * Test an agent configuration against sample inputs/outputs
     */
    testAgent(agentConfig: Pick<BuiltAgent, 'systemPrompt' | 'model' | 'temperature'>, sampleInputs: string[], expectedOutputs: string[]): Promise<TestResults>;
    /**
     * Run agent with test input (simplified - no tools)
     */
    private runTestAgent;
    /**
     * Score output against expected output using LLM-as-Judge
     */
    private scoreOutput;
    /**
     * Refine agent based on test failures
     */
    refineAgentPrompt(originalPrompt: string, testResults: TestResults): Promise<string>;
}
//# sourceMappingURL=agent-tester.d.ts.map