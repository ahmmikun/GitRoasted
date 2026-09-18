// Tests for the leaderboard seed script: idempotent upserts via the analysis
// service, sequential execution, and per-user fault tolerance.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/analysis-service", () => ({
  getProfileAnalysis: vi.fn(),
}));

import { SEED_USERNAMES, seedLeaderboard } from "./seed-leaderboard";
import { getProfileAnalysis } from "../lib/analysis-service";

/** Minimal successful analysis result for a username. */
function okResult(username: string, score = 800) {
  return {
    ok: true as const,
    analysis: {
      username,
      profile: {
        login: username,
        name: null,
        avatarUrl: "",
        bio: null,
        followers: 0,
        following: 0,
        publicRepos: 0,
        profileUrl: `https://github.com/${username}`,
        blog: null,
        company: null,
        location: null,
        createdAt: "2015-01-01T00:00:00Z",
      },
      stats: {
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
      },
      score,
      grade: "A",
      tier: { min: 800, label: "Outstanding", grade: "A" },
      breakdown: [],
      summary: "",
      repos: [],
      fromSnapshot: false,
      analyzedAt: new Date("2025-01-01T00:00:00Z"),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProfileAnalysis).mockImplementation(
    async (username: string) => okResult(username) as never,
  );
});

describe("SEED_USERNAMES", () => {
  it("is a non-empty list of unique, valid-looking logins", () => {
    expect(SEED_USERNAMES.length).toBeGreaterThan(0);
    expect(new Set(SEED_USERNAMES).size).toBe(SEED_USERNAMES.length);
    for (const username of SEED_USERNAMES) {
      expect(username).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/);
    }
  });
});

describe("seedLeaderboard", () => {
  it("analyzes every username and persists each one", async () => {
    const outcomes = await seedLeaderboard(["torvalds", "octocat"], { spacingMs: 0 });

    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((o) => o.status === "seeded")).toBe(true);
    expect(getProfileAnalysis).toHaveBeenCalledTimes(2);

    // Persisting is what actually seeds the leaderboard, and force guarantees
    // fresh data rather than reusing a stale snapshot.
    for (const call of vi.mocked(getProfileAnalysis).mock.calls) {
      expect(call[1]).toMatchObject({ force: true, persist: true });
    }
  });

  it("reports the measured score for each seeded developer", async () => {
    vi.mocked(getProfileAnalysis).mockResolvedValueOnce(okResult("torvalds", 965) as never);

    const [outcome] = await seedLeaderboard(["torvalds"], { spacingMs: 0 });
    expect(outcome).toMatchObject({ username: "torvalds", status: "seeded", score: 965 });
  });

  it("runs sequentially, one user at a time", async () => {
    const order: string[] = [];
    vi.mocked(getProfileAnalysis).mockImplementation(async (username: string) => {
      order.push(`start:${username}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end:${username}`);
      return okResult(username) as never;
    });

    await seedLeaderboard(["a1", "b2"], { spacingMs: 0 });

    // A parallel run would interleave the start/end markers.
    expect(order).toEqual(["start:a1", "end:a1", "start:b2", "end:b2"]);
  });

  it("skips writing when dryRun is set", async () => {
    await seedLeaderboard(["torvalds"], { spacingMs: 0, dryRun: true });

    expect(vi.mocked(getProfileAnalysis).mock.calls[0][1]).toMatchObject({
      persist: false,
    });
  });

  it("keeps going when one developer fails", async () => {
    vi.mocked(getProfileAnalysis)
      .mockResolvedValueOnce({
        ok: false,
        kind: "not_found",
        message: "GitHub user \"ghost\" was not found.",
      } as never)
      .mockResolvedValueOnce(okResult("octocat") as never);

    const outcomes = await seedLeaderboard(["ghost", "octocat"], { spacingMs: 0 });

    expect(outcomes[0]).toMatchObject({ username: "ghost", status: "failed" });
    expect(outcomes[1]).toMatchObject({ username: "octocat", status: "seeded" });
  });

  it("rejects invalid usernames without calling the analysis service", async () => {
    const outcomes = await seedLeaderboard(["-bad-name-"], { spacingMs: 0 });

    expect(outcomes[0].status).toBe("invalid");
    expect(getProfileAnalysis).not.toHaveBeenCalled();
  });

  it("normalizes usernames through the shared validator", async () => {
    await seedLeaderboard(["  torvalds  "], { spacingMs: 0 });
    expect(getProfileAnalysis).toHaveBeenCalledWith("torvalds", expect.anything());
  });

  it("is idempotent: a second run issues the same upserting calls", async () => {
    const first = await seedLeaderboard(["torvalds"], { spacingMs: 0 });
    const second = await seedLeaderboard(["torvalds"], { spacingMs: 0 });

    expect(first).toEqual(second);
    expect(getProfileAnalysis).toHaveBeenCalledTimes(2);
  });

  it("handles an empty list without error", async () => {
    await expect(seedLeaderboard([], { spacingMs: 0 })).resolves.toEqual([]);
    expect(getProfileAnalysis).not.toHaveBeenCalled();
  });
});
