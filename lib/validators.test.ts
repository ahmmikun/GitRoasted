// Feature: gitroasted — Property-based and boundary tests for validators.
// Covers tasks 2.2 (Property 1), 2.3 (Property 11), 2.4 (boundary unit tests).

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateUsername,
  parseRoastOutput,
  GITHUB_USERNAME_REGEX,
} from "./validators";
import type { RoastOutput } from "./types";

const validRoast: RoastOutput = {
  score: 50,
  grade: "C",
  title: "Test Title",
  shortRoast: "Short roast.",
  longRoast: "Longer roast text here.",
  strengths: ["Strength one"],
  weaknesses: ["Weakness one"],
  improvementTips: ["Tip one"],
  shareCaption: "Share this roast!",
};

// Feature: gitroasted, Property 1: Username validation matches the GitHub rule
describe("Property 1: Username validation matches the GitHub rule", () => {
  it("accepts iff trimmed form is non-empty, ≤39 chars, and matches the regex", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = validateUsername(input);
        const trimmed = typeof input === "string" ? input.trim() : "";
        const expectedOk =
          trimmed.length >= 1 &&
          trimmed.length <= 39 &&
          GITHUB_USERNAME_REGEX.test(trimmed);
        return result.ok === expectedOk;
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: gitroasted, Property 11: Out-of-range scores are rejected
describe("Property 11: Out-of-range scores are rejected", () => {
  it("rejects scores below 0", () => {
    fc.assert(
      fc.property(fc.integer({ max: -1 }), (score) => {
        return parseRoastOutput({ ...validRoast, score }).ok === false;
      }),
      { numRuns: 100 },
    );
  });

  it("rejects scores above 100", () => {
    fc.assert(
      fc.property(fc.integer({ min: 101 }), (score) => {
        return parseRoastOutput({ ...validRoast, score }).ok === false;
      }),
      { numRuns: 100 },
    );
  });

  it("accepts any integer score in [0, 100]", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
        return parseRoastOutput({ ...validRoast, score }).ok === true;
      }),
      { numRuns: 100 },
    );
  });
});

// Task 2.4: Explicit boundary unit tests for the username validator
describe("validateUsername — boundary and error cases", () => {
  it("accepts a 39-character username (maximum)", () => {
    // 39 alphanumeric chars: valid
    expect(validateUsername("a".repeat(39)).ok).toBe(true);
  });

  it("rejects a 40-character username (over maximum)", () => {
    expect(validateUsername("a".repeat(40)).ok).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateUsername("").ok).toBe(false);
  });

  it("rejects a whitespace-only string", () => {
    expect(validateUsername("   ").ok).toBe(false);
  });

  it("rejects a username starting with a hyphen", () => {
    expect(validateUsername("-username").ok).toBe(false);
  });

  it("rejects a username ending with a hyphen", () => {
    expect(validateUsername("username-").ok).toBe(false);
  });

  it("rejects a username with an @ symbol", () => {
    expect(validateUsername("user@name").ok).toBe(false);
  });

  it("rejects a username with a space", () => {
    expect(validateUsername("user name").ok).toBe(false);
  });

  it("rejects a username with a dot", () => {
    expect(validateUsername("user.name").ok).toBe(false);
  });

  it("accepts a single-character username", () => {
    expect(validateUsername("a").ok).toBe(true);
  });

  it("accepts a username with hyphens in the middle", () => {
    expect(validateUsername("user-name-123").ok).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateUsername("  validuser  ").ok).toBe(true);
  });

  it("returns the trimmed username on success", () => {
    const result = validateUsername("  hello  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.username).toBe("hello");
  });
});

describe("parseRoastOutput", () => {
  it("accepts a fully valid roast object", () => {
    expect(parseRoastOutput(validRoast).ok).toBe(true);
  });

  it("rejects when required fields are missing", () => {
    const { title: _t, ...withoutTitle } = validRoast;
    expect(parseRoastOutput(withoutTitle).ok).toBe(false);
  });

  it("rejects when score is not an integer", () => {
    expect(parseRoastOutput({ ...validRoast, score: 50.5 }).ok).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(parseRoastOutput(null).ok).toBe(false);
    expect(parseRoastOutput("string").ok).toBe(false);
    expect(parseRoastOutput(42).ok).toBe(false);
  });
});
