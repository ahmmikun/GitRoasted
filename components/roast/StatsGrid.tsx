"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Star,
  GitFork,
  FolderGit2,
  Code2,
  FileText,
  Zap,
  Languages,
  Copy,
} from "lucide-react";
import type { GitHubStats } from "@/lib/types";

interface StatCellProps {
  value: number | string;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  accent?: string;
}

function StatCell({ value, label, tooltip, icon, accent = "var(--yellow)" }: StatCellProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div
          style={{
            background: "var(--surface-2)",
            border: "2px solid var(--border)",
            padding: "0.875rem 0.75rem",
            textAlign: "center",
            cursor: "default",
            transition: "transform 0.08s, box-shadow 0.08s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translate(-2px, -2px)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = `4px 4px 0px ${accent}`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "";
          }}
        >
          <div style={{ color: accent, marginBottom: "0.25rem", display: "flex", justifyContent: "center" }}>
            {icon}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1 }}>{value}</div>
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginTop: "0.25rem",
            }}
          >
            {label}
          </div>
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="TooltipContent" sideOffset={6}>
          {tooltip}
          <Tooltip.Arrow style={{ fill: "var(--yellow)" }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

interface StatsGridProps {
  stats: GitHubStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const cells: StatCellProps[] = [
    {
      value: stats.totalStars,
      label: "Stars",
      tooltip: "Total stars across all repos",
      icon: <Star size={16} strokeWidth={2.5} />,
      accent: "var(--yellow)",
    },
    {
      value: stats.totalForks,
      label: "Forks",
      tooltip: "Times your repos were forked",
      icon: <GitFork size={16} strokeWidth={2.5} />,
      accent: "var(--cyan)",
    },
    {
      value: stats.totalReposAnalyzed,
      label: "Repos",
      tooltip: "Public repositories analyzed",
      icon: <FolderGit2 size={16} strokeWidth={2.5} />,
      accent: "var(--green)",
    },
    {
      value: stats.originalRepos,
      label: "Original",
      tooltip: "Repos you actually wrote",
      icon: <Code2 size={16} strokeWidth={2.5} />,
      accent: "var(--green)",
    },
    {
      value: stats.forkedRepos,
      label: "Forked",
      tooltip: "Repos you borrowed from others",
      icon: <Copy size={16} strokeWidth={2.5} />,
      accent: "var(--orange)",
    },
    {
      value: stats.reposWithDescription,
      label: "Described",
      tooltip: "Repos with a description (rare)",
      icon: <FileText size={16} strokeWidth={2.5} />,
      accent: "var(--cyan)",
    },
    {
      value: stats.recentlyUpdatedRepos,
      label: "Active",
      tooltip: "Repos updated in the last 90 days",
      icon: <Zap size={16} strokeWidth={2.5} />,
      accent: "var(--yellow)",
    },
    {
      value: stats.topLanguages.length,
      label: "Languages",
      tooltip: stats.topLanguages.length
        ? `Top: ${stats.topLanguages.join(", ")}`
        : "No languages detected",
      icon: <Languages size={16} strokeWidth={2.5} />,
      accent: "var(--green)",
    },
  ];

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: "0",
          border: "3px solid var(--border)",
          boxShadow: "var(--shadow)",
        }}
      >
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            style={{
              borderRight: i % 4 !== 3 ? "2px solid var(--border)" : undefined,
              borderBottom: i < cells.length - 4 ? "2px solid var(--border)" : undefined,
            }}
          >
            <StatCell {...cell} />
          </div>
        ))}
      </div>

      {stats.topLanguages.length > 0 && (
        <p
          style={{
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <Languages size={13} />
          {stats.topLanguages.join(" · ")}
        </p>
      )}
    </Tooltip.Provider>
  );
}
