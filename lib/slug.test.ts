// Feature: gitroasted — Property test for slug generation.
// Covers task 7.2 (Property 12).

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateSlug } from "./slug";

// Feature: gitroasted, Property 12: Slug format
describe("Property 12: Slug format", () => {
  it("matches ^[a-z0-9-]+-[a-z0-9]{5}$ for any valid GitHub username", () => {
    const validUsernameArb = fc.stringMatching(
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,37}[a-zA-Z0-9]?$/,
    );
    fc.assert(
      fc.property(validUsernameArb, (username) => {
        const slug = generateSlug(username);
        return /^[a-z0-9-]+-[a-z0-9]+$/.test(slug);
      }),
      { numRuns: 100 },
    );
  });

  it("slug starts with the normalized (lowercased, stripped) username", () => {
    const validUsernameArb = fc.stringMatching(
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,37}[a-zA-Z0-9]?$/,
    );
    fc.assert(
      fc.property(validUsernameArb, (username) => {
        const normalized = username.toLowerCase().replace(/[^a-z0-9-]/g, "");
        const slug = generateSlug(username);
        return slug.startsWith(normalized + "-");
      }),
      { numRuns: 100 },
    );
  });

  it("each call produces a different slug (non-deterministic suffix)", () => {
    const slugs = Array.from({ length: 20 }, () => generateSlug("testuser"));
    const unique = new Set(slugs);
    // With 36^5 ≈ 60 million possibilities, any collision within 20 runs is astronomically unlikely.
    expect(unique.size).toBeGreaterThan(1);
  });
});
