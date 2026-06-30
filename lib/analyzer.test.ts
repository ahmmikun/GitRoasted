// Feature: gitroasted — Property tests for the profile analyzer.
// Covers tasks 4.2 (Property 4), 4.3 (Property 5), 4.4 (Property 6).

import { describe, it } from "vitest";
import fc from "fast-check";
import { analyzeProfile } from "./analyzer";
import type { GitHubProfile, GitHubRepo } from "./types";

// Arbitrary for a GitHubProfile — only login is required to match the GitHub rule.
const profileArb: fc.Arbitrary<GitHubProfile> = fc.record({
  login: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,18}$/),
  name: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 })),
  avatarUrl: fc.constant("https://example.com/avatar.png"),
  bio: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 200 })),
  followers: fc.nat({ max: 50000 }),
  following: fc.nat({ max: 5000 }),
  publicRepos: fc.nat({ max: 500 }),
  profileUrl: fc.constant("https://github.com/user"),
  blog: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
  company: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
  location: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
  createdAt: fc.constant("2020-01-01T00:00:00Z"),
});

// Arbitrary for a single GitHubRepo.
const repoArb: fc.Arbitrary<GitHubRepo> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 40 }),
  description: fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 100 }),
  ),
  language: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 30 })),
  stargazersCount: fc.nat({ max: 5000 }),
  forksCount: fc.nat({ max: 1000 }),
  fork: fc.boolean(),
  homepage: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
  pushedAt: fc.constant("2020-01-01T00:00:00Z"),
});

const reposArb = fc.array(repoArb, { maxLength: 50 });

// A fixed "now" so recent-activity counting is deterministic within each run.
const NOW = new Date("2025-01-01T00:00:00Z").getTime();

// Feature: gitroasted, Property 4: Analyzer aggregation is consistent
describe("Property 4: Analyzer aggregation is consistent", () => {
  it("totalStars equals sum of stargazersCount across repos", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { stats } = analyzeProfile(profile, repos, NOW);
        const expected = repos.reduce((s, r) => s + r.stargazersCount, 0);
        return stats.totalStars === expected;
      }),
      { numRuns: 100 },
    );
  });

  it("totalForks equals sum of forksCount across repos", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { stats } = analyzeProfile(profile, repos, NOW);
        const expected = repos.reduce((s, r) => s + r.forksCount, 0);
        return stats.totalForks === expected;
      }),
      { numRuns: 100 },
    );
  });

  it("reposWithDescription + reposWithoutDescription === totalReposAnalyzed", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { stats } = analyzeProfile(profile, repos, NOW);
        return (
          stats.reposWithDescription + stats.reposWithoutDescription ===
          stats.totalReposAnalyzed
        );
      }),
      { numRuns: 100 },
    );
  });

  it("originalRepos + forkedRepos === totalReposAnalyzed", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { stats } = analyzeProfile(profile, repos, NOW);
        return stats.originalRepos + stats.forkedRepos === stats.totalReposAnalyzed;
      }),
      { numRuns: 100 },
    );
  });

  it("empty repo list yields 0 for every repo-derived statistic (not omitted)", () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const { stats } = analyzeProfile(profile, [], NOW);
        return (
          stats.totalReposAnalyzed === 0 &&
          stats.totalStars === 0 &&
          stats.totalForks === 0 &&
          stats.reposWithDescription === 0 &&
          stats.reposWithoutDescription === 0 &&
          stats.reposWithHomepage === 0 &&
          stats.recentlyUpdatedRepos === 0 &&
          stats.forkedRepos === 0 &&
          stats.originalRepos === 0 &&
          Array.isArray(stats.topLanguages) &&
          stats.topLanguages.length === 0
        );
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: gitroasted, Property 5: Developer score is a bounded integer
describe("Property 5: Developer score is a bounded integer", () => {
  it("score is always an integer in the inclusive range [0, 100]", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { score } = analyzeProfile(profile, repos, NOW);
        return Number.isInteger(score) && score >= 0 && score <= 100;
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: gitroasted, Property 6: Analyzer produces a usable summary
describe("Property 6: Analyzer produces a usable summary", () => {
  it("summary is a non-empty string containing the username and score", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { summary, score } = analyzeProfile(profile, repos, NOW);
        return (
          typeof summary === "string" &&
          summary.trim().length > 0 &&
          summary.includes(profile.login) &&
          summary.includes(String(score))
        );
      }),
      { numRuns: 100 },
    );
  });
});
