/**
 * Analysis_Service — the single entry point for "analyze this GitHub user".
 *
 * Every feature that needs a Developer_Score (the roast flow, the comparison
 * view, the improvement roadmap, and the leaderboard seed script) goes through
 * `getProfileAnalysis` so that:
 *  - GitHub is queried at most once per user per cache window,
 *  - the profile + contribution requests run in parallel,
 *  - and every successful analysis refreshes the leaderboard snapshot.
 *
 * Failures are returned as typed results rather than thrown, matching the
 * convention already used by `lib/github.ts`.
 */

import { analyzeProfile } from "./analyzer";
import { connectToDatabase } from "./db";
import { fetchContributionData, fetchGitHubData } from "./github";
import { ProfileAnalysisModel } from "@/models/ProfileAnalysis";
import type {
  ContributionData,
  DimensionScore,
  GitHubProfile,
  GitHubRepo,
  GitHubStats,
  ScoreTier,
} from "./types";

/** How long a stored snapshot is considered fresh enough to reuse. */
const DEFAULT_SNAPSHOT_TTL_HOURS = 6;

/** A completed analysis, whether freshly computed or reused from a snapshot. */
export interface ProfileAnalysis {
  username: string;
  profile: GitHubProfile;
  stats: GitHubStats;
  score: number;
  grade: string;
  tier: ScoreTier;
  breakdown: DimensionScore[];
  /** Compact AI-prompt summary. Empty when reused from a stored snapshot. */
  summary: string;
  /** Repositories backing the analysis. Empty when reused from a snapshot. */
  repos: GitHubRepo[];
  /** True when the result came from a stored snapshot instead of a live fetch. */
  fromSnapshot: boolean;
  analyzedAt: Date;
}

/** Discriminated result so callers can map failures onto HTTP responses. */
export type ProfileAnalysisResult =
  | { ok: true; analysis: ProfileAnalysis }
  | { ok: false; kind: "not_found" | "upstream_error"; message: string };

/** Options controlling cache reuse and persistence. */
export interface GetProfileAnalysisOptions {
  /** Skip the stored snapshot and always fetch fresh data from GitHub. */
  force?: boolean;
  /** Override the snapshot freshness window, in hours. */
  ttlHours?: number;
  /** Set false to skip writing the leaderboard snapshot (used by dry runs). */
  persist?: boolean;
  /** Reference time, injectable for tests. */
  now?: number;
}

function getSnapshotTtlMs(ttlHours?: number): number {
  const configured =
    ttlHours ??
    Number.parseInt(process.env.CACHE_DURATION_HOURS ?? String(DEFAULT_SNAPSHOT_TTL_HOURS), 10);
  const hours =
    Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SNAPSHOT_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

/** Pick the most-used language, or null when no language was detected. */
function primaryLanguageOf(stats: GitHubStats): string | null {
  return stats.topLanguages && stats.topLanguages.length > 0 ? stats.topLanguages[0] : null;
}

/**
 * Reconstruct an analysis from a stored leaderboard snapshot.
 *
 * The snapshot deliberately omits repositories and the AI summary, which are
 * only needed by the roast flow — that flow always performs a live fetch.
 */
function analysisFromSnapshot(doc: {
  username: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;
  score: number;
  grade: string;
  tier: string;
  breakdown: DimensionScore[];
  followers: number;
  following: number;
  publicRepos: number;
  accountCreatedAt: string;
  stats: GitHubStats;
  analyzedAt: Date;
}): ProfileAnalysis {
  return {
    username: doc.username,
    profile: {
      login: doc.login,
      name: doc.name,
      avatarUrl: doc.avatarUrl,
      bio: doc.bio,
      followers: doc.followers,
      following: doc.following,
      publicRepos: doc.publicRepos,
      profileUrl: doc.profileUrl,
      blog: null,
      company: null,
      location: null,
      createdAt: doc.accountCreatedAt,
    },
    stats: doc.stats,
    score: doc.score,
    grade: doc.grade,
    // Snapshots store only the tier label; the numeric bound is not needed downstream.
    tier: { min: 0, label: doc.tier, grade: doc.grade },
    breakdown: doc.breakdown,
    summary: "",
    repos: [],
    fromSnapshot: true,
    analyzedAt: doc.analyzedAt,
  };
}

/** Read a fresh stored snapshot for a username, or null when none is usable. */
async function findFreshSnapshot(
  username: string,
  ttlMs: number,
  now: number,
): Promise<ProfileAnalysis | null> {
  try {
    await connectToDatabase();
    const cutoff = new Date(now - ttlMs);
    const doc = await ProfileAnalysisModel.findOne({
      username: username.toLowerCase(),
      analyzedAt: { $gte: cutoff },
    }).lean();

    if (!doc) return null;
    return analysisFromSnapshot(doc as unknown as Parameters<typeof analysisFromSnapshot>[0]);
  } catch {
    // A database problem must never block analysis — fall through to a live fetch.
    return null;
  }
}

/**
 * Upsert the leaderboard snapshot for an analysis.
 *
 * Never throws: a failed write means the developer is missing from the
 * leaderboard, which must not fail the request the user actually made.
 */
export async function saveProfileSnapshot(analysis: ProfileAnalysis): Promise<boolean> {
  try {
    await connectToDatabase();
    await ProfileAnalysisModel.findOneAndUpdate(
      { username: analysis.username },
      {
        $set: {
          username: analysis.username,
          login: analysis.profile.login || analysis.username,
          name: analysis.profile.name ?? null,
          avatarUrl: analysis.profile.avatarUrl ?? "",
          profileUrl:
            analysis.profile.profileUrl ||
            `https://github.com/${analysis.profile.login || analysis.username}`,
          bio: analysis.profile.bio ?? null,
          score: analysis.score,
          grade: analysis.grade,
          tier: analysis.tier.label,
          breakdown: analysis.breakdown,
          followers: analysis.profile.followers ?? 0,
          following: analysis.profile.following ?? 0,
          publicRepos: analysis.profile.publicRepos ?? 0,
          totalStars: analysis.stats.totalStars ?? 0,
          totalForks: analysis.stats.totalForks ?? 0,
          topLanguages: analysis.stats.topLanguages ?? [],
          primaryLanguage: primaryLanguageOf(analysis.stats),
          accountCreatedAt: analysis.profile.createdAt ?? "",
          stats: analysis.stats,
          analyzedAt: analysis.analyzedAt,
        },
      },
      { upsert: true, new: true },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Analyze a GitHub user, reusing a recent snapshot when one exists.
 *
 * @param username Validated GitHub login.
 * @param options  Cache/persistence overrides.
 */
export async function getProfileAnalysis(
  username: string,
  options: GetProfileAnalysisOptions = {},
): Promise<ProfileAnalysisResult> {
  const { force = false, ttlHours, persist = true } = options;
  const now = options.now ?? Date.now();
  const normalized = username.toLowerCase();

  // 1. Reuse a fresh snapshot when allowed — avoids hitting GitHub at all.
  if (!force) {
    const snapshot = await findFreshSnapshot(normalized, getSnapshotTtlMs(ttlHours), now);
    if (snapshot) return { ok: true, analysis: snapshot };
  }

  // 2. Fetch profile/repos and contribution data concurrently. Contribution
  //    data is best-effort, so it resolves to null rather than failing.
  const [githubResult, contributions] = await Promise.all([
    fetchGitHubData(username),
    fetchContributionData(username).catch<ContributionData | null>(() => null),
  ]);

  if (!githubResult.ok) {
    return { ok: false, kind: githubResult.kind, message: githubResult.message };
  }

  const { profile, repos } = githubResult;
  const { stats, score, breakdown, tier, grade, summary } = analyzeProfile(
    profile,
    repos,
    now,
    contributions,
  );

  const analysis: ProfileAnalysis = {
    username: normalized,
    profile,
    stats,
    score,
    grade,
    tier,
    breakdown,
    summary,
    repos,
    fromSnapshot: false,
    analyzedAt: new Date(now),
  };

  // 3. Refresh the leaderboard snapshot. Best-effort by design.
  if (persist) {
    await saveProfileSnapshot(analysis);
  }

  return { ok: true, analysis };
}
