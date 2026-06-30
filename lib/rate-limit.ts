/**
 * Rate_Limiter for GitRoasted.
 *
 * Enforces per-IP request limits using the RateLimit MongoDB collection.
 * Only called on cache-miss paths — cached responses never count against
 * the rate limit (Req 3.4).
 *
 * `checkAndRecord` accepts an injectable clock (for testing) and returns:
 *  - `{ allowed: true, remaining }` when the request is permitted, and
 *    persists the incremented count.
 *  - `{ allowed: false, retryAfterSeconds }` when the IP is over the limit.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import { connectToDatabase } from "./db";
import { RateLimitModel } from "@/models/RateLimit";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Pure logic: determine the rate-limit outcome given the current record state,
 * the current timestamp, the configured limit, and the window size.
 *
 * Exported separately so it can be property-tested without a database.
 */
export function computeRateLimitDecision(
  existing: { requests: number; windowStart: Date } | null,
  now: number,
  limit: number,
  windowMs: number,
): {
  allowed: boolean;
  newRequests: number;
  newWindowStart: Date;
  retryAfterSeconds?: number;
} {
  if (!existing || now - existing.windowStart.getTime() >= windowMs) {
    // New IP or the window has elapsed — start a fresh window with count 1.
    return { allowed: true, newRequests: 1, newWindowStart: new Date(now) };
  }

  if (existing.requests >= limit) {
    const msRemaining = existing.windowStart.getTime() + windowMs - now;
    return {
      allowed: false,
      newRequests: existing.requests,
      newWindowStart: existing.windowStart,
      retryAfterSeconds: Math.max(1, Math.ceil(msRemaining / 1000)),
    };
  }

  return {
    allowed: true,
    newRequests: existing.requests + 1,
    newWindowStart: existing.windowStart,
  };
}

/**
 * Check whether an IP is within its rate-limit budget and, if allowed,
 * record the request.
 *
 * @param ip    The originating IP address.
 * @param clock Injectable clock function (defaults to `Date.now`).
 */
export async function checkAndRecord(
  ip: string,
  clock: () => number = () => Date.now(),
): Promise<RateLimitResult> {
  await connectToDatabase();

  const limit = parseInt(process.env.RATE_LIMIT_PER_HOUR ?? "5", 10);
  const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 5;
  const now = clock();

  const existing = await RateLimitModel.findOne({ ip }).lean();
  const decision = computeRateLimitDecision(existing, now, effectiveLimit, WINDOW_MS);

  if (!decision.allowed) {
    return { allowed: false, retryAfterSeconds: decision.retryAfterSeconds! };
  }

  const nowDate = new Date(now);

  if (!existing || now - existing.windowStart.getTime() >= WINDOW_MS) {
    // Reset or create.
    await RateLimitModel.findOneAndUpdate(
      { ip },
      {
        $set: {
          requests: 1,
          windowStart: decision.newWindowStart,
          lastRequestAt: nowDate,
        },
      },
      { upsert: true },
    );
  } else {
    // Increment within existing window.
    await RateLimitModel.updateOne(
      { ip },
      { $inc: { requests: 1 }, $set: { lastRequestAt: nowDate } },
    );
  }

  return {
    allowed: true,
    remaining: Math.max(0, effectiveLimit - decision.newRequests),
  };
}
