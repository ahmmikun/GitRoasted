// Tests for developer comparison: dimension/metric diffs, tie handling,
// deciding dimensions, and API validation/error mapping.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { accountAgeYears, compareDevelopers, type ComparisonInput } from "./compare";
import { DIMENSION_MAX } from "./scoring";
import type { DimensionScore } from "./types";

const NOW = new Date("2025-01-01T00:00:00Z").getTime();

/** Build a full 8-dimension breakdown from partial overrides. */
function breakdown(overrides: Partial<Record<keyof typeof DIMENSION_MAX, number>>): DimensionScore[] {
  return (Object.keys(DIMENSION_MAX) as Array<keyof typeof DIMENSION_MAX>).map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    score: overrides[key] ?? 0,
    max: DIMENSION_MAX[key],
    detail: "detail",
  }));
}

function side(username: string, overrides: Partial<ComparisonInput> = {}): ComparisonInput {
  return {
    username,
    login: username,
    name: null,
    avatarUrl: "",
    profileUrl: `https://github.com/${username}`,
    score: 0,
    grade: "F",
    tier: "Getting Started",
    breakdown: breakdown({}),
    followers: 0,
    following: 0,
    publicRepos: 0,
    totalStars: 0,
    totalForks: 0,
    totalRepos: 0,
    distinctLanguages: 0,
    topLanguages: [],
    recentlyUpdatedRepos: 0,
    accountCreatedAt: "2020-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("accountAgeYears", () => {
  it("computes age in tenths of a year", () => {
    expect(accountAgeYears("2015-01-01T00:00:00Z", NOW)).toBe(10);
    expect(accountAgeYears("2024-07-02T00:00:00Z", NOW)).toBeCloseTo(0.5, 1);
  });

  it("returns 0 for an unusable date rather than throwing", () => {
    expect(accountAgeYears("", NOW)).toBe(0);
    expect(accountAgeYears("not-a-date", NOW)).toBe(0);
  });
});

describe("compareDevelopers — score", () => {
  it("reports the absolute score gap and which side leads", () => {
    const result = compareDevelopers(
      side("alpha", { score: 820 }),
      side("beta", { score: 640 }),
      NOW,
    );

    expect(result.scoreDifference).toBe(180);
    expect(result.scoreLeader).toBe("a");
  });

  it("marks equal scores as a tie, not an arbitrary winner", () => {
    const result = compareDevelopers(
      side("alpha", { score: 700 }),
      side("beta", { score: 700 }),
      NOW,
    );

    expect(result.scoreDifference).toBe(0);
    expect(result.scoreLeader).toBe("tie");
  });

  it("is symmetric: swapping sides flips the leader but keeps the gap", () => {
    const a = side("alpha", { score: 500 });
    const b = side("beta", { score: 800 });

    const forward = compareDevelopers(a, b, NOW);
    const reversed = compareDevelopers(b, a, NOW);

    expect(forward.scoreDifference).toBe(reversed.scoreDifference);
    expect(forward.scoreLeader).toBe("b");
    expect(reversed.scoreLeader).toBe("a");
  });
});

describe("compareDevelopers — dimensions", () => {
  it("compares every dimension and records the per-dimension gap", () => {
    const result = compareDevelopers(
      side("alpha", { breakdown: breakdown({ impact: 200, community: 50 }) }),
      side("beta", { breakdown: breakdown({ impact: 80, community: 120 }) }),
      NOW,
    );

    expect(result.dimensions).toHaveLength(8);

    const impact = result.dimensions.find((d) => d.key === "impact")!;
    expect(impact).toMatchObject({ a: 200, b: 80, leader: "a", difference: 120 });
    expect(impact.max).toBe(DIMENSION_MAX.impact);

    const community = result.dimensions.find((d) => d.key === "community")!;
    expect(community).toMatchObject({ leader: "b", difference: 70 });
  });

  it("marks equal dimensions as ties", () => {
    const result = compareDevelopers(
      side("alpha", { breakdown: breakdown({ quality: 100 }) }),
      side("beta", { breakdown: breakdown({ quality: 100 }) }),
      NOW,
    );

    expect(result.dimensions.find((d) => d.key === "quality")!.leader).toBe("tie");
  });

  it("ranks deciding dimensions by contribution to the gap", () => {
    const result = compareDevelopers(
      side("alpha", {
        breakdown: breakdown({ impact: 250, consistency: 100, quality: 75 }),
      }),
      side("beta", {
        breakdown: breakdown({ impact: 50, consistency: 90, quality: 75 }),
      }),
      NOW,
    );

    const keys = result.decidingDimensions.map((d) => d.key);
    expect(keys[0]).toBe("impact"); // 200-point gap
    expect(keys[1]).toBe("consistency"); // 10-point gap
    // Equal dimensions contribute nothing and are excluded.
    expect(keys).not.toContain("quality");
  });

  it("returns no deciding dimensions for identical breakdowns", () => {
    const same = breakdown({ impact: 100 });
    const result = compareDevelopers(
      side("alpha", { breakdown: same }),
      side("beta", { breakdown: same }),
      NOW,
    );

    expect(result.decidingDimensions).toEqual([]);
  });

  it("tolerates a side with an empty breakdown", () => {
    const result = compareDevelopers(
      side("alpha", { breakdown: breakdown({ impact: 120 }) }),
      side("beta", { breakdown: [] }),
      NOW,
    );

    expect(result.dimensions).toHaveLength(8);
    expect(result.dimensions.find((d) => d.key === "impact")).toMatchObject({
      a: 120,
      b: 0,
      leader: "a",
    });
  });
});

describe("compareDevelopers — metrics", () => {
  it("compares the headline GitHub metrics", () => {
    const result = compareDevelopers(
      side("alpha", {
        followers: 500,
        publicRepos: 30,
        totalStars: 1200,
        totalForks: 90,
        distinctLanguages: 6,
        recentlyUpdatedRepos: 4,
        accountCreatedAt: "2015-01-01T00:00:00Z",
      }),
      side("beta", {
        followers: 500,
        publicRepos: 12,
        totalStars: 40,
        totalForks: 200,
        distinctLanguages: 3,
        recentlyUpdatedRepos: 9,
        accountCreatedAt: "2021-01-01T00:00:00Z",
      }),
      NOW,
    );

    const byKey = Object.fromEntries(result.metrics.map((m) => [m.key, m]));

    expect(byKey.followers.leader).toBe("tie");
    expect(byKey.publicRepos).toMatchObject({ leader: "a", difference: 18 });
    expect(byKey.totalStars).toMatchObject({ leader: "a", difference: 1160 });
    expect(byKey.totalForks.leader).toBe("b");
    expect(byKey.recentlyUpdatedRepos.leader).toBe("b");
    expect(byKey.accountAge.leader).toBe("a");
    expect(byKey.accountAge.displayA).toBe("10 yr");
  });

  it("covers every advertised metric", () => {
    const result = compareDevelopers(side("a1"), side("b2"), NOW);
    const keys = result.metrics.map((m) => m.key);

    expect(keys).toEqual([
      "followers",
      "publicRepos",
      "totalStars",
      "totalForks",
      "distinctLanguages",
      "recentlyUpdatedRepos",
      "accountAge",
    ]);
  });
});

describe("compareDevelopers — per-side strengths", () => {
  it("derives strengths and improvement areas from the breakdown", () => {
    const result = compareDevelopers(
      side("alpha", {
        breakdown: breakdown({ impact: 250, community: 150, quality: 0 }),
      }),
      side("beta"),
      NOW,
    );

    expect(result.a.strengths.length).toBeGreaterThan(0);
    expect(result.a.strengths).toContain("Impact");
    expect(result.a.improvementAreas).toContain("Quality");
    // A fully-earned dimension must never be listed as needing improvement.
    expect(result.a.improvementAreas).not.toContain("Impact");
  });

  it("returns empty strength lists when there is no breakdown", () => {
    const result = compareDevelopers(
      side("alpha", { breakdown: [] }),
      side("beta", { breakdown: [] }),
      NOW,
    );

    expect(result.a.strengths).toEqual([]);
    expect(result.a.improvementAreas).toEqual([]);
  });

  it("carries through profile identity for display", () => {
    const result = compareDevelopers(
      side("alpha", { login: "Alpha", name: "Alpha Dev", score: 700, grade: "B" }),
      side("beta"),
      NOW,
    );

    expect(result.a).toMatchObject({
      login: "Alpha",
      name: "Alpha Dev",
      score: 700,
      grade: "B",
      profileUrl: "https://github.com/alpha",
    });
  });
});

// ── API route ────────────────────────────────────────────────────────────────

vi.mock("@/lib/analysis-service", () => ({
  getProfileAnalysis: vi.fn(),
}));

import { GET } from "@/app/api/compare/route";
import { getProfileAnalysis } from "@/lib/analysis-service";

function analysisFor(username: string, score = 600) {
  return {
    ok: true as const,
    analysis: {
      username,
      profile: {
        login: username,
        name: null,
        avatarUrl: "",
        bio: null,
        followers: 10,
        following: 5,
        publicRepos: 4,
        profileUrl: `https://github.com/${username}`,
        blog: null,
        company: null,
        location: null,
        createdAt: "2019-01-01T00:00:00Z",
      },
      stats: {
        totalReposAnalyzed: 4,
        totalStars: 20,
        totalForks: 3,
        topLanguages: ["TypeScript"],
        reposWithDescription: 3,
        reposWithoutDescription: 1,
        reposWithHomepage: 1,
        recentlyUpdatedRepos: 2,
        forkedRepos: 0,
        originalRepos: 4,
      },
      score,
      grade: "C",
      tier: { min: 550, label: "Solid", grade: "C" },
      breakdown: breakdown({ impact: 100 }),
      summary: "",
      repos: [],
      fromSnapshot: false,
      analyzedAt: new Date(NOW),
    },
  };
}

function makeReq(query: string) {
  return new Request(`http://localhost/api/compare${query}`) as unknown as
    import("next/server").NextRequest;
}

describe("GET /api/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProfileAnalysis).mockImplementation(
      async (username: string) => analysisFor(username) as never,
    );
  });

  it("returns a comparison for two valid usernames", async () => {
    vi.mocked(getProfileAnalysis)
      .mockResolvedValueOnce(analysisFor("alpha", 800) as never)
      .mockResolvedValueOnce(analysisFor("beta", 600) as never);

    const res = await GET(makeReq("?a=alpha&b=beta"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: { scoreDifference: number; scoreLeader: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.scoreDifference).toBe(200);
    expect(body.data.scoreLeader).toBe("a");
  });

  it("analyzes both developers in parallel", async () => {
    await GET(makeReq("?a=alpha&b=beta"));
    expect(getProfileAnalysis).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing or invalid first username", async () => {
    const res = await GET(makeReq("?b=beta"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.message).toContain("First username");
  });

  it("rejects an invalid second username", async () => {
    const res = await GET(makeReq("?a=alpha&b=-nope-"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("Second username");
  });

  it("rejects comparing a developer with themselves", async () => {
    const res = await GET(makeReq("?a=alpha&b=ALPHA"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("two different usernames");
  });

  it("returns 404 naming the username that does not exist", async () => {
    vi.mocked(getProfileAnalysis)
      .mockResolvedValueOnce(analysisFor("alpha") as never)
      .mockResolvedValueOnce({
        ok: false,
        kind: "not_found",
        message: "not found",
      } as never);

    const res = await GET(makeReq("?a=alpha&b=ghostuser"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("ghostuser");
  });

  it("returns a friendly 502 on an upstream failure without leaking details", async () => {
    vi.mocked(getProfileAnalysis).mockResolvedValue({
      ok: false,
      kind: "upstream_error",
      message: "GitHub repositories request failed with status 403.",
    } as never);

    const res = await GET(makeReq("?a=alpha&b=beta"));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UPSTREAM");
    expect(body.error.message).not.toContain("403");
    expect(body.error.message).toContain("rate limiting");
  });
});
