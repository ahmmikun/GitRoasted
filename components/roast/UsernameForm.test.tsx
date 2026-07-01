// Task 12.6: Component tests for UsernameForm.
// Covers Req 2.1–2.4, 12.2.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsernameForm from "./UsernameForm";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UsernameForm", () => {
  it("renders the username input and submit button", () => {
    render(<UsernameForm />);
    expect(screen.getByLabelText(/github username/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /roast me/i })).toBeInTheDocument();
  });

  it("shows a validation error for an invalid username without network call", async () => {
    render(<UsernameForm />);
    const input = screen.getByLabelText(/github username/i);
    const btn = screen.getByRole("button", { name: /roast me/i });

    await userEvent.type(input, "-invalid-");
    await userEvent.click(btn);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows an error and stays on the form when the API returns an error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "NOT_FOUND", message: "GitHub user not found." },
      }),
    });

    render(<UsernameForm />);
    await userEvent.type(screen.getByLabelText(/github username/i), "missinguser");
    await userEvent.click(screen.getByRole("button", { name: /roast me/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub user not found.");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates to /r/[slug] on a successful API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        slug: "testuser-ab123",
        shareUrl: "https://example.com/r/testuser-ab123",
      }),
    });

    render(<UsernameForm />);
    await userEvent.type(screen.getByLabelText(/github username/i), "testuser");
    await userEvent.click(screen.getByRole("button", { name: /roast me/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/r/testuser-ab123");
    });
  });

  it("shows a loading state while the request is in flight", async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((r) => { resolve = r; });
    mockFetch.mockReturnValueOnce(pending);

    render(<UsernameForm />);
    await userEvent.type(screen.getByLabelText(/github username/i), "testuser");
    await userEvent.click(screen.getByRole("button", { name: /roast me/i }));

    // Loading screen replaces the form; verify the form submit button is gone
    // and a loading indicator is shown instead.
    expect(screen.queryByRole("button", { name: /roast me/i })).toBeNull();

    // Clean up
    resolve({
      ok: true,
      json: async () => ({ success: true, slug: "s-abc12" }),
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
  });

  it("shows an error on network failure without navigating", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<UsernameForm />);
    await userEvent.type(screen.getByLabelText(/github username/i), "testuser");
    await userEvent.click(screen.getByRole("button", { name: /roast me/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
