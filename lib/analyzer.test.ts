// Feature: gitroasted — Property tests for the profile analyzer.
// Covers tasks 4.2 (Property 4), 4.3 (Property 5), 4.4 (Property 6).

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { analyzeProfile } from "./analyzer";
import type { GitHubProfile, GitHubRepo } from "./types";

/** A fixed, minimal profile for the deterministic (non-property) tests. */
const baseProfile: GitHubProfile = {
  login: "fixture",
  name: null,
  avatarUrl: "https://example.com/avatar.png",
  bio: null,
  followers: 0,
  following: 0,
  publicRepos: 0,
  profileUrl: "https://github.com/fixture",
  blog: null,
  company: null,
  location: null,
  createdAt: "2020-01-01T00:00:00Z",
};

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
  it("score is always an integer in the inclusive range [0, 1000]", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { score } = analyzeProfile(profile, repos, NOW);
        return Number.isInteger(score) && score >= 0 && score <= 1000;
      }),
      { numRuns: 100 },
    );
  });

  it("score always equals the sum of the dimension breakdown", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { score, breakdown } = analyzeProfile(profile, repos, NOW);
        return (
          breakdown.length === 8 &&
          breakdown.reduce((sum, d) => sum + d.score, 0) === score
        );
      }),
      { numRuns: 100 },
    );
  });

  it("always reports a tier and grade consistent with the score", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { score, tier, grade } = analyzeProfile(profile, repos, NOW);
        return score >= tier.min && grade === tier.grade && grade.length > 0;
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

  it("summary embeds the per-dimension breakdown for the AI prompt", () => {
    fc.assert(
      fc.property(profileArb, reposArb, (profile, repos) => {
        const { summary, breakdown } = analyzeProfile(profile, repos, NOW);
        return (
          summary.includes("Score breakdown:") &&
          breakdown.every((d) => summary.includes(`${d.label}: ${d.score}/${d.max}`))
        );
      }),
      { numRuns: 50 },
    );
  });
});

// The analyzer must compute the extra stat fields the scorer depends on.
describe("extended statistics for the scoring engine", () => {
  it("counts distinct languages beyond the top-5 display cap", () => {
    const repos: GitHubRepo[] = [
      "TypeScript",
      "Rust",
      "Go",
      "Python",
      "C",
      "Ruby",
      "Elixir",
    ].map((language, i) => ({
      name: `repo-${i}`,
      description: null,
      language,
      stargazersCount: 0,
      forksCount: 0,
      fork: false,
      homepage: null,
      pushedAt: "2024-12-01T00:00:00Z",
    }));

    const { stats } = analyzeProfile(baseProfile, repos, NOW);
    expect(stats.topLanguages).toHaveLength(5);
    expect(stats.distinctLanguages).toBe(7);
  });

  it("counts licenses, topics, READMEs and the top repo's stars", () => {
    const repos: GitHubRepo[] = [
      {
        name: "a",
        description: "described",
        language: "TypeScript",
        stargazersCount: 120,
        forksCount: 4,
        fork: false,
        homepage: "https://example.com",
        pushedAt: "2024-12-20T00:00:00Z",
        license: "MIT",
        topics: ["cli", "tooling"],
        readmeExcerpt: "A helpful readme",
      },
      {
        name: "b",
        description: null,
        language: "Rust",
        stargazersCount: 3,
        forksCount: 0,
        fork: false,
        homepage: null,
        pushedAt: "2024-11-01T00:00:00Z",
        license: null,
        topics: [],
      },
    ];

    const { stats } = analyzeProfile(baseProfile, repos, NOW);
    expect(stats.reposWithLicense).toBe(1);
    expect(stats.reposWithTopics).toBe(1);
    expect(stats.reposWithReadme).toBe(1);
    expect(stats.maxRepoStars).toBe(120);
  });

  it("computes days since the most recent push, and null when unknown", () => {
    const repos: GitHubRepo[] = [
      {
        name: "old",
        description: null,
        language: null,
        stargazersCount: 0,
        forksCount: 0,
        fork: false,
        homepage: null,
        pushedAt: "2024-01-01T00:00:00Z",
      },
      {
        name: "new",
        description: null,
        language: null,
        stargazersCount: 0,
        forksCount: 0,
        fork: false,
        homepage: null,
        // Exactly 10 days before NOW (2025-01-01).
        pushedAt: "2024-12-22T00:00:00Z",
      },
    ];

    expect(analyzeProfile(baseProfile, repos, NOW).stats.daysSinceLastPush).toBe(10);
    expect(analyzeProfile(baseProfile, [], NOW).stats.daysSinceLastPush).toBeNull();
  });

  it("uses contribution data for the Consistency dimension when supplied", () => {
    const withData = analyzeProfile(baseProfile, [], NOW, {
      totalContributions: 1500,
      activeWeeks: 52,
      longestStreakDays: 100,
      estimated: false,
    });
    const withoutData = analyzeProfile(baseProfile, [], NOW, null);

    const consistencyWith = withData.breakdown.find((d) => d.key === "consistency")!;
    const consistencyWithout = withoutData.breakdown.find((d) => d.key === "consistency")!;

    expect(consistencyWith.score).toBeGreaterThan(consistencyWithout.score);
    expect(consistencyWith.detail).toContain("1,500");
  });

  it("accurately counts all 27 described repositories and produces zero undescribed repos", () => {
    const repos27: GitHubRepo[] = Array.from({ length: 27 }, (_, i) => ({
      name: `project-${i + 1}`,
      description: `Valid description for project ${i + 1}`,
      hasDescription: true,
      language: "TypeScript",
      stargazersCount: 5,
      forksCount: 1,
      fork: false,
      homepage: `https://example.com/project-${i + 1}`,
      hasHomepage: true,
      pushedAt: "2024-12-01T00:00:00Z",
      hasReadme: true,
      hasLicense: true,
      licenseName: "MIT",
      topics: ["typescript", "cli"],
      hasTopics: true,
    }));

    const result = analyzeProfile(baseProfile, repos27, NOW);
    expect(result.stats.totalReposAnalyzed).toBe(27);
    expect(result.stats.reposWithDescription).toBe(27);
    expect(result.stats.reposWithoutDescription).toBe(0);
    expect(result.stats.undescribedRepoNames).toHaveLength(0);
    expect(result.stats.unlicensedRepoNames).toHaveLength(0);
    expect(result.stats.untaggedRepoNames).toHaveLength(0);
    expect(result.stats.repoAuditIssues).toHaveLength(0);
  });

  it("produces a detailed RepoAuditIssue with detected metadata, missing fields, evidence, and fix", () => {
    const repos: GitHubRepo[] = [
      {
        name: "flawed-repo",
        description: "Has description",
        hasDescription: true,
        language: "Rust",
        stargazersCount: 10,
        forksCount: 2,
        fork: false,
        homepage: null,
        hasHomepage: false,
        pushedAt: "2024-12-01T00:00:00Z",
        hasReadme: false,
        hasLicense: false,
        topics: ["rust"],
        hasTopics: true,
      },
    ];

    const result = analyzeProfile(baseProfile, repos, NOW);
    expect(result.stats.repoAuditIssues).toHaveLength(1);

    const issue = result.stats.repoAuditIssues![0];
    expect(issue.repoName).toBe("flawed-repo");
    expect(issue.missing).toContain("license");
    expect(issue.missing).toContain("readme");
    expect(issue.missing).toContain("homepage");
    expect(issue.missing).not.toContain("description");
    expect(issue.missing).not.toContain("topics");

    expect(issue.detected.hasDescription).toBe(true);
    expect(issue.detected.hasTopics).toBe(true);
    expect(issue.detected.hasLicense).toBe(false);
    expect(issue.detected.hasReadme).toBe(false);

    expect(issue.evidence).toContain("GitHub API metadata");
    expect(issue.recommendedFix).toContain("flawed-repo");
  });
});
