/**
 * Single source of truth for navigation, creator links, and support links.
 *
 * Keeping these in one module means the header, footer, About page, and Support
 * page can never drift apart, and a URL only ever has to be changed once.
 */

/** A primary navigation destination. */
export interface NavItem {
  href: string;
  label: string;
  /** Short description used by the footer and mobile menu. */
  description: string;
}

/** Primary navigation, in header order. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Analyze", description: "Score any public GitHub profile" },
  { href: "/leaderboard", label: "Leaderboard", description: "Top analyzed developers" },
  { href: "/compare", label: "Compare", description: "Put two developers side by side" },
  { href: "/improve", label: "Improve", description: "Get a personalised roadmap" },
  { href: "/about", label: "About", description: "Connect with the creator" },
  { href: "/support", label: "Support", description: "Help keep the project running" },
];

/** Identifiers for the creator's social profiles. */
export type SocialKey = "github" | "linkedin" | "twitter" | "facebook" | "instagram";

export interface SocialLink {
  key: SocialKey;
  label: string;
  /** Accessible label, since the visual link is often just an icon. */
  ariaLabel: string;
  href: string;
  /** Handle shown next to the icon. */
  handle: string;
}

/** The creator's public profiles. */
export const SOCIAL_LINKS: SocialLink[] = [
  {
    key: "github",
    label: "GitHub",
    ariaLabel: "Creator's GitHub profile (opens in a new tab)",
    href: "https://github.com/ahmmikun",
    handle: "@ahmmikun",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    ariaLabel: "Creator's LinkedIn profile (opens in a new tab)",
    href: "https://www.linkedin.com/in/ahmmikun",
    handle: "in/ahmmikun",
  },
  {
    key: "twitter",
    label: "Twitter / X",
    ariaLabel: "Creator's Twitter profile (opens in a new tab)",
    href: "https://twitter.com/ahmmikun",
    handle: "@ahmmikun",
  },
  {
    key: "facebook",
    label: "Facebook",
    ariaLabel: "Creator's Facebook profile (opens in a new tab)",
    href: "https://facebook.com/AhmmiKun",
    handle: "AhmmiKun",
  },
  {
    key: "instagram",
    label: "Instagram",
    ariaLabel: "Creator's Instagram profile (opens in a new tab)",
    href: "https://instagram.com/ahmmikun",
    handle: "@ahmmikun",
  },
];

/** Buy Me a Coffee support link. */
export const SUPPORT_LINK = {
  href: "https://www.buymeacoffee.com/ahmmikun",
  label: "Buy Me a Coffee",
  ariaLabel: "Support the project on Buy Me a Coffee (opens in a new tab)",
  username: "ahmmikun",
} as const;

/** Application name and short description, reused across metadata and the footer. */
export const APP_NAME = "GitRoasted";
export const APP_TAGLINE = "GitHub developer analysis, scored out of 1000.";
export const APP_DESCRIPTION =
  "Analyze any public GitHub profile across eight scoring dimensions, compare developers, climb the leaderboard, and get a practical roadmap to improve.";

/** Creator display name, used in the footer copyright. */
export const CREATOR_NAME = "Salman Ahmad";

/**
 * Dimension names and weights, for display on the About page.
 *
 * Mirrors `DIMENSION_MAX` in `lib/scoring.ts`; kept here as plain data so the
 * marketing copy does not need to import the scoring engine.
 */
export const DIMENSION_SUMMARY: Array<{ label: string; max: number }> = [
  { label: "Impact", max: 250 },
  { label: "Consistency", max: 200 },
  { label: "Quality", max: 150 },
  { label: "Community", max: 150 },
  { label: "Diversity", max: 100 },
  { label: "Experience", max: 75 },
  { label: "Activity", max: 50 },
  { label: "Bonuses", max: 25 },
];

/** Public base URL, used for canonical and Open Graph URLs. */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
