import { describe, it, expect } from "vitest";
import fc from "fast-check";

// Scaffold smoke test: confirms the Vitest + fast-check toolchain runs.
// Real tests are added by subsequent tasks and can replace this file.
describe("scaffold toolchain", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("runs a fast-check property", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 },
    );
  });
});
