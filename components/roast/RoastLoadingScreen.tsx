"use client";

import { useEffect, useState } from "react";
import { Search, FolderGit2, BookOpen, Trophy, Brain, Flame, Skull } from "lucide-react";

interface Step {
  icon: React.ReactNode;
  label: string;
  durationMs: number;
}

const STEPS: Step[] = [
  { icon: <Search size={16} strokeWidth={2.5} />,     label: "Fetching GitHub profile…",       durationMs: 2500 },
  { icon: <FolderGit2 size={16} strokeWidth={2.5} />, label: "Scanning repositories…",         durationMs: 2500 },
  { icon: <BookOpen size={16} strokeWidth={2.5} />,   label: "Reading README files…",           durationMs: 2500 },
  { icon: <Trophy size={16} strokeWidth={2.5} />,     label: "Computing shame score…",          durationMs: 2000 },
  { icon: <Brain size={16} strokeWidth={2.5} />,      label: "Consulting AI overlords…",        durationMs: 3000 },
  { icon: <Flame size={16} strokeWidth={2.5} />,      label: "Crafting the perfect insult…",   durationMs: 3000 },
  { icon: <Skull size={16} strokeWidth={2.5} />,      label: "This developer… wow.",            durationMs: Infinity },
];

const PROGRESS_PER_STEP = 90 / (STEPS.length - 1); // spread 0→90% across first N-1 steps

interface Props {
  username: string;
}

export default function RoastLoadingScreen({ username }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let stepIndex = 0;
    let cancelled = false;

    function advance() {
      if (cancelled || stepIndex >= STEPS.length - 1) return;
      const current = STEPS[stepIndex];
      if (current.durationMs === Infinity) return;
      setTimeout(() => {
        if (cancelled) return;
        stepIndex += 1;
        setActiveStep(stepIndex);
        setProgress(Math.min(90, Math.round(stepIndex * PROGRESS_PER_STEP)));
        advance();
      }, current.durationMs);
    }

    advance();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "480px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "0",
      }}
    >
      {/* Header strip */}
      <div
        style={{
          background: "var(--yellow)",
          border: "3px solid var(--border)",
          borderBottom: "none",
          padding: "0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Flame size={14} color="#000" strokeWidth={2.5} />
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#000",
          }}
        >
          Roasting
        </span>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "#000",
            marginLeft: "0.25rem",
          }}
        >
          @{username}
        </span>
      </div>

      {/* Main card */}
      <div
        className="brut-card"
        style={{ padding: "1.5rem", borderTop: "none" }}
      >
        {/* Progress bar */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <span className="brut-label" style={{ margin: 0 }}>Progress</span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--yellow)",
              }}
            >
              {progress}%
            </span>
          </div>
          <div
            style={{
              height: "16px",
              background: "var(--surface-2)",
              border: "3px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--yellow)",
                transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>

        {/* Step list */}
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {STEPS.map((step, i) => {
            const isPast   = i < activeStep;
            const isActive = i === activeStep;
            const isFuture = i > activeStep;

            return (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  opacity: isFuture ? 0.3 : 1,
                  transition: "opacity 0.3s ease",
                }}
              >
                {/* Icon circle */}
                <div
                  style={{
                    flexShrink: 0,
                    width: "28px",
                    height: "28px",
                    border: `2px solid ${isActive ? "var(--yellow)" : isPast ? "var(--green)" : "var(--border)"}`,
                    background: isActive ? "rgba(255,230,0,0.1)" : isPast ? "rgba(0,255,106,0.08)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isActive ? "var(--yellow)" : isPast ? "var(--green)" : "var(--muted)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {step.icon}
                </div>

                <span
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--text)" : isPast ? "var(--muted)" : "var(--muted)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {step.label}
                </span>

                {/* Active pulse dot */}
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--yellow)",
                      flexShrink: 0,
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                )}

                {/* Done check */}
                {isPast && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.7rem",
                      color: "var(--green)",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  );
}
