import Link from "next/link";

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    gap: "1rem",
    padding: "2rem",
  },
  title: { fontSize: "2rem", fontWeight: 700 },
  sub: { color: "#8b949e" },
  link: {
    display: "inline-block",
    marginTop: "0.5rem",
    padding: "0.6rem 1.25rem",
    background: "#238636",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    fontWeight: 600,
    textDecoration: "none",
  },
};

/**
 * Not-found page for /r/[slug] routes.
 * Rendered by Next.js when `notFound()` is called in the result page.
 *
 * Requirements: 10.2
 */
export default function NotFound() {
  return (
    <div style={styles.page} role="main">
      <h1 style={styles.title}>🔥 Roast not found</h1>
      <p style={styles.sub}>
        This roast may have expired or the link is incorrect.
      </p>
      <Link href="/" style={styles.link}>
        Start a new roast
      </Link>
    </div>
  );
}
