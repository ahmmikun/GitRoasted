/**
 * Cache lookup helper for GitRoasted.
 *
 * Queries the Roast collection for a record for the given username created
 * within the configured Cache_Window (default 24 hours). Returns the record
 * on a cache hit, or null on a miss.
 *
 * Requirements: 4.1, 4.2, 4.3
 */

import { connectToDatabase } from "./db";
import { RoastModel, type IRoast } from "@/models/Roast";

const DEFAULT_CACHE_HOURS = 24;

function getCacheDurationMs(): number {
  const hours = parseInt(
    process.env.CACHE_DURATION_HOURS ?? String(DEFAULT_CACHE_HOURS),
    10,
  );
  return (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_CACHE_HOURS) *
    60 *
    60 *
    1000;
}

/**
 * Find a cached roast for a username created within the Cache_Window.
 *
 * Returns the most-recent matching record as a lean (plain) object, or
 * null when no valid cached record exists.
 *
 * @param username The GitHub login to look up (case-insensitive).
 */
export async function findCachedRoast(
  username: string,
): Promise<(IRoast & { _id: unknown }) | null> {
  await connectToDatabase();
  const cutoff = new Date(Date.now() - getCacheDurationMs());
  return RoastModel.findOne({
    username: username.toLowerCase(),
    createdAt: { $gte: cutoff },
  })
    .sort({ createdAt: -1 })
    .lean<IRoast & { _id: unknown }>();
}
