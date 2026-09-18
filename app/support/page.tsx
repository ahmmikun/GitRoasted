import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bug, Coffee, Share2, Star } from "lucide-react";
import { APP_NAME, SOCIAL_LINKS, SUPPORT_LINK } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Support the Project",
  description: `${APP_NAME} is free and open source. If it was useful, you can support its development.`,
  alternates: { canonical: "/support" },
  openGraph: {
    title: `Support ${APP_NAME}`,
    description: "Free and open source. Support its development if it was useful to you.",
    url: "/support",
  },
};

const githubLink = SOCIAL_LINKS.find((s) => s.key === "github");

export default function SupportPage() {
  return (
    <main className="page-wrap">
      <header className="page-header">
        <p className="brut-label">
          <Coffee size={13} strokeWidth={2.5} aria-hidden="true" /> Support
        </p>
        <h1 className="page-title">Enjoying the project?</h1>
        <p className="page-sub">
          {APP_NAME} is free, open source, and has no ads or paywalls. Supporting it is
          entirely optional — the whole thing works the same either way.
        </p>
      </header>

      <section className="sup-card" aria-label="Buy Me a Coffee">
        <Coffee size={28} strokeWidth={2.5} aria-hidden="true" className="sup-icon" />
        <h2 className="sup-title">Support its development ☕</h2>
        <p className="sup-text">
          Running the analysis pipeline costs a little in API usage, and the time comes out
          of evenings and weekends. If the score or the roadmap was useful to you, a coffee
          is a genuinely nice way to say so.
        </p>
        <a
          href={SUPPORT_LINK.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={SUPPORT_LINK.ariaLabel}
          className="brut-btn sup-cta"
        >
          <Coffee size={16} strokeWidth={2.5} aria-hidden="true" />
          {SUPPORT_LINK.label}
        </a>
        <p className="sup-handle">buymeacoffee.com/{SUPPORT_LINK.username}</p>
      </section>

      <section className="sup-alt" aria-label="Other ways to help">
        <h2 className="brut-section-title">Free ways to help</h2>
        <p className="sup-text sup-alt-intro">
          Money is genuinely not the only useful thing — these help just as much.
        </p>

        <ul className="sup-list">
          <li>
            <Star size={16} strokeWidth={2.5} aria-hidden="true" />
            <div>
              <h3>Star the repository</h3>
              <p>
                It is the simplest signal that the project is worth maintaining, and it
                helps other developers find it.
              </p>
              {githubLink ? (
                <a
                  href={githubLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={githubLink.ariaLabel}
                  className="lb-link"
                >
                  Open GitHub
                </a>
              ) : null}
            </div>
          </li>

          <li>
            <Bug size={16} strokeWidth={2.5} aria-hidden="true" />
            <div>
              <h3>Report a scoring edge case</h3>
              <p>
                If a dimension scores your profile in a way that seems wrong, that is a
                genuinely useful bug report — the scoring rules improve from real examples.
              </p>
            </div>
          </li>

          <li>
            <Share2 size={16} strokeWidth={2.5} aria-hidden="true" />
            <div>
              <h3>Share your result</h3>
              <p>
                Every roast has a shareable link, and comparisons carry their state in the
                URL, so both are easy to pass along.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <div className="sup-footer-cta">
        <Link href="/" className="brut-btn">
          Analyze a profile
          <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <Link href="/about" className="brut-btn-ghost">
          About the creator
        </Link>
      </div>
    </main>
  );
}
