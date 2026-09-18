import type { Metadata } from "next";
import LeaderboardClient from "@/components/leaderboard/LeaderboardClient";
import { getLeaderboardPage, type LeaderboardPage } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GitHub Developer Leaderboard",
  description:
    "See how analyzed GitHub developers rank by Developer Score out of 1000, across impact, consistency, quality, community, and more.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "GitHub Developer Leaderboard",
    description: "Ranked GitHub developers scored out of 1000.",
    url: "/leaderboard",
  },
};

/**
 * Leaderboard page. The first page is rendered on the server so the ranking is
 * visible immediately and indexable; search and pagination then run client-side.
 */
export default async function LeaderboardRoute() {
  let initialData: LeaderboardPage | null = null;

  try {
    initialData = await getLeaderboardPage({ page: 1 });
  } catch {
    // Render the client shell, which shows a friendly error with a retry action.
    initialData = null;
  }

  return (
    <main>
      <LeaderboardClient initialData={initialData} />
    </main>
  );
}
