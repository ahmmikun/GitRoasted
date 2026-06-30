/**
 * Mongoose model for per-IP rate-limit tracking.
 *
 * Each document tracks the originating IP, the current request count, the
 * start of the current window, and the time of the most recent request.
 *
 * Requirements: 3.1
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IRateLimit {
  ip: string;
  requests: number;
  windowStart: Date;
  lastRequestAt: Date;
}

export interface IRateLimitDocument extends IRateLimit, Document {}

const RateLimitSchema = new Schema<IRateLimitDocument>({
  ip: { type: String, required: true, unique: true, index: true },
  requests: { type: Number, required: true, default: 0 },
  windowStart: { type: Date, required: true },
  lastRequestAt: { type: Date, required: true },
});

export const RateLimitModel: Model<IRateLimitDocument> =
  (mongoose.models.RateLimit as Model<IRateLimitDocument>) ??
  mongoose.model<IRateLimitDocument>("RateLimit", RateLimitSchema);

export default RateLimitModel;
