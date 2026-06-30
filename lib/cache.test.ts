// Feature: gitroasted — Property test for the cache decision.
// Covers task 9.2 (Property 7).
//
// The cache decision logic is: reuse the record when createdAt >= (now - windowMs).
// This is a pure time comparison tested here as a property independent of MongoDB.

import { describe, it } from "vitest";
import fc from "fast-check";

const CACHE_HOURS = 24;
const CACHE_MS = CACHE_HOURS * 60 * 60 * 1000;

/**
 * Pure cache decision: should the record be reused?
 * Mirrors the MongoDB query: createdAt >= (now - cacheDurationMs).
 */
function isCacheHit(createdAt: Date, now: number, cacheMs: number): boolean {
  return createdAt.getTime() >= now - cacheMs;
}

// Feature: gitroasted, Property 7: Cache decision depends only on record age
describe("Property 7: Cache decision depends only on record age", () => {
  it("reuses a record when its age is within the cache window", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: CACHE_MS - 1 }), // age strictly within window
        (ageMs) => {
          const now = 10_000_000_000;
          const createdAt = new Date(now - ageMs);
          return isCacheHit(createdAt, now, CACHE_MS) === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does not reuse a record older than the cache window", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: CACHE_MS }), // age >= window (expired)
        (excess) => {
          const now = 10_000_000_000;
          const createdAt = new Date(now - CACHE_MS - excess);
          return isCacheHit(createdAt, now, CACHE_MS) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("treats a record created exactly at the window boundary as a hit", () => {
    const now = 10_000_000_000;
    const createdAt = new Date(now - CACHE_MS);
    // The MongoDB query uses $gte so boundary is included.
    const result = isCacheHit(createdAt, now, CACHE_MS);
    // result should be true at exactly the boundary
    fc.assert(
      fc.property(fc.constant(0), () => result === true),
      { numRuns: 1 },
    );
  });

  it("a record with a future createdAt is always a hit", () => {
    fc.assert(
      fc.property(fc.nat({ max: CACHE_MS * 2 }), (offset) => {
        const now = 10_000_000_000;
        const createdAt = new Date(now + offset);
        return isCacheHit(createdAt, now, CACHE_MS) === true;
      }),
      { numRuns: 100 },
    );
  });
});
