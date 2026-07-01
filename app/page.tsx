import { Flame, GitBranch, Zap } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import UsernameForm from "@/components/roast/UsernameForm";

function HeroFallback() {
  return (
    <div
      role="alert"
      style={{
        padding: "2rem",
        border: "3px solid #ff2d2d",
        boxShadow: "4px 4px 0px #ff2d2d",
        textAlign: "center",
        color: "#ff2d2d",
        fontWeight: 700,
      }}
    >
      Something went wrong. Please reload.
    </div>
  );
}

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        background: "var(--bg)",
      }}
    >
      {/* Decorative top stripe */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: "repeating-linear-gradient(90deg, var(--yellow) 0px, var(--yellow) 40px, #000 40px, #000 80px)",
          zIndex: 50,
        }}
      />

      <ErrorBoundary fallback={<HeroFallback />}>
        <section
          aria-label="Hero"
          style={{
            width: "100%",
            maxWidth: "640px",
            display: "flex",
            flexDirection: "column",
            gap: "0",
          }}
        >
          {/* Title block */}
          <div
            className="brut-card hero-card"
            style={{
              padding: "2.5rem 2rem 2rem",
              marginBottom: "0",
              borderBottom: "none",
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <GitBranch size={14} strokeWidth={2.5} color="var(--muted)" />
              <span className="brut-label" style={{ margin: 0 }}>
                AI-Powered · No Mercy
              </span>
            </div>

            {/* Main title */}
            <h1
              className="hero-title"
              style={{
                fontSize: "clamp(3rem, 10vw, 5.5rem)",
                fontWeight: 700,
                lineHeight: 0.9,
                letterSpacing: "-0.03em",
                marginBottom: "1.25rem",
              }}
            >
              GIT
              <span className="hero-title-accent">
                ROASTED
              </span>
            </h1>

            {/* Sub copy */}
            <p
              style={{
                fontSize: "1.05rem",
                color: "var(--muted)",
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              Enter a public GitHub username.{" "}
              <span style={{ color: "var(--text)" }}>Get brutally judged</span>{" "}
              by our AI overlords.
            </p>
          </div>

          {/* Divider with icon */}
          <div
            className="hero-divider"
            style={{
              background: "var(--yellow)",
              border: "3px solid var(--border)",
              borderTop: "none",
              borderBottom: "none",
              padding: "0.6rem 2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Flame size={16} color="#000" strokeWidth={2.5} />
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#000",
              }}
            >
              No feelings. Pure code.
            </span>
            <Zap size={16} color="#000" strokeWidth={2.5} style={{ marginLeft: "auto" }} />
          </div>

          {/* Form block */}
          <div
            className="brut-card hero-form-card"
            style={{
              padding: "2rem",
              borderTop: "none",
            }}
          >
            <UsernameForm />

            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1.5rem",
                borderTop: "2px solid #1a1a1a",
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap" as const,
              }}
            >
              {[
                ["🔥", "100% savage"],
                ["⚡", "AI-powered"],
                ["🔒", "Read-only access"],
              ].map(([icon, label]) => (
                <span
                  key={label}
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "var(--muted)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {icon} {label}
                </span>
              ))}
            </div>
          </div>
        </section>
      </ErrorBoundary>

      {/* Bottom stripe */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "repeating-linear-gradient(90deg, var(--red) 0px, var(--red) 40px, #000 40px, #000 80px)",
        }}
      />
    </main>
  );
}
