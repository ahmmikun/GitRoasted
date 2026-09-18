// Tests for trailing-year contribution fetching: GraphQL calendar, the
// public-events fallback, and graceful degradation when both are unavailable.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchContributionData } from "./github";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const ORIGINAL_TOKEN = process.env.GITHUB_TOKEN;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) {
    delete process.env.GITHUB_TOKEN;
  } else {
    process.env.GITHUB_TOKEN = ORIGINAL_TOKEN;
  }
});

/** Build a GraphQL calendar payload from an array of {date, count} days. */
function calendarPayload(
  days: Array<{ date: string; count: number }>,
  totalContributions?: number,
) {
  // Chunk the days into weeks of 7 to mimic the real response shape.
  const weeks: Array<{ contributionDays: Array<{ contributionCount: number; date: string }> }> = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push({
      contributionDays: days.slice(i, i + 7).map((d) => ({
        contributionCount: d.count,
        date: d.date,
      })),
    });
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions:
                totalContributions ?? days.reduce((s, d) => s + d.count, 0),
              weeks,
            },
          },
        },
      },
    }),
  };
}

/** Generate consecutive ISO dates starting from a fixed Monday. */
function isoDays(start: string, count: number): string[] {
  const base = Date.parse(start);
  return Array.from({ length: count }, (_, i) =>
    new Date(base + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

describe("fetchContributionData — GraphQL calendar", () => {
  it("returns real (non-estimated) data when the calendar is available", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    // 14 consecutive contributing days spanning two ISO weeks.
    const days = isoDays("2024-01-01T00:00:00Z", 14).map((date) => ({ date, count: 3 }));
    mockFetch.mockResolvedValueOnce(calendarPayload(days, 42));

    const result = await fetchContributionData("someone");

    expect(result).not.toBeNull();
    expect(result!.estimated).toBe(false);
    expect(result!.totalContributions).toBe(42);
    expect(result!.activeWeeks).toBe(2);
    expect(result!.longestStreakDays).toBe(14);

    // Confirm it used the GraphQL endpoint with an Authorization header.
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/graphql");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("computes the longest streak across gaps rather than total active days", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const days = [
      // A 3-day run.
      { date: "2024-01-01", count: 1 },
      { date: "2024-01-02", count: 1 },
      { date: "2024-01-03", count: 1 },
      // Gap.
      { date: "2024-01-05", count: 0 },
      // A 5-day run.
      { date: "2024-01-08", count: 2 },
      { date: "2024-01-09", count: 2 },
      { date: "2024-01-10", count: 2 },
      { date: "2024-01-11", count: 2 },
      { date: "2024-01-12", count: 2 },
    ];
    mockFetch.mockResolvedValueOnce(calendarPayload(days));

    const result = await fetchContributionData("someone");
    expect(result!.longestStreakDays).toBe(5);
  });

  it("caps activeWeeks at 52", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    // 400 consecutive contributing days spans more than 52 ISO weeks.
    const days = isoDays("2024-01-01T00:00:00Z", 400).map((date) => ({ date, count: 1 }));
    mockFetch.mockResolvedValueOnce(calendarPayload(days));

    const result = await fetchContributionData("someone");
    expect(result!.activeWeeks).toBeLessThanOrEqual(52);
    expect(result!.activeWeeks).toBe(52);
  });

  it("falls back to public events when GraphQL returns an errors envelope", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    mockFetch
      // GraphQL responds 200 but with errors.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ errors: [{ message: "Bad credentials" }] }),
      })
      // Public-events fallback.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { created_at: "2024-05-01T10:00:00Z" },
          { created_at: "2024-05-02T10:00:00Z" },
        ],
      });

    const result = await fetchContributionData("someone");
    expect(result).not.toBeNull();
    expect(result!.estimated).toBe(true);
    expect(result!.totalContributions).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to public events when GraphQL returns a non-ok status", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ created_at: "2024-05-01T10:00:00Z" }],
      });

    const result = await fetchContributionData("someone");
    expect(result!.estimated).toBe(true);
  });

  it("falls back to public events when the GraphQL request throws", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    mockFetch
      .mockImplementationOnce(() => Promise.reject(new Error("Network failure")))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ created_at: "2024-05-01T10:00:00Z" }],
      });

    const result = await fetchContributionData("someone");
    expect(result!.estimated).toBe(true);
  });
});

describe("fetchContributionData — no token", () => {
  it("skips GraphQL entirely and uses the public-events estimate", async () => {
    delete process.env.GITHUB_TOKEN;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { created_at: "2024-05-01T10:00:00Z" },
        { created_at: "2024-05-01T12:00:00Z" },
        { created_at: "2024-05-02T09:00:00Z" },
      ],
    });

    const result = await fetchContributionData("someone");

    expect(result).not.toBeNull();
    expect(result!.estimated).toBe(true);
    expect(result!.totalContributions).toBe(3);
    // Two distinct days, both in the same ISO week.
    expect(result!.activeWeeks).toBe(1);
    expect(result!.longestStreakDays).toBe(2);

    // Only the REST events endpoint should have been called.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("/events/public");
  });

  it("treats a blank token as absent", async () => {
    process.env.GITHUB_TOKEN = "   ";
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });

    await fetchContributionData("someone");
    expect(mockFetch.mock.calls[0][0]).toContain("/events/public");
  });
});

describe("fetchContributionData — total degradation", () => {
  it("returns null when both sources fail", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(fetchContributionData("someone")).resolves.toBeNull();
  });

  it("returns null when the events request throws", async () => {
    delete process.env.GITHUB_TOKEN;
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error("offline")));

    await expect(fetchContributionData("someone")).resolves.toBeNull();
  });

  it("returns null when the events payload is not an array", async () => {
    delete process.env.GITHUB_TOKEN;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: "Not Found" }),
    });

    await expect(fetchContributionData("someone")).resolves.toBeNull();
  });

  it("never throws even when fetch resolves to undefined", async () => {
    delete process.env.GITHUB_TOKEN;
    mockFetch.mockResolvedValueOnce(undefined);

    await expect(fetchContributionData("someone")).resolves.toBeNull();
  });

  it("returns null when the calendar is missing from an otherwise valid response", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { user: null } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchContributionData("ghost")).resolves.toBeNull();
  });
});
