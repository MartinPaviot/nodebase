/**
 * L1 Eval - Deterministic Assertions
 *
 * Fast, rule-based checks that must pass before sending
 * Block immediately if failed (no LLM needed)
 *
 * Examples:
 * - Contains recipient name (no "Dear [Name]")
 * - No placeholders ({{variable}})
 * - Correct language detected
 * - Max length respected
 * - Required fields present
 *
 * Usage:
 * ```typescript
 * const result = await evaluateL1(text, assertions);
 * if (!result.passed) {
 *   console.log("Blocked:", result.failedAssertions);
 * }
 * ```
 */

import { ValidationError } from "../errors";

// ============================================
// TYPES
// ============================================

export type AssertionSeverity = "block" | "warn";

export interface Assertion {
  check: string;
  severity: AssertionSeverity;
  params?: Record<string, unknown>;
}

export interface AssertionResult {
  check: string;
  passed: boolean;
  severity: AssertionSeverity;
  message?: string;
}

export interface L1EvalResult {
  passed: boolean;
  failedAssertions: AssertionResult[];
  warnings: AssertionResult[];
  allResults: AssertionResult[];
}

// ============================================
// ASSERTION CHECKS
// ============================================

class AssertionChecker {
  /**
   * Check for placeholders like {{name}}, [Name], {variable}
   */
  static hasNoPlaceholders(text: string): AssertionResult {
    const placeholderRegex = /\{\{[^}]+\}\}|\[[A-Z][^\]]*\]|\{[a-z_]+\}/g;
    const matches = text.match(placeholderRegex);

    return {
      check: "no_placeholders",
      passed: !matches || matches.length === 0,
      severity: "block",
      message: matches ? `Found placeholders: ${matches.join(", ")}` : undefined,
    };
  }

  /**
   * Check that text contains recipient name
   */
  static containsRecipientName(text: string, recipientName?: string): AssertionResult {
    if (!recipientName) {
      return {
        check: "contains_recipient_name",
        passed: true, // Skip if no name provided
        severity: "block",
      };
    }

    const firstName = recipientName.split(" ")[0];
    const containsName = text.includes(firstName) || text.includes(recipientName);

    return {
      check: "contains_recipient_name",
      passed: containsName,
      severity: "block",
      message: containsName ? undefined : `Recipient name "${recipientName}" not found`,
    };
  }

  /**
   * Check for generic greetings (Dear Sir/Madam, To whom it may concern)
   */
  static hasNoGenericGreeting(text: string): AssertionResult {
    const genericPatterns = [
      /dear sir\/madam/i,
      /to whom it may concern/i,
      /dear hiring manager/i,
      /hello there/i,
    ];

    const foundGeneric = genericPatterns.some((pattern) => pattern.test(text));

    return {
      check: "no_generic_greeting",
      passed: !foundGeneric,
      severity: "warn",
      message: foundGeneric ? "Generic greeting detected" : undefined,
    };
  }

  /**
   * Check max length
   */
  static respectsMaxLength(text: string, maxLength: number): AssertionResult {
    const passed = text.length <= maxLength;

    return {
      check: "respects_max_length",
      passed,
      severity: "warn",
      message: passed ? undefined : `Text too long: ${text.length} chars (max ${maxLength})`,
    };
  }

  /**
   * Check min length
   */
  static respectsMinLength(text: string, minLength: number): AssertionResult {
    const passed = text.length >= minLength;

    return {
      check: "respects_min_length",
      passed,
      severity: "warn",
      message: passed ? undefined : `Text too short: ${text.length} chars (min ${minLength})`,
    };
  }

  /**
   * Check language (simple heuristic)
   */
  static correctLanguage(text: string, expectedLang: "en" | "fr" | "es" | "de"): AssertionResult {
    // Simple heuristic: check for common words
    const langPatterns = {
      en: /\b(the|and|is|are|was|were|have|has|will|would|can|could)\b/gi,
      fr: /\b(le|la|les|de|et|est|sont|avoir|être|je|tu|il|elle|nous|vous)\b/gi,
      es: /\b(el|la|los|las|de|y|es|son|tener|ser|yo|tú|él|ella|nosotros)\b/gi,
      de: /\b(der|die|das|den|dem|und|ist|sind|haben|sein|ich|du|er|sie|wir)\b/gi,
    };

    const pattern = langPatterns[expectedLang];
    const matches = text.match(pattern);
    const passed = matches !== null && matches.length >= 3;

    return {
      check: "correct_language",
      passed,
      severity: "warn",
      message: passed ? undefined : `Expected language: ${expectedLang}`,
    };
  }

  /**
   * Check for profanity/inappropriate content
   */
  static hasNoProfanity(text: string): AssertionResult {
    // Basic profanity filter (extend with better library if needed)
    const profanityWords = ["fuck", "shit", "damn", "ass", "bitch"];
    const lowerText = text.toLowerCase();
    const foundProfanity = profanityWords.some((word) => lowerText.includes(word));

    return {
      check: "no_profanity",
      passed: !foundProfanity,
      severity: "block",
      message: foundProfanity ? "Inappropriate content detected" : undefined,
    };
  }

  /**
   * Check email format (if applicable)
   */
  static hasValidEmail(text: string, requireEmail: boolean): AssertionResult {
    if (!requireEmail) {
      return {
        check: "has_valid_email",
        passed: true,
        severity: "warn",
      };
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const hasEmail = emailRegex.test(text);

    return {
      check: "has_valid_email",
      passed: hasEmail,
      severity: "warn",
      message: hasEmail ? undefined : "No valid email found",
    };
  }

  /**
   * Check for real content (not just template)
   */
  static hasRealContent(text: string): AssertionResult {
    // Remove common template parts
    const withoutGreeting = text
      .replace(/^(hi|hello|dear|greetings)[^.!?\n]*/gi, "")
      .replace(/(best regards|sincerely|cheers|thanks)[^.!?\n]*$/gi, "")
      .trim();

    const contentLength = withoutGreeting.length;
    const passed = contentLength > 50; // At least 50 chars of real content

    return {
      check: "has_real_content",
      passed,
      severity: "block",
      message: passed ? undefined : `Too little content: ${contentLength} chars`,
    };
  }
}

// ============================================
// L1 EVALUATOR
// ============================================

export class L1Evaluator {
  /**
   * Run all assertions
   */
  static async evaluate(
    text: string,
    assertions: Assertion[],
    context?: Record<string, unknown>
  ): Promise<L1EvalResult> {
    const results: AssertionResult[] = [];

    for (const assertion of assertions) {
      let result: AssertionResult;

      switch (assertion.check) {
        case "no_placeholders":
          result = AssertionChecker.hasNoPlaceholders(text);
          break;

        case "contains_recipient_name":
          result = AssertionChecker.containsRecipientName(
            text,
            context?.recipientName as string
          );
          break;

        case "no_generic_greeting":
          result = AssertionChecker.hasNoGenericGreeting(text);
          break;

        case "respects_max_length":
          result = AssertionChecker.respectsMaxLength(
            text,
            (assertion.params?.maxLength as number) || 10000
          );
          break;

        case "respects_min_length":
          result = AssertionChecker.respectsMinLength(
            text,
            (assertion.params?.minLength as number) || 10
          );
          break;

        case "correct_language":
          result = AssertionChecker.correctLanguage(
            text,
            (assertion.params?.language as "en" | "fr" | "es" | "de") || "en"
          );
          break;

        case "no_profanity":
          result = AssertionChecker.hasNoProfanity(text);
          break;

        case "has_valid_email":
          result = AssertionChecker.hasValidEmail(
            text,
            assertion.params?.requireEmail as boolean
          );
          break;

        case "has_real_content":
          result = AssertionChecker.hasRealContent(text);
          break;

        default:
          throw new ValidationError(
            "assertion",
            assertion.check,
            `Unknown assertion check: ${assertion.check}`
          );
      }

      // Override severity from assertion config
      result.severity = assertion.severity;
      results.push(result);
    }

    const failedAssertions = results.filter((r) => !r.passed && r.severity === "block");
    const warnings = results.filter((r) => !r.passed && r.severity === "warn");

    return {
      passed: failedAssertions.length === 0,
      failedAssertions,
      warnings,
      allResults: results,
    };
  }

  /**
   * Quick check - returns true if all blocking assertions pass
   */
  static async quickCheck(text: string, assertions: Assertion[]): Promise<boolean> {
    const result = await this.evaluate(text, assertions);
    return result.passed;
  }
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export const evaluateL1 = L1Evaluator.evaluate;
export const quickCheckL1 = L1Evaluator.quickCheck;
