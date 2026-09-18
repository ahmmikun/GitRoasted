import type { Metadata } from "next";
import { Suspense } from "react";
import CompareClient from "@/components/compare/CompareClient";

export const metadata: Metadata = {
  title: "Compare GitHub Developers",
  description:
    "Compare two GitHub developers side by side across impact, consistency, quality, community, diversity, experience, and activity.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Compare GitHub Developers",
    description: "See how two GitHub developers compare across eight scoring dimensions.",
    url: "/compare",
  },
};

/**
 * Compare page. The interactive form reads its state from the query string, so
 * it is wrapped in Suspense as required for `useSearchParams`.
 */
export default function CompareRoute() {
  return (
    <main>
      <Suspense
        fallback={
          <div className="page-wrap">
            <p className="page-sub">Loading comparison…</p>
          </div>
        }
      >
        <CompareClient />
      </Suspense>
    </main>
  );
}
