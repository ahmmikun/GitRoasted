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
import { MAX_SCORE, tierForScore } from "../scoring";
import type {
  AiProvider,
  GenerationResult,
  GitHubProfile,
  GitHubStats,
  RoastOutput,
} from "../types";

const PROVIDERS: AiProvider[] = [
  openRouterProvider,
  geminiProvider,
  openAiProvider,
  grokProvider,
];

/**
 * Force the canonical Developer_Score onto a roast.
 *
 * The score shown on the result page, the leaderboard, and the comparison view
 * must all be the same number, so the analyzer is the single source of truth.
 * Models are asked to echo it back, but we overwrite it regardless in case a
 * provider recalculates or hallucinates a different value.
 */
function withCanonicalScore(roast: RoastOutput, analyzerScore: number): RoastOutput {
  const score = Math.max(0, Math.min(MAX_SCORE, Math.round(analyzerScore)));
  return { ...roast, score, grade: tierForScore(score).grade };
}

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
        roast: withCanonicalScore(parsed.value, analyzerScore),
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
        roast: withCanonicalScore(parsed.value, analyzerScore),
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

  // Last resort: hardcoded default, still carrying the canonical score.
  return {
    roast: withCanonicalScore(DEFAULT_ROAST, analyzerScore),
    aiMeta: {
      providerUsed: "default",
      modelUsed: "default",
      aiFailed: true,
      fallbackUsed: true,
    },
  };
}
