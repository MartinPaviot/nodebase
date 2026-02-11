"use strict";
/**
 * Hallucination Detector - Detects potential hallucinations
 * Simple heuristic-based approach
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HallucinationDetector = void 0;
class HallucinationDetector {
    hallucinationIndicators = [
        'as an ai',
        'i cannot',
        'i do not have access',
        'i cannot access',
        'i apologize but',
        'i don\'t actually',
        'i made that up',
        'i fabricated',
        'that was incorrect',
        'i was mistaken',
    ];
    /**
     * Detect potential hallucinations in conversation
     */
    async detect(messages, traces) {
        // Check assistant messages for hallucination indicators
        const assistantMessages = messages.filter((m) => m.role === 'assistant');
        for (const message of assistantMessages) {
            const content = message.content.toLowerCase();
            // Check for explicit admission of error/limitation
            const hasIndicator = this.hallucinationIndicators.some((indicator) => content.includes(indicator));
            if (hasIndicator) {
                return true;
            }
            // Check for placeholder patterns (common hallucination)
            if (this.hasPlaceholders(content)) {
                return true;
            }
        }
        // Check for tool call failures that might indicate hallucinated data
        const toolFailureRate = this.getToolFailureRate(traces);
        if (toolFailureRate > 0.5) {
            // High tool failure might indicate agent is making up data
            return true;
        }
        return false;
    }
    /**
     * Check if text contains placeholder patterns
     */
    hasPlaceholders(text) {
        const placeholderPatterns = [
            /\[.*?\]/g, // [placeholder]
            /{{.*?}}/g, // {{variable}}
            /<.*?>/g, // <placeholder>
            /\$\{.*?\}/g, // ${variable}
            /xxx+/gi, // xxx or XXX
        ];
        return placeholderPatterns.some((pattern) => pattern.test(text));
    }
    /**
     * Get tool failure rate from traces
     */
    getToolFailureRate(traces) {
        const totalCalls = traces.reduce((sum, t) => sum + t.toolSuccesses + t.toolFailures, 0);
        if (totalCalls === 0) {
            return 0;
        }
        const totalFailures = traces.reduce((sum, t) => sum + t.toolFailures, 0);
        return totalFailures / totalCalls;
    }
    /**
     * Detect specific hallucination patterns
     */
    detectPatterns(text) {
        const patterns = [];
        if (this.hasPlaceholders(text)) {
            patterns.push('placeholder_text');
        }
        if (this.hasVagueReferences(text)) {
            patterns.push('vague_references');
        }
        if (this.hasUncertainLanguage(text)) {
            patterns.push('uncertain_language');
        }
        return patterns;
    }
    /**
     * Check for vague references (might indicate fabrication)
     */
    hasVagueReferences(text) {
        const vaguePatterns = [
            /according to (some|many) sources/i,
            /it is believed that/i,
            /some say that/i,
            /reportedly/i,
            /allegedly/i,
        ];
        return vaguePatterns.some((pattern) => pattern.test(text));
    }
    /**
     * Check for uncertain language
     */
    hasUncertainLanguage(text) {
        const uncertainWords = [
            'probably',
            'maybe',
            'perhaps',
            'possibly',
            'might be',
            'could be',
            'i think',
            'i believe',
            'i assume',
        ];
        const lowerText = text.toLowerCase();
        const count = uncertainWords.filter((word) => lowerText.includes(word)).length;
        return count >= 2; // Flag if 2+ uncertain words
    }
}
exports.HallucinationDetector = HallucinationDetector;
