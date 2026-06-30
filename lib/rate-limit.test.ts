// Feature: gitroasted — Property tests for rate-limit logic.
// Covers tasks 9.4 (Property 2) and unit tests via computeRateLimitDecision.
// Task 9.5 (Property 3) is covered in the API route integration tests where
// we verify checkAndRecord is never called on a cache-hit path.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeRateLimitDecision } from "./rate-limit";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Feature: gitroasted, Property 2: Rate limiter enforces the per-IP window
describe("Property 2: Rate limiter enforces the per-IP window", () => {
  it("allows exactly limit requests in a window, then denies the next", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (limit) => {
        const startTime = 1_000_000;
        let state: { requests: number; windowStart: Date } | null = null;
        let allowedCount = 0;

        // Fire limit+1 requests at the same instant
        for (let i = 0; i < limit + 1; i++) {
          const decision = computeRateLimitDecision(state, startTime, limit, WINDOW_MS);
          if (decision.allowed) {
            allowedCount++;
            state = {
              requests: decision.newRequests,
              windowStart: decision.newWindowStart,
            };
          }
        }

        return allowedCount === limit;
      }),
      { numRuns: 100 },
    );
  });

  it("resets the count when the window elapses", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (limit) => {
        const startTime = 1_000_000;
        let state: { requests: number; windowStart: Date } | null = null;

        // Exhaust the window
        for (let i = 0; i < limit; i++) {
          const d = computeRateLimitDecision(state, startTime, limit, WINDOW_MS);
          if (d.allowed) {
            state = { requests: d.newRequests, windowStart: d.newWindowStart };
          }
        }

        // One more request in the same window should be denied
        const withinWindow = computeRateLimitDecision(state, startTime, limit, WINDOW_MS);
        if (withinWindow.allowed) return false;

        // After the window elapses, the request should be allowed again
        const afterWindow = startTime + WINDOW_MS + 1;
        const afterDecision = computeRateLimitDecision(state, afterWindow, limit, WINDOW_MS);
        return afterDecision.allowed === true && afterDecision.newRequests === 1;
      }),
      { numRuns: 100 },
    );
  });

  it("a fresh IP (null state) is always allowed", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.nat({ max: Math.floor(Number.MAX_SAFE_INTEGER / 2) }),
        (limit, now) => {
          const decision = computeRateLimitDecision(null, now, limit, WINDOW_MS);
          return decision.allowed === true && decision.newRequests === 1;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns retryAfterSeconds when denied", () => {
    const limit = 3;
    const startTime = 1_000_000;
    let state: { requests: number; windowStart: Date } | null = null;

    // Exhaust the window
    for (let i = 0; i < limit; i++) {
      const d = computeRateLimitDecision(state, startTime, limit, WINDOW_MS);
      if (d.allowed) {
        state = { requests: d.newRequests, windowStart: d.newWindowStart };
      }
    }

    const denied = computeRateLimitDecision(state, startTime, limit, WINDOW_MS);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterSeconds).toBeGreaterThan(0);
      expect(denied.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_MS / 1000);
    }
  });
});

describe("computeRateLimitDecision — unit cases", () => {
  it("increments requests within the same window", () => {
    const state = { requests: 2, windowStart: new Date(1_000_000) };
    const d = computeRateLimitDecision(state, 1_000_500, 5, WINDOW_MS);
    expect(d.allowed).toBe(true);
    expect(d.newRequests).toBe(3);
    expect(d.newWindowStart.getTime()).toBe(1_000_000);
  });

  it("resets to 1 when the window has elapsed", () => {
    const state = { requests: 5, windowStart: new Date(1_000_000) };
    const now = 1_000_000 + WINDOW_MS + 1;
    const d = computeRateLimitDecision(state, now, 5, WINDOW_MS);
    expect(d.allowed).toBe(true);
    expect(d.newRequests).toBe(1);
    expect(d.newWindowStart.getTime()).toBe(now);
  });
});
