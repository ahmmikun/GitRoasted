// Tests for the shared Analysis_Service: snapshot reuse, live fetching,
// leaderboard upserts, and error mapping.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GitHubProfile, GitHubRepo } from "./types";

vi.mock("./db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./github", () => ({
  fetchGitHubData: vi.fn(),
  fetchContributionData: vi.fn(),
}));

vi.mock("@/models/ProfileAnalysis", () => ({
  ProfileAnalysisModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import { getProfileAnalysis, saveProfileSnapshot } from "./analysis-service";
import { fetchContributionData, fetchGitHubData } from "./github";
import { ProfileAnalysisModel } from "@/models/ProfileAnalysis";

const NOW = new Date("2025-01-01T00:00:00Z").getTime();

const profile: GitHubProfile = {
  login: "TestUser",
  name: "Test User",
  avatarUrl: "https://example.com/a.png",
  bio: "Builder",
  followers: 120,
  following: 30,
  publicRepos: 12,
  profileUrl: "https://github.com/TestUser",
  blog: "https://example.com",
  company: "Acme",
  location: "Earth",
  createdAt: "2018-01-01T00:00:00Z",
  profileReadme: "# hi",
};

const repos: GitHubRepo[] = [
  {
    name: "cool-lib",
    description: "Does cool things",
    language: "TypeScript",
    stargazersCount: 300,
    forksCount: 40,
    fork: false,
    homepage: "https://example.com",
    pushedAt: "2024-12-30T00:00:00Z",
    license: "MIT",
    topics: ["library"],
    readmeExcerpt: "A readme",
  },
];

/** Helper to stub the leaderboard snapshot lookup. */
function stubSnapshot(doc: unknown) {
  vi.mocked(ProfileAnalysisModel.findOne).mockReturnValue({
    lean: vi.fn().mockResolvedValue(doc),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubSnapshot(null);
  vi.mocked(ProfileAnalysisModel.findOneAndUpdate).mockResolvedValue({} as never);
  vi.mocked(fetchGitHubData).mockResolvedValue({ ok: true, profile, repos });
  vi.mocked(fetchContributionData).mockResolvedValue({
    totalContributions: 800,
    activeWeeks: 40,
    longestStreakDays: 20,
    estimated: false,
  });
});

describe("getProfileAnalysis — live fetch", () => {
  it("fetches GitHub data and contributions in parallel and scores the profile", async () => {
    const result = await getProfileAnalysis("TestUser", { now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(fetchGitHubData).toHaveBeenCalledWith("TestUser");
    expect(fetchContributionData).toHaveBeenCalledWith("TestUser");

    const { analysis } = result;
    expect(analysis.username).toBe("testuser");
    expect(analysis.score).toBeGreaterThan(0);
    expect(analysis.score).toBeLessThanOrEqual(1000);
    expect(analysis.breakdown).toHaveLength(8);
    expect(analysis.fromSnapshot).toBe(false);
    expect(analysis.repos).toHaveLength(1);
    expect(analysis.summary.length).toBeGreaterThan(0);
    // Real contribution data must not be flagged as estimated in the detail text.
    const consistency = analysis.breakdown.find((d) => d.key === "consistency")!;
    expect(consistency.detail).toContain("800");
  });

  it("upserts the leaderboard snapshot keyed by lowercased username", async () => {
    await getProfileAnalysis("TestUser", { now: NOW });

    expect(ProfileAnalysisModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = vi.mocked(ProfileAnalysisModel.findOneAndUpdate).mock
      .calls[0];

    expect(filter).toEqual({ username: "testuser" });
    expect(options).toMatchObject({ upsert: true });

    const set = (update as { $set: Record<string, unknown> }).$set;
    expect(set.login).toBe("TestUser");
    expect(set.primaryLanguage).toBe("TypeScript");
    expect(set.totalStars).toBe(300);
    expect(set.followers).toBe(120);
    expect(set.score).toBeGreaterThan(0);
    expect(set.accountCreatedAt).toBe("2018-01-01T00:00:00Z");
  });

  it("skips persistence when persist:false", async () => {
    await getProfileAnalysis("TestUser", { now: NOW, persist: false });
    expect(ProfileAnalysisModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("still succeeds when contribution data is unavailable", async () => {
    vi.mocked(fetchContributionData).mockResolvedValue(null);

    const result = await getProfileAnalysis("TestUser", { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const consistency = result.analysis.breakdown.find((d) => d.key === "consistency")!;
    expect(consistency.detail).toContain("estimated");
    // Degraded, not zeroed — the repo was pushed recently.
    expect(consistency.score).toBeLessThanOrEqual(100);
  });

  it("still succeeds when contribution fetching rejects", async () => {
    vi.mocked(fetchContributionData).mockRejectedValue(new Error("boom"));
    const result = await getProfileAnalysis("TestUser", { now: NOW });
    expect(result.ok).toBe(true);
  });

  it("still succeeds when the snapshot upsert fails", async () => {
    vi.mocked(ProfileAnalysisModel.findOneAndUpdate).mockRejectedValue(new Error("db down"));
    const result = await getProfileAnalysis("TestUser", { now: NOW });
    expect(result.ok).toBe(true);
  });
});

describe("getProfileAnalysis — snapshot reuse", () => {
  const snapshotDoc = {
    username: "testuser",
    login: "TestUser",
    name: "Test User",
    avatarUrl: "https://example.com/a.png",
    profileUrl: "https://github.com/TestUser",
    bio: "Builder",
    score: 640,
    grade: "C",
    tier: "Solid",
    breakdown: [{ key: "impact", label: "Impact", score: 100, max: 250, detail: "d" }],
    followers: 120,
    following: 30,
    publicRepos: 12,
    accountCreatedAt: "2018-01-01T00:00:00Z",
    stats: { totalStars: 300, topLanguages: ["TypeScript"] },
    analyzedAt: new Date(NOW - 60 * 60 * 1000), // 1 hour old
  };

  it("reuses a fresh snapshot without calling GitHub at all", async () => {
    stubSnapshot(snapshotDoc);

    const result = await getProfileAnalysis("TestUser", { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.analysis.fromSnapshot).toBe(true);
    expect(result.analysis.score).toBe(640);
    expect(result.analysis.grade).toBe("C");
    expect(result.analysis.tier.label).toBe("Solid");
    expect(fetchGitHubData).not.toHaveBeenCalled();
    expect(fetchContributionData).not.toHaveBeenCalled();
  });

  it("queries snapshots with a freshness cutoff", async () => {
    stubSnapshot(snapshotDoc);
    await getProfileAnalysis("TestUser", { now: NOW, ttlHours: 6 });

    const [filter] = vi.mocked(ProfileAnalysisModel.findOne).mock.calls[0] as unknown as [
      { username: string; analyzedAt: { $gte: Date } },
    ];
    expect(filter.username).toBe("testuser");
    expect(filter.analyzedAt.$gte.getTime()).toBe(NOW - 6 * 60 * 60 * 1000);
  });

  it("ignores snapshots when force:true", async () => {
    stubSnapshot(snapshotDoc);

    const result = await getProfileAnalysis("TestUser", { now: NOW, force: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.analysis.fromSnapshot).toBe(false);
    expect(ProfileAnalysisModel.findOne).not.toHaveBeenCalled();
    expect(fetchGitHubData).toHaveBeenCalled();
  });

  it("falls back to a live fetch when the snapshot lookup throws", async () => {
    vi.mocked(ProfileAnalysisModel.findOne).mockImplementation(() => {
      throw new Error("db unavailable");
    });

    const result = await getProfileAnalysis("TestUser", { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.fromSnapshot).toBe(false);
    expect(fetchGitHubData).toHaveBeenCalled();
  });
});

describe("getProfileAnalysis — error mapping", () => {
  it("propagates not_found", async () => {
    vi.mocked(fetchGitHubData).mockResolvedValue({
      ok: false,
      kind: "not_found",
      message: 'GitHub user "ghost" was not found.',
    });

    const result = await getProfileAnalysis("ghost", { now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("not_found");
    expect(ProfileAnalysisModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("propagates upstream_error", async () => {
    vi.mocked(fetchGitHubData).mockResolvedValue({
      ok: false,
      kind: "upstream_error",
      message: "GitHub API unavailable.",
    });

    const result = await getProfileAnalysis("someone", { now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("upstream_error");
  });
});

describe("saveProfileSnapshot", () => {
  it("persists full profile fields including blog, company, location, and profileReadme", async () => {
    vi.mocked(ProfileAnalysisModel.findOneAndUpdate).mockResolvedValue({} as never);

    const ok = await saveProfileSnapshot({
      username: "testuser",
      profile: {
        ...profile,
        hasProfileReadme: true,
        profileReadme: "# Custom Readme",
      },
      stats: {
        totalReposAnalyzed: 1,
        totalStars: 300,
        totalForks: 40,
        topLanguages: ["TypeScript"],
        reposWithDescription: 1,
        reposWithoutDescription: 0,
        reposWithHomepage: 1,
        recentlyUpdatedRepos: 1,
        forkedRepos: 0,
        originalRepos: 1,
      },
      score: 500,
      grade: "D",
      tier: { min: 400, label: "Developing", grade: "D" },
      breakdown: [],
      summary: "",
      repos: [],
      fromSnapshot: false,
      analyzedAt: new Date(NOW),
    });

    expect(ok).toBe(true);
    expect(ProfileAnalysisModel.findOneAndUpdate).toHaveBeenCalledWith(
      { username: "testuser" },
      expect.objectContaining({
        $set: expect.objectContaining({
          blog: "https://example.com",
          company: "Acme",
          location: "Earth",
          hasProfileReadme: true,
          profileReadme: "# Custom Readme",
        }),
      }),
      { upsert: true, new: true },
    );
  });

  it("returns false instead of throwing when the write fails", async () => {
    vi.mocked(ProfileAnalysisModel.findOneAndUpdate).mockRejectedValue(new Error("nope"));

    const ok = await saveProfileSnapshot({
      username: "testuser",
      profile,
      stats: {
        totalReposAnalyzed: 1,
        totalStars: 300,
        totalForks: 40,
        topLanguages: ["TypeScript"],
        reposWithDescription: 1,
        reposWithoutDescription: 0,
        reposWithHomepage: 1,
        recentlyUpdatedRepos: 1,
        forkedRepos: 0,
        originalRepos: 1,
      },
      score: 500,
      grade: "D",
      tier: { min: 400, label: "Developing", grade: "D" },
      breakdown: [],
      summary: "",
      repos: [],
      fromSnapshot: false,
      analyzedAt: new Date(NOW),
    });

    expect(ok).toBe(false);
  });
});

describe("getProfileAnalysis — legacy snapshot backward compatibility", () => {
  it("infers hasProfileReadme and blog from bonuses detail when missing from legacy snapshot", async () => {
    stubSnapshot({
      username: "testuser",
      login: "TestUser",
      name: "Test User",
      avatarUrl: "https://example.com/a.png",
      profileUrl: "https://github.com/TestUser",
      bio: "Builder",
      score: 800,
      grade: "B",
      tier: "Strong",
      breakdown: [
        {
          key: "bonuses",
          label: "Bonuses",
          score: 25,
          max: 25,
          detail: "Earned for: profile README, bio, website, company/location, a repo with 50+ stars.",
        },
      ],
      followers: 120,
      following: 30,
      publicRepos: 12,
      accountCreatedAt: "2018-01-01T00:00:00Z",
      stats: { totalStars: 300, topLanguages: ["TypeScript"] },
      analyzedAt: new Date(NOW - 60 * 60 * 1000),
      // Legacy document: blog and hasProfileReadme omitted
    });

    const result = await getProfileAnalysis("TestUser", { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.analysis.profile.hasProfileReadme).toBe(true);
    expect(result.analysis.profile.blog).not.toBeNull();
  });
});
