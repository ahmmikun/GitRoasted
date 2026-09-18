/**
 * GET /api/leaderboard
 *
 * Returns one ranked page of analyzed developers, highest Developer_Score
 * first. Supports `?page=`, `?pageSize=`, and a `?q=` username/name search.
 *
 * Read-only and public: the response contains only public GitHub profile data
 * that is already visible on github.com. No authentication is required, and no
 * secrets or internal fields are ever projected.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLeaderboardPage } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const result = await getLeaderboardPage({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch {
    // Never surface a raw database error to the client.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "LEADERBOARD_UNAVAILABLE",
          message: "The leaderboard is temporarily unavailable. Please try again shortly.",
        },
      },
      { status: 503 },
    );
  }
}
