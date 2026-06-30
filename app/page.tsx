import ErrorBoundary from "@/components/ErrorBoundary";
import UsernameForm from "@/components/roast/UsernameForm";

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1.5rem",
  },
  hero: {
    textAlign: "center" as const,
    maxWidth: "600px",
    width: "100%",
  },
  title: {
    fontSize: "clamp(2.5rem, 6vw, 4rem)",
    fontWeight: 800,
    marginBottom: "0.75rem",
    letterSpacing: "-0.02em",
  },
  tagline: {
    fontSize: "1.15rem",
    color: "#8b949e",
    marginBottom: "0.5rem",
  },
  sub: {
    fontSize: "0.95rem",
    color: "#6e7681",
    marginBottom: "2rem",
  },
  fallback: {
    padding: "2rem",
    textAlign: "center" as const,
    color: "#f85149",
  },
};

function HeroFallback() {
  return (
    <div style={styles.fallback} role="alert">
      <p>Something went wrong rendering this page. Please reload.</p>
    </div>
  );
}

/**
 * Home page — hero section with UsernameForm wrapped in an error boundary.
 *
 * Requirements: 12.1, 12.2, 12.3
 */
export default function Home() {
  return (
    <main style={styles.main}>
      <ErrorBoundary fallback={<HeroFallback />}>
        <section style={styles.hero} aria-label="Hero">
          <h1 style={styles.title}>🔥 GitRoasted</h1>
          <p style={styles.tagline}>
            AI-powered GitHub profile roast generator
          </p>
          <p style={styles.sub}>
            Enter a public GitHub username and get roasted (or mildly praised).
          </p>
          <UsernameForm />
        </section>
      </ErrorBoundary>
    </main>
  );
}
