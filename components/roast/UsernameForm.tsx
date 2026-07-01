"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Eye, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { validateUsername } from "@/lib/validators";
import RoastLoadingScreen from "./RoastLoadingScreen";

interface CachedRoast {
  slug: string;
  shareUrl: string;
}

function CachedChoiceCard({
  username,
  cached,
  onViewExisting,
  onGenerateNew,
  generating,
}: {
  username: string;
  cached: CachedRoast;
  onViewExisting: () => void;
  onGenerateNew: () => void;
  generating: boolean;
}) {
  return (
    <div style={{ width: "100%", maxWidth: "480px", margin: "0 auto" }}>
      {/* Header strip */}
      <div
        style={{
          background: "var(--yellow)",
          border: "3px solid var(--border)",
          borderBottom: "none",
          padding: "0.65rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Eye size={14} color="#000" strokeWidth={2.5} />
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#000",
          }}
        >
          Roast found for @{username}
        </span>
      </div>

      {/* Card body */}
      <div
        className="brut-card"
        style={{ padding: "1.5rem", borderTop: "none", display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.6 }}>
          A roast for{" "}
          <span style={{ color: "var(--text)", fontWeight: 700 }}>@{username}</span>{" "}
          was generated recently and is stored. What would you like to do?
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <button
            onClick={onViewExisting}
            className="brut-btn"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <Eye size={16} strokeWidth={2.5} />
            View existing roast
            <ArrowRight size={16} strokeWidth={2.5} style={{ marginLeft: "auto" }} />
          </button>

          <button
            onClick={onGenerateNew}
            disabled={generating}
            className="brut-btn-ghost"
            style={{ width: "100%", justifyContent: "center", opacity: generating ? 0.5 : 1 }}
          >
            <RefreshCw size={16} strokeWidth={2.5} />
            {generating ? "Generating…" : "Generate fresh roast"}
          </button>
        </div>

        {/* Token warning */}
        <div
          style={{
            padding: "0.65rem 0.875rem",
            border: "2px solid var(--orange)",
            background: "rgba(255,136,0,0.06)",
            display: "flex",
            gap: "0.5rem",
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle
            size={14}
            strokeWidth={2.5}
            color="var(--orange)"
            style={{ flexShrink: 0, marginTop: "2px" }}
          />
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--orange)",
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            Generating a fresh roast calls GitHub&apos;s API and an AI provider — it counts
            against your rate limit and consumes API tokens. Use only when needed.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UsernameForm() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedRoast, setCachedRoast] = useState<CachedRoast | null>(null);
  const router = useRouter();

  async function submitRoast(usernameValue: string, force = false) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: usernameValue, force }),
      });

      const data = (await response.json()) as {
        success: boolean;
        cached?: boolean;
        slug?: string;
        shareUrl?: string;
        error?: { code: string; message: string };
      };

      if (data.success && data.cached && data.slug && data.shareUrl) {
        // Existing roast found — let the user choose.
        setLoading(false);
        setCachedRoast({ slug: data.slug, shareUrl: data.shareUrl });
      } else if (data.success && data.slug) {
        router.push(`/r/${data.slug}`);
      } else {
        setError(data.error?.message ?? "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const validation = validateUsername(username);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    await submitRoast(validation.username);
  }

  // Show loading screen while generating.
  if (loading) {
    return <RoastLoadingScreen username={username} />;
  }

  // Show choice card when a cached roast was found.
  if (cachedRoast) {
    return (
      <CachedChoiceCard
        username={username}
        cached={cachedRoast}
        onViewExisting={() => router.push(`/r/${cachedRoast.slug}`)}
        onGenerateNew={async () => {
          setCachedRoast(null);
          const validation = validateUsername(username);
          if (validation.ok) await submitRoast(validation.username, true);
        }}
        generating={loading}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Roast form">
      <label className="brut-label" htmlFor="username-input">
        GitHub username
      </label>

      <div className="form-row">
        <input
          id="username-input"
          className="brut-input"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (error) setError(null);
            if (cachedRoast) setCachedRoast(null);
          }}
          placeholder="e.g. torvalds"
          disabled={loading}
          aria-label="GitHub username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />

        <button
          type="submit"
          disabled={loading || !username.trim()}
          aria-disabled={loading || !username.trim()}
          className="brut-btn"
          style={{ flexShrink: 0 }}
        >
          <Flame size={16} strokeWidth={2.5} />
          Roast me
        </button>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            marginTop: "0.75rem",
            padding: "0.6rem 0.75rem",
            border: "2px solid var(--red)",
            background: "rgba(255,45,45,0.08)",
            color: "var(--red)",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {error}
        </p>
      )}
    </form>
  );
}
