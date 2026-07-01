import {
  Flame,
  GitBranch,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Share2,
  Trophy,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import * as Separator from "@radix-ui/react-separator";
import type { GitHubProfile, GitHubStats, RoastOutput } from "@/lib/types";
import ShareButtons from "./ShareButtons";
import StatsGrid from "./StatsGrid";

export interface RoastData {
  slug: string;
  username: string;
  githubProfile: GitHubProfile;
  githubStats: GitHubStats;
  analysis: RoastOutput;
}

interface RoastResultProps {
  data: RoastData;
  shareUrl: string;
}

function gradeConfig(grade: string): { color: string; shadow: string; bg: string } {
  switch (grade) {
    case "S": return { color: "#ffe600", shadow: "4px 4px 0px #ffe600", bg: "rgba(255,230,0,0.08)" };
    case "A": return { color: "#00ff6a", shadow: "4px 4px 0px #00ff6a", bg: "rgba(0,255,106,0.08)" };
    case "B": return { color: "#00e5ff", shadow: "4px 4px 0px #00e5ff", bg: "rgba(0,229,255,0.08)" };
    case "C": return { color: "#ff8800", shadow: "4px 4px 0px #ff8800", bg: "rgba(255,136,0,0.08)" };
    case "D": return { color: "#ff5500", shadow: "4px 4px 0px #ff5500", bg: "rgba(255,85,0,0.08)" };
    default:  return { color: "#ff2d2d", shadow: "4px 4px 0px #ff2d2d", bg: "rgba(255,45,45,0.08)" };
  }
}

function SectionTitle({
  icon,
  label,
  color = "var(--text)",
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
}) {
  return (
    <div className="brut-section-title" style={{ color }}>
      {icon}
      <span>{label}</span>
      <div
        style={{
          flex: 1,
          height: "2px",
          background: color === "var(--text)" ? "var(--border)" : color,
          marginLeft: "0.5rem",
          opacity: 0.4,
        }}
      />
    </div>
  );
}

export default function RoastResult({ data, shareUrl }: RoastResultProps) {
  const { githubProfile: p, githubStats: stats, analysis: roast } = data;
  const grade = gradeConfig(roast.grade);

  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {/* Top stripe */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          height: "6px",
          background:
            "repeating-linear-gradient(90deg, var(--yellow) 0px, var(--yellow) 40px, #000 40px, #000 80px)",
          zIndex: 50,
        }}
      />

      {/* Back link */}
      <a
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.78rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginTop: "1rem",
        }}
      >
        ← New roast
      </a>

      {/* Profile header */}
      <div
        className="brut-card"
        style={{
          padding: "1.5rem",
          display: "flex",
          gap: "1.25rem",
          alignItems: "flex-start",
          flexWrap: "wrap" as const,
        }}
      >
        {p.avatarUrl && (
          <div style={{ flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.avatarUrl}
              alt={`${p.login}'s avatar`}
              width={80}
              height={80}
              style={{
                display: "block",
                border: "3px solid var(--border)",
                boxShadow: "4px 4px 0px var(--yellow)",
              }}
            />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <GitBranch size={14} color="var(--muted)" strokeWidth={2.5} />
            <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>
              github.com/{p.login}
            </span>
            <a
              href={p.profileUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="View on GitHub"
              style={{ color: "var(--muted)", display: "flex" }}
            >
              <ExternalLink size={12} />
            </a>
          </div>

          <h1
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              marginBottom: "0.3rem",
            }}
          >
            @{p.login}
          </h1>

          {p.name && (
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 500, marginBottom: "0.25rem" }}>
              {p.name}
            </p>
          )}
          {p.bio && (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic" }}>
              &ldquo;{p.bio}&rdquo;
            </p>
          )}
        </div>

        {/* Score + grade */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexShrink: 0 }}>
          <div
            style={{
              background: "var(--surface-2)",
              border: "3px solid var(--border)",
              boxShadow: grade.shadow,
              padding: "0.75rem 1rem",
              textAlign: "center",
              minWidth: "72px",
            }}
          >
            <div style={{ fontSize: "2.25rem", fontWeight: 700, lineHeight: 1, color: grade.color }}>
              {roast.score}
            </div>
            <div
              style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginTop: "2px",
              }}
            >
              / 100
            </div>
          </div>

          <div
            aria-label={`Grade ${roast.grade}`}
            style={{
              background: grade.bg,
              border: `3px solid ${grade.color}`,
              boxShadow: grade.shadow,
              padding: "0.5rem 0.75rem",
              fontSize: "2rem",
              fontWeight: 700,
              color: grade.color,
              lineHeight: 1,
            }}
          >
            {roast.grade}
          </div>
        </div>
      </div>

      {/* Roast card */}
      <div className="brut-card-red" style={{ padding: "1.5rem" }}>
        <SectionTitle
          icon={<Flame size={14} strokeWidth={2.5} />}
          label="Roast"
          color="var(--red)"
        />

        <h2
          style={{
            fontSize: "clamp(1.2rem, 3vw, 1.6rem)",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: "0.6rem",
            lineHeight: 1.15,
          }}
        >
          {roast.title}
        </h2>

        <p
          style={{
            fontStyle: "italic",
            fontSize: "1.05rem",
            color: "var(--orange)",
            fontWeight: 600,
            marginBottom: "1rem",
            lineHeight: 1.5,
          }}
        >
          {roast.shortRoast}
        </p>

        <Separator.Root
          className="brut-divider"
          style={{ marginBottom: "1rem", background: "rgba(255,45,45,0.3)" }}
        />

        <p style={{ color: "#c9d1d9", lineHeight: 1.75, fontSize: "0.95rem" }}>
          {roast.longRoast}
        </p>
      </div>

      {/* Stats */}
      <div>
        <SectionTitle
          icon={<Trophy size={14} strokeWidth={2.5} />}
          label="GitHub Stats"
        />
        <StatsGrid stats={stats} />
      </div>

      {/* Strengths + Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        {roast.strengths.length > 0 && (
          <div
            style={{
              border: "3px solid var(--green)",
              boxShadow: "4px 4px 0px var(--green)",
              background: "var(--surface)",
              padding: "1.25rem",
            }}
          >
            <SectionTitle
              icon={<CheckCircle2 size={14} strokeWidth={2.5} />}
              label="Strengths"
              color="var(--green)"
            />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {roast.strengths.map((s, i) => (
                <li key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  <CheckCircle2 size={14} color="var(--green)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: "3px" }} />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {roast.weaknesses.length > 0 && (
          <div
            style={{
              border: "3px solid var(--orange)",
              boxShadow: "4px 4px 0px var(--orange)",
              background: "var(--surface)",
              padding: "1.25rem",
            }}
          >
            <SectionTitle
              icon={<XCircle size={14} strokeWidth={2.5} />}
              label="Weaknesses"
              color="var(--orange)"
            />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {roast.weaknesses.map((w, i) => (
                <li key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  <XCircle size={14} color="var(--orange)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: "3px" }} />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tips */}
      {roast.improvementTips.length > 0 && (
        <div
          className="brut-card"
          style={{ padding: "1.25rem", borderColor: "var(--yellow)", boxShadow: "var(--shadow)" }}
        >
          <SectionTitle
            icon={<Lightbulb size={14} strokeWidth={2.5} />}
            label="How to be less terrible"
            color="var(--yellow)"
          />
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {roast.improvementTips.map((tip, i) => (
              <li key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.9rem", lineHeight: 1.5 }}>
                <Lightbulb size={14} color="var(--yellow)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: "3px" }} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Share */}
      <div className="brut-card" style={{ padding: "1.5rem", textAlign: "center" }}>
        <SectionTitle
          icon={<Share2 size={14} strokeWidth={2.5} />}
          label="Share your shame"
        />
        <p
          style={{
            fontStyle: "italic",
            color: "var(--muted)",
            fontSize: "0.95rem",
            marginBottom: "1.25rem",
            lineHeight: 1.5,
          }}
        >
          {roast.shareCaption}
        </p>
        <ShareButtons shareUrl={shareUrl} />
      </div>

      {/* CTA */}
      <div
        style={{
          background: "var(--yellow)",
          border: "3px solid var(--border)",
          boxShadow: "6px 6px 0px var(--border)",
          padding: "2rem 1.5rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <p
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#000",
            opacity: 0.6,
          }}
        >
          Think you can do better?
        </p>
        <h2
          style={{
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            fontWeight: 700,
            color: "#000",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Roast your own profile.
        </h2>
        <a
          href="/"
          className="brut-btn"
          style={{
            background: "#000",
            color: "var(--yellow)",
            borderColor: "#000",
            boxShadow: "4px 4px 0px rgba(0,0,0,0.3)",
            marginTop: "0.25rem",
          }}
        >
          Try it now
          <ArrowRight size={16} strokeWidth={2.5} />
        </a>
      </div>
    </div>
  );
}
