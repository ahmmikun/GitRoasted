// Tests for the score migration logic: correct rescaling and idempotency.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { planRecordMigration, rescaleLegacyScore } from "./migrate-scores";
import { MAX_SCORE, tierForScore } from "../lib/scoring";

describe("rescaleLegacyScore", () => {
  it("multiplies a legacy 0–100 score by 10", () => {
    expect(rescaleLegacyScore(0)).toBe(0);
    expect(rescaleLegacyScore(10)).toBe(100);
    expect(rescaleLegacyScore(72)).toBe(720);
    expect(rescaleLegacyScore(100)).toBe(1000);
  });

  it("always produces an integer within [0, 1000]", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
        const scaled = rescaleLegacyScore(score);
        return Number.isInteger(scaled) && scaled >= 0 && scaled <= MAX_SCORE;
      }),
      { numRuns: 200 },
    );
  });

  it("clamps nonsense input rather than propagating it", () => {
    expect(rescaleLegacyScore(-5)).toBe(0);
    expect(rescaleLegacyScore(Number.NaN)).toBe(0);
    expect(rescaleLegacyScore(99999)).toBe(MAX_SCORE);
  });

  it("preserves relative ordering of legacy scores", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (a, b) => {
          if (a === b) return rescaleLegacyScore(a) === rescaleLegacyScore(b);
          return a < b
            ? rescaleLegacyScore(a) < rescaleLegacyScore(b)
            : rescaleLegacyScore(a) > rescaleLegacyScore(b);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("planRecordMigration", () => {
  it("rescales a legacy record and recomputes its grade", () => {
    const plan = planRecordMigration({ analysis: { score: 82 } });
    expect(plan).toEqual({ action: "rescale", score: 820, grade: "A" });
  });

  it("derives the grade from the shared tier bands", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (legacy) => {
        const plan = planRecordMigration({ analysis: { score: legacy } });
        if (plan.action !== "rescale") return false;
        return plan.grade === tierForScore(plan.score).grade;
      }),
      { numRuns: 200 },
    );
  });

  it("is idempotent: an already-stamped record is skipped", () => {
    const plan = planRecordMigration({ scoreScale: MAX_SCORE, analysis: { score: 820 } });
    expect(plan).toEqual({ action: "skip" });
  });

  it("stamps (without changing) a score already above the legacy ceiling", () => {
    expect(planRecordMigration({ analysis: { score: 640 } })).toEqual({ action: "stamp" });
  });

  it("skips records with no usable score", () => {
    expect(planRecordMigration({})).toEqual({ action: "skip" });
    expect(planRecordMigration({ analysis: {} })).toEqual({ action: "skip" });
    expect(planRecordMigration({ analysis: { score: Number.NaN } })).toEqual({
      action: "skip",
    });
  });

  it("running the plan twice never rescales twice", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (legacy) => {
        const first = planRecordMigration({ analysis: { score: legacy } });
        if (first.action !== "rescale") return false;

        // Simulate the record after the first pass, including the stamp.
        const second = planRecordMigration({
          scoreScale: MAX_SCORE,
          analysis: { score: first.score },
        });
        return second.action === "skip";
      }),
      { numRuns: 200 },
    );
  });

  it("treats the legacy boundary of exactly 100 as legacy, not current", () => {
    expect(planRecordMigration({ analysis: { score: 100 } })).toEqual({
      action: "rescale",
      score: 1000,
      grade: "S",
    });
    expect(planRecordMigration({ analysis: { score: 101 } })).toEqual({ action: "stamp" });
  });
});
