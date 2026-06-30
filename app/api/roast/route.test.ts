// Task 11.3: Integration tests for POST /api/roast and GET /api/roast/[slug].
// All external dependencies (MongoDB, GitHub, AI) are mocked.
// Also covers Property 3: Cached requests do not consume rate budget.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IRoast } from "@/models/Roast";

// ── Mocks must be declared before module imports ──────────────────────────────

vi.mock("@/lib/cache", () => ({
  findCachedRoast: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAndRecord: vi.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
}));

vi.mock("@/lib/github", () => ({
  fetchGitHubData: vi.fn().mockResolvedValue({
    ok: true,
    profile: {
      login: "testuser",
      name: "Test User",
      avatarUrl: "https://example.com/avatar.png",
      bio: null,
      followers: 10,
      following: 5,
      publicRepos: 3,
      profileUrl: "https://github.com/testuser",
      blog: null,
      company: null,
      location: null,
      createdAt: "2020-01-01T00:00:00Z",
    },
    repos: [],
  }),
}));

vi.mock("@/lib/analyzer", () => ({
  analyzeProfile: vi.fn().mockReturnValue({
    stats: {
      totalReposAnalyzed: 0,
      totalStars: 0,
      totalForks: 0,
      topLanguages: [],
      reposWithDescription: 0,
      reposWithoutDescription: 0,
      reposWithHomepage: 0,
      recentlyUpdatedRepos: 0,
      forkedRepos: 0,
      originalRepos: 0,
    },
    score: 10,
    summary: "GitHub user: testuser\nDeveloper score: 10/100",
  }),
}));

vi.mock("@/lib/ai", () => ({
  generateRoast: vi.fn().mockResolvedValue({
    roast: {
      score: 10,
      grade: "F",
      title: "Test Roast",
      shortRoast: "Short.",
      longRoast: "Longer text.",
      strengths: ["s1"],
      weaknesses: ["w1"],
      improvementTips: ["t1"],
      shareCaption: "caption",
    },
    aiMeta: {
      providerUsed: "openrouter",
      modelUsed: "test-model",
      aiFailed: false,
      fallbackUsed: false,
    },
  }),
}));

vi.mock("@/lib/slug", () => ({
  generateSlug: vi.fn().mockReturnValue("testuser-abc12"),
}));

vi.mock("@/models/Roast", () => ({
  RoastModel: {
    create: vi.fn().mockResolvedValue({ slug: "testuser-abc12" }),
    findOne: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(null),
    })),
  },
}));

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  default: vi.fn().mockResolvedValue(undefined),
}));

// ── Import route handlers after mocks ────────────────────────────────────────

import { POST } from "@/app/api/roast/route";
import { GET } from "@/app/api/roast/[slug]/route";
import { findCachedRoast } from "@/lib/cache";
import { checkAndRecord } from "@/lib/rate-limit";
import { fetchGitHubData } from "@/lib/github";
import { RoastModel } from "@/models/Roast";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePostReq(body: unknown) {
  return new Request("http://localhost/api/roast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function makeGetReq(slug: string) {
  return {
    request: new Request(`http://localhost/api/roast/${slug}`) as unknown as import("next/server").NextRequest,
    params: Promise.resolve({ slug }),
  };
}

const cachedRecord: Partial<IRoast> & { _id: unknown; slug: string } = {
  _id: "mock-id",
  slug: "testuser-x9z12",
  username: "testuser",
  githubProfile: {} as IRoast["githubProfile"],
  githubStats: {} as IRoast["githubStats"],
  analysis: {} as IRoast["analysis"],
  aiMeta: { providerUsed: "openrouter", modelUsed: "m", aiFailed: false, fallbackUsed: false },
  publicStats: { views: 0, shares: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.mocked(findCachedRoast).mockResolvedValue(null);
  vi.mocked(checkAndRecord).mockResolvedValue({ allowed: true, remaining: 4 });
  vi.mocked(fetchGitHubData).mockResolvedValue({
    ok: true,
    profile: {
      login: "testuser",
      name: null,
      avatarUrl: "",
      bio: null,
      followers: 0,
      following: 0,
      publicRepos: 0,
      profileUrl: "",
      blog: null,
      company: null,
      location: null,
      createdAt: "",
    },
    repos: [],
  });
  vi.mocked(RoastModel.create).mockResolvedValue({ slug: "testuser-abc12" } as never);
});

// ── POST /api/roast ───────────────────────────────────────────────────────────

describe("POST /api/roast", () => {
  it("returns 400 for an invalid username", async () => {
    const res = await POST(makePostReq({ username: "-invalid-" }));
    expect(res.status).toBe(400);
    const data = await res.json() as { success: boolean; error: { code: string } };
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION");
  });

  it("returns 400 for missing username", async () => {
    const res = await POST(makePostReq({}));
    expect(res.status).toBe(400);
    const data = await res.json() as { success: boolean; error: { code: string } };
    expect(data.error.code).toBe("VALIDATION");
  });

  // Feature: gitroasted, Property 3: Cached requests do not consume rate budget
  it("returns the cached slug/shareUrl and does NOT call checkAndRecord on a cache hit", async () => {
    vi.mocked(findCachedRoast).mockResolvedValueOnce(cachedRecord as never);

    const res = await POST(makePostReq({ username: "testuser" }));
    expect(res.status).toBe(200);
    const data = await res.json() as { success: boolean; slug: string };
    expect(data.success).toBe(true);
    expect(data.slug).toBe("testuser-x9z12");
    expect(checkAndRecord).not.toHaveBeenCalled();
  });

  it("returns 429 when the IP rate limit is exceeded (cache miss)", async () => {
    vi.mocked(checkAndRecord).mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const res = await POST(makePostReq({ username: "testuser" }));
    expect(res.status).toBe(429);
    const data = await res.json() as { success: boolean; error: { code: string } };
    expect(data.error.code).toBe("RATE_LIMIT");
  });

  it("returns 404 when the GitHub profile does not exist", async () => {
    vi.mocked(fetchGitHubData).mockResolvedValueOnce({
      ok: false,
      kind: "not_found",
      message: "User not found",
    });

    const res = await POST(makePostReq({ username: "nonexistent" }));
    expect(res.status).toBe(404);
    const data = await res.json() as { error: { code: string } };
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("returns 502 on GitHub upstream error", async () => {
    vi.mocked(fetchGitHubData).mockResolvedValueOnce({
      ok: false,
      kind: "upstream_error",
      message: "GitHub is down",
    });

    const res = await POST(makePostReq({ username: "testuser" }));
    expect(res.status).toBe(502);
    const data = await res.json() as { error: { code: string } };
    expect(data.error.code).toBe("UPSTREAM");
  });

  it("returns 500 and no shareUrl when persistence fails", async () => {
    // Simulate all slug-creation attempts throwing a non-collision error
    vi.mocked(RoastModel.create).mockRejectedValue(new Error("DB write failed"));

    const res = await POST(makePostReq({ username: "testuser" }));
    expect(res.status).toBe(500);
    const data = await res.json() as { success: boolean; error: { code: string }; shareUrl?: string };
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("GENERATION");
    expect(data.shareUrl).toBeUndefined();
  });

  it("returns success with slug and shareUrl on a full successful flow", async () => {
    const res = await POST(makePostReq({ username: "testuser" }));
    expect(res.status).toBe(200);
    const data = await res.json() as { success: boolean; slug: string; shareUrl: string };
    expect(data.success).toBe(true);
    expect(data.slug).toBe("testuser-abc12");
    expect(typeof data.shareUrl).toBe("string");
  });
});

// ── GET /api/roast/[slug] ────────────────────────────────────────────────────

describe("GET /api/roast/[slug]", () => {
  it("returns 404 when no record exists for the slug", async () => {
    vi.mocked(RoastModel.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(null),
    } as never);

    const { request, params } = makeGetReq("unknown-slug");
    const res = await GET(request, { params });
    expect(res.status).toBe(404);
  });

  it("returns the record when it exists", async () => {
    const mockDoc = {
      slug: "found-abc12",
      username: "founduser",
      analysis: { score: 75 },
    };
    vi.mocked(RoastModel.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(mockDoc),
    } as never);

    const { request, params } = makeGetReq("found-abc12");
    const res = await GET(request, { params });
    expect(res.status).toBe(200);
    const data = await res.json() as { success: boolean; data: { slug: string } };
    expect(data.success).toBe(true);
    expect(data.data.slug).toBe("found-abc12");
  });
});
