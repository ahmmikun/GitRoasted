/**
 * Developer_Score engine — the 1000-point, 8-dimension scoring model.
 *
 * Pure logic: given a normalized profile, its aggregate stats, and (optionally)
 * trailing-year contribution data, produce a total score in [0, 1000] together
 * with a per-dimension breakdown and a tier.
 *
 * The breakdown is the backbone of the whole platform — the leaderboard ranks
 * by `total`, the comparison view diffs dimensions, and the improvement
 * roadmap targets the weakest dimensions. Because of that, every dimension
 * carries a human-readable `detail` explaining what produced its score.
 *
 * Correctness properties (verified by property tests):
 *  - `total` is an integer in [0, 1000].
 *  - Every dimension score is an integer in [0, its own max].
 *  - `total` equals the sum of the dimension scores.
 *  - The dimension maxima sum to exactly 1000.
 *  - Scoring is deterministic for a fixed input and reference time.
 */

import type {
  ContributionData,
  DimensionScore,
  GitHubProfile,
  GitHubStats,
  ScoreDimensionKey,
  ScoreResult,
  ScoreTier,
} from "./types";

// Re-exported so callers can import the score vocabulary from either module.
export type { DimensionScore, ScoreDimensionKey, ScoreResult, ScoreTier };

/** The maximum attainable Developer_Score. */
export const MAX_SCORE = 1000;

/** Point ceiling for each dimension. These sum to exactly `MAX_SCORE`. */
export const DIMENSION_MAX: Record<ScoreDimensionKey, number> = {
  impact: 250,
  consistency: 200,
  quality: 150,
  community: 150,
  diversity: 100,
  experience: 75,
  activity: 50,
  bonuses: 25,
};

/** Display order used by every UI that renders the breakdown. */
export const DIMENSION_ORDER: ScoreDimensionKey[] = [
  "impact",
  "consistency",
  "quality",
  "community",
  "diversity",
  "experience",
  "activity",
  "bonuses",
];

/** Human-readable label and one-line meaning for each dimension. */
export const DIMENSION_META: Record<
  ScoreDimensionKey,
  { label: string; description: string }
> = {
  impact: {
    label: "Impact",
    description: "How much attention your work attracts — stars and forks.",
  },
  consistency: {
    label: "Consistency",
    description: "How regularly you contributed over the last year.",
  },
  quality: {
    label: "Quality",
    description: "Documentation, licensing, topics and demo links on your repos.",
  },
  community: {
    label: "Community",
    description: "Your following on GitHub and how it balances against who you follow.",
  },
  diversity: {
    label: "Diversity",
    description: "The range of languages across your public repositories.",
  },
  experience: {
    label: "Experience",
    description: "How long your account has existed.",
  },
  activity: {
    label: "Activity",
    description: "Recent pushes and how many repos you are actively touching.",
  },
  bonuses: {
    label: "Bonuses",
    description: "Profile completeness, a profile README, and standout repositories.",
  },
};

/**
 * Tier bands, ordered from highest to lowest. Every score in [0, 1000] falls
 * into exactly one band because the last band starts at 0.
 */
export const SCORE_TIERS: ScoreTier[] = [
  { min: 900, label: "Elite", grade: "S" },
  { min: 800, label: "Outstanding", grade: "A" },
  { min: 700, label: "Strong", grade: "B" },
  { min: 550, label: "Solid", grade: "C" },
  { min: 400, label: "Developing", grade: "D" },
  { min: 200, label: "Early", grade: "E" },
  { min: 0, label: "Getting Started", grade: "F" },
];

/** Resolve the tier for a total score. */
export function tierForScore(total: number): ScoreTier {
  const safe = Number.isFinite(total) ? total : 0;
  // SCORE_TIERS is ordered descending, so the first match is the tightest band.
  return SCORE_TIERS.find((tier) => safe >= tier.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

/** Clamp `value` into the inclusive range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** Coerce a possibly-missing numeric stat into a non-negative finite number. */
function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Map a count onto [0, 1] with diminishing returns.
 *
 * Uses a logarithmic curve so the first few stars/followers matter far more
 * than the thousandth, and `target` is the value at which the curve reaches 1.
 * This keeps mega-accounts from flattening the entire leaderboard.
 */
function logProgress(value: number, target: number): number {
  const v = num(value);
  if (v <= 0 || target <= 0) return 0;
  return clamp(Math.log10(1 + v) / Math.log10(1 + target), 0, 1);
}

/** Map a count onto [0, 1] linearly, saturating at `target`. */
function linearProgress(value: number, target: number): number {
  const v = num(value);
  if (v <= 0 || target <= 0) return 0;
  return clamp(v / target, 0, 1);
}

/** A non-null, non-whitespace string is considered "present". */
function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Safe ratio helper: returns 0 when the denominator is 0 or the part is absent. */
function ratio(part: number | null | undefined, whole: number): number {
  if (whole <= 0) return 0;
  return clamp(num(part) / whole, 0, 1);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365.25;

/** Star count at which the Impact star component saturates. */
const IMPACT_STARS_TARGET = 5000;
/** Fork count at which the Impact fork component saturates. */
const IMPACT_FORKS_TARGET = 1000;
/** Trailing-year contributions at which Consistency saturates. */
const CONSISTENCY_CONTRIB_TARGET = 1500;
/** Weeks in the trailing-year contribution window. */
const WEEKS_PER_YEAR = 52;
/** Follower count at which the Community follower component saturates. */
const COMMUNITY_FOLLOWERS_TARGET = 10000;
/** Distinct languages at which Diversity saturates. */
const DIVERSITY_LANGUAGES_TARGET = 8;
/** Account age in years at which Experience saturates. */
const EXPERIENCE_YEARS_TARGET = 8;
/** Recently-updated repo count at which the Activity breadth component saturates. */
const ACTIVITY_REPOS_TARGET = 6;
/** Stars on a single repo that qualify it as a standout project. */
const STANDOUT_REPO_STARS = 50;
/**
 * Fraction of the Consistency ceiling reachable without real contribution data.
 * Capping the estimate at half avoids both punishing users when we lack a token
 * and rewarding them as if we had verified the data.
 */
const CONSISTENCY_ESTIMATE_CEILING = 0.5;

/** Format a number with thousands separators for use in `detail` strings. */
function fmt(value: number | null | undefined): string {
  return Math.round(num(value)).toLocaleString("en-US");
}

/** Build a dimension entry, rounding and clamping the score to its ceiling. */
function dimension(
  key: ScoreDimensionKey,
  rawScore: number,
  detail: string,
): DimensionScore {
  const max = DIMENSION_MAX[key];
  return {
    key,
    label: DIMENSION_META[key].label,
    score: Math.round(clamp(rawScore, 0, max)),
    max,
    detail,
  };
}

/**
 * Impact (250) — community traction, weighted toward stars over forks.
 */
function scoreImpact(stats: GitHubStats): DimensionScore {
  const stars = num(stats.totalStars);
  const forks = num(stats.totalForks);
  const max = DIMENSION_MAX.impact;

  const starPoints = logProgress(stars, IMPACT_STARS_TARGET) * (max * 0.7);
  const forkPoints = logProgress(forks, IMPACT_FORKS_TARGET) * (max * 0.3);

  const detail =
    stars === 0 && forks === 0
      ? "No stars or forks yet across your public repositories."
      : `${fmt(stars)} star(s) and ${fmt(forks)} fork(s) across your public repositories.`;

  return dimension("impact", starPoints + forkPoints, detail);
}

/**
 * Consistency (200) — trailing-year contribution volume and spread.
 *
 * With real calendar data, volume is worth 60% and the number of active weeks
 * 40%, so steady contributors beat single-weekend bursts. Without calendar
 * data we fall back to a capped estimate derived from recent repo pushes.
 */
function scoreConsistency(
  stats: GitHubStats,
  contributions: ContributionData | null | undefined,
): DimensionScore {
  const max = DIMENSION_MAX.consistency;

  if (!contributions || contributions.estimated) {
    // Fallback: infer rough regularity from how many repos were pushed recently.
    const activeRepos = num(stats.recentlyUpdatedRepos);
    const estimated =
      linearProgress(activeRepos, ACTIVITY_REPOS_TARGET) * max * CONSISTENCY_ESTIMATE_CEILING;
    const contributionNote =
      contributions && contributions.totalContributions > 0
        ? ` Estimated from ~${fmt(contributions.totalContributions)} recent public event(s).`
        : "";
    return dimension(
      "consistency",
      estimated,
      `Contribution history unavailable, so this is estimated from ${fmt(activeRepos)} recently updated repo(s) and capped at half credit.${contributionNote}`,
    );
  }

  const volume = logProgress(contributions.totalContributions, CONSISTENCY_CONTRIB_TARGET) * (max * 0.6);
  const spread = linearProgress(contributions.activeWeeks, WEEKS_PER_YEAR) * (max * 0.4);

  const detail = `${fmt(contributions.totalContributions)} contribution(s) over the last year, active in ${fmt(contributions.activeWeeks)} of ${WEEKS_PER_YEAR} weeks (longest streak ${fmt(contributions.longestStreakDays)} day(s)).`;

  return dimension("consistency", volume + spread, detail);
}

/**
 * Quality (150) — signals that a repository is presentable to other humans:
 * descriptions, READMEs, licenses, topics, and live demos.
 *
 * Ratios are taken over original (non-forked) repos where that is the
 * meaningful denominator, since forks inherit their metadata.
 */
function scoreQuality(stats: GitHubStats): DimensionScore {
  const total = num(stats.totalReposAnalyzed);
  const originals = num(stats.originalRepos);

  if (total === 0) {
    return dimension(
      "quality",
      0,
      "No public repositories to assess for documentation or licensing.",
    );
  }

  const descriptionRatio = ratio(stats.reposWithDescription, total);
  const licenseRatio = ratio(stats.reposWithLicense, originals);
  const topicsRatio = ratio(stats.reposWithTopics, originals);
  const homepageRatio = ratio(stats.reposWithHomepage, originals);
  // READMEs are only sampled for the top repos, so credit presence rather than coverage.
  const readmeSignal = num(stats.reposWithReadme) > 0 ? 1 : 0;

  const points =
    descriptionRatio * 50 +
    licenseRatio * 30 +
    topicsRatio * 30 +
    homepageRatio * 20 +
    readmeSignal * 20;

  const detail = `${fmt(stats.reposWithDescription)}/${fmt(total)} repo(s) described, ${fmt(stats.reposWithLicense)} licensed, ${fmt(stats.reposWithTopics)} with topics, ${fmt(stats.reposWithHomepage)} with a demo link.`;

  return dimension("quality", points, detail);
}

/**
 * Community (150) — audience size plus a healthy follower/following balance.
 */
function scoreCommunity(profile: GitHubProfile): DimensionScore {
  const max = DIMENSION_MAX.community;
  const followers = num(profile.followers);
  const following = num(profile.following);

  const audience = logProgress(followers, COMMUNITY_FOLLOWERS_TARGET) * (max * 0.75);

  // A ratio at or above 1 earns the full balance component. Users who follow
  // nobody are not penalised — they simply score on audience alone.
  const balanceRatio = following > 0 ? clamp(followers / following, 0, 1) : followers > 0 ? 1 : 0;
  const balance = balanceRatio * (max * 0.25);

  const detail =
    followers === 0
      ? "No followers yet."
      : `${fmt(followers)} follower(s) against ${fmt(following)} following.`;

  return dimension("community", audience + balance, detail);
}

/**
 * Diversity (100) — breadth of languages used across public repositories.
 */
function scoreDiversity(stats: GitHubStats): DimensionScore {
  // Prefer the uncapped distinct count; fall back to the capped top-languages
  // list for records persisted before that field existed.
  const distinct =
    typeof stats.distinctLanguages === "number"
      ? num(stats.distinctLanguages)
      : (stats.topLanguages?.length ?? 0);

  const points = linearProgress(distinct, DIVERSITY_LANGUAGES_TARGET) * DIMENSION_MAX.diversity;

  const detail =
    distinct === 0
      ? "No languages detected on your public repositories."
      : `${fmt(distinct)} distinct language(s) detected${
          stats.topLanguages && stats.topLanguages.length > 0
            ? ` (top: ${stats.topLanguages.join(", ")})`
            : ""
        }.`;

  return dimension("diversity", points, detail);
}

/**
 * Experience (75) — account age. Purely a function of the creation date, so it
 * grows on its own and cannot be gamed.
 */
function scoreExperience(profile: GitHubProfile, now: number): DimensionScore {
  const created = Date.parse(profile.createdAt ?? "");
  if (Number.isNaN(created)) {
    return dimension("experience", 0, "Account creation date unavailable.");
  }

  const years = Math.max(0, (now - created) / (MS_PER_DAY * DAYS_PER_YEAR));
  const points = linearProgress(years, EXPERIENCE_YEARS_TARGET) * DIMENSION_MAX.experience;
  const rounded = Math.round(years * 10) / 10;

  return dimension(
    "experience",
    points,
    `Account is about ${rounded} year(s) old (created ${profile.createdAt.slice(0, 10)}).`,
  );
}

/**
 * Activity (50) — how recently and how broadly you are pushing code.
 */
function scoreActivity(stats: GitHubStats): DimensionScore {
  const max = DIMENSION_MAX.activity;
  const activeRepos = num(stats.recentlyUpdatedRepos);
  const breadth = linearProgress(activeRepos, ACTIVITY_REPOS_TARGET) * (max * 0.4);

  const days = stats.daysSinceLastPush;
  let recencyRatio = 0;
  let recencyNote = "No recorded pushes.";

  if (typeof days === "number" && Number.isFinite(days) && days >= 0) {
    // Full credit within a week, tapering linearly to zero at one year.
    if (days <= 7) {
      recencyRatio = 1;
    } else if (days >= 365) {
      recencyRatio = 0;
    } else {
      recencyRatio = 1 - (days - 7) / (365 - 7);
    }
    recencyNote = `Last push was ${fmt(days)} day(s) ago.`;
  } else if (activeRepos > 0) {
    // Legacy records lack the push timestamp; infer partial recency instead.
    recencyRatio = 0.5;
    recencyNote = "Last push date unavailable.";
  }

  const recency = clamp(recencyRatio, 0, 1) * (max * 0.6);

  return dimension(
    "activity",
    breadth + recency,
    `${recencyNote} ${fmt(activeRepos)} repo(s) updated in the last 90 days.`.trim(),
  );
}

/**
 * Bonuses (25) — profile polish and evidence of at least one standout project.
 */
function scoreBonuses(profile: GitHubProfile, stats: GitHubStats): DimensionScore {
  const earned: string[] = [];
  let points = 0;

  if (isNonEmpty(profile.profileReadme ?? null)) {
    points += 8;
    earned.push("profile README");
  }
  if (isNonEmpty(profile.bio)) {
    points += 3;
    earned.push("bio");
  }
  if (isNonEmpty(profile.blog)) {
    points += 2;
    earned.push("website");
  }
  if (isNonEmpty(profile.company) || isNonEmpty(profile.location)) {
    points += 2;
    earned.push("company/location");
  }
  if (num(stats.maxRepoStars) >= STANDOUT_REPO_STARS) {
    points += 10;
    earned.push(`a repo with ${STANDOUT_REPO_STARS}+ stars`);
  }

  const detail =
    earned.length > 0
      ? `Earned for: ${earned.join(", ")}.`
      : "No bonus signals yet — add a bio, website, and profile README.";

  return dimension("bonuses", points, detail);
}

/**
 * Compute the full Developer_Score for a profile.
 *
 * @param profile       Normalized public profile data.
 * @param stats         Aggregate repository statistics from the analyzer.
 * @param contributions Trailing-year contribution data, or null when it could
 *                      not be fetched (Consistency then degrades gracefully).
 * @param now           Reference time in ms, injectable for deterministic tests.
 */
export function computeDeveloperScore(
  profile: GitHubProfile,
  stats: GitHubStats,
  contributions: ContributionData | null = null,
  now: number = Date.now(),
): ScoreResult {
  const breakdown: DimensionScore[] = [
    scoreImpact(stats),
    scoreConsistency(stats, contributions),
    scoreQuality(stats),
    scoreCommunity(profile),
    scoreDiversity(stats),
    scoreExperience(profile, now),
    scoreActivity(stats),
    scoreBonuses(profile, stats),
  ];

  // Summing already-rounded dimension scores keeps the displayed breakdown
  // exactly consistent with the displayed total.
  const total = clamp(
    breakdown.reduce((sum, d) => sum + d.score, 0),
    0,
    MAX_SCORE,
  );
  const tier = tierForScore(total);

  return { total, breakdown, tier, grade: tier.grade };
}

/** Look up one dimension in a breakdown, or undefined when absent. */
export function findDimension(
  breakdown: DimensionScore[],
  key: ScoreDimensionKey,
): DimensionScore | undefined {
  return breakdown.find((d) => d.key === key);
}

/**
 * Rank dimensions by how much of their ceiling is unearned, strongest gap
 * first. Used by the improvement roadmap to target real weaknesses, and by the
 * comparison view to surface areas for improvement.
 */
export function weakestDimensions(
  breakdown: DimensionScore[],
  limit: number = breakdown.length,
): DimensionScore[] {
  return [...breakdown]
    .sort((a, b) => {
      const gapA = (a.max - a.score) / a.max;
      const gapB = (b.max - b.score) / b.max;
      if (gapB !== gapA) return gapB - gapA;
      // Deterministic tie-break: larger ceiling first, then key order.
      if (b.max !== a.max) return b.max - a.max;
      return a.key.localeCompare(b.key);
    })
    .slice(0, limit);
}

/**
 * Rank dimensions by how much of their ceiling is earned, strongest first.
 * Used to derive factual strengths.
 */
export function strongestDimensions(
  breakdown: DimensionScore[],
  limit: number = breakdown.length,
): DimensionScore[] {
  return [...breakdown]
    .sort((a, b) => {
      const ratioA = a.score / a.max;
      const ratioB = b.score / b.max;
      if (ratioB !== ratioA) return ratioB - ratioA;
      if (b.max !== a.max) return b.max - a.max;
      return a.key.localeCompare(b.key);
    })
    .slice(0, limit);
}
