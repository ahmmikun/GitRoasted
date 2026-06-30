/**
 * Profile_Analyzer for GitRoasted.
 *
 * Pure logic that turns a GitHub profile and its repositories into aggregate
 * statistics, a clamped/rounded Developer_Score in [0, 100], and a compact
 * multi-line summary suitable for embedding in an AI prompt.
 *
 * Correctness properties (see design.md):
 *  - totalStars === sum of repo stars; totalForks === sum of repo forks.
 *  - reposWithDescription + reposWithoutDescription === totalReposAnalyzed.
 *  - originalRepos + forkedRepos === totalReposAnalyzed.
 *  - An empty repo list yields zero for every repository-derived statistic.
 *  - The score is always an integer in the inclusive range 0..100.
 */

import type { AnalysisResult, GitHubProfile, GitHubRepo, GitHubStats } from "./types";

/** Number of top languages to surface in the stats and summary. */
const TOP_LANGUAGES_LIMIT = 5;

/** A repo pushed within this many days counts as "recently updated". */
const RECENT_ACTIVITY_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A non-null, non-whitespace string is considered "present". */
function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Compute the most-used languages across the repositories, ordered by
 * frequency (descending) with name as a deterministic tie-breaker.
 */
function computeTopLanguages(repos: GitHubRepo[]): string[] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (isNonEmpty(repo.language)) {
      const lang = (repo.language as string).trim();
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, TOP_LANGUAGES_LIMIT)
    .map(([lang]) => lang);
}

/** Count repositories whose `pushedAt` falls within the recent-activity window. */
function countRecentlyUpdated(repos: GitHubRepo[], now: number): number {
  let count = 0;
  for (const repo of repos) {
    const pushed = Date.parse(repo.pushedAt);
    if (!Number.isNaN(pushed) && now - pushed <= RECENT_ACTIVITY_DAYS * MS_PER_DAY) {
      count += 1;
    }
  }
  return count;
}

/** Compute the aggregate GitHub statistics. Every field is present even for an empty repo list. */
function computeStats(repos: GitHubRepo[], now: number): GitHubStats {
  const totalReposAnalyzed = repos.length;

  let totalStars = 0;
  let totalForks = 0;
  let reposWithDescription = 0;
  let reposWithHomepage = 0;
  let forkedRepos = 0;

  for (const repo of repos) {
    totalStars += repo.stargazersCount;
    totalForks += repo.forksCount;
    if (isNonEmpty(repo.description)) reposWithDescription += 1;
    if (isNonEmpty(repo.homepage)) reposWithHomepage += 1;
    if (repo.fork) forkedRepos += 1;
  }

  return {
    totalReposAnalyzed,
    totalStars,
    totalForks,
    topLanguages: computeTopLanguages(repos),
    reposWithDescription,
    // Defined as the complement so the partition always sums to the total.
    reposWithoutDescription: totalReposAnalyzed - reposWithDescription,
    reposWithHomepage,
    recentlyUpdatedRepos: countRecentlyUpdated(repos, now),
    forkedRepos,
    // Defined as the complement so the partition always sums to the total.
    originalRepos: totalReposAnalyzed - forkedRepos,
  };
}

/** Clamp `value` into the inclusive range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the Developer_Score from profile-only and repo-derived signals.
 *
 * Each signal contributes a bounded amount so no single dimension dominates;
 * the accumulated raw value is clamped to [0, 100] and rounded to an integer.
 * For a zero-repository profile only the profile signals contribute.
 */
function computeScore(profile: GitHubProfile, stats: GitHubStats): number {
  let raw = 0;

  // Repository breadth (original repos), capped.
  raw += clamp(stats.originalRepos * 2, 0, 20);

  // Community traction.
  raw += clamp(stats.totalStars, 0, 25);
  raw += clamp(stats.totalForks, 0, 10);

  // Language diversity.
  raw += clamp(stats.topLanguages.length * 3, 0, 15);

  // Description coverage ratio (only meaningful when repos exist).
  if (stats.totalReposAnalyzed > 0) {
    const coverage = stats.reposWithDescription / stats.totalReposAnalyzed;
    raw += coverage * 15;
  }

  // Recent activity.
  raw += clamp(stats.recentlyUpdatedRepos * 2, 0, 15);

  // Profile completeness signals.
  if (isNonEmpty(profile.bio)) raw += 5;
  if (isNonEmpty(profile.blog)) raw += 3;
  if (isNonEmpty(profile.company)) raw += 2;

  return clamp(Math.round(raw), 0, 100);
}

/** Build the compact multi-line summary embedded into the AI prompt. */
function buildSummary(
  profile: GitHubProfile,
  stats: GitHubStats,
  score: number,
): string {
  const name = isNonEmpty(profile.name) ? (profile.name as string) : profile.login;
  const languages = stats.topLanguages.length > 0 ? stats.topLanguages.join(", ") : "none";
  const bio = isNonEmpty(profile.bio) ? (profile.bio as string).trim() : "(no bio)";

  return [
    `GitHub user: ${profile.login}${name !== profile.login ? ` (${name})` : ""}`,
    `Bio: ${bio}`,
    `Followers: ${profile.followers} | Following: ${profile.following} | Public repos: ${profile.publicRepos}`,
    `Repos analyzed: ${stats.totalReposAnalyzed} (original: ${stats.originalRepos}, forked: ${stats.forkedRepos})`,
    `Total stars: ${stats.totalStars} | Total forks: ${stats.totalForks}`,
    `Top languages: ${languages}`,
    `Descriptions: ${stats.reposWithDescription} with / ${stats.reposWithoutDescription} without`,
    `Repos with homepage: ${stats.reposWithHomepage} | Recently updated: ${stats.recentlyUpdatedRepos}`,
    `Developer score: ${score}/100`,
  ].join("\n");
}

/**
 * Analyze a GitHub profile and its repositories into stats, a developer score,
 * and a compact AI-prompt summary.
 *
 * @param profile Normalized public profile data.
 * @param repos   Normalized public repositories (may be empty).
 * @param now     Optional reference time (ms) for recent-activity detection;
 *                defaults to the current time. Injectable for testability.
 */
export function analyzeProfile(
  profile: GitHubProfile,
  repos: GitHubRepo[],
  now: number = Date.now(),
): AnalysisResult {
  const stats = computeStats(repos, now);
  const score = computeScore(profile, stats);
  const summary = buildSummary(profile, stats, score);
  return { stats, score, summary };
}
