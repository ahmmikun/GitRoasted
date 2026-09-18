"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  ExternalLink,
  GitCompare,
  Minus,
  RotateCcw,
  Trophy,
} from "lucide-react";
import type { ComparisonResult, ComparisonSide, Leader } from "@/lib/compare";
import { MAX_SCORE } from "@/lib/scoring";
import { validateUsername } from "@/lib/validators";

/** Accessible, colour-independent marker for which side leads a row. */
function LeaderBadge({ leader, side }: { leader: Leader; side: "a" | "b" }) {
  if (leader === "tie") {
    return (
      <span className="cmp-badge cmp-badge-tie">
        <Minus size={11} strokeWidth={3} aria-hidden="true" />
        Tie
      </span>
    );
  }
  if (leader !== side) return null;
  return (
    <span className="cmp-badge cmp-badge-lead">
      <Trophy size={11} strokeWidth={3} aria-hidden="true" />
      Higher
    </span>
  );
}

function SideCard({ side, label }: { side: ComparisonSide; label: string }) {
  return (
    <article className="cmp-side">
      <p className="brut-label">{label}</p>
      <div className="cmp-side-head">
        {side.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={side.avatarUrl}
            alt={`${side.login}'s avatar`}
            width={52}
            height={52}
            className="cmp-avatar"
            loading="lazy"
          />
        ) : null}
        <div className="cmp-side-names">
          <h2>@{side.login}</h2>
          {side.name ? <p>{side.name}</p> : null}
        </div>
      </div>

      <p className="cmp-side-score">
        {side.score}
        <span className="cmp-side-score-max"> / {MAX_SCORE}</span>
      </p>
      <p className="cmp-side-tier">
        Grade {side.grade}
        {side.tier ? ` · ${side.tier}` : ""}
      </p>

      {side.strengths.length > 0 ? (
        <div className="cmp-side-list">
          <h3>Strongest dimensions</h3>
          <ul>
            {side.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {side.improvementAreas.length > 0 ? (
        <div className="cmp-side-list">
          <h3>Biggest gaps</h3>
          <ul>
            {side.improvementAreas.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <a
        href={side.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="lb-link"
        aria-label={`${side.login} on GitHub (opens in a new tab)`}
      >
        View on GitHub
        <ExternalLink size={12} strokeWidth={2.5} aria-hidden="true" />
      </a>
    </article>
  );
}

export default function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramA = searchParams.get("a") ?? "";
  const paramB = searchParams.get("b") ?? "";

  const [inputA, setInputA] = useState(paramA);
  const [inputB, setInputB] = useState(paramB);
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last pair we fetched so re-renders never refetch the same data.
  const lastFetched = useRef<string>("");

  const runComparison = useCallback(async (a: string, b: string) => {
    const key = `${a.toLowerCase()}|${b.toLowerCase()}`;
    lastFetched.current = key;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ a, b });
      const res = await fetch(`/api/compare?${params.toString()}`);
      const body = (await res.json()) as {
        success: boolean;
        data?: ComparisonResult;
        error?: { message: string };
      };

      if (!res.ok || !body.success || !body.data) {
        setData(null);
        setError(body.error?.message ?? "Comparison failed. Please try again.");
      } else {
        setData(body.data);
      }
    } catch {
      setData(null);
      setError("Network problem — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Drive fetching from the URL so links are shareable and the back button works.
  useEffect(() => {
    if (!paramA || !paramB) {
      setData(null);
      lastFetched.current = "";
      return;
    }

    setInputA(paramA);
    setInputB(paramB);

    const key = `${paramA.toLowerCase()}|${paramB.toLowerCase()}`;
    if (key === lastFetched.current) return;

    void runComparison(paramA, paramB);
  }, [paramA, paramB, runComparison]);

  /** Push the pair into the URL; the effect above performs the fetch. */
  function navigateTo(a: string, b: string) {
    router.push(`/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validA = validateUsername(inputA);
    if (!validA.ok) {
      setError(`First username: ${validA.error}`);
      return;
    }
    const validB = validateUsername(inputB);
    if (!validB.ok) {
      setError(`Second username: ${validB.error}`);
      return;
    }
    if (validA.username.toLowerCase() === validB.username.toLowerCase()) {
      setError("Enter two different usernames to compare.");
      return;
    }

    setError(null);
    navigateTo(validA.username, validB.username);
  }

  function handleSwap() {
    const nextA = inputB;
    const nextB = inputA;
    setInputA(nextA);
    setInputB(nextB);
    if (data) navigateTo(nextA, nextB);
  }

  function handleReset() {
    setInputA("");
    setInputB("");
    setData(null);
    setError(null);
    lastFetched.current = "";
    router.push("/compare");
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="brut-label">
          <GitCompare size={13} strokeWidth={2.5} aria-hidden="true" /> Side-by-side analysis
        </p>
        <h1 className="page-title">Compare developers</h1>
        <p className="page-sub">
          Enter two GitHub usernames to see how their measured activity compares across
          every scoring dimension. This shows differences within these metrics only — it
          is not a judgement of anyone&apos;s ability.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="cmp-form">
        <div className="cmp-form-fields">
          <div className="cmp-field">
            <label className="brut-label" htmlFor="cmp-a">
              Developer A
            </label>
            <input
              id="cmp-a"
              className="brut-input"
              type="text"
              value={inputA}
              onChange={(e) => setInputA(e.target.value)}
              placeholder="e.g. octocat"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div className="cmp-field">
            <label className="brut-label" htmlFor="cmp-b">
              Developer B
            </label>
            <input
              id="cmp-b"
              className="brut-input"
              type="text"
              value={inputB}
              onChange={(e) => setInputB(e.target.value)}
              placeholder="e.g. torvalds"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="cmp-form-actions">
          <button type="submit" className="brut-btn" disabled={loading}>
            <GitCompare size={16} strokeWidth={2.5} aria-hidden="true" />
            {loading ? "Comparing…" : "Compare"}
          </button>
          <button
            type="button"
            className="brut-btn-ghost"
            onClick={handleSwap}
            disabled={loading || (!inputA && !inputB)}
          >
            <ArrowLeftRight size={16} strokeWidth={2.5} aria-hidden="true" />
            Swap
          </button>
          <button
            type="button"
            className="brut-btn-ghost"
            onClick={handleReset}
            disabled={loading || (!inputA && !inputB && !data)}
          >
            <RotateCcw size={16} strokeWidth={2.5} aria-hidden="true" />
            Reset
          </button>
        </div>
      </form>

      {error ? (
        <div className="lb-notice lb-notice-error" role="alert">
          <AlertTriangle size={16} strokeWidth={2.5} aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="lb-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Comparing developers…</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="lb-skeleton-row" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {!loading && !data && !error ? (
        <div className="lb-notice" role="status">
          <GitCompare size={16} strokeWidth={2.5} aria-hidden="true" />
          <p>
            Enter two usernames above to start. Results are shareable — the comparison is
            stored in the page URL.
          </p>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <section className="cmp-sides" aria-label="Developer profiles">
            <SideCard side={data.a} label="Developer A" />
            <SideCard side={data.b} label="Developer B" />
          </section>

          <section className="cmp-summary" aria-label="Score difference">
            <h2 className="brut-section-title">Score difference</h2>
            {data.scoreLeader === "tie" ? (
              <p className="cmp-summary-text">
                Both developers scored <strong>{data.a.score}</strong> / {MAX_SCORE} — an
                exact tie.
              </p>
            ) : (
              <p className="cmp-summary-text">
                <strong>
                  @{data.scoreLeader === "a" ? data.a.login : data.b.login}
                </strong>{" "}
                scores <strong>{data.scoreDifference}</strong> point
                {data.scoreDifference === 1 ? "" : "s"} higher (
                {data.scoreLeader === "a" ? data.a.score : data.b.score} vs{" "}
                {data.scoreLeader === "a" ? data.b.score : data.a.score} out of {MAX_SCORE}).
              </p>
            )}

            {data.decidingDimensions.length > 0 ? (
              <>
                <p className="cmp-summary-sub">
                  The gap comes mostly from these dimensions:
                </p>
                <ul className="cmp-deciding">
                  {data.decidingDimensions.slice(0, 3).map((d) => (
                    <li key={d.key}>
                      <span className="cmp-deciding-label">{d.label}</span>
                      <span className="cmp-deciding-value">
                        +{d.difference} for @{d.leader === "a" ? data.a.login : data.b.login}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="cmp-table-wrap" aria-label="Dimension comparison">
            <h2 className="brut-section-title">Score dimensions</h2>
            <table className="cmp-table">
              <caption className="sr-only">
                Per-dimension score comparison out of each dimension&apos;s maximum
              </caption>
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">@{data.a.login}</th>
                  <th scope="col">@{data.b.login}</th>
                  <th scope="col">Max</th>
                </tr>
              </thead>
              <tbody>
                {data.dimensions.map((d) => (
                  <tr key={d.key}>
                    <th scope="row">
                      <span className="cmp-dim-label">{d.label}</span>
                      <span className="cmp-dim-desc">{d.description}</span>
                    </th>
                    <td>
                      <span className="cmp-cell">
                        {d.a}
                        <LeaderBadge leader={d.leader} side="a" />
                      </span>
                      <span className="cmp-bar" aria-hidden="true">
                        <span
                          className="cmp-bar-fill"
                          style={{
                            width: `${d.max > 0 ? (d.a / d.max) * 100 : 0}%`,
                            background: "var(--cyan)",
                          }}
                        />
                      </span>
                    </td>
                    <td>
                      <span className="cmp-cell">
                        {d.b}
                        <LeaderBadge leader={d.leader} side="b" />
                      </span>
                      <span className="cmp-bar" aria-hidden="true">
                        <span
                          className="cmp-bar-fill"
                          style={{
                            width: `${d.max > 0 ? (d.b / d.max) * 100 : 0}%`,
                            background: "var(--yellow)",
                          }}
                        />
                      </span>
                    </td>
                    <td className="cmp-max">{d.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="cmp-table-wrap" aria-label="Metric comparison">
            <h2 className="brut-section-title">GitHub metrics</h2>
            <table className="cmp-table">
              <caption className="sr-only">
                Measured GitHub metrics for both developers
              </caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">@{data.a.login}</th>
                  <th scope="col">@{data.b.login}</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((m) => (
                  <tr key={m.key}>
                    <th scope="row">{m.label}</th>
                    <td>
                      <span className="cmp-cell">
                        {m.displayA ?? m.a.toLocaleString("en-US")}
                        <LeaderBadge leader={m.leader} side="a" />
                      </span>
                    </td>
                    <td>
                      <span className="cmp-cell">
                        {m.displayB ?? m.b.toLocaleString("en-US")}
                        <LeaderBadge leader={m.leader} side="b" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
