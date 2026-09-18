// Tests for the creator/support links and the pages that render them.
// External links must be correct, open safely, and be accessible.

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  DIMENSION_SUMMARY,
  NAV_ITEMS,
  SOCIAL_LINKS,
  SUPPORT_LINK,
  appUrl,
} from "@/lib/site-config";
import { DIMENSION_MAX, MAX_SCORE } from "@/lib/scoring";
import AboutPage from "@/app/about/page";
import SupportPage from "@/app/support/page";
import Footer from "@/components/layout/Footer";

describe("site-config link data", () => {
  it("points every social link at the correct profile", () => {
    const byKey = Object.fromEntries(SOCIAL_LINKS.map((s) => [s.key, s.href]));

    expect(byKey.github).toBe("https://github.com/ahmmikun");
    expect(byKey.linkedin).toBe("https://www.linkedin.com/in/ahmmikun");
    expect(byKey.twitter).toBe("https://twitter.com/ahmmikun");
    expect(byKey.facebook).toBe("https://facebook.com/AhmmiKun");
    expect(byKey.instagram).toBe("https://instagram.com/ahmmikun");
  });

  it("uses https and a descriptive aria-label for every social link", () => {
    for (const social of SOCIAL_LINKS) {
      expect(social.href.startsWith("https://")).toBe(true);
      expect(social.ariaLabel).toContain("new tab");
      expect(social.label.length).toBeGreaterThan(0);
      expect(social.handle.length).toBeGreaterThan(0);
    }
  });

  it("points the support link at the right Buy Me a Coffee account", () => {
    expect(SUPPORT_LINK.href).toBe("https://www.buymeacoffee.com/ahmmikun");
    expect(SUPPORT_LINK.username).toBe("ahmmikun");
    expect(SUPPORT_LINK.ariaLabel).toContain("new tab");
  });

  it("keeps the About page dimension table in sync with the scoring engine", () => {
    const configTotal = DIMENSION_SUMMARY.reduce((sum, d) => sum + d.max, 0);
    expect(configTotal).toBe(MAX_SCORE);

    const engineValues = Object.values(DIMENSION_MAX).sort((a, b) => b - a);
    const configValues = DIMENSION_SUMMARY.map((d) => d.max).sort((a, b) => b - a);
    expect(configValues).toEqual(engineValues);
    expect(DIMENSION_SUMMARY).toHaveLength(8);
  });

  it("exposes every navigation destination with a root-relative href", () => {
    expect(NAV_ITEMS.length).toBeGreaterThan(0);
    for (const item of NAV_ITEMS) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("falls back to localhost when no public URL is configured", () => {
    expect(appUrl()).toMatch(/^https?:\/\//);
  });
});

describe("About page", () => {
  it("renders every social link safely and accessibly", () => {
    render(<AboutPage />);

    for (const social of SOCIAL_LINKS) {
      const link = screen.getByRole("link", { name: social.ariaLabel });
      expect(link).toHaveAttribute("href", social.href);
      expect(link).toHaveAttribute("target", "_blank");
      // noopener prevents the opened page from touching window.opener.
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });

  it("presents itself as a creator page, not a corporate contact form", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /connect with the creator/i }),
    ).toBeInTheDocument();
    // No contact form is claimed, and no email address is invented.
    expect(document.querySelector("form")).toBeNull();
    expect(document.body.textContent).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("explains the scoring dimensions with their real weights", () => {
    render(<AboutPage />);

    for (const dimension of DIMENSION_SUMMARY) {
      expect(screen.getByText(dimension.label)).toBeInTheDocument();
    }
  });

  it("links onward to analysis and support", () => {
    render(<AboutPage />);

    expect(screen.getByRole("link", { name: /analyze a profile/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: SUPPORT_LINK.ariaLabel })).toHaveAttribute(
      "href",
      SUPPORT_LINK.href,
    );
  });
});

describe("Support page", () => {
  it("renders a working Buy Me a Coffee call to action", () => {
    render(<SupportPage />);

    const cta = screen.getByRole("link", { name: SUPPORT_LINK.ariaLabel });
    expect(cta).toHaveAttribute("href", "https://www.buymeacoffee.com/ahmmikun");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta.getAttribute("rel")).toContain("noopener");
    expect(cta).toHaveTextContent(/buy me a coffee/i);
  });

  it("keeps the ask non-intrusive and free of pressure language", () => {
    render(<SupportPage />);
    const text = document.body.textContent ?? "";

    expect(text).toMatch(/optional/i);
    // No guilt-tripping or urgency.
    expect(text).not.toMatch(/please donate/i);
    expect(text).not.toMatch(/act now/i);
    expect(text).not.toMatch(/last chance/i);
    expect(text).not.toMatch(/we need your money/i);
  });

  it("offers free alternatives to paying", () => {
    render(<SupportPage />);

    expect(screen.getByRole("heading", { name: /free ways to help/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /star the repository/i })).toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("includes a subtle support link", () => {
    render(<Footer />);

    const support = screen.getByRole("link", { name: SUPPORT_LINK.ariaLabel });
    expect(support).toHaveAttribute("href", SUPPORT_LINK.href);
    expect(support.getAttribute("rel")).toContain("noopener");
  });

  it("links to every section and social profile", () => {
    render(<Footer />);

    const nav = screen.getByRole("navigation", { name: "Footer" });
    for (const item of NAV_ITEMS) {
      expect(within(nav).getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }

    for (const social of SOCIAL_LINKS) {
      expect(screen.getByRole("link", { name: social.ariaLabel })).toHaveAttribute(
        "href",
        social.href,
      );
    }
  });

  it("shows a current copyright line", () => {
    render(<Footer />);
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()}`)),
    ).toBeInTheDocument();
  });
});
