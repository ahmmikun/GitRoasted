// Tests for the shared NavBar: link coverage, active state, and the
// accessibility contract of the mobile disclosure menu.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NAV_ITEMS } from "@/lib/site-config";

const mockPathname = vi.fn<() => string>(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

import NavBar from "./NavBar";

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/");
});

describe("NavBar", () => {
  it("renders a link for every primary destination", () => {
    render(<NavBar />);
    const nav = screen.getAllByRole("navigation", { name: "Primary" })[0];

    for (const item of NAV_ITEMS) {
      const link = within(nav).getByRole("link", { name: item.label });
      expect(link).toHaveAttribute("href", item.href);
    }
  });

  it("marks the current route with aria-current, not colour alone", () => {
    mockPathname.mockReturnValue("/leaderboard");
    render(<NavBar />);

    const nav = screen.getAllByRole("navigation", { name: "Primary" })[0];
    const active = within(nav).getByRole("link", { name: "Leaderboard" });
    expect(active).toHaveAttribute("aria-current", "page");

    const inactive = within(nav).getByRole("link", { name: "Compare" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("treats nested routes as active for their parent section", () => {
    mockPathname.mockReturnValue("/leaderboard/page/2");
    render(<NavBar />);

    const nav = screen.getAllByRole("navigation", { name: "Primary" })[0];
    expect(within(nav).getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark Analyze active on other routes", () => {
    mockPathname.mockReturnValue("/support");
    render(<NavBar />);

    const nav = screen.getAllByRole("navigation", { name: "Primary" })[0];
    expect(within(nav).getByRole("link", { name: "Analyze" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("exposes the mobile menu as a collapsed disclosure by default", () => {
    render(<NavBar />);
    const toggle = screen.getByRole("button", { name: /open navigation menu/i });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "site-mobile-nav");
  });

  it("expands and collapses the mobile menu on click", async () => {
    const user = userEvent.setup();
    render(<NavBar />);

    const toggle = screen.getByRole("button", { name: /open navigation menu/i });
    await user.click(toggle);

    expect(
      screen.getByRole("button", { name: /close navigation menu/i }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: /close navigation menu/i }));
    expect(
      screen.getByRole("button", { name: /open navigation menu/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the mobile menu when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<NavBar />);

    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    await user.keyboard("{Escape}");

    expect(
      screen.getByRole("button", { name: /open navigation menu/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("links the brand back to the home page", () => {
    render(<NavBar />);
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
  });
});
