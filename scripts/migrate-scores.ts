/**
 * One-time migration: rescale legacy Developer_Scores from 0–100 to 0–1000.
 *
 * Roasts persisted before the scoring redesign stored `analysis.score` on the
 * old 0–100 scale. Their underlying repository data is not re-fetchable here,
 * so each legacy score is multiplied by 10 and its grade recomputed from the
 * shared tier bands. This keeps historical results readable and correctly
 * ordered alongside newly scored profiles.
 *
 * Idempotency: a record is only migrated when it carries the legacy marker
 * (`scoreScale` absent AND `analysis.score` <= 100). After migration each
 * record is stamped with `scoreScale: 1000`, so re-running the script is a
 * no-op. Scores that are already above 100 are stamped without being changed.
 *
 * Usage:
 *   npm run migrate:scores            # apply the migration
 *   npm run migrate:scores -- --dry   # report what would change, write nothing
 *
 * Requires MONGODB_URI. This rewrites stored data — back up or run against a
 * development database first.
 */

import { connectToDatabase } from "../lib/db";
import { MAX_SCORE, tierForScore } from "../lib/scoring";
import { RoastModel } from "../models/Roast";
import mongoose from "mongoose";

/** Legacy maximum score. Anything at or below this may need rescaling. */
const LEGACY_MAX_SCORE = 100;

/** Factor mapping the legacy scale onto the current one. */
const SCALE_FACTOR = MAX_SCORE / LEGACY_MAX_SCORE;

interface MigrationSummary {
  scanned: number;
  rescaled: number;
  alreadyCurrent: number;
  skipped: number;
}

/**
 * Rescale a legacy score onto the 0–1000 range.
 * Exported for testing.
 */
export function rescaleLegacyScore(score: number): number {
  if (!Number.isFinite(score) || score < 0) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.round(score * SCALE_FACTOR)));
}

/**
 * Decide what should happen to a single record.
 * Pure so the decision logic can be property-tested without a database.
 */
export function planRecordMigration(record: {
  scoreScale?: number;
  analysis?: { score?: number };
}): { action: "rescale"; score: number; grade: string } | { action: "stamp" } | { action: "skip" } {
  // Already migrated — nothing to do.
  if (record.scoreScale === MAX_SCORE) return { action: "skip" };

  const score = record.analysis?.score;
  if (typeof score !== "number" || !Number.isFinite(score)) return { action: "skip" };

  // Scores above the legacy ceiling are already on the new scale; just stamp them.
  if (score > LEGACY_MAX_SCORE) return { action: "stamp" };

  const rescaled = rescaleLegacyScore(score);
  return { action: "rescale", score: rescaled, grade: tierForScore(rescaled).grade };
}

/** Run the migration. Returns a summary of what happened. */
export async function migrateScores(dryRun = false): Promise<MigrationSummary> {
  await connectToDatabase();

  const summary: MigrationSummary = {
    scanned: 0,
    rescaled: 0,
    alreadyCurrent: 0,
    skipped: 0,
  };

  // `scoreScale` is not part of the schema, so read raw documents.
  const cursor = RoastModel.collection.find({});

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    summary.scanned += 1;

    const plan = planRecordMigration(
      doc as unknown as { scoreScale?: number; analysis?: { score?: number } },
    );

    if (plan.action === "skip") {
      summary.skipped += 1;
      continue;
    }

    if (plan.action === "stamp") {
      summary.alreadyCurrent += 1;
      if (!dryRun) {
        await RoastModel.collection.updateOne(
          { _id: doc._id },
          { $set: { scoreScale: MAX_SCORE } },
        );
      }
      continue;
    }

    summary.rescaled += 1;
    if (!dryRun) {
      await RoastModel.collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            "analysis.score": plan.score,
            "analysis.grade": plan.grade,
            scoreScale: MAX_SCORE,
          },
        },
      );
    }
  }

  return summary;
}

/** CLI entry point. */
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry") || process.argv.includes("--dry-run");

  console.log(
    dryRun
      ? "Running score migration in DRY RUN mode — no documents will be written."
      : "Running score migration (0–100 → 0–1000).",
  );

  try {
    const summary = await migrateScores(dryRun);
    console.log("\nMigration summary");
    console.log(`  Records scanned:        ${summary.scanned}`);
    console.log(`  Rescaled to /1000:      ${summary.rescaled}`);
    console.log(`  Already on /1000:       ${summary.alreadyCurrent}`);
    console.log(`  Skipped (no score/done):${summary.skipped}`);
    if (dryRun) console.log("\nNothing was written (dry run).");
  } catch (error) {
    console.error(
      "\nMigration failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

// Only run when executed directly, so tests can import the pure helpers.
const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].includes("migrate-scores");
if (invokedDirectly) {
  void main();
}
