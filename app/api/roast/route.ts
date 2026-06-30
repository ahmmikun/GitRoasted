/**
 * POST /api/roast
 *
 * Orchestrates: validate → cache lookup → (on miss) rate-limit check →
 * GitHub data fetch → profile analysis → AI roast generation →
 * persistence with unique slug → respond with { slug, shareUrl }.
 *
 * Requirements: 2.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4, 5.3, 5.4, 5.5,
 *               9.1, 9.2, 9.3, 9.4
 */

import { NextRequest, NextResponse } from "next/server";
import { validateUsername } from "@/lib/validators";
import { findCachedRoast } from "@/lib/cache";
import { checkAndRecord } from "@/lib/rate-limit";
import { fetchGitHubData } from "@/lib/github";
import { analyzeProfile } from "@/lib/analyzer";
import { generateRoast } from "@/lib/ai";
import { generateSlug } from "@/lib/slug";
import { connectToDatabase } from "@/lib/db";
import { RoastModel } from "@/models/Roast";

const MAX_SLUG_RETRIES = 5;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

function errorResponse(
  code: "VALIDATION" | "RATE_LIMIT" | "NOT_FOUND" | "UPSTREAM" | "GENERATION",
  message: string,
  status: number,
) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export async function POST(request: NextRequest) {
  // 1. Parse and validate the username.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION", "Request body must be valid JSON.", 400);
  }

  const bodyObj = body as Record<string, unknown>;
  const validation = validateUsername(bodyObj?.username);
  if (!validation.ok) {
    return errorResponse("VALIDATION", validation.error, 400);
  }
  const { username } = validation;

  // 2. Cache lookup — a hit returns the existing share URL without AI or rate counting.
  try {
    const cached = await findCachedRoast(username);
    if (cached) {
      const shareUrl = `${getAppUrl()}/r/${cached.slug}`;
      return NextResponse.json({ success: true, slug: cached.slug, shareUrl });
    }
  } catch {
    // Cache miss or DB error — proceed to generation.
  }

  // 3. Rate limit (only on cache-miss paths).
  const ip = getClientIp(request);
  let rateResult: Awaited<ReturnType<typeof checkAndRecord>>;
  try {
    rateResult = await checkAndRecord(ip);
  } catch {
    // If rate-limit check fails, allow the request to proceed rather than block.
    rateResult = { allowed: true, remaining: 0 };
  }

  if (!rateResult.allowed) {
    return errorResponse(
      "RATE_LIMIT",
      `Too many roasts. Please try again in ${rateResult.retryAfterSeconds} second(s).`,
      429,
    );
  }

  // 4. Fetch GitHub data.
  const githubResult = await fetchGitHubData(username);
  if (!githubResult.ok) {
    if (githubResult.kind === "not_found") {
      return errorResponse("NOT_FOUND", githubResult.message, 404);
    }
    return errorResponse("UPSTREAM", githubResult.message, 502);
  }
  const { profile, repos } = githubResult;

  // 5. Analyze the profile.
  const { stats, score, summary } = analyzeProfile(profile, repos);

  // 6. Generate the roast.
  const { roast, aiMeta } = await generateRoast(summary, score, profile, stats);

  // 7. Persist the Roast_Record with a unique slug (bounded retries on collision).
  await connectToDatabase();
  const appUrl = getAppUrl();

  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = generateSlug(username);
    try {
      const record = await RoastModel.create({
        slug,
        username: username.toLowerCase(),
        githubProfile: profile,
        githubStats: stats,
        analysis: roast,
        aiMeta,
        publicStats: { views: 0, shares: 0 },
      });
      const shareUrl = `${appUrl}/r/${record.slug}`;
      return NextResponse.json({ success: true, slug: record.slug, shareUrl });
    } catch (err: unknown) {
      // MongoDB duplicate key error (unique index on slug).
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code: number }).code === 11000 &&
        attempt < MAX_SLUG_RETRIES - 1
      ) {
        continue;
      }
      break;
    }
  }

  return errorResponse(
    "GENERATION",
    "Failed to persist the roast. Please try again.",
    500,
  );
}
