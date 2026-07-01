import Link from "next/link";
import { Flame, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "var(--bg)",
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
            "repeating-linear-gradient(90deg, var(--red) 0px, var(--red) 40px, #000 40px, #000 80px)",
        }}
      />

      <div
        style={{
          border: "3px solid var(--red)",
          boxShadow: "6px 6px 0px var(--red)",
          background: "var(--surface)",
          padding: "3rem 2.5rem",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            background: "var(--red)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            marginBottom: "1.25rem",
            border: "3px solid var(--border)",
          }}
        >
          <Flame size={28} color="#000" strokeWidth={2.5} />
        </div>

        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            marginBottom: "0.75rem",
          }}
        >
          404
        </h1>

        <p
          style={{
            fontWeight: 700,
            fontSize: "1.1rem",
            marginBottom: "0.5rem",
          }}
        >
          Roast not found.
        </p>

        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.9rem",
            marginBottom: "2rem",
            lineHeight: 1.6,
          }}
        >
          This roast may have expired or the link is incorrect. Time to get
          a fresh one.
        </p>

        <Link href="/" className="brut-btn" style={{ display: "inline-flex" }}>
          <ArrowLeft size={16} strokeWidth={2.5} />
          Start a new roast
        </Link>
      </div>
    </div>
  );
}
