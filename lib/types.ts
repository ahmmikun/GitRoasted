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
}

/** A single public repository, normalized from the GitHub REST API. */
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
}

/** Aggregate statistics computed by the Profile_Analyzer. */
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
}

/** Result of analyzing a profile: stats, developer score, and AI prompt summary. */
export interface AnalysisResult {
  stats: GitHubStats;
  score: number; // integer 0..100
  summary: string; // compact text for the AI prompt
}

/** The structured roast produced by an AI provider, the rule-based engine, or the default. */
export interface RoastOutput {
  score: number; // 0..100
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
