// Tests for the improvement roadmap: recommendations must be triggered by real
// measured shortfalls, tier-appropriate, specific, and free of empty promises.

import { describe, it, expect } from "vitest";
import { buildRoadmap } from "./recommendations";
import { computeDeveloperScore } from "./scoring";
import type { GitHubProfile, GitHubStats } from "./types";

const NOW = new Date("2025-01-01T00:00:00Z").getTime();

const weakProfile: GitHubProfile = {
  login: "newbie",
  name: null,
  avatarUrl: "",
  bio: null,
  followers: 1,
  following: 40,
  publicRepos: 4,
  profileUrl: "https://github.com/newbie",
  blog: null,
  company: null,
  location: null,
  createdAt: "2023-06-01T00:00:00Z",
  profileReadme: null,
};

const weakStats: GitHubStats = {
  totalReposAnalyzed: 4,
  totalStars: 0,
  totalForks: 0,
  topLanguages: ["JavaScript"],
  reposWithDescription: 1,
  reposWithoutDescription: 3,
  reposWithHomepage: 0,
  recentlyUpdatedRepos: 0,
  forkedRepos: 2,
  originalRepos: 2,
  distinctLanguages: 1,
  reposWithLicense: 0,
  reposWithTopics: 0,
  reposWithReadme: 0,
  maxRepoStars: 0,
  daysSinceLastPush: 400,
};

const strongProfile: GitHubProfile = {
  login: "veteran",
  name: "Veteran Dev",
  avatarUrl: "https://example.com/a.png",
  bio: "Maintainer",
  followers: 20000,
  following: 100,
  publicRepos: 70,
  profileUrl: "https://github.com/veteran",
  blog: "https://example.com",
  company: "OSS",
  location: "Internet",
  createdAt: "2010-01-01T00:00:00Z",
  profileReadme: "# Hello",
};

const strongStats: GitHubStats = {
  totalReposAnalyzed: 40,
  totalStars: 90000,
  totalForks: 12000,
  topLanguages: ["Rust", "Go", "TypeScript", "C", "Python"],
  reposWithDescription: 40,
  reposWithoutDescription: 0,
  reposWithHomepage: 30,
  recentlyUpdatedRepos: 20,
  forkedRepos: 0,
  originalRepos: 40,
  distinctLanguages: 10,
  reposWithLicense: 40,
  reposWithTopics: 40,
  reposWithReadme: 3,
  maxRepoStars: 40000,
  daysSinceLastPush: 0,
};

/** Build a roadmap using the real scoring engine, so triggers stay in sync. */
function roadmapFor(
  profile: GitHubProfile,
  stats: GitHubStats,
  contributions: Parameters<typeof computeDeveloperScore>[2] = null,
) {
  const { breakdown } = computeDeveloperScore(profile, stats, contributions, NOW);
  return buildRoadmap(profile, stats, breakdown);
}

describe("buildRoadmap — weak profile", () => {
  const roadmap = roadmapFor(weakProfile, weakStats);

  it("produces recommendations in all three tiers", () => {
    expect(roadmap.quickWins.length).toBeGreaterThan(0);
    expect(roadmap.shortTerm.length).toBeGreaterThan(0);
    expect(roadmap.longTerm.length).toBeGreaterThan(0);
    expect(roadmap.count).toBe(
      roadmap.quickWins.length + roadmap.shortTerm.length + roadmap.longTerm.length,
    );
    expect(roadmap.isStrongProfile).toBe(false);
  });

  it("flags the missing bio, website, and profile README as quick wins", () => {
    const ids = roadmap.quickWins.map((r) => r.id);
    expect(ids).toContain("add-bio");
    expect(ids).toContain("add-website");
    expect(ids).toContain("profile-readme");
  });

  it("names the exact repository counts rather than speaking generally", () => {
    const descriptions = roadmap.quickWins.find((r) => r.id === "add-descriptions")!;
    // 3 undescribed of 4 total.
    expect(descriptions.why).toContain("3");
    expect(descriptions.why).toContain("4");
    expect(descriptions.title).toContain("3");
  });

  it("suggests the correctly named profile README repository", () => {
    const readme = roadmap.quickWins.find((r) => r.id === "profile-readme")!;
    expect(readme.example).toContain("newbie/newbie");
  });

  it("raises stale activity using the real day count", () => {
    const stale = roadmap.shortTerm.find((r) => r.id === "resume-pushing")!;
    expect(stale.why).toContain("400 days ago");
  });

  it("recommends open-source participation for weak community metrics", () => {
    const community = roadmap.longTerm.find((r) => r.id === "build-community")!;
    expect(community.why).toContain("1 follower");
    expect(community.action.toLowerCase()).toContain("contribute");
  });

  it("recommends broadening languages when the portfolio is single-language", () => {
    const diversity = roadmap.longTerm.find((r) => r.id === "broaden-languages")!;
    expect(diversity.why).toContain("JavaScript");
  });

  it("orders focus dimensions by proportional shortfall", () => {
    expect(roadmap.focusDimensions.length).toBeGreaterThan(0);
    expect(roadmap.focusDimensions.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < roadmap.focusDimensions.length; i++) {
      const prev = roadmap.focusDimensions[i - 1];
      const curr = roadmap.focusDimensions[i];
      expect(prev.missing / prev.max).toBeGreaterThanOrEqual(curr.missing / curr.max);
    }
  });
});

describe("buildRoadmap — recommendation quality", () => {
  const roadmap = roadmapFor(weakProfile, weakStats);
  const all = [...roadmap.quickWins, ...roadmap.shortTerm, ...roadmap.longTerm];

  it("gives every recommendation a complete, populated shape", () => {
    for (const r of all) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.why).toBeTruthy();
      expect(r.metric).toBeTruthy();
      expect(r.impact).toBeTruthy();
      expect(r.action).toBeTruthy();
      expect(r.example).toBeTruthy();
      expect(["quickWin", "shortTerm", "longTerm"]).toContain(r.tier);
    }
  });

  it("tags each recommendation with the tier list it appears in", () => {
    expect(roadmap.quickWins.every((r) => r.tier === "quickWin")).toBe(true);
    expect(roadmap.shortTerm.every((r) => r.tier === "shortTerm")).toBe(true);
    expect(roadmap.longTerm.every((r) => r.tier === "longTerm")).toBe(true);
  });

  it("uses unique ids so they are safe as list keys", () => {
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never promises an exact score increase", () => {
    for (const r of all) {
      const text = `${r.title} ${r.why} ${r.impact} ${r.action} ${r.example}`;
      expect(text).not.toMatch(/will (increase|gain|add|boost).{0,20}\d+\s*points?/i);
      expect(text).not.toMatch(/guarantee/i);
    }
  });

  it("describes impact as available headroom tied to a real dimension", () => {
    for (const r of all) {
      expect(r.impact).toMatch(/headroom|maxed out|Affects your overall score/);
    }
  });

  it("avoids generic filler advice", () => {
    for (const r of all) {
      const title = r.title.toLowerCase();
      expect(title).not.toBe("code more");
      expect(title).not.toBe("build projects");
      expect(title).not.toBe("get more followers");
      // Every title should be actionable and specific, not a bare platitude.
      expect(r.title.split(" ").length).toBeGreaterThan(2);
    }
  });
});

describe("buildRoadmap — strong profile", () => {
  const roadmap = roadmapFor(strongProfile, strongStats, {
    totalContributions: 4000,
    activeWeeks: 52,
    longestStreakDays: 300,
    estimated: false,
  });

  it("does not invent problems that the data does not support", () => {
    const ids = [...roadmap.quickWins, ...roadmap.shortTerm, ...roadmap.longTerm].map(
      (r) => r.id,
    );

    expect(ids).not.toContain("add-bio");
    expect(ids).not.toContain("add-website");
    expect(ids).not.toContain("profile-readme");
    expect(ids).not.toContain("add-descriptions");
    expect(ids).not.toContain("add-topics");
    expect(ids).not.toContain("add-license");
    expect(ids).not.toContain("resume-pushing");
    expect(ids).not.toContain("grow-impact");
    expect(ids).not.toContain("build-community");
    expect(ids).not.toContain("broaden-languages");
  });

  it("reports a strong profile when nothing is worth flagging", () => {
    expect(roadmap.count).toBe(0);
    expect(roadmap.isStrongProfile).toBe(true);
    expect(roadmap.focusDimensions.length).toBeLessThanOrEqual(3);
  });
});

describe("buildRoadmap — partial data", () => {
  it("skips repo-specific advice for a profile with no repositories", () => {
    const roadmap = roadmapFor(
      weakProfile,
      {
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
      },
    );

    const ids = [...roadmap.quickWins, ...roadmap.shortTerm, ...roadmap.longTerm].map(
      (r) => r.id,
    );

    // Nothing repo-derived can be claimed when there are no repositories.
    expect(ids).not.toContain("add-descriptions");
    expect(ids).not.toContain("add-topics");
    expect(ids).not.toContain("add-license");
    expect(ids).not.toContain("write-readmes");
    expect(ids).not.toContain("spread-activity");
    expect(ids).not.toContain("broaden-languages");
    expect(ids).not.toContain("resume-pushing");
    // Profile-level advice still applies.
    expect(ids).toContain("add-bio");
  });

  it("tolerates legacy stats missing the newer optional fields", () => {
    const legacyStats = {
      totalReposAnalyzed: 5,
      totalStars: 10,
      totalForks: 1,
      topLanguages: ["Python"],
      reposWithDescription: 5,
      reposWithoutDescription: 0,
      reposWithHomepage: 1,
      recentlyUpdatedRepos: 3,
      forkedRepos: 0,
      originalRepos: 5,
    } as GitHubStats;

    expect(() => roadmapFor(weakProfile, legacyStats)).not.toThrow();
    const roadmap = roadmapFor(weakProfile, legacyStats);
    expect(roadmap.count).toBeGreaterThan(0);
  });

  it("does not raise the stale-push item when the push date is unknown", () => {
    const roadmap = roadmapFor(weakProfile, { ...weakStats, daysSinceLastPush: null });
    const ids = roadmap.shortTerm.map((r) => r.id);
    expect(ids).not.toContain("resume-pushing");
  });
});
