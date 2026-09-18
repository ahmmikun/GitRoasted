/**
 * Rule_Based_Engine — the local roast generator.
 *
 * `ruleBasedRoast` builds a roast from simple heuristics over the profile and
 * computed stats, deriving a grade from the Developer_Score. `DEFAULT_ROAST` is
 * a hardcoded constant used as the last-resort fallback. Both are guaranteed to
 * satisfy `roastOutputSchema` (score is an integer in 0..1000 and every string
 * field is non-empty).
 */

import type { GitHubProfile, GitHubStats, RoastOutput } from "../types";
import { MAX_SCORE, tierForScore } from "../scoring";

/** Number of repos at or below which a portfolio is considered "thin". */
const LOW_REPO_THRESHOLD = 3;

/** Score at or above which the roast softens its tone. */
const RESPECTABLE_SCORE = 700;

/** Clamp a raw score to an integer within the inclusive range 0..MAX_SCORE. */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.round(score)));
}

/**
 * Derive a letter grade from the Developer_Score using the shared tier bands,
 * so the fallback grade always matches the rest of the application.
 */
function gradeFromScore(score: number): string {
  return tierForScore(score).grade;
}

/**
 * Generate a roast purely from heuristics, with no external AI call.
 *
 * The returned object always satisfies `roastOutputSchema`: the score is a
 * clamped integer, the grade is derived from it, and the string arrays are
 * seeded with safe defaults so they never expose empty/blank entries.
 */
export function ruleBasedRoast(
  profile: GitHubProfile,
  stats: GitHubStats,
  score: number,
): RoastOutput {
  const safeScore = clampScore(score);
  const grade = gradeFromScore(safeScore);
  const displayName = profile.name?.trim() || profile.login;

  const weaknesses: string[] = [];
  const improvementTips: string[] = [];

  // Heuristic: missing bio.
  if (!profile.bio || profile.bio.trim().length === 0) {
    weaknesses.push("No bio — your profile is more mysterious than documented.");
    improvementTips.push(
      "Add a bio so visitors know who you are before they judge your code.",
    );
  }

  // Heuristic: low repo count.
  if (stats.totalReposAnalyzed <= LOW_REPO_THRESHOLD) {
    weaknesses.push(
      `Only ${stats.totalReposAnalyzed} public repo(s) — the portfolio is looking a little shy.`,
    );
    improvementTips.push(
      "Ship a few more public projects to show what you can actually build.",
    );
  }

  // Heuristic: zero stars.
  if (stats.totalStars === 0) {
    weaknesses.push("Zero total stars — even your own repos forgot to clap.");
    improvementTips.push(
      "Write a clear README and share your best repo; stars follow good docs.",
    );
  }

  // Heuristic: many repos without descriptions.
  if (stats.reposWithoutDescription > stats.reposWithDescription) {
    weaknesses.push(
      `${stats.reposWithoutDescription} repo(s) with no description — "untitled project" energy.`,
    );
    improvementTips.push(
      "Give every repo a one-line description so people know what it does.",
    );
  }

  // Heuristic: single-language portfolio.
  if (stats.topLanguages.length === 1) {
    weaknesses.push(
      `Everything is ${stats.topLanguages[0]} — a one-language wonder.`,
    );
    improvementTips.push(
      "Experiment with another language or two to round out your range.",
    );
  }

  // Strengths, derived from positive signals (always seeded so the array is meaningful).
  const strengths: string[] = [];
  if (stats.totalStars > 0) {
    strengths.push(`Pulled in ${stats.totalStars} star(s) — people noticed.`);
  }
  if (stats.topLanguages.length > 1) {
    strengths.push(
      `Comfortable across ${stats.topLanguages.length} languages — nice range.`,
    );
  }
  if (stats.reposWithDescription > 0) {
    strengths.push(
      `${stats.reposWithDescription} repo(s) actually have descriptions — readable, who knew.`,
    );
  }
  if (profile.followers > 0) {
    strengths.push(`${profile.followers} follower(s) — you have an audience.`);
  }
  if (strengths.length === 0) {
    strengths.push("You showed up and made a GitHub account. That's a start.");
  }

  // Ensure the negative arrays are never empty.
  if (weaknesses.length === 0) {
    weaknesses.push("Honestly? Not much to roast here. Suspiciously solid.");
  }
  if (improvementTips.length === 0) {
    improvementTips.push("Keep shipping — consistency beats everything.");
  }

  const shortRoast =
    safeScore >= RESPECTABLE_SCORE
      ? `${displayName} actually knows what they're doing. Grade ${grade}, and it shows.`
      : `${displayName} has a GitHub profile and the courage to let people see it. Grade ${grade}.`;

  const longRoast = [
    `${displayName} scored ${safeScore}/${MAX_SCORE} (grade ${grade}).`,
    `Across ${stats.totalReposAnalyzed} repo(s), there are ${stats.totalStars} star(s) and ${stats.totalForks} fork(s) to show for it.`,
    weaknesses[0],
    improvementTips[0],
  ].join(" ");

  const title =
    safeScore >= RESPECTABLE_SCORE
      ? `${displayName}: Quietly Competent`
      : `${displayName}: A Work in Progress`;

  const shareCaption = `I scored ${safeScore}/${MAX_SCORE} (grade ${grade}) on GitRoasted. Can you beat me?`;

  return {
    score: safeScore,
    grade,
    title,
    shortRoast,
    longRoast,
    strengths,
    weaknesses,
    improvementTips,
    shareCaption,
  };
}

/**
 * Hardcoded last-resort roast. Returned when every external provider AND the
 * rule-based engine fail. Always satisfies `roastOutputSchema`.
 */
export const DEFAULT_ROAST: RoastOutput = {
  score: 500,
  grade: "C",
  title: "The Mysterious Developer",
  shortRoast:
    "We couldn't fully analyze this profile, but the vibes are... present.",
  longRoast:
    "Our roast machine ran out of spicy takes for this one, so here's a balanced verdict: you have a GitHub profile, which already puts you ahead of everyone who only talks about coding. Keep building, keep shipping, and come back for a hotter roast later.",
  strengths: ["You exist on GitHub, which is more than half of LinkedIn can say."],
  weaknesses: ["We didn't have enough data to find your flaws. Lucky you."],
  improvementTips: [
    "Add public repositories and project descriptions so we can roast you properly next time.",
  ],
  shareCaption: "I got roasted on GitRoasted. Think you can do better?",
};
