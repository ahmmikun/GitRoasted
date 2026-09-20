// Feature: gitroasted — Property and unit tests for the AI orchestrator.
// Covers tasks 6.5 (Property 8), 6.6 (Property 9), 6.7 (Property 10).

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateRoast } from "./index";
import { DEFAULT_ROAST, ruleBasedRoast } from "./fallback";
import { parseRoastOutput, roastOutputSchema } from "../validators";
import { analyzeProfile } from "../analyzer";
import type { AiProvider, GitHubProfile, GitHubStats, RoastOutput } from "../types";

const PROVIDER_NAMES = ["openrouter", "gemini", "openai", "grok"] as const;
type Outcome = "valid" | "invalid" | "throw";

const validRoastOutput: RoastOutput = {
  score: 65,
  grade: "C",
  title: "Average Dev",
  shortRoast: "Could be worse.",
  longRoast: "Somewhere in the middle of the pack.",
  strengths: ["Has repos"],
  weaknesses: ["No bio"],
  improvementTips: ["Write a bio"],
  shareCaption: "I got roasted!",
};

function makeMockProviders(outcomes: readonly Outcome[]): AiProvider[] {
  return PROVIDER_NAMES.map((name, i) => ({
    name,
    model: `mock-${name}`,
    async generate(): Promise<unknown> {
      const outcome = outcomes[i] ?? "throw";
      if (outcome === "throw") throw new Error(`${name} failed`);
      if (outcome === "invalid") return { not: "a valid roast" };
      return validRoastOutput;
    },
  }));
}

const outcomeArb = fc.constantFrom<Outcome>("valid", "invalid", "throw");
const fourOutcomesArb = fc.tuple(
  outcomeArb,
  outcomeArb,
  outcomeArb,
  outcomeArb,
);

const minimalProfile: GitHubProfile = {
  login: "tester",
  name: null,
  avatarUrl: "",
  bio: null,
  followers: 0,
  following: 0,
  publicRepos: 0,
  profileUrl: "",
  blog: null,
  company: null,
  location: null,
  createdAt: "2020-01-01T00:00:00Z",
};

const minimalStats: GitHubStats = {
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
};

const SUMMARY = "GitHub user: tester\nDeveloper score: 0/100";

// Feature: gitroasted, Property 8: AI fallback chain order and validity
describe("Property 8: AI fallback chain order and validity", () => {
  it("uses the first provider that returns a valid response", async () => {
    await fc.assert(
      fc.asyncProperty(fourOutcomesArb, async (outcomes) => {
        const providers = makeMockProviders(outcomes);
        const result = await generateRoast(
          SUMMARY,
          0,
          minimalProfile,
          minimalStats,
          providers,
        );

        const firstValidIdx = outcomes.findIndex((o) => o === "valid");

        if (firstValidIdx >= 0) {
          return result.aiMeta.providerUsed === PROVIDER_NAMES[firstValidIdx];
        }

        // No external provider succeeded — must be rule_based or default
        return result.aiMeta.fallbackUsed === true;
      }),
      { numRuns: 100 },
    );
  });

  it("skips providers whose response fails schema validation", async () => {
    // Make first 3 providers invalid, last one valid
    const providers = makeMockProviders(["invalid", "invalid", "invalid", "valid"]);
    const result = await generateRoast(SUMMARY, 0, minimalProfile, minimalStats, providers);
    expect(result.aiMeta.providerUsed).toBe("grok");
    expect(result.aiMeta.aiFailed).toBe(false);
    expect(result.aiMeta.fallbackUsed).toBe(false);
  });

  it("falls back to rule_based when all external providers throw", async () => {
    const providers = makeMockProviders(["throw", "throw", "throw", "throw"]);
    const result = await generateRoast(SUMMARY, 50, minimalProfile, minimalStats, providers);
    expect(result.aiMeta.fallbackUsed).toBe(true);
    expect(result.aiMeta.aiFailed).toBe(true);
  });
});

// Feature: gitroasted, Property 9: Generation always yields a valid roast
describe("Property 9: Generation always yields a valid roast", () => {
  it("produces a schema-valid RoastOutput even when all providers fail", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.constantFrom<Outcome>("invalid", "throw"),
          fc.constantFrom<Outcome>("invalid", "throw"),
          fc.constantFrom<Outcome>("invalid", "throw"),
          fc.constantFrom<Outcome>("invalid", "throw"),
        ),
        async (outcomes) => {
          const providers = makeMockProviders(outcomes);
          const result = await generateRoast(
            SUMMARY,
            0,
            minimalProfile,
            minimalStats,
            providers,
          );
          return parseRoastOutput(result.roast).ok === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("always produces a schema-valid roast for any outcome combination", async () => {
    await fc.assert(
      fc.asyncProperty(fourOutcomesArb, async (outcomes) => {
        const providers = makeMockProviders(outcomes);
        const result = await generateRoast(
          SUMMARY,
          0,
          minimalProfile,
          minimalStats,
          providers,
        );
        return parseRoastOutput(result.roast).ok === true;
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: gitroasted, Property 10: AI metadata reflects the producing path
describe("Property 10: AI metadata reflects the producing path", () => {
  it("sets aiFailed=false and fallbackUsed=false when an external provider succeeds", async () => {
    const providers = makeMockProviders(["valid", "invalid", "throw", "throw"]);
    const result = await generateRoast(SUMMARY, 0, minimalProfile, minimalStats, providers);
    expect(result.aiMeta.aiFailed).toBe(false);
    expect(result.aiMeta.fallbackUsed).toBe(false);
    expect(result.aiMeta.providerUsed).toBe("openrouter");
  });

  it("sets aiFailed=true and fallbackUsed=true when no external provider succeeds", async () => {
    const providers = makeMockProviders(["throw", "invalid", "throw", "invalid"]);
    const result = await generateRoast(SUMMARY, 0, minimalProfile, minimalStats, providers);
    expect(result.aiMeta.aiFailed).toBe(true);
    expect(result.aiMeta.fallbackUsed).toBe(true);
  });

  it("records the correct provider name for any winning provider", async () => {
    await fc.assert(
      fc.asyncProperty(fourOutcomesArb, async (outcomes) => {
        const providers = makeMockProviders(outcomes);
        const result = await generateRoast(
          SUMMARY,
          0,
          minimalProfile,
          minimalStats,
          providers,
        );

        const firstValidIdx = outcomes.findIndex((o) => o === "valid");
        if (firstValidIdx >= 0) {
          return (
            result.aiMeta.providerUsed === PROVIDER_NAMES[firstValidIdx] &&
            result.aiMeta.aiFailed === false &&
            result.aiMeta.fallbackUsed === false
          );
        }
        return (
          (result.aiMeta.providerUsed === "rule_based" ||
            result.aiMeta.providerUsed === "default") &&
          result.aiMeta.aiFailed === true &&
          result.aiMeta.fallbackUsed === true
        );
      }),
      { numRuns: 100 },
    );
  });
});

// Cross-cutting: orchestrator with real analyzer output
describe("generateRoast with analyzer output", () => {
  it("integrates with analyzeProfile to produce a valid roast", async () => {
    const profile: GitHubProfile = {
      login: "developer",
      name: "Dev Developer",
      avatarUrl: "https://example.com/avatar.png",
      bio: "I write code",
      followers: 25,
      following: 10,
      publicRepos: 8,
      profileUrl: "https://github.com/developer",
      blog: null,
      company: null,
      location: null,
      createdAt: "2018-01-01T00:00:00Z",
    };
    const { stats, score, summary } = analyzeProfile(profile, []);

    // All providers fail — should still produce a valid roast via rule-based
    const providers = makeMockProviders(["throw", "throw", "throw", "throw"]);
    const result = await generateRoast(summary, score, profile, stats, providers);

    expect(parseRoastOutput(result.roast).ok).toBe(true);
    expect(result.aiMeta.fallbackUsed).toBe(true);
  });
});

describe("fallback schema validation", () => {
  it("DEFAULT_ROAST satisfies roastOutputSchema", () => {
    expect(roastOutputSchema.safeParse(DEFAULT_ROAST).success).toBe(true);
  });

  it("ruleBasedRoast satisfies roastOutputSchema for a sparse profile", () => {
    const profile: GitHubProfile = {
      login: "nobody",
      name: null,
      avatarUrl: "",
      bio: null,
      followers: 0,
      following: 0,
      publicRepos: 0,
      profileUrl: "",
      blog: null,
      company: null,
      location: null,
      createdAt: "2020-01-01T00:00:00Z",
    };
    const stats: GitHubStats = {
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
    };
    expect(roastOutputSchema.safeParse(ruleBasedRoast(profile, stats, -5)).success).toBe(true);
    expect(roastOutputSchema.safeParse(ruleBasedRoast(profile, stats, 999)).success).toBe(true);
  });

  it("ruleBasedRoast satisfies roastOutputSchema for a rich profile", () => {
    const profile: GitHubProfile = {
      login: "dev",
      name: "Dev Eloper",
      avatarUrl: "",
      bio: "I code",
      followers: 100,
      following: 10,
      publicRepos: 20,
      profileUrl: "",
      blog: "x",
      company: "y",
      location: "z",
      createdAt: "2015-01-01T00:00:00Z",
    };
    const stats: GitHubStats = {
      totalReposAnalyzed: 20,
      totalStars: 500,
      totalForks: 50,
      topLanguages: ["TypeScript", "Go", "Rust"],
      reposWithDescription: 18,
      reposWithoutDescription: 2,
      reposWithHomepage: 5,
      recentlyUpdatedRepos: 8,
      forkedRepos: 3,
      originalRepos: 17,
    };
    expect(roastOutputSchema.safeParse(ruleBasedRoast(profile, stats, 85)).success).toBe(true);
  });
});

