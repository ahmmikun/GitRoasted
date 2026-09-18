/**
 * Validation schemas and helpers for GitRoasted.
 *
 * Uses Zod for both the inbound username/request validation and the strict
 * AI Roast_Output contract. Parse failures are surfaced as typed `{ ok }`
 * results so callers never have to catch.
 */

import { z } from "zod";
import type { RoastOutput } from "./types";
import { MAX_SCORE } from "./scoring";

/**
 * GitHub username rule: 1–39 chars, alphanumeric or hyphen, no leading or
 * trailing hyphen. The regex alone rejects disallowed characters, edge
 * hyphens, and lengths over 39.
 */
export const GITHUB_USERNAME_REGEX =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/** Schema for a single GitHub username. Trimmed before validation. */
export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username is required")
  .max(39, "Username must be at most 39 characters")
  .regex(GITHUB_USERNAME_REGEX, "Invalid GitHub username");

/** Schema for the inbound POST /api/roast request body. */
export const roastRequestSchema = z.object({
  username: usernameSchema,
  roastMode: z.enum(["brutal", "playful"]).optional(),
});

/**
 * Strict schema for AI-produced roast output. A score outside 0..1000 fails
 * validation, so the response is treated as invalid and the fallback chain
 * continues. The upper bound matches `MAX_SCORE` in `lib/scoring.ts`.
 */
export const roastOutputSchema = z.object({
  score: z.number().int().min(0).max(MAX_SCORE),
  grade: z.string().min(1),
  title: z.string().min(1),
  shortRoast: z.string().min(1),
  longRoast: z.string().min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvementTips: z.array(z.string()),
  shareCaption: z.string().min(1),
});

/** Result type for username validation. */
export type ValidateUsernameResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

/**
 * Validate an unknown input as a GitHub username.
 * Returns the trimmed username on success or a human-readable error on failure.
 */
export function validateUsername(input: unknown): ValidateUsernameResult {
  const result = usernameSchema.safeParse(input);
  if (result.success) {
    return { ok: true, username: result.data };
  }
  const message = result.error.issues[0]?.message ?? "Invalid GitHub username";
  return { ok: false, error: message };
}

/** Result type for roast output parsing. */
export type ParseRoastOutputResult =
  | { ok: true; value: RoastOutput }
  | { ok: false; error: string };

/**
 * Parse an unknown value (e.g. a raw AI response) against the Roast_Output
 * schema. Returns the validated value on success or an error on failure.
 */
export function parseRoastOutput(raw: unknown): ParseRoastOutputResult {
  const result = roastOutputSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const message = result.error.issues[0]?.message ?? "Invalid roast output";
  return { ok: false, error: message };
}
