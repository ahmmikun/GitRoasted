"use client";

import { useState } from "react";
import { Copy, Check, AlertCircle } from "lucide-react";

interface ShareButtonsProps {
  shareUrl: string;
}

export default function ShareButtons({ shareUrl }: ShareButtonsProps) {
  const [feedback, setFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setFeedback({ message: "Link copied to clipboard!", isError: false });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({
        message: "Could not copy — select the URL manually.",
        isError: true,
      });
    }
  }

  const copied = feedback && !feedback.isError;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.875rem" }}>
      <button
        onClick={handleCopy}
        aria-label="Copy share link"
        className="brut-btn"
        style={copied ? { background: "var(--green)", borderColor: "var(--green)" } : undefined}
      >
        {copied ? (
          <Check size={16} strokeWidth={2.5} />
        ) : (
          <Copy size={16} strokeWidth={2.5} />
        )}
        {copied ? "Copied!" : "Copy share link"}
      </button>

      {/* URL pill */}
      <div
        style={{
          padding: "0.4rem 0.75rem",
          background: "var(--surface-2)",
          border: "2px solid var(--border)",
          fontFamily: "monospace",
          fontSize: "0.78rem",
          color: "var(--muted)",
          wordBreak: "break-all",
          maxWidth: "340px",
          textAlign: "center",
        }}
      >
        {shareUrl}
      </div>

      {feedback && (
        <p
          role={feedback.isError ? "alert" : "status"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            color: feedback.isError ? "var(--red)" : "var(--green)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {feedback.isError && <AlertCircle size={14} strokeWidth={2.5} />}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
