import type { Metadata } from "next";
import { Suspense } from "react";
import ImproveClient from "@/components/improve/ImproveClient";

export const metadata: Metadata = {
  title: "How to Improve Your GitHub Profile",
  description:
    "Get specific, data-driven recommendations to improve your GitHub profile, grouped into quick wins, short-term work, and long-term goals.",
  alternates: { canonical: "/improve" },
  openGraph: {
    title: "How to Improve Your GitHub Profile",
    description:
      "A practical roadmap built from your measured GitHub activity — quick wins, short term, and long term.",
    url: "/improve",
  },
};

/**
 * Improve page. Reads the target username from the query string, so the
 * interactive part is wrapped in Suspense as `useSearchParams` requires.
 */
export default function ImproveRoute() {
  return (
    <main>
      <Suspense
        fallback={
          <div className="page-wrap">
            <p className="page-sub">Loading roadmap…</p>
          </div>
        }
      >
        <ImproveClient />
      </Suspense>
    </main>
  );
}
