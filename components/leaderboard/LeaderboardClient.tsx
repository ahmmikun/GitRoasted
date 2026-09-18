"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Crown,
  ExternalLink,
  Medal,
  Search,
  Star,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type { LeaderboardEntry, LeaderboardPage } from "@/lib/leaderboard";
import { MAX_SCORE } from "@/lib/scoring";

/** Colour + icon treatment for the top three positions. */
function podiumStyle(rank: number): { accent: string; icon: React.ReactNode; label: string } {
  if (rank === 1) {
    return {
      accent: "var(--yellow)",
      icon: <Crown size={16} strokeWidth={2.5} aria-hidden="true" />,
      label: "1st place",
    };
  }
  if (rank === 2) {
    return {
      accent: "var(--cyan)",
      icon: <Medal size={16} strokeWidth={2.5} aria-hidden="true" />,
      label: "2nd place",
    };
  }
  return {
    accent: "var(--orange)",
    icon: <Medal size={16} strokeWidth={2.5} aria-hidden="true" />,
    label: "3rd place",
  };
}

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const { accent, icon, label } = podiumStyle(entry.rank);

  return (
    <article
      className="lb-podium-card"
      style={{ borderColor: accent, boxShadow: `6px 6px 0px ${accent}` }}
    >
      <header className="lb-podium-rank" style={{ color: accent }}>
        {icon}
        <span>{label}</span>
      </header>

      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.avatarUrl}
          alt={`${entry.login}'s avatar`}
          width={64}
          height={64}
          className="lb-avatar"
          style={{ boxShadow: `3px 3px 0px ${accent}` }}
          loading="lazy"
        />
      ) : null}

      <h3 className="lb-podium-name">@{entry.login}</h3>
      {entry.name ? <p className="lb-podium-fullname">{entry.name}</p> : null}

      <p className="lb-podium-score" style={{ color: accent }}>
        {entry.score}
        <span className="lb-podium-score-max"> / {MAX_SCORE}</span>
      </p>
      <p className="lb-podium-tier">
        Grade {entry.grade}
        {entry.tier ? ` · ${entry.tier}` : ""}
      </p>

      <dl className="lb-podium-meta">
        <div>
          <dt>Stars</dt>
          <dd>{entry.totalStars.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Followers</dt>
          <dd>{entry.followers.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd>{entry.primaryLanguage ?? "—"}</dd>
        </div>
      </dl>

      <div className="lb-podium-actions">
        <Link href={`/improve?username=${encodeURIComponent(entry.username)}`} className="lb-link">
          View analysis
          <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <a
          href={entry.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="lb-link"
          aria-label={`${entry.login} on GitHub (opens in a new tab)`}
        >
          GitHub
          <ExternalLink size={13} strokeWidth={2.5} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

/** Skeleton rows shown while a page is loading. */
function LoadingState() {
  return (
    <div className="lb-skeleton" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading leaderboard…</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="lb-skeleton-row" aria-hidden="true" />
      ))}
    </div>
  );
}

export default function LeaderboardClient({ initialData }: { initialData: LeaderboardPage | null }) {
  const [data, setData] = useState<LeaderboardPage | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialData ? null : "The leaderboard is temporarily unavailable. Please try again shortly.",
  );
  const [searchInput, setSearchInput] = useState(initialData?.query ?? "");
  const [activeQuery, setActiveQuery] = useState(initialData?.query ?? "");
  const [page, setPage] = useState(initialData?.page ?? 1);

  // Skip the first fetch: the server already rendered page 1.
  const isFirstRender = useRef(true);

  const load = useCallback(async (nextPage: number, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (query) params.set("q", query);

      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      const body = (await res.json()) as {
        success: boolean;
        data?: LeaderboardPage;
        error?: { message: string };
      };

      if (!res.ok || !body.success || !body.data) {
        setError(body.error?.message ?? "Could not load the leaderboard. Please try again.");
      } else {
        setData(body.data);
      }
    } catch {
      setError("Network problem — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void load(page, activeQuery);
  }, [page, activeQuery, load]);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setActiveQuery(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setPage(1);
    setActiveQuery("");
  }

  const entries = data?.entries ?? [];
  const podium = useMemo(
    () => (data && data.page === 1 && !data.query ? entries.slice(0, 3) : []),
    [data, entries],
  );
  const listed = podium.length > 0 ? entries.slice(3) : entries;

  const hasNoDataAtAll = data !== null && data.totalDevelopers === 0;
  const hasNoMatches = data !== null && data.total === 0 && data.totalDevelopers > 0;

  return (
    <div className="lb-wrap">
      <header className="lb-header">
        <p className="brut-label">
          <Trophy size={13} strokeWidth={2.5} aria-hidden="true" /> Ranked by Developer Score
        </p>
        <h1 className="lb-title">Leaderboard</h1>
        <p className="lb-sub">
          Every developer analyzed with GitRoasted, ranked out of {MAX_SCORE}. Analyze a
          profile to add it to the board.
        </p>
      </header>

      <form onSubmit={handleSearch} className="lb-search" role="search">
        <label className="brut-label" htmlFor="lb-search-input">
          Search developers
        </label>
        <div className="lb-search-row">
          <input
            id="lb-search-input"
            className="brut-input"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by username or name"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="brut-btn" disabled={loading}>
            <Search size={16} strokeWidth={2.5} aria-hidden="true" />
            Search
          </button>
          {activeQuery ? (
            <button type="button" className="brut-btn-ghost" onClick={clearSearch}>
              <X size={16} strokeWidth={2.5} aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>
        {activeQuery ? (
          <p className="lb-search-status" role="status">
            Showing matches for &ldquo;{activeQuery}&rdquo;
            {data ? ` — ${data.total} developer(s)` : ""}
          </p>
        ) : null}
      </form>

      {error ? (
        <div className="lb-notice lb-notice-error" role="alert">
          <AlertTriangle size={16} strokeWidth={2.5} aria-hidden="true" />
          <div>
            <p>{error}</p>
            <button
              type="button"
              className="brut-btn-ghost lb-retry"
              onClick={() => void load(page, activeQuery)}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <LoadingState /> : null}

      {!loading && !error && hasNoDataAtAll ? (
        <div className="lb-notice" role="status">
          <Users size={16} strokeWidth={2.5} aria-hidden="true" />
          <div>
            <p>
              <strong>No developers analyzed yet.</strong> The leaderboard fills up as
              profiles are analyzed — there are no placeholder rankings here.
            </p>
            <Link href="/" className="brut-btn lb-cta">
              Analyze the first profile
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && !error && hasNoMatches ? (
        <div className="lb-notice" role="status">
          <Search size={16} strokeWidth={2.5} aria-hidden="true" />
          <div>
            <p>
              No developer matches &ldquo;{activeQuery}&rdquo;. They may not have been
              analyzed yet.
            </p>
            <Link href="/" className="brut-btn lb-cta">
              Analyze this profile
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && !error && podium.length > 0 ? (
        <section aria-label="Top three developers" className="lb-podium">
          {podium.map((entry) => (
            <PodiumCard key={entry.username} entry={entry} />
          ))}
        </section>
      ) : null}

      {!loading && !error && listed.length > 0 ? (
        <section aria-label="Developer rankings" className="lb-table-wrap">
          <table className="lb-table">
            <caption className="sr-only">
              Developers ranked by Developer Score, highest first
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Developer</th>
                <th scope="col">Score</th>
                <th scope="col" className="lb-col-optional">
                  Grade
                </th>
                <th scope="col" className="lb-col-optional">
                  Language
                </th>
                <th scope="col" className="lb-col-optional">
                  Stars
                </th>
                <th scope="col">Links</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((entry) => (
                <tr key={entry.username}>
                  <td className="lb-rank">{entry.rank}</td>
                  <td>
                    <div className="lb-dev">
                      {entry.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.avatarUrl}
                          alt={`${entry.login}'s avatar`}
                          width={32}
                          height={32}
                          className="lb-avatar-sm"
                          loading="lazy"
                        />
                      ) : null}
                      <span className="lb-dev-names">
                        <span className="lb-dev-login">@{entry.login}</span>
                        {entry.name ? (
                          <span className="lb-dev-fullname">{entry.name}</span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="lb-score">
                    {entry.score}
                    <span className="lb-score-max"> / {MAX_SCORE}</span>
                  </td>
                  <td className="lb-col-optional">{entry.grade}</td>
                  <td className="lb-col-optional">{entry.primaryLanguage ?? "—"}</td>
                  <td className="lb-col-optional">
                    <span className="lb-stars">
                      <Star size={12} strokeWidth={2.5} aria-hidden="true" />
                      {entry.totalStars.toLocaleString("en-US")}
                    </span>
                  </td>
                  <td>
                    <div className="lb-row-actions">
                      <Link
                        href={`/improve?username=${encodeURIComponent(entry.username)}`}
                        className="lb-link"
                      >
                        Analysis
                      </Link>
                      <a
                        href={entry.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lb-link"
                        aria-label={`${entry.login} on GitHub (opens in a new tab)`}
                      >
                        GitHub
                        <ExternalLink size={12} strokeWidth={2.5} aria-hidden="true" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {!loading && !error && data && data.totalPages > 1 ? (
        <nav className="lb-pagination" aria-label="Leaderboard pages">
          <button
            type="button"
            className="brut-btn-ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={data.page <= 1}
          >
            Previous
          </button>
          <p aria-live="polite">
            Page {data.page} of {data.totalPages}
          </p>
          <button
            type="button"
            className="brut-btn-ghost"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={data.page >= data.totalPages}
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
