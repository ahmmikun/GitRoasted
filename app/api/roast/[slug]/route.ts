/**
 * GET /api/roast/[slug]
 *
 * Returns the Roast_Record for the given slug, or 404 when none exists.
 *
 * Requirements: 10.1, 10.2
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RoastModel } from "@/models/Roast";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  await connectToDatabase();
  const record = await RoastModel.findOne({ slug }).lean();

  if (!record) {
    return NextResponse.json(
      { success: false, error: "Roast not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: record });
}
