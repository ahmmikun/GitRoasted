/**
 * Profile_Analyzer for GitRoasted.
 *
 * Pure logic that turns a GitHub profile and its repositories into aggregate
 * statistics, the 1000-point Developer_Score with its per-dimension breakdown
 * (see `lib/scoring.ts`), and a compact multi-line summary suitable for
 * embedding in an AI prompt.
 *
 * Correctness properties (see design.md):
 *  - totalStars === sum of repo stars; totalForks === sum of repo forks.
 *  - reposWithDescription + reposWithoutDescription === totalReposAnalyzed.
 *  - originalRepos + forkedRepos === totalReposAnalyzed.
 *  - An empty repo list yields zero for every repository-derived statistic.
 *  - The score is always an integer in the inclusive range 0..1000.
 */

import type {
  AnalysisResult,
  ContributionData,
  GitHubProfile,
  GitHubRepo,
  GitHubStats,
  ScoreResult,
} from "./types";
import { MAX_SCORE, computeDeveloperScore } from "./scoring";

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
  return [...countLanguages(repos).entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, TOP_LANGUAGES_LIMIT)
    .map(([lang]) => lang);
}

/** Tally repositories per language. Repos with no detected language are skipped. */
function countLanguages(repos: GitHubRepo[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (isNonEmpty(repo.language)) {
      const lang = (repo.language as string).trim();
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }
  return counts;
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

/**
 * Whole days since the most recent push across all repositories.
 * Returns null when no repository has a parseable push timestamp.
 */
function computeDaysSinceLastPush(repos: GitHubRepo[], now: number): number | null {
  let latest: number | null = null;
  for (const repo of repos) {
    const pushed = Date.parse(repo.pushedAt);
    if (!Number.isNaN(pushed) && (latest === null || pushed > latest)) {
      latest = pushed;
    }
  }
  if (latest === null) return null;
  // Clamp at 0 so clock skew never yields a negative age.
  return Math.max(0, Math.floor((now - latest) / MS_PER_DAY));
}

/** Compute the aggregate GitHub statistics. Every field is present even for an empty repo list. */
function computeStats(repos: GitHubRepo[], now: number): GitHubStats {
  const totalReposAnalyzed = repos.length;

  let totalStars = 0;
  let totalForks = 0;
  let reposWithDescription = 0;
  let reposWithHomepage = 0;
  let forkedRepos = 0;
  let reposWithLicense = 0;
  let reposWithTopics = 0;
  let reposWithReadme = 0;
  let maxRepoStars = 0;

  const undescribedRepoNames: string[] = [];
  const unlicensedRepoNames: string[] = [];
  const untaggedRepoNames: string[] = [];
  const missingReadmeRepoNames: string[] = [];
  const repoAuditIssues: import("./types").RepoAuditIssue[] = [];

  for (const repo of repos) {
    totalStars += repo.stargazersCount;
    totalForks += repo.forksCount;

    const hasDesc =
      repo.hasDescription ?? (isNonEmpty(repo.description));
    if (hasDesc) {
      reposWithDescription += 1;
    } else {
      undescribedRepoNames.push(repo.name);
    }

    const hasHome =
      repo.hasHomepage ?? (isNonEmpty(repo.homepage));
    if (hasHome) reposWithHomepage += 1;

    if (repo.fork) {
      forkedRepos += 1;
    }

    const hasLic =
      repo.hasLicense ??
      (isNonEmpty(repo.license ?? null) || isNonEmpty(repo.licenseName ?? null));
    if (hasLic) {
      reposWithLicense += 1;
    } else if (!repo.fork) {
      unlicensedRepoNames.push(repo.name);
    }

    const hasTop =
      repo.hasTopics ??
      (Array.isArray(repo.topics) && repo.topics.length > 0);
    if (hasTop) {
      reposWithTopics += 1;
    } else if (!repo.fork) {
      untaggedRepoNames.push(repo.name);
    }

    const hasRead =
      repo.hasReadme ?? (isNonEmpty(repo.readmeExcerpt ?? null));
    if (hasRead) {
      reposWithReadme += 1;
    } else if (!repo.fork && repo.hasReadme === false) {
      missingReadmeRepoNames.push(repo.name);
    }

    if (repo.stargazersCount > maxRepoStars) maxRepoStars = repo.stargazersCount;

    // Collect audit issue if documentation or metadata is missing
    const missing: Array<"readme" | "license" | "topics" | "description" | "homepage"> = [];
    if (!hasDesc) missing.push("description");
    if (!repo.fork && !hasLic) missing.push("license");
    if (!repo.fork && !hasTop) missing.push("topics");
    if (!repo.fork && !hasHome) missing.push("homepage");
    if (!repo.fork && repo.hasReadme === false) missing.push("readme");

    if (missing.length > 0) {
      const detectedDetails: string[] = [];
      if (hasDesc && repo.description) {
        detectedDetails.push(`description: "${repo.description.slice(0, 35)}..."`);
      }
      if (hasLic) detectedDetails.push(`license: "${repo.licenseName || repo.license || "detected"}"`);
      if (hasTop && repo.topics) detectedDetails.push(`topics: [${repo.topics.join(", ")}]`);
      if (hasHome && repo.homepage) detectedDetails.push(`homepage: "${repo.homepage}"`);
      if (hasRead) detectedDetails.push("README present");

      const detectedSummary =
        detectedDetails.length > 0 ? detectedDetails.join(", ") : "None";

      repoAuditIssues.push({
        repoName: repo.name,
        isFork: repo.fork,
        missing,
        detected: {
          hasDescription: Boolean(hasDesc),
          description: repo.description,
          hasReadme: repo.hasReadme ?? (hasRead ? true : null),
          readmeExcerpt: repo.readmeExcerpt,
          hasLicense: Boolean(hasLic),
          licenseName: repo.licenseName || repo.license,
          hasTopics: Boolean(hasTop),
          topics: repo.topics,
          hasHomepage: Boolean(hasHome),
          homepage: repo.homepage,
        },
        evidence: `GitHub API metadata (${detectedSummary})`,
        recommendedFix: `Add missing ${missing.join(", ")} to repository "${repo.name}".`,
      });
    }
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
    distinctLanguages: countLanguages(repos).size,
    reposWithLicense,
    reposWithTopics,
    reposWithReadme,
    maxRepoStars,
    daysSinceLastPush: computeDaysSinceLastPush(repos, now),
    repoAuditIssues,
    undescribedRepoNames,
    unlicensedRepoNames,
    untaggedRepoNames,
    missingReadmeRepoNames,
  };
}

/**
 * Build the compact multi-line summary embedded into the AI prompt.
 *
 * The Developer_Score and its per-dimension breakdown are included so the
 * model roasts the same numbers the UI displays rather than inventing its own.
 */
function buildSummary(
  profile: GitHubProfile,
  stats: GitHubStats,
  score: ScoreResult,
  repos: GitHubRepo[],
): string {
  const name = isNonEmpty(profile.name) ? (profile.name as string) : profile.login;
  const languages = stats.topLanguages.length > 0 ? stats.topLanguages.join(", ") : "none";
  const bio = isNonEmpty(profile.bio) ? (profile.bio as string).trim() : "(no bio)";

  const lines = [
    `GitHub user: ${profile.login}${name !== profile.login ? ` (${name})` : ""}`,
    `Bio: ${bio}`,
    `Followers: ${profile.followers} | Following: ${profile.following} | Public repos: ${profile.publicRepos}`,
    `Repos analyzed: ${stats.totalReposAnalyzed} (original: ${stats.originalRepos}, forked: ${stats.forkedRepos})`,
    `Total stars: ${stats.totalStars} | Total forks: ${stats.totalForks}`,
    `Top languages: ${languages}`,
    `Descriptions: ${stats.reposWithDescription} with / ${stats.reposWithoutDescription} without`,
    `Repos with homepage: ${stats.reposWithHomepage} | Recently updated: ${stats.recentlyUpdatedRepos}`,
    `Developer score: ${score.total}/${MAX_SCORE} (grade ${score.grade}, tier ${score.tier.label})`,
    "",
    "Score breakdown:",
    ...score.breakdown.map(
      (d) => `  - ${d.label}: ${d.score}/${d.max} — ${d.detail}`,
    ),
  ];

  // Top 5 non-forked repos by stars with README excerpts.
  const topRepos = [...repos]
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazersCount - a.stargazersCount)
    .slice(0, 5);

  if (topRepos.length > 0) {
    lines.push("", "Top repositories:");
    for (const repo of topRepos) {
      const desc = isNonEmpty(repo.description) ? `: ${(repo.description as string).trim()}` : "";
      lines.push(`  - ${repo.name} (★${repo.stargazersCount}${desc})`);
      if (isNonEmpty(repo.readmeExcerpt ?? null)) {
        lines.push(`    README: ${(repo.readmeExcerpt as string).trim()}`);
      }
    }
  }

  // Profile README if present.
  if (isNonEmpty(profile.profileReadme ?? null)) {
    const excerpt = (profile.profileReadme as string).substring(0, 500).trim();
    lines.push("", `Profile README:\n${excerpt}`);
  }

  return lines.join("\n");
}

/**
 * Analyze a GitHub profile and its repositories into stats, the 1000-point
 * Developer_Score with its per-dimension breakdown, and a compact AI-prompt
 * summary.
 *
 * @param profile       Normalized public profile data.
 * @param repos         Normalized public repositories (may be empty).
 * @param now           Optional reference time (ms) for recency calculations;
 *                      defaults to the current time. Injectable for testability.
 * @param contributions Optional trailing-year contribution data. When null the
 *                      Consistency dimension degrades to a capped estimate.
 */
export function analyzeProfile(
  profile: GitHubProfile,
  repos: GitHubRepo[],
  now: number = Date.now(),
  contributions: ContributionData | null = null,
): AnalysisResult {
  const stats = computeStats(repos, now);
  const score = computeDeveloperScore(profile, stats, contributions, now);
  const summary = buildSummary(profile, stats, score, repos);
  return {
    stats,
    score: score.total,
    breakdown: score.breakdown,
    tier: score.tier,
    grade: score.grade,
    summary,
  };
}
