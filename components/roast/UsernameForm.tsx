"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateUsername } from "@/lib/validators";

const styles = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "1rem",
    width: "100%",
    maxWidth: "480px",
    margin: "0 auto",
  },
  inputRow: {
    display: "flex",
    width: "100%",
    gap: "0.5rem",
  },
  input: {
    flex: 1,
    padding: "0.75rem 1rem",
    fontSize: "1rem",
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "6px",
    color: "#e6edf3",
    outline: "none",
  },
  button: {
    padding: "0.75rem 1.25rem",
    fontSize: "1rem",
    fontWeight: 600,
    background: "#238636",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  error: {
    color: "#f85149",
    fontSize: "0.875rem",
    textAlign: "center" as const,
  },
};

/**
 * UsernameForm — client component for submitting a GitHub username.
 *
 * Mirrors the `usernameSchema` on the client side so invalid input is
 * rejected before the network call. On success, navigates to `/r/[slug]`.
 * On failure, stays on the form and shows an inline error message.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 12.2
 */
export default function UsernameForm() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Client-side validation mirror of usernameSchema.
    const validation = validateUsername(username);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: validation.username }),
      });

      const data = (await response.json()) as {
        success: boolean;
        slug?: string;
        error?: { code: string; message: string };
      };

      if (data.success && data.slug) {
        router.push(`/r/${data.slug}`);
      } else {
        setError(
          data.error?.message ?? "Something went wrong. Please try again.",
        );
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || !username.trim();

  return (
    <form onSubmit={handleSubmit} style={styles.form} aria-label="Roast form">
      <div style={styles.inputRow}>
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (error) setError(null);
          }}
          placeholder="GitHub username…"
          disabled={loading}
          aria-label="GitHub username"
          style={styles.input}
          autoComplete="off"
          autoCapitalize="none"
        />
        <button
          type="submit"
          disabled={isDisabled}
          aria-disabled={isDisabled}
          style={{
            ...styles.button,
            ...(isDisabled ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? "Roasting…" : "Roast me 🔥"}
        </button>
      </div>
      {error && (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
