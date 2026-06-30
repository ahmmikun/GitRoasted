import { describe, it, expect } from "vitest";
import { ruleBasedRoast, DEFAULT_ROAST } from "./fallback";
import { roastOutputSchema } from "../validators";
import type { GitHubProfile, GitHubStats } from "../types";

describe("fallback schema validation", () => {
  it("DEFAULT_ROAST satisfies roastOutputSchema", () => {
    expect(roastOutputSchema.safeParse(DEFAULT_ROAST).success).toBe(true);
  });

  it("ruleBasedRoast satisfies roastOutputSchema for a sparse profile", () => {
    const profile: GitHubProfile = {
      login: "nobody", name: null, avatarUrl: "", bio: null,
      followers: 0, following: 0, publicRepos: 0, profileUrl: "",
      blog: null, company: null, location: null, createdAt: "2020-01-01T00:00:00Z",
    };
    const stats: GitHubStats = {
      totalReposAnalyzed: 0, totalStars: 0, totalForks: 0, topLanguages: [],
      reposWithDescription: 0, reposWithoutDescription: 0, reposWithHomepage: 0,
      recentlyUpdatedRepos: 0, forkedRepos: 0, originalRepos: 0,
    };
    expect(roastOutputSchema.safeParse(ruleBasedRoast(profile, stats, -5)).success).toBe(true);
    expect(roastOutputSchema.safeParse(ruleBasedRoast(profile, stats, 999)).success).toBe(true);
  });

  it("ruleBasedRoast satisfies roastOutputSchema for a rich profile", () => {
    const profile: GitHubProfile = {
      login: "dev", name: "Dev Eloper", avatarUrl: "", bio: "I code",
      followers: 100, following: 10, publicRepos: 20, profileUrl: "",
      blog: "x", company: "y", location: "z", createdAt: "2015-01-01T00:00:00Z",
    };
    const stats: GitHubStats = {
      totalReposAnalyzed: 20, totalStars: 500, totalForks: 50,
      topLanguages: ["TypeScript", "Go", "Rust"],
      reposWithDescription: 18, reposWithoutDescription: 2, reposWithHomepage: 5,
      recentlyUpdatedRepos: 8, forkedRepos: 3, originalRepos: 17,
    };
    expect(roastOutputSchema.safeParse(ruleBasedRoast(profile, stats, 85)).success).toBe(true);
  });
});
