/**
 * Leaderboard queries over the Profile_Analysis collection.
 *
 * Ranking reuses the same Developer_Score the rest of the application shows —
 * there is no separate leaderboard scoring. Only public profile fields are
 * projected so nothing internal can leak into an API response.
 */

import { connectToDatabase } from "./db";
import { ProfileAnalysisModel } from "@/models/ProfileAnalysis";

/** Default and maximum page sizes. The cap bounds the response payload. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** A single ranked leaderboard row. */
export interface LeaderboardEntry {
  rank: number;
  username: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  score: number;
  grade: string;
  tier: string;
  primaryLanguage: string | null;
  followers: number;
  totalStars: number;
  publicRepos: number;
  analyzedAt: string;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  page: number;
  pageSize: number;
  /** Number of developers matching the current query. */
  total: number;
  totalPages: number;
  /** Total developers analyzed, ignoring any search filter. */
  totalDevelopers: number;
  query: string;
}

/** Clamp a page number to a sane positive integer. */
function normalizePage(page: unknown): number {
  const parsed = typeof page === "number" ? page : Number.parseInt(String(page ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

/** Clamp a page size into [1, MAX_PAGE_SIZE]. */
function normalizePageSize(pageSize: unknown): number {
  const parsed =
    typeof pageSize === "number" ? pageSize : Number.parseInt(String(pageSize ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(parsed));
}

/** Escape regex metacharacters so a search term is always treated literally. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface LeaderboardQuery {
  page?: number | string;
  pageSize?: number | string;
  /** Case-insensitive username/name substring search. */
  q?: string;
}

/**
 * Fetch one page of the leaderboard, ranked by Developer_Score descending.
 *
 * Ranks are absolute (they continue across pages) and the sort includes
 * `username` as a tie-break so pagination is stable when scores are equal.
 */
export async function getLeaderboardPage(
  query: LeaderboardQuery = {},
): Promise<LeaderboardPage> {
  await connectToDatabase();

  const page = normalizePage(query.page);
  const pageSize = normalizePageSize(query.pageSize);
  const rawQuery = typeof query.q === "string" ? query.q.trim() : "";

  const filter: Record<string, unknown> = {};
  if (rawQuery.length > 0) {
    const pattern = new RegExp(escapeRegex(rawQuery), "i");
    filter.$or = [{ username: pattern }, { name: pattern }];
  }

  const [total, totalDevelopers, docs] = await Promise.all([
    ProfileAnalysisModel.countDocuments(filter),
    // Unfiltered count powers the "not enough data yet" empty state.
    rawQuery.length > 0
      ? ProfileAnalysisModel.countDocuments({})
      : Promise.resolve(undefined),
    ProfileAnalysisModel.find(filter)
      .select(
        "username login name avatarUrl profileUrl score grade tier primaryLanguage followers totalStars publicRepos analyzedAt -_id",
      )
      .sort({ score: -1, username: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const entries: LeaderboardEntry[] = (docs as unknown as LeaderboardEntry[]).map(
    (doc, index) => ({
      rank: (page - 1) * pageSize + index + 1,
      username: doc.username,
      login: doc.login || doc.username,
      name: doc.name ?? null,
      avatarUrl: doc.avatarUrl ?? "",
      profileUrl: doc.profileUrl || `https://github.com/${doc.login || doc.username}`,
      score: doc.score ?? 0,
      grade: doc.grade ?? "F",
      tier: doc.tier ?? "",
      primaryLanguage: doc.primaryLanguage ?? null,
      followers: doc.followers ?? 0,
      totalStars: doc.totalStars ?? 0,
      publicRepos: doc.publicRepos ?? 0,
      analyzedAt: new Date(doc.analyzedAt).toISOString(),
    }),
  );

  return {
    entries,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    totalDevelopers: totalDevelopers ?? total,
    query: rawQuery,
  };
}
