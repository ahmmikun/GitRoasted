"use client";

import { useState } from "react";

interface ShareButtonsProps {
  shareUrl: string;
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.75rem",
  },
  caption: {
    fontSize: "0.9rem",
    color: "#8b949e",
    fontStyle: "italic" as const,
    textAlign: "center" as const,
  },
  button: {
    padding: "0.6rem 1.25rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    color: "#e6edf3",
    cursor: "pointer",
  },
  feedback: {
    fontSize: "0.85rem",
    fontWeight: 600,
  },
};

/**
 * ShareButtons — client component for copying the share URL to the clipboard.
 *
 * Uses the Clipboard API to write the URL. Shows confirmation on success and
 * an error message when the clipboard operation fails.
 *
 * Requirements: 11.1, 11.2, 11.3
 */
export default function ShareButtons({ shareUrl }: ShareButtonsProps) {
  const [feedback, setFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setFeedback({ message: "Link copied to clipboard! ✓", isError: false });
    } catch {
      setFeedback({
        message: "Could not copy link. Please copy it manually.",
        isError: true,
      });
    }
  }

  return (
    <div style={styles.wrapper}>
      <button
        onClick={handleCopy}
        style={styles.button}
        aria-label="Copy share link"
      >
        🔗 Copy share link
      </button>

      {feedback && (
        <p
          role={feedback.isError ? "alert" : "status"}
          style={{
            ...styles.feedback,
            color: feedback.isError ? "#f85149" : "#3fb950",
          }}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
