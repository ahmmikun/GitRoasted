// Tasks 12.5 (Property 15) and 12.6: Component tests for RoastResult and ShareButtons.
// Covers Req 10.1, 10.2, 10.3, 11.1, 11.2, 11.3.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import RoastResult, { type RoastData } from "./RoastResult";
import ShareButtons from "./ShareButtons";

// ── Mock data helpers ─────────────────────────────────────────────────────────

function makeRoastData(overrides: Partial<RoastData> = {}): RoastData {
  return {
    slug: "tester-x1y2z",
    username: "tester",
    githubProfile: {
      login: "tester",
      name: "Test Developer",
      avatarUrl: "https://example.com/avatar.png",
      bio: "Loves coding",
      followers: 42,
      following: 10,
      publicRepos: 12,
      profileUrl: "https://github.com/tester",
      blog: null,
      company: null,
      location: null,
      createdAt: "2019-01-01T00:00:00Z",
    },
    githubStats: {
      totalReposAnalyzed: 12,
      totalStars: 88,
      totalForks: 15,
      topLanguages: ["TypeScript", "Python", "Go"],
      reposWithDescription: 9,
      reposWithoutDescription: 3,
      reposWithHomepage: 2,
      recentlyUpdatedRepos: 4,
      forkedRepos: 2,
      originalRepos: 10,
    },
    analysis: {
      score: 78,
      grade: "B",
      title: "Quietly Competent",
      shortRoast: "Not bad at all.",
      longRoast: "This developer knows what they're doing.",
      strengths: ["Strong star count", "Multi-language"],
      weaknesses: ["Some repos missing descriptions"],
      improvementTips: ["Write READMEs", "Open-source more"],
      shareCaption: "I scored 78/100 — can you beat me?",
    },
    ...overrides,
  };
}

const SHARE_URL = "https://example.com/r/tester-x1y2z";

// ── Property 15: Result rendering includes all record fields ──────────────────

// Feature: gitroasted, Property 15: Result rendering includes all record fields
describe("Property 15: RoastResult renders all record fields", () => {
  it("renders all required fields for any valid RoastData", () => {
    const strengthsArb = fc.array(fc.string({ minLength: 1, maxLength: 80 }), {
      minLength: 1,
      maxLength: 5,
    });
    const weaknessesArb = fc.array(fc.string({ minLength: 1, maxLength: 80 }), {
      minLength: 1,
      maxLength: 5,
    });
    const tipsArb = fc.array(fc.string({ minLength: 1, maxLength: 80 }), {
      minLength: 1,
      maxLength: 5,
    });

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        strengthsArb,
        weaknessesArb,
        tipsArb,
        (score, title, strengths, weaknesses, tips) => {
          const data = makeRoastData({
            analysis: {
              ...makeRoastData().analysis,
              score,
              title,
              strengths,
              weaknesses,
              improvementTips: tips,
            },
          });

          const { unmount } = render(
            <RoastResult data={data} shareUrl={SHARE_URL} />,
          );

          const hasSummaryInfo =
            document.body.textContent?.includes("tester") === true &&
            document.body.textContent?.includes(String(score)) === true &&
            document.body.textContent?.includes(title) === true;

          unmount();
          return hasSummaryInfo;
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── Full rendering integration ────────────────────────────────────────────────

describe("RoastResult", () => {
  it("renders the username", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(screen.getByText(/@tester/)).toBeInTheDocument();
  });

  it("renders the developer score", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(screen.getByText("78")).toBeInTheDocument();
  });

  it("renders the grade badge", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(screen.getByLabelText(/grade B/i)).toBeInTheDocument();
  });

  it("renders the roast title", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(screen.getByText("Quietly Competent")).toBeInTheDocument();
  });

  it("renders the short roast", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(screen.getByText("Not bad at all.")).toBeInTheDocument();
  });

  it("renders the long roast", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(
      screen.getByText("This developer knows what they're doing."),
    ).toBeInTheDocument();
  });

  it("renders all GitHub stats", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    // Stats grid values
    expect(screen.getByText("88")).toBeInTheDocument(); // totalStars
    expect(screen.getByText("15")).toBeInTheDocument(); // totalForks
    expect(screen.getByText("12")).toBeInTheDocument(); // totalReposAnalyzed
  });

  it("renders every strength", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(screen.getByText("Strong star count")).toBeInTheDocument();
    expect(screen.getByText("Multi-language")).toBeInTheDocument();
  });

  it("renders every weakness", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(
      screen.getByText("Some repos missing descriptions"),
    ).toBeInTheDocument();
  });

  it("renders every improvement tip", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(screen.getByText("Write READMEs")).toBeInTheDocument();
    expect(screen.getByText("Open-source more")).toBeInTheDocument();
  });

  it("renders the share caption", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(screen.getByText("I scored 78/100 — can you beat me?")).toBeInTheDocument();
  });

  it("renders the copy link button", () => {
    render(<RoastResult data={makeRoastData()} shareUrl={SHARE_URL} />);
    expect(
      screen.getByRole("button", { name: /copy share link/i }),
    ).toBeInTheDocument();
  });
});

// ── ShareButtons: clipboard tests (Req 11.1, 11.2, 11.3) ─────────────────────

describe("ShareButtons", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it("copies the shareUrl to the clipboard when the button is clicked", async () => {
    render(<ShareButtons shareUrl={SHARE_URL} />);
    await userEvent.click(screen.getByRole("button", { name: /copy share link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SHARE_URL);
  });

  it("shows confirmation feedback after a successful copy (Req 11.2)", async () => {
    render(<ShareButtons shareUrl={SHARE_URL} />);
    await userEvent.click(screen.getByRole("button", { name: /copy share link/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/copied/i);
  });

  it("shows an error message when the clipboard operation fails (Req 11.3)", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("Permission denied")) },
      writable: true,
      configurable: true,
    });

    render(<ShareButtons shareUrl={SHARE_URL} />);
    await userEvent.click(screen.getByRole("button", { name: /copy share link/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
