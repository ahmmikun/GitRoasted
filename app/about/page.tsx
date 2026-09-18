import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Coffee, Heart, Users } from "lucide-react";
import SocialIcon from "@/components/layout/SocialIcon";
import {
  APP_NAME,
  CREATOR_NAME,
  DIMENSION_SUMMARY,
  SOCIAL_LINKS,
  SUPPORT_LINK,
} from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About & Contact",
  description: `Learn what ${APP_NAME} measures and connect with its creator on GitHub, LinkedIn, X, Facebook, and Instagram.`,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `About ${APP_NAME}`,
    description: "What this project measures, and how to reach the person who built it.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <main className="page-wrap">
      <header className="page-header">
        <p className="brut-label">
          <Users size={13} strokeWidth={2.5} aria-hidden="true" /> About the project
        </p>
        <h1 className="page-title">Connect with the creator</h1>
        <p className="page-sub">
          {APP_NAME} started as an AI roast generator and grew into a way to actually
          measure a public GitHub profile — then explain the number and what to do about
          it. It is built and maintained by one person, in the open.
        </p>
      </header>

      <section className="about-grid" aria-label="Creator links">
        <div className="about-card">
          <h2 className="about-heading">
            <Heart size={15} strokeWidth={2.5} aria-hidden="true" />
            Say hello
          </h2>
          <p className="about-text">
            I&apos;m {CREATOR_NAME}. If you have feedback, found a scoring edge case, or
            just want to argue about how many points a README is worth, any of these work
            — GitHub issues are best for bugs.
          </p>

          <ul className="about-socials">
            {SOCIAL_LINKS.map((social) => (
              <li key={social.key}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.ariaLabel}
                  className="about-social"
                >
                  <SocialIcon name={social.key} size={22} />
                  <span className="about-social-text">
                    <span className="about-social-label">{social.label}</span>
                    <span className="about-social-handle">{social.handle}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="about-card">
          <h2 className="about-heading">What the score measures</h2>
          <p className="about-text">
            Every profile is scored out of 1000 across eight dimensions, using only public
            data from the GitHub API. Nothing is inferred from private repositories.
          </p>

          <dl className="about-dims">
            {DIMENSION_SUMMARY.map((dimension) => (
              <div key={dimension.label}>
                <dt>{dimension.label}</dt>
                <dd>{dimension.max}</dd>
              </div>
            ))}
          </dl>

          <p className="about-note">
            Quality and Consistency are best-effort approximations — we read repository
            metadata and your public contribution calendar, not the contents of your code.
          </p>
        </div>
      </section>

      <section className="about-cta" aria-label="Next steps">
        <div>
          <h2 className="about-heading">Try it on your own profile</h2>
          <p className="about-text">
            Analyze your profile, see where the points are going, and compare yourself with
            anyone else on GitHub.
          </p>
        </div>
        <div className="about-cta-actions">
          <Link href="/" className="brut-btn">
            Analyze a profile
            <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <a
            href={SUPPORT_LINK.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={SUPPORT_LINK.ariaLabel}
            className="brut-btn-ghost"
          >
            <Coffee size={16} strokeWidth={2.5} aria-hidden="true" />
            {SUPPORT_LINK.label}
          </a>
        </div>
      </section>
    </main>
  );
}
