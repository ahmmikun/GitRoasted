// Property and unit tests for the 1000-point, 8-dimension Developer_Score engine.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  DIMENSION_MAX,
  DIMENSION_ORDER,
  MAX_SCORE,
  SCORE_TIERS,
  computeDeveloperScore,
  findDimension,
  strongestDimensions,
  tierForScore,
  weakestDimensions,
} from "./scoring";
import type { ContributionData, GitHubProfile, GitHubStats } from "./types";

const NOW = new Date("2025-01-01T00:00:00Z").getTime();

const profileArb: fc.Arbitrary<GitHubProfile> = fc.record({
  login: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,18}$/),
  name: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 40 })),
  avatarUrl: fc.constant("https://example.com/a.png"),
  bio: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
  followers: fc.nat({ max: 200000 }),
  following: fc.nat({ max: 20000 }),
  publicRepos: fc.nat({ max: 800 }),
  profileUrl: fc.constant("https://github.com/u"),
  blog: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 60 })),
  company: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 60 })),
  location: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 60 })),
  createdAt: fc.oneof(
    fc.constant("2008-01-01T00:00:00Z"),
    fc.constant("2020-06-15T00:00:00Z"),
    fc.constant("2024-12-31T00:00:00Z"),
    // Deliberately invalid / missing dates must not break scoring.
    fc.constant(""),
    fc.constant("not-a-date"),
  ),
  profileReadme: fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.string({ minLength: 1, maxLength: 200 }),
  ),
});

const statsArb: fc.Arbitrary<GitHubStats> = fc
  .record({
    totalReposAnalyzed: fc.nat({ max: 100 }),
    totalStars: fc.nat({ max: 200000 }),
    totalForks: fc.nat({ max: 50000 }),
    topLanguages: fc.array(fc.string({ minLength: 1, maxLength: 12 }), { maxLength: 5 }),
    reposWithDescription: fc.nat({ max: 100 }),
    reposWithoutDescription: fc.nat({ max: 100 }),
    reposWithHomepage: fc.nat({ max: 100 }),
    recentlyUpdatedRepos: fc.nat({ max: 100 }),
    forkedRepos: fc.nat({ max: 100 }),
    originalRepos: fc.nat({ max: 100 }),
    distinctLanguages: fc.oneof(fc.constant(undefined), fc.nat({ max: 30 })),
    reposWithLicense: fc.oneof(fc.constant(undefined), fc.nat({ max: 100 })),
    reposWithTopics: fc.oneof(fc.constant(undefined), fc.nat({ max: 100 })),
    reposWithReadme: fc.oneof(fc.constant(undefined), fc.nat({ max: 10 })),
    maxRepoStars: fc.oneof(fc.constant(undefined), fc.nat({ max: 100000 })),
    daysSinceLastPush: fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.nat({ max: 4000 }),
    ),
  })
  .map((s) => s as GitHubStats);

const contributionsArb: fc.Arbitrary<ContributionData | null> = fc.oneof(
  fc.constant(null),
  fc.record({
    totalContributions: fc.nat({ max: 20000 }),
    activeWeeks: fc.nat({ max: 52 }),
    longestStreakDays: fc.nat({ max: 365 }),
    estimated: fc.boolean(),
  }),
);

/** A zeroed stats object, used for "empty profile" assertions. */
const emptyStats: GitHubStats = {
  totalReposAnalyzed: 0,
  totalStars: 0,
  totalForks: 0,
  topLanguages: [],
  reposWithDescription: 0,
  reposWithoutDescription: 0,
  reposWithHomepage: 0,
  recentlyUpdatedRepos: 0,
  forkedRepos: 0,
  originalRepos: 0,
  distinctLanguages: 0,
  reposWithLicense: 0,
  reposWithTopics: 0,
  reposWithReadme: 0,
  maxRepoStars: 0,
  daysSinceLastPush: null,
};

const bareProfile: GitHubProfile = {
  login: "nobody",
  name: null,
  avatarUrl: "",
  bio: null,
  followers: 0,
  following: 0,
  publicRepos: 0,
  profileUrl: "https://github.com/nobody",
  blog: null,
  company: null,
  location: null,
  createdAt: "2024-12-25T00:00:00Z",
  profileReadme: null,
};

describe("dimension configuration", () => {
  it("dimension maxima sum to exactly MAX_SCORE (1000)", () => {
    const sum = Object.values(DIMENSION_MAX).reduce((a, b) => a + b, 0);
    expect(sum).toBe(MAX_SCORE);
    expect(MAX_SCORE).toBe(1000);
  });

  it("declares all eight dimensions in a stable display order", () => {
    expect(DIMENSION_ORDER).toHaveLength(8);
    expect(new Set(DIMENSION_ORDER).size).toBe(8);
    for (const key of DIMENSION_ORDER) {
      expect(DIMENSION_MAX[key]).toBeGreaterThan(0);
    }
  });

  it("matches the agreed weights", () => {
    expect(DIMENSION_MAX).toEqual({
      impact: 250,
      consistency: 200,
      quality: 150,
      community: 150,
      diversity: 100,
      experience: 75,
      activity: 50,
      bonuses: 25,
    });
  });
});

describe("computeDeveloperScore invariants", () => {
  it("total is always an integer in [0, 1000]", () => {
    fc.assert(
      fc.property(profileArb, statsArb, contributionsArb, (profile, stats, contributions) => {
        const { total } = computeDeveloperScore(profile, stats, contributions, NOW);
        return Number.isInteger(total) && total >= 0 && total <= MAX_SCORE;
      }),
      { numRuns: 200 },
    );
  });

  it("every dimension score is an integer within its own ceiling", () => {
    fc.assert(
      fc.property(profileArb, statsArb, contributionsArb, (profile, stats, contributions) => {
        const { breakdown } = computeDeveloperScore(profile, stats, contributions, NOW);
        return breakdown.every(
          (d) =>
            Number.isInteger(d.score) &&
            d.score >= 0 &&
            d.score <= d.max &&
            d.max === DIMENSION_MAX[d.key],
        );
      }),
      { numRuns: 200 },
    );
  });

  it("total equals the sum of the dimension scores", () => {
    fc.assert(
      fc.property(profileArb, statsArb, contributionsArb, (profile, stats, contributions) => {
        const { total, breakdown } = computeDeveloperScore(profile, stats, contributions, NOW);
        return breakdown.reduce((sum, d) => sum + d.score, 0) === total;
      }),
      { numRuns: 200 },
    );
  });

  it("always returns all eight dimensions in the declared order", () => {
    fc.assert(
      fc.property(profileArb, statsArb, contributionsArb, (profile, stats, contributions) => {
        const { breakdown } = computeDeveloperScore(profile, stats, contributions, NOW);
        return (
          breakdown.length === 8 &&
          breakdown.every((d, i) => d.key === DIMENSION_ORDER[i]) &&
          breakdown.every((d) => typeof d.detail === "string" && d.detail.length > 0)
        );
      }),
      { numRuns: 100 },
    );
  });

  it("is deterministic for a fixed input and reference time", () => {
    fc.assert(
      fc.property(profileArb, statsArb, contributionsArb, (profile, stats, contributions) => {
        const a = computeDeveloperScore(profile, stats, contributions, NOW);
        const b = computeDeveloperScore(profile, stats, contributions, NOW);
        return JSON.stringify(a) === JSON.stringify(b);
      }),
      { numRuns: 100 },
    );
  });

  it("assigns a tier whose grade matches the total", () => {
    fc.assert(
      fc.property(profileArb, statsArb, contributionsArb, (profile, stats, contributions) => {
        const { total, tier, grade } = computeDeveloperScore(profile, stats, contributions, NOW);
        return total >= tier.min && grade === tier.grade;
      }),
      { numRuns: 100 },
    );
  });
});

describe("empty and minimal profiles", () => {
  it("a brand-new empty profile scores only on profile-derived dimensions", () => {
    const result = computeDeveloperScore(bareProfile, emptyStats, null, NOW);

    expect(findDimension(result.breakdown, "impact")!.score).toBe(0);
    expect(findDimension(result.breakdown, "quality")!.score).toBe(0);
    expect(findDimension(result.breakdown, "community")!.score).toBe(0);
    expect(findDimension(result.breakdown, "diversity")!.score).toBe(0);
    expect(findDimension(result.breakdown, "activity")!.score).toBe(0);
    expect(findDimension(result.breakdown, "bonuses")!.score).toBe(0);
    // Consistency has no data at all, so the estimate is also zero.
    expect(findDimension(result.breakdown, "consistency")!.score).toBe(0);
    // Experience is the only non-zero dimension (a few days of account age).
    expect(findDimension(result.breakdown, "experience")!.score).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThan(20);
    expect(result.grade).toBe("F");
  });

  it("never throws on an invalid account creation date", () => {
    const result = computeDeveloperScore(
      { ...bareProfile, createdAt: "not-a-date" },
      emptyStats,
      null,
      NOW,
    );
    expect(findDimension(result.breakdown, "experience")!.score).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("dimension behaviour", () => {
  it("Impact rises with stars and forks and saturates below the ceiling abuse point", () => {
    const low = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, totalStars: 10, totalForks: 2 },
      null,
      NOW,
    );
    const high = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, totalStars: 5000, totalForks: 1000 },
      null,
      NOW,
    );
    const insane = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, totalStars: 5_000_000, totalForks: 1_000_000 },
      null,
      NOW,
    );

    const lowImpact = findDimension(low.breakdown, "impact")!.score;
    const highImpact = findDimension(high.breakdown, "impact")!.score;
    const insaneImpact = findDimension(insane.breakdown, "impact")!.score;

    expect(lowImpact).toBeGreaterThan(0);
    expect(highImpact).toBeGreaterThan(lowImpact);
    expect(highImpact).toBe(DIMENSION_MAX.impact);
    expect(insaneImpact).toBe(DIMENSION_MAX.impact);
  });

  it("Consistency uses real calendar data when available", () => {
    const contributions: ContributionData = {
      totalContributions: 1500,
      activeWeeks: 52,
      longestStreakDays: 120,
      estimated: false,
    };
    const result = computeDeveloperScore(bareProfile, emptyStats, contributions, NOW);
    const consistency = findDimension(result.breakdown, "consistency")!;
    expect(consistency.score).toBe(DIMENSION_MAX.consistency);
    expect(consistency.detail).toContain("1,500");
  });

  it("Consistency degrades to at most half credit without calendar data", () => {
    const result = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, recentlyUpdatedRepos: 50 },
      null,
      NOW,
    );
    const consistency = findDimension(result.breakdown, "consistency")!;
    expect(consistency.score).toBe(DIMENSION_MAX.consistency / 2);
    expect(consistency.detail).toContain("estimated");
  });

  it("Consistency treats estimated contribution data as the fallback path", () => {
    const estimated: ContributionData = {
      totalContributions: 5000,
      activeWeeks: 52,
      longestStreakDays: 300,
      estimated: true,
    };
    const result = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, recentlyUpdatedRepos: 6 },
      estimated,
      NOW,
    );
    const consistency = findDimension(result.breakdown, "consistency")!;
    expect(consistency.score).toBeLessThanOrEqual(DIMENSION_MAX.consistency / 2);
  });

  it("Quality rewards documentation, licensing, topics and demos", () => {
    const bare = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, totalReposAnalyzed: 10, originalRepos: 10 },
      null,
      NOW,
    );
    const polished = computeDeveloperScore(
      bareProfile,
      {
        ...emptyStats,
        totalReposAnalyzed: 10,
        originalRepos: 10,
        reposWithDescription: 10,
        reposWithLicense: 10,
        reposWithTopics: 10,
        reposWithHomepage: 10,
        reposWithReadme: 3,
      },
      null,
      NOW,
    );

    expect(findDimension(bare.breakdown, "quality")!.score).toBe(0);
    expect(findDimension(polished.breakdown, "quality")!.score).toBe(DIMENSION_MAX.quality);
  });

  it("Diversity prefers the uncapped distinct language count over topLanguages", () => {
    const capped = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, topLanguages: ["a", "b", "c", "d", "e"], distinctLanguages: undefined },
      null,
      NOW,
    );
    const uncapped = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, topLanguages: ["a", "b", "c", "d", "e"], distinctLanguages: 8 },
      null,
      NOW,
    );

    expect(findDimension(uncapped.breakdown, "diversity")!.score).toBe(DIMENSION_MAX.diversity);
    expect(findDimension(capped.breakdown, "diversity")!.score).toBeLessThan(
      DIMENSION_MAX.diversity,
    );
  });

  it("Experience saturates at the configured account age", () => {
    const old = computeDeveloperScore(
      { ...bareProfile, createdAt: "2010-01-01T00:00:00Z" },
      emptyStats,
      null,
      NOW,
    );
    expect(findDimension(old.breakdown, "experience")!.score).toBe(DIMENSION_MAX.experience);
  });

  it("Activity rewards a recent push and penalises a stale profile", () => {
    const fresh = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, recentlyUpdatedRepos: 6, daysSinceLastPush: 1 },
      null,
      NOW,
    );
    const stale = computeDeveloperScore(
      bareProfile,
      { ...emptyStats, recentlyUpdatedRepos: 0, daysSinceLastPush: 900 },
      null,
      NOW,
    );

    expect(findDimension(fresh.breakdown, "activity")!.score).toBe(DIMENSION_MAX.activity);
    expect(findDimension(stale.breakdown, "activity")!.score).toBe(0);
  });

  it("Bonuses accumulate from profile polish and a standout repo", () => {
    const full = computeDeveloperScore(
      {
        ...bareProfile,
        bio: "I build things",
        blog: "https://example.com",
        company: "Acme",
        location: "Earth",
        profileReadme: "# hi",
      },
      { ...emptyStats, maxRepoStars: 500 },
      null,
      NOW,
    );
    expect(findDimension(full.breakdown, "bonuses")!.score).toBe(DIMENSION_MAX.bonuses);
  });

  it("Community is not penalised for following nobody", () => {
    const result = computeDeveloperScore(
      { ...bareProfile, followers: 100, following: 0 },
      emptyStats,
      null,
      NOW,
    );
    const solo = findDimension(result.breakdown, "community")!;
    const balanced = findDimension(
      computeDeveloperScore(
        { ...bareProfile, followers: 100, following: 100 },
        emptyStats,
        null,
        NOW,
      ).breakdown,
      "community",
    )!;
    expect(solo.score).toBe(balanced.score);
  });
});

describe("a strong real-world-shaped profile", () => {
  it("scores highly across all eight dimensions", () => {
    const profile: GitHubProfile = {
      login: "prolific",
      name: "Prolific Dev",
      avatarUrl: "https://example.com/a.png",
      bio: "Open source maintainer",
      followers: 12000,
      following: 120,
      publicRepos: 80,
      profileUrl: "https://github.com/prolific",
      blog: "https://example.com",
      company: "OSS Inc",
      location: "Internet",
      createdAt: "2011-03-01T00:00:00Z",
      profileReadme: "# Hello",
    };
    const stats: GitHubStats = {
      totalReposAnalyzed: 60,
      totalStars: 40000,
      totalForks: 5000,
      topLanguages: ["TypeScript", "Rust", "Go", "Python", "C"],
      reposWithDescription: 58,
      reposWithoutDescription: 2,
      reposWithHomepage: 30,
      recentlyUpdatedRepos: 20,
      forkedRepos: 5,
      originalRepos: 55,
      distinctLanguages: 12,
      reposWithLicense: 50,
      reposWithTopics: 45,
      reposWithReadme: 3,
      maxRepoStars: 20000,
      daysSinceLastPush: 0,
    };
    const contributions: ContributionData = {
      totalContributions: 3200,
      activeWeeks: 51,
      longestStreakDays: 210,
      estimated: false,
    };

    const result = computeDeveloperScore(profile, stats, contributions, NOW);

    expect(result.total).toBeGreaterThan(900);
    expect(result.total).toBeLessThanOrEqual(MAX_SCORE);
    expect(result.grade).toBe("S");
    expect(result.tier.label).toBe("Elite");
    // Every dimension should have earned something.
    expect(result.breakdown.every((d) => d.score > 0)).toBe(true);
  });
});

describe("tierForScore", () => {
  it("maps boundary scores to the expected grades", () => {
    expect(tierForScore(1000).grade).toBe("S");
    expect(tierForScore(900).grade).toBe("S");
    expect(tierForScore(899).grade).toBe("A");
    expect(tierForScore(800).grade).toBe("A");
    expect(tierForScore(700).grade).toBe("B");
    expect(tierForScore(550).grade).toBe("C");
    expect(tierForScore(400).grade).toBe("D");
    expect(tierForScore(200).grade).toBe("E");
    expect(tierForScore(0).grade).toBe("F");
  });

  it("covers the whole range with descending, non-overlapping bands", () => {
    for (let i = 1; i < SCORE_TIERS.length; i++) {
      expect(SCORE_TIERS[i].min).toBeLessThan(SCORE_TIERS[i - 1].min);
    }
    expect(SCORE_TIERS[SCORE_TIERS.length - 1].min).toBe(0);

    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_SCORE }), (score) => {
        const tier = tierForScore(score);
        return score >= tier.min && typeof tier.grade === "string" && tier.grade.length > 0;
      }),
      { numRuns: 200 },
    );
  });

  it("falls back to the lowest tier for a non-finite score", () => {
    expect(tierForScore(Number.NaN).grade).toBe("F");
  });
});

describe("weakest and strongest dimension ranking", () => {
  const { breakdown } = computeDeveloperScore(
    { ...bareProfile, followers: 5000, following: 10 },
    { ...emptyStats, totalStars: 9000, totalForks: 900 },
    null,
    NOW,
  );

  it("ranks the biggest proportional gaps first and is a stable permutation", () => {
    const weakest = weakestDimensions(breakdown);
    expect(weakest).toHaveLength(breakdown.length);
    for (let i = 1; i < weakest.length; i++) {
      const prev = (weakest[i - 1].max - weakest[i - 1].score) / weakest[i - 1].max;
      const curr = (weakest[i].max - weakest[i].score) / weakest[i].max;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
    // Earned dimensions must not appear as the top weakness.
    expect(weakest[0].score / weakest[0].max).toBeLessThan(0.5);
  });

  it("ranks the highest earned proportion first", () => {
    const strongest = strongestDimensions(breakdown, 3);
    expect(strongest).toHaveLength(3);
    for (let i = 1; i < strongest.length; i++) {
      const prev = strongest[i - 1].score / strongest[i - 1].max;
      const curr = strongest[i].score / strongest[i].max;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("does not mutate the input breakdown", () => {
    const snapshot = JSON.stringify(breakdown);
    weakestDimensions(breakdown);
    strongestDimensions(breakdown);
    expect(JSON.stringify(breakdown)).toBe(snapshot);
  });
});
