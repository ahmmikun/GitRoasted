/**
 * Mongoose model for persisted Roast_Records.
 *
 * Stores the slug, username, GitHub profile/stats, analysis (roast output),
 * AI metadata, and public view/share counts. Timestamps (createdAt, updatedAt)
 * are added automatically.
 *
 * Requirements: 9.2, 9.3, 9.4
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { GitHubProfile, GitHubStats, RoastOutput, AiMeta } from "@/lib/types";

export interface IRoast {
  slug: string;
  username: string;
  githubProfile: GitHubProfile;
  githubStats: GitHubStats;
  analysis: RoastOutput;
  aiMeta: AiMeta;
  publicStats: { views: number; shares: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoastDocument extends IRoast, Document {}

const RoastSchema = new Schema<IRoastDocument>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, index: true },

    githubProfile: {
      login: String,
      name: String,
      avatarUrl: String,
      bio: String,
      followers: Number,
      following: Number,
      publicRepos: Number,
      profileUrl: String,
      blog: String,
      company: String,
      location: String,
      createdAt: String,
    },

    githubStats: {
      totalReposAnalyzed: Number,
      totalStars: Number,
      totalForks: Number,
      topLanguages: [String],
      reposWithDescription: Number,
      reposWithoutDescription: Number,
      reposWithHomepage: Number,
      recentlyUpdatedRepos: Number,
      forkedRepos: Number,
      originalRepos: Number,
    },

    analysis: {
      score: Number,
      grade: String,
      title: String,
      shortRoast: String,
      longRoast: String,
      strengths: [String],
      weaknesses: [String],
      improvementTips: [String],
      shareCaption: String,
    },

    aiMeta: {
      providerUsed: String,
      modelUsed: String,
      aiFailed: Boolean,
      fallbackUsed: Boolean,
    },

    publicStats: {
      views: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

// Compound index: supports the cache-lookup query (username + createdAt).
RoastSchema.index({ username: 1, createdAt: -1 });

export const RoastModel: Model<IRoastDocument> =
  (mongoose.models.Roast as Model<IRoastDocument>) ??
  mongoose.model<IRoastDocument>("Roast", RoastSchema);

export default RoastModel;
