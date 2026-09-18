/**
 * Seed the leaderboard with a curated set of well-known public developers.
 *
 * A brand-new deployment has an empty leaderboard, which makes the feature look
 * broken rather than simply unused. This script analyzes a short list of
 * prominent public accounts through the normal analysis service, so the seeded
 * rows are real measured data — never invented scores.
 *
 * Behaviour:
 *  - Sequential, with a pause between users, to stay friendly to GitHub's rate
 *    limit. Set GITHUB_TOKEN for a much higher ceiling.
 *  - Idempotent: the analysis service upserts by username, so re-running
 *    refreshes rows instead of duplicating them.
 *  - Fault tolerant: one failed user never aborts the run.
 *
 * Usage:
 *   npm run seed:leaderboard                       # seed the default list
 *   npm run seed:leaderboard -- --dry              # analyze but do not write
 *   npm run seed:leaderboard -- torvalds gaearon   # seed specific users
 */

import mongoose from "mongoose";
import { getProfileAnalysis } from "../lib/analysis-service";
import { validateUsername } from "../lib/validators";

/**
 * Curated seed accounts: widely known maintainers and the GitHub mascot.
 * Chosen for recognisability and a spread of scores, not as a ranking.
 */
export const SEED_USERNAMES: string[] = [
  "torvalds",
  "gaearon",
  "sindresorhus",
  "tj",
  "yyx990803",
  "octocat",
];

/** Delay between users, in milliseconds, to avoid bursting the API. */
const REQUEST_SPACING_MS = 1500;

export interface SeedOutcome {
  username: string;
  status: "seeded" | "failed" | "invalid";
  score?: number;
  grade?: string;
  reason?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Analyze and persist each username in order.
 *
 * @param usernames Logins to seed.
 * @param options   `dryRun` analyzes without writing; `spacingMs` overrides the
 *                  inter-request delay (tests pass 0).
 */
export async function seedLeaderboard(
  usernames: string[] = SEED_USERNAMES,
  options: { dryRun?: boolean; spacingMs?: number } = {},
): Promise<SeedOutcome[]> {
  const { dryRun = false, spacingMs = REQUEST_SPACING_MS } = options;
  const outcomes: SeedOutcome[] = [];

  for (let i = 0; i < usernames.length; i++) {
    const raw = usernames[i];
    const validation = validateUsername(raw);

    if (!validation.ok) {
      outcomes.push({ username: raw, status: "invalid", reason: validation.error });
      continue;
    }

    const username = validation.username;

    // `force` guarantees fresh data; `persist` is what actually seeds the board.
    const result = await getProfileAnalysis(username, {
      force: true,
      persist: !dryRun,
    });

    if (result.ok) {
      outcomes.push({
        username,
        status: "seeded",
        score: result.analysis.score,
        grade: result.analysis.grade,
      });
    } else {
      outcomes.push({ username, status: "failed", reason: result.message });
    }

    // Space out requests, but never sleep after the final user.
    if (spacingMs > 0 && i < usernames.length - 1) {
      await sleep(spacingMs);
    }
  }

  return outcomes;
}

/** CLI entry point. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry") || args.includes("--dry-run");
  const explicit = args.filter((arg) => !arg.startsWith("--"));
  const usernames = explicit.length > 0 ? explicit : SEED_USERNAMES;

  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "No GITHUB_TOKEN set — GitHub's unauthenticated rate limit is low and the\n" +
        "Consistency dimension will be estimated. Seeding will still work.\n",
    );
  }

  console.log(
    `${dryRun ? "[dry run] " : ""}Seeding ${usernames.length} developer(s): ${usernames.join(", ")}\n`,
  );

  try {
    const outcomes = await seedLeaderboard(usernames, { dryRun });

    for (const outcome of outcomes) {
      if (outcome.status === "seeded") {
        console.log(`  ✓ ${outcome.username} — ${outcome.score}/1000 (grade ${outcome.grade})`);
      } else {
        console.log(`  ✗ ${outcome.username} — ${outcome.status}: ${outcome.reason ?? "unknown"}`);
      }
    }

    const seeded = outcomes.filter((o) => o.status === "seeded").length;
    console.log(`\n${seeded}/${outcomes.length} developer(s) analyzed successfully.`);
    if (dryRun) console.log("Nothing was written (dry run).");
  } catch (error) {
    console.error(
      "\nSeeding failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

// Only run when executed directly, so tests can import the helpers.
const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].includes("seed-leaderboard");
if (invokedDirectly) {
  void main();
}
