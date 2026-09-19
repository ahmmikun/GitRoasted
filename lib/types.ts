/**
 * Shared domain types for GitRoasted.
 *
 * These interfaces describe the data that flows through the pipeline:
 * GitHub data (profile + repos) -> analysis (stats + score + summary) ->
 * AI generation (roast output + metadata).
 */

/** Public GitHub profile data, normalized from the GitHub REST API. */
export interface GitHubProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  profileUrl: string;
  blog: string | null;
  company: string | null;
  location: string | null;
  createdAt: string; // ISO
  profileReadme?: string | null; // content of {username}/{username}/README.md if it exists
  hasProfileReadme?: boolean; // verified presence of a valid, usable profile README
}

/**
 * A single public repository, normalized from the GitHub REST API.
 *
 * Fields marked optional are either fetched opportunistically (README) or were
 * added after the first release; records persisted before then will not have
 * them, so every consumer must tolerate `undefined`.
 */
export interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  fork: boolean;
  homepage: string | null;
  pushedAt: string; // ISO
  readmeExcerpt?: string | null; // first ~300 chars of README if fetched
  hasReadme?: boolean | null; // true if verified present, false if verified missing
  license?: string | null; // SPDX id or key, e.g. "mit", "other"
  licenseName?: string | null; // Human-readable name, e.g. "MIT License"
  hasLicense?: boolean; // true if license metadata or file detected
  topics?: string[]; // repository topics
  hasTopics?: boolean;
  hasDescription?: boolean;
  hasHomepage?: boolean;
  watchers?: number;
  openIssues?: number;
}

/** Detailed audit information for a repository that has missing documentation or metadata. */
export interface RepoAuditIssue {
  repoName: string;
  isFork: boolean;
  missing: Array<"readme" | "license" | "topics" | "description" | "homepage">;
  detected: {
    hasDescription: boolean;
    description?: string | null;
    hasReadme: boolean | null;
    readmeExcerpt?: string | null;
    hasLicense: boolean;
    licenseName?: string | null;
    hasTopics: boolean;
    topics?: string[];
    hasHomepage: boolean;
    homepage?: string | null;
  };
  evidence: string;
  recommendedFix: string;
}

/**
 * Aggregate statistics computed by the Profile_Analyzer.
 *
 * The fields at the end are optional for backward compatibility with
 * `Roast` documents persisted before the scoring redesign. Scoring and
 * recommendation code substitutes safe defaults when they are absent.
 */
export interface GitHubStats {
  totalReposAnalyzed: number;
  totalStars: number;
  totalForks: number;
  topLanguages: string[];
  reposWithDescription: number;
  reposWithoutDescription: number;
  reposWithHomepage: number;
  recentlyUpdatedRepos: number;
  forkedRepos: number;
  originalRepos: number;
  /** Count of distinct languages across all repos (not capped like topLanguages). */
  distinctLanguages?: number;
  reposWithLicense?: number;
  reposWithTopics?: number;
  /** Repos among those inspected that had a README we could read. */
  reposWithReadme?: number;
  /** Highest star count on any single repo. */
  maxRepoStars?: number;
  /** Whole days since the most recent push across all repos; null when unknown. */
  daysSinceLastPush?: number | null;
  /** Repositories with specific documentation/metadata issues. */
  repoAuditIssues?: RepoAuditIssue[];
  /** Names of repositories missing descriptions. */
  undescribedRepoNames?: string[];
  /** Names of original repositories missing licenses. */
  unlicensedRepoNames?: string[];
  /** Names of original repositories missing topics. */
  untaggedRepoNames?: string[];
  /** Names of top/inspected repositories missing READMEs. */
  missingReadmeRepoNames?: string[];
}

/**
 * Contribution activity for the trailing year.
 *
 * Sourced from the GitHub GraphQL contributions calendar when a token is
 * available. `estimated` marks values derived from a weaker fallback signal so
 * the scorer can avoid penalising a profile for our own missing data.
 */
export interface ContributionData {
  /** Total contributions in the trailing year. */
  totalContributions: number;
  /** Weeks in the trailing year containing at least one contribution. */
  activeWeeks: number;
  /** Longest run of consecutive contributing days in the trailing year. */
  longestStreakDays: number;
  /** True when these numbers are inferred rather than read from the calendar. */
  estimated: boolean;
}

/** Stable identifiers for the eight scoring dimensions. */
export type ScoreDimensionKey =
  | "impact"
  | "consistency"
  | "quality"
  | "community"
  | "diversity"
  | "experience"
  | "activity"
  | "bonuses";

/** A single scored dimension of the Developer_Score. */
export interface DimensionScore {
  key: ScoreDimensionKey;
  label: string;
  score: number;
  max: number;
  /** Human-readable explanation of what produced this score. */
  detail: string;
}

/** A score tier: a named band of the 0–1000 range with a letter grade. */
export interface ScoreTier {
  /** Inclusive lower bound of the band. */
  min: number;
  label: string;
  grade: string;
}

/** The complete result of scoring a profile. */
export interface ScoreResult {
  total: number;
  breakdown: DimensionScore[];
  tier: ScoreTier;
  grade: string;
}

/**
 * Result of analyzing a profile: stats, the Developer_Score with its
 * per-dimension breakdown, and the compact AI-prompt summary.
 */
export interface AnalysisResult {
  stats: GitHubStats;
  score: number; // integer 0..1000
  breakdown: DimensionScore[];
  tier: ScoreTier;
  grade: string;
  summary: string; // compact text for the AI prompt
}

/** The structured roast produced by an AI provider, the rule-based engine, or the default. */
export interface RoastOutput {
  score: number; // 0..1000
  grade: string;
  title: string;
  shortRoast: string;
  longRoast: string;
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
  shareCaption: string;
}

/** Metadata describing which path produced the roast. */
export interface AiMeta {
  providerUsed: string; // e.g. "openrouter" | "gemini" | ... | "rule_based" | "default"
  modelUsed: string;
  aiFailed: boolean; // true if all external providers failed
  fallbackUsed: boolean; // true if rule-based or default was used
}

/** The full result returned by the AI orchestrator. */
export interface GenerationResult {
  roast: RoastOutput;
  aiMeta: AiMeta;
}

/** Interface implemented by each external AI provider module. */
export interface AiProvider {
  name: string;
  model: string;
  generate(summary: string): Promise<unknown>; // raw, unvalidated
}
