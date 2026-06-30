/**
 * Shared prompt construction and response helpers for the AI provider modules.
 *
 * Every external provider sends the same instruction (produce a GitRoasted
 * `RoastOutput` as JSON) built from the analyzer summary, and every provider
 * needs to turn the model's text answer back into a parsed JSON value. These
 * helpers keep that logic in one place so each provider module only owns its
 * transport details (endpoint, auth, response envelope).
 *
 * Note: none of these helpers validate the shape of the result — validation is
 * the orchestrator's responsibility (task 6.3). They only parse text into an
 * `unknown` value for the orchestrator to validate.
 */

/**
 * System instruction describing the required JSON contract. The provider is
 * asked to return ONLY a JSON object matching the `RoastOutput` schema so the
 * orchestrator can validate it directly.
 */
export const ROAST_SYSTEM_PROMPT = [
  "You are GitRoasted, a witty but good-natured code reviewer who roasts public GitHub profiles.",
  "Write jokes that are funny but safe: never hateful, discriminatory, or a personal attack on protected characteristics.",
  "Respond with ONLY a single JSON object and no surrounding prose or markdown.",
  "The JSON object MUST have exactly these keys:",
  '- "score": integer 0..100 (overall developer score)',
  '- "grade": short letter grade string (e.g. "A", "B", "C")',
  '- "title": short punchy title string',
  '- "shortRoast": one-sentence roast string',
  '- "longRoast": multi-sentence roast string',
  '- "strengths": array of strings',
  '- "weaknesses": array of strings',
  '- "improvementTips": array of strings',
  '- "shareCaption": short shareable caption string',
].join("\n");

/**
 * Build the user-facing prompt from the compact analyzer summary.
 */
export function buildUserPrompt(summary: string): string {
  return [
    "Here is a compact summary of a public GitHub profile to roast:",
    "",
    summary,
    "",
    "Produce the roast now as a single JSON object following the system instructions.",
  ].join("\n");
}

/**
 * Read a required environment variable, throwing when it is missing or blank.
 * A throw here causes the orchestrator to skip this provider and fall through
 * to the next one in the chain.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Parse a model's text answer into a JSON value.
 *
 * Models sometimes wrap JSON in markdown code fences (```json ... ```), so this
 * strips a fenced block when present before parsing. Returns the parsed value
 * as `unknown` for the orchestrator to validate. Throws when the text is not
 * valid JSON, which the orchestrator treats as a failed attempt.
 */
export function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}
