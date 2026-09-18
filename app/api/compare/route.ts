/**
 * GET /api/compare?a=<username>&b=<username>
 *
 * Analyzes two developers and returns a factual, metric-by-metric comparison.
 *
 * Both analyses run through the shared analysis service, so a recently analyzed
 * profile is reused from its snapshot instead of hitting GitHub again. The two
 * lookups run in parallel. No AI is involved — the comparison is deterministic.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProfileAnalysis, type ProfileAnalysis } from "@/lib/analysis-service";
import { compareDevelopers, type ComparisonInput } from "@/lib/compare";
import { validateUsername } from "@/lib/validators";

export const dynamic = "force-dynamic";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** Map an analysis onto the fields the comparison needs. */
function toComparisonInput(analysis: ProfileAnalysis): ComparisonInput {
  const { profile, stats } = analysis;
  return {
    username: analysis.username,
    login: profile.login || analysis.username,
    name: profile.name ?? null,
    avatarUrl: profile.avatarUrl ?? "",
    profileUrl: profile.profileUrl || `https://github.com/${analysis.username}`,
    score: analysis.score,
    grade: analysis.grade,
    tier: analysis.tier.label,
    breakdown: analysis.breakdown,
    followers: profile.followers ?? 0,
    following: profile.following ?? 0,
    publicRepos: profile.publicRepos ?? 0,
    totalStars: stats.totalStars ?? 0,
    totalForks: stats.totalForks ?? 0,
    totalRepos: stats.totalReposAnalyzed ?? 0,
    // Fall back to the capped list for snapshots saved before this field existed.
    distinctLanguages: stats.distinctLanguages ?? stats.topLanguages?.length ?? 0,
    topLanguages: stats.topLanguages ?? [],
    recentlyUpdatedRepos: stats.recentlyUpdatedRepos ?? 0,
    accountCreatedAt: profile.createdAt ?? "",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawA = searchParams.get("a");
  const rawB = searchParams.get("b");

  const validationA = validateUsername(rawA);
  if (!validationA.ok) {
    return errorResponse("VALIDATION", `First username: ${validationA.error}`, 400);
  }

  const validationB = validateUsername(rawB);
  if (!validationB.ok) {
    return errorResponse("VALIDATION", `Second username: ${validationB.error}`, 400);
  }

  const usernameA = validationA.username;
  const usernameB = validationB.username;

  if (usernameA.toLowerCase() === usernameB.toLowerCase()) {
    return errorResponse(
      "VALIDATION",
      "Enter two different usernames to compare.",
      400,
    );
  }

  // Both sides in parallel; each reuses a fresh snapshot when one exists.
  const [resultA, resultB] = await Promise.all([
    getProfileAnalysis(usernameA),
    getProfileAnalysis(usernameB),
  ]);

  // Report a missing profile precisely so the UI can name the offending input.
  for (const [result, username] of [
    [resultA, usernameA],
    [resultB, usernameB],
  ] as const) {
    if (!result.ok) {
      if (result.kind === "not_found") {
        return errorResponse(
          "NOT_FOUND",
          `We could not find a GitHub user called "${username}". Check the spelling — the account may have been renamed or deleted.`,
          404,
        );
      }
      return errorResponse(
        "UPSTREAM",
        "GitHub could not be reached right now (it may be rate limiting us). Please try again in a moment.",
        502,
      );
    }
  }

  // Both are ok at this point; narrow for TypeScript.
  if (!resultA.ok || !resultB.ok) {
    return errorResponse("UPSTREAM", "Comparison failed. Please try again.", 502);
  }

  const comparison = compareDevelopers(
    toComparisonInput(resultA.analysis),
    toComparisonInput(resultB.analysis),
  );

  return NextResponse.json({ success: true, data: comparison });
}
