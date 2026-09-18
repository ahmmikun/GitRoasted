/**
 * Mongoose model for Profile_Analysis snapshots.
 *
 * One document per GitHub user, upserted every time we analyze that user
 * (from a roast, a comparison, an improvement lookup, or the seed script).
 * This collection is the source of truth for the leaderboard: it is small,
 * indexed by score, and holds only public profile data.
 *
 * Unlike the `Roast` collection — which keeps one immutable record per
 * generated roast — this collection keeps only the latest analysis per user,
 * so ranking never shows the same developer twice.
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { DimensionScore, GitHubStats } from "@/lib/types";

/** Public, leaderboard-facing snapshot of a developer's latest analysis. */
export interface IProfileAnalysis {
  /** Lowercased GitHub login — the unique key for upserts. */
  username: string;
  /** Login with its original casing, for display. */
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;

  /** Developer_Score total in [0, 1000]. */
  score: number;
  grade: string;
  tier: string;
  breakdown: DimensionScore[];

  // Denormalized headline metrics so the leaderboard needs no joins.
  followers: number;
  following: number;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
  topLanguages: string[];
  /** Most-used language, or null when none was detected. */
  primaryLanguage: string | null;
  accountCreatedAt: string;

  /** Full stats blob, reused by the improvement roadmap and comparison views. */
  stats: GitHubStats;

  /** When this snapshot was last refreshed. */
  analyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProfileAnalysisDocument extends IProfileAnalysis, Document {}

const DimensionSchema = new Schema<DimensionScore>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    score: { type: Number, required: true },
    max: { type: Number, required: true },
    detail: { type: String, default: "" },
  },
  { _id: false },
);

const ProfileAnalysisSchema = new Schema<IProfileAnalysisDocument>(
  {
    username: { type: String, required: true, unique: true, index: true },
    login: { type: String, required: true },
    name: { type: String, default: null },
    avatarUrl: { type: String, default: "" },
    profileUrl: { type: String, default: "" },
    bio: { type: String, default: null },

    score: { type: Number, required: true, min: 0, max: 1000, index: true },
    grade: { type: String, required: true },
    tier: { type: String, default: "" },
    breakdown: { type: [DimensionSchema], default: [] },

    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    publicRepos: { type: Number, default: 0 },
    totalStars: { type: Number, default: 0 },
    totalForks: { type: Number, default: 0 },
    topLanguages: { type: [String], default: [] },
    primaryLanguage: { type: String, default: null },
    accountCreatedAt: { type: String, default: "" },

    // Stored loosely: the stats shape is additive and validated upstream by the analyzer.
    stats: { type: Schema.Types.Mixed, default: {} },

    analyzedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Supports the default leaderboard query: highest score first, with a stable
// tie-break so pagination never repeats or skips a developer.
ProfileAnalysisSchema.index({ score: -1, username: 1 });

export const ProfileAnalysisModel: Model<IProfileAnalysisDocument> =
  (mongoose.models.ProfileAnalysis as Model<IProfileAnalysisDocument>) ??
  mongoose.model<IProfileAnalysisDocument>("ProfileAnalysis", ProfileAnalysisSchema);

export default ProfileAnalysisModel;
