"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  Rocket,
  Search,
  Target,
  Zap,
} from "lucide-react";
import ScoreMeter from "@/components/score/ScoreMeter";
import { MAX_SCORE } from "@/lib/scoring";
import type { ImprovementRoadmap, Recommendation } from "@/lib/recommendations";
import type { DimensionScore } from "@/lib/types";
import { validateUsername } from "@/lib/validators";

interface ImproveData {
  username: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  score: number;
  grade: string;
  tier: string;
  breakdown: DimensionScore[];
  roadmap: ImprovementRoadmap;
}

/** One recommendation, rendered as a self-explaining card. */
function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <article className="imp-card">
      <h4 className="imp-card-title">{rec.title}</h4>

      <dl className="imp-card-body">
        <div>
          <dt>Why</dt>
          <dd>{rec.why}</dd>
        </div>
        <div>
          <dt>Affects</dt>
          <dd>
            <span className="imp-metric-tag">{rec.metric}</span>
          </dd>
        </div>
        <div>
          <dt>Expected impact</dt>
          <dd>{rec.impact}</dd>
        </div>
        <div>
          <dt>Do this</dt>
          <dd>{rec.action}</dd>
        </div>
        <div>
          <dt>Example</dt>
          <dd className="imp-example">{rec.example}</dd>
        </div>
      </dl>
    </article>
  );
}

/** A tier of the roadmap, hidden entirely when it has no items. */
function TierSection({
  title,
  blurb,
  icon,
  accent,
  items,
}: {
  title: string;
  blurb: string;
  icon: React.ReactNode;
  accent: string;
  items: Recommendation[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="imp-tier" aria-labelledby={`tier-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <header className="imp-tier-head" style={{ borderColor: accent }}>
        <h3
          id={`tier-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="imp-tier-title"
          style={{ color: accent }}
        >
          {icon}
          {title}
          <span className="imp-tier-count">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </h3>
        <p className="imp-tier-blurb">{blurb}</p>
      </header>

      <div className="imp-cards">
        {items.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>
    </section>
  );
}

export default function ImproveClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramUsername = searchParams.get("username") ?? "";

  const [input, setInput] = useState(paramUsername);
  const [data, setData] = useState<ImproveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevents refetching the same username on unrelated re-renders.
  const lastFetched = useRef<string>("");

  const load = useCallback(async (username: string) => {
    lastFetched.current = username.toLowerCase();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/improve?username=${encodeURIComponent(username)}`);
      const body = (await res.json()) as {
        success: boolean;
        data?: ImproveData;
        error?: { message: string };
      };

      if (!res.ok || !body.success || !body.data) {
        setData(null);
        setError(body.error?.message ?? "Could not build your roadmap. Please try again.");
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

  useEffect(() => {
    if (!paramUsername) {
      setData(null);
      lastFetched.current = "";
      return;
    }
    setInput(paramUsername);
    if (paramUsername.toLowerCase() === lastFetched.current) return;
    void load(paramUsername);
  }, [paramUsername, load]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateUsername(input);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    router.push(`/improve?username=${encodeURIComponent(validation.username)}`);
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="brut-label">
          <Target size={13} strokeWidth={2.5} aria-hidden="true" /> Personalised roadmap
        </p>
        <h1 className="page-title">How to improve</h1>
        <p className="page-sub">
          Enter a GitHub username to get specific, measured recommendations. Every item is
          derived from that profile&apos;s actual data — nothing generic, and no promises
          about exact score changes.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="imp-form">
        <label className="brut-label" htmlFor="imp-username">
          GitHub username
        </label>
        <div className="form-row">
          <input
            id="imp-username"
            className="brut-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. torvalds"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button type="submit" className="brut-btn" disabled={loading}>
            <Search size={16} strokeWidth={2.5} aria-hidden="true" />
            {loading ? "Analyzing…" : "Get roadmap"}
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
          <span className="sr-only">Building your roadmap…</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="lb-skeleton-row" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {!loading && !data && !error ? (
        <div className="lb-notice" role="status">
          <Lightbulb size={16} strokeWidth={2.5} aria-hidden="true" />
          <p>
            Enter a username above to see where the score is being lost and exactly what to
            do about it.
          </p>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <section className="imp-summary" aria-label="Current score">
            <div className="imp-summary-head">
              {data.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.avatarUrl}
                  alt={`${data.login}'s avatar`}
                  width={56}
                  height={56}
                  className="cmp-avatar"
                  loading="lazy"
                />
              ) : null}
              <div>
                <h2 className="imp-summary-name">@{data.login}</h2>
                <p className="imp-summary-score">
                  {data.score}
                  <span className="cmp-side-score-max"> / {MAX_SCORE}</span>
                  <span className="imp-summary-grade">
                    Grade {data.grade}
                    {data.tier ? ` · ${data.tier}` : ""}
                  </span>
                </p>
              </div>
              <a
                href={data.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="lb-link imp-summary-link"
                aria-label={`${data.login} on GitHub (opens in a new tab)`}
              >
                GitHub
                <ExternalLink size={12} strokeWidth={2.5} aria-hidden="true" />
              </a>
            </div>

            {data.roadmap.focusDimensions.length > 0 ? (
              <p className="imp-focus">
                Most available headroom:{" "}
                {data.roadmap.focusDimensions.map((d, i) => (
                  <span key={d.key}>
                    {i > 0 ? ", " : ""}
                    <strong>{d.label}</strong> ({d.missing} of {d.max} unearned)
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          <section className="imp-breakdown" aria-label="Score breakdown">
            <h2 className="brut-section-title">
              <Target size={14} strokeWidth={2.5} aria-hidden="true" />
              Score breakdown
            </h2>
            {data.breakdown.map((dimension) => (
              <ScoreMeter key={dimension.key} dimension={dimension} showDetail />
            ))}
          </section>

          {data.roadmap.isStrongProfile ? (
            <div className="imp-strong" role="status">
              <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" />
              <div>
                <h2>Nothing significant to flag</h2>
                <p>
                  Every signal we can measure from public GitHub data already looks strong
                  on this profile. Rather than invent filler advice, we will say plainly:
                  keep doing what you are doing.
                </p>
              </div>
            </div>
          ) : (
            <div className="imp-tiers">
              <TierSection
                title="Quick wins"
                blurb="Small changes you could finish today."
                icon={<Zap size={15} strokeWidth={2.5} aria-hidden="true" />}
                accent="var(--yellow)"
                items={data.roadmap.quickWins}
              />
              <TierSection
                title="Short term"
                blurb="Worth planning over the next few weeks."
                icon={<Target size={15} strokeWidth={2.5} aria-hidden="true" />}
                accent="var(--cyan)"
                items={data.roadmap.shortTerm}
              />
              <TierSection
                title="Long term"
                blurb="Sustained work that compounds over months."
                icon={<Rocket size={15} strokeWidth={2.5} aria-hidden="true" />}
                accent="var(--green)"
                items={data.roadmap.longTerm}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
