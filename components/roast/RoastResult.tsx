import type { GitHubProfile, GitHubStats, RoastOutput } from "@/lib/types";
import ShareButtons from "./ShareButtons";

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

function gradeColor(grade: string): string {
  if (["S", "A"].includes(grade)) return "#3fb950";
  if (grade === "B") return "#58a6ff";
  if (grade === "C") return "#d29922";
  if (grade === "D") return "#db6d28";
  return "#f85149";
}

const s = {
  page: {
    maxWidth: "780px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2rem",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
    flexWrap: "wrap" as const,
  },
  avatar: {
    width: "88px",
    height: "88px",
    borderRadius: "50%",
    border: "2px solid #30363d",
  },
  headerInfo: { flex: 1 },
  username: { fontSize: "1.5rem", fontWeight: 700, margin: 0 },
  subline: { color: "#8b949e", fontSize: "0.9rem", marginTop: "0.25rem" },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap" as const,
  },
  scoreCircle: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "#161b22",
    border: "3px solid #30363d",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1 },
  scoreLabel: { fontSize: "0.6rem", color: "#8b949e", marginTop: "2px" },
  gradeBadge: {
    fontSize: "1.5rem",
    fontWeight: 800,
    padding: "0.25rem 0.75rem",
    background: "#161b22",
    border: "2px solid #30363d",
    borderRadius: "6px",
  },
  card: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "8px",
    padding: "1.25rem 1.5rem",
  },
  cardTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#8b949e",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "0.75rem",
  },
  title: { fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" },
  shortRoast: {
    fontStyle: "italic" as const,
    fontSize: "1.05rem",
    color: "#f0883e",
    marginBottom: "1rem",
  },
  longRoast: { color: "#c9d1d9", lineHeight: 1.7 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "0.75rem",
  },
  stat: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "6px",
    padding: "0.75rem",
    textAlign: "center" as const,
  },
  statNum: { fontSize: "1.4rem", fontWeight: 700 },
  statLabel: { fontSize: "0.75rem", color: "#8b949e", marginTop: "2px" },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  listItem: { display: "flex", gap: "0.5rem", alignItems: "flex-start" },
  bullet: { flexShrink: 0, fontSize: "0.8rem", marginTop: "3px" },
};

/**
 * RoastResult — presentational component that renders all fields of a roast record.
 *
 * Receives data as props so it can be rendered by server components (result page)
 * and tested independently with React Testing Library.
 *
 * Requirements: 10.1, 10.3
 */
export default function RoastResult({ data, shareUrl }: RoastResultProps) {
  const { githubProfile: profile, githubStats: stats, analysis: roast } = data;
  const grade = roast.grade;

  return (
    <div style={s.page}>
      {/* Profile header */}
      <header style={s.header}>
        {profile.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={`${profile.login}'s avatar`}
            style={s.avatar}
          />
        )}
        <div style={s.headerInfo}>
          <h1 style={s.username}>
            <a
              href={profile.profileUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              @{profile.login}
            </a>
          </h1>
          {profile.name && (
            <p style={s.subline}>{profile.name}</p>
          )}
          <div style={{ ...s.scoreRow, marginTop: "0.75rem" }}>
            <div style={s.scoreCircle}>
              <span style={s.scoreNum}>{roast.score}</span>
              <span style={s.scoreLabel}>/ 100</span>
            </div>
            <span
              style={{
                ...s.gradeBadge,
                color: gradeColor(grade),
                borderColor: gradeColor(grade),
              }}
              aria-label={`Grade ${grade}`}
            >
              {grade}
            </span>
          </div>
        </div>
      </header>

      {/* Roast content */}
      <section style={s.card} aria-label="Roast">
        <p style={s.cardTitle}>Roast</p>
        <h2 style={s.title}>{roast.title}</h2>
        <p style={s.shortRoast}>{roast.shortRoast}</p>
        <p style={s.longRoast}>{roast.longRoast}</p>
      </section>

      {/* GitHub stats grid */}
      <section aria-label="GitHub stats">
        <p style={{ ...s.cardTitle, marginBottom: "0.75rem" }}>GitHub stats</p>
        <div style={s.statsGrid}>
          <div style={s.stat}>
            <div style={s.statNum}>{stats.totalStars}</div>
            <div style={s.statLabel}>Stars</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{stats.totalForks}</div>
            <div style={s.statLabel}>Forks</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{stats.totalReposAnalyzed}</div>
            <div style={s.statLabel}>Repos</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{stats.originalRepos}</div>
            <div style={s.statLabel}>Original</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{stats.forkedRepos}</div>
            <div style={s.statLabel}>Forked</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{stats.reposWithDescription}</div>
            <div style={s.statLabel}>Described</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{stats.recentlyUpdatedRepos}</div>
            <div style={s.statLabel}>Active (90d)</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{stats.topLanguages.length}</div>
            <div style={s.statLabel}>Languages</div>
          </div>
        </div>
        {stats.topLanguages.length > 0 && (
          <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#8b949e" }}>
            Top languages: {stats.topLanguages.join(", ")}
          </p>
        )}
      </section>

      {/* Strengths */}
      {roast.strengths.length > 0 && (
        <section style={s.card} aria-label="Strengths">
          <p style={s.cardTitle}>Strengths</p>
          <ul style={s.list}>
            {roast.strengths.map((s, i) => (
              <li key={i} style={{ display: "flex", gap: "0.5rem" }}>
                <span>✅</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Weaknesses */}
      {roast.weaknesses.length > 0 && (
        <section style={s.card} aria-label="Weaknesses">
          <p style={s.cardTitle}>Weaknesses</p>
          <ul style={s.list}>
            {roast.weaknesses.map((w, i) => (
              <li key={i} style={{ display: "flex", gap: "0.5rem" }}>
                <span>⚠️</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Improvement tips */}
      {roast.improvementTips.length > 0 && (
        <section style={s.card} aria-label="Improvement tips">
          <p style={s.cardTitle}>Improvement tips</p>
          <ul style={s.list}>
            {roast.improvementTips.map((tip, i) => (
              <li key={i} style={{ display: "flex", gap: "0.5rem" }}>
                <span>💡</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Share section */}
      <section style={{ ...s.card, textAlign: "center" }} aria-label="Share">
        <p style={s.cardTitle}>Share your roast</p>
        <p style={{ marginBottom: "1rem", fontStyle: "italic", color: "#c9d1d9" }}>
          {roast.shareCaption}
        </p>
        <ShareButtons shareUrl={shareUrl} />
      </section>
    </div>
  );
}
