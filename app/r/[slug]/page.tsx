import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { RoastModel } from "@/models/Roast";
import RoastResult from "@/components/roast/RoastResult";
import type { RoastData } from "@/components/roast/RoastResult";

export const dynamic = "force-dynamic";

/**
 * Result page — server component that fetches a Roast_Record by slug and
 * renders the full roast. Displays a not-found view when the slug has no
 * record. Viewable without authentication.
 *
 * Requirements: 10.1, 10.2, 10.3
 */
export default async function ResultPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  await connectToDatabase();
  const record = await RoastModel.findOne({ slug }).lean();

  if (!record) {
    notFound();
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shareUrl = `${appUrl}/r/${slug}`;

  const data: RoastData = {
    slug: record.slug,
    username: record.username,
    githubProfile: record.githubProfile as RoastData["githubProfile"],
    githubStats: record.githubStats as RoastData["githubStats"],
    analysis: record.analysis as RoastData["analysis"],
  };

  return <RoastResult data={data} shareUrl={shareUrl} />;
}
