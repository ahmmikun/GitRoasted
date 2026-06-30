/**
 * AI_Orchestrator — `lib/ai/index.ts`
 *
 * Attempts external AI providers in priority order (OpenRouter → Gemini →
 * OpenAI → Grok), validates each response with `parseRoastOutput`, falls back
 * to the rule-based engine when all external providers fail, and finally falls
 * back to `DEFAULT_ROAST`. The orchestrator never throws to its caller.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.3
 */

import { openRouterProvider } from "./openrouter";
import { geminiProvider } from "./gemini";
import { openAiProvider } from "./openai";
import { grokProvider } from "./grok";
import { ruleBasedRoast, DEFAULT_ROAST } from "./fallback";
import { parseRoastOutput } from "../validators";
import type {
  AiProvider,
  GenerationResult,
  GitHubProfile,
  GitHubStats,
} from "../types";

const PROVIDERS: AiProvider[] = [
  openRouterProvider,
  geminiProvider,
  openAiProvider,
  grokProvider,
];

/**
 * Generate a roast by trying external AI providers in priority order.
 *
 * @param summary       Compact profile summary from the analyzer.
 * @param analyzerScore Developer score (0–100) from the analyzer.
 * @param profile       Normalized GitHub profile (used by rule-based fallback).
 * @param stats         Computed GitHub stats (used by rule-based fallback).
 * @param providers     Overridable provider list for testing.
 */
export async function generateRoast(
  summary: string,
  analyzerScore: number,
  profile: GitHubProfile,
  stats: GitHubStats,
  providers: AiProvider[] = PROVIDERS,
): Promise<GenerationResult> {
  // Try each external provider in order.
  for (const provider of providers) {
    let raw: unknown;
    try {
      raw = await provider.generate(summary);
    } catch {
      continue;
    }

    const parsed = parseRoastOutput(raw);
    if (parsed.ok) {
      return {
        roast: parsed.value,
        aiMeta: {
          providerUsed: provider.name,
          modelUsed: provider.model,
          aiFailed: false,
          fallbackUsed: false,
        },
      };
    }
    // Invalid response — skip to the next provider.
  }

  // All external providers failed. Try the rule-based engine.
  try {
    const roast = ruleBasedRoast(profile, stats, analyzerScore);
    const parsed = parseRoastOutput(roast);
    if (parsed.ok) {
      return {
        roast: parsed.value,
        aiMeta: {
          providerUsed: "rule_based",
          modelUsed: "rule_based",
          aiFailed: true,
          fallbackUsed: true,
        },
      };
    }
  } catch {
    // Rule-based engine failed — fall through to DEFAULT_ROAST.
  }

  // Last resort: hardcoded default.
  return {
    roast: DEFAULT_ROAST,
    aiMeta: {
      providerUsed: "default",
      modelUsed: "default",
      aiFailed: true,
      fallbackUsed: true,
    },
  };
}
