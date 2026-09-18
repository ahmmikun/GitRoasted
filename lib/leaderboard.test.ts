// Tests for leaderboard ranking, search, pagination, and the API route's
// error/empty handling.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  default: vi.fn().mockResolvedValue(undefined),
}));

const findChain = {
  select: vi.fn(),
  sort: vi.fn(),
  skip: vi.fn(),
  limit: vi.fn(),
  lean: vi.fn(),
};

vi.mock("@/models/ProfileAnalysis", () => ({
  ProfileAnalysisModel: {
    find: vi.fn(() => findChain),
    countDocuments: vi.fn(),
  },
}));

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, escapeRegex, getLeaderboardPage } from "./leaderboard";
import { ProfileAnalysisModel } from "@/models/ProfileAnalysis";
import { GET } from "@/app/api/leaderboard/route";

/** Build a stored snapshot document. */
function doc(username: string, score: number, extra: Record<string, unknown> = {}) {
  return {
    username,
    login: username,
    name: `${username} name`,
    avatarUrl: `https://example.com/${username}.png`,
    profileUrl: `https://github.com/${username}`,
    score,
    grade: "B",
    tier: "Strong",
    primaryLanguage: "TypeScript",
    followers: 10,
    totalStars: 100,
    publicRepos: 5,
    analyzedAt: new Date("2025-01-01T00:00:00Z"),
    ...extra,
  };
}

/** Point the mocked find() chain at a fixed result set. */
function stubResults(docs: unknown[], total = docs.length, unfilteredTotal = total) {
  findChain.select.mockReturnValue(findChain);
  findChain.sort.mockReturnValue(findChain);
  findChain.skip.mockReturnValue(findChain);
  findChain.limit.mockReturnValue(findChain);
  findChain.lean.mockResolvedValue(docs);

  vi.mocked(ProfileAnalysisModel.countDocuments).mockImplementation((filter?: unknown) => {
    const isFiltered = filter && Object.keys(filter as object).length > 0;
    return Promise.resolve(isFiltered ? total : unfilteredTotal) as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("escapeRegex", () => {
  it("escapes regex metacharacters so search terms stay literal", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegex("(x)[y]")).toBe("\\(x\\)\\[y\\]");
  });
});

describe("getLeaderboardPage — ranking", () => {
  it("sorts by score descending with username as a stable tie-break", async () => {
    stubResults([doc("alpha", 900), doc("beta", 700)]);

    await getLeaderboardPage();

    expect(findChain.sort).toHaveBeenCalledWith({ score: -1, username: 1 });
  });

  it("assigns absolute ranks that continue across pages", async () => {
    stubResults([doc("k", 500), doc("l", 400)], 42);

    const result = await getLeaderboardPage({ page: 3, pageSize: 10 });

    expect(result.entries[0].rank).toBe(21);
    expect(result.entries[1].rank).toBe(22);
    expect(findChain.skip).toHaveBeenCalledWith(20);
    expect(findChain.limit).toHaveBeenCalledWith(10);
  });

  it("projects only public fields and excludes _id", async () => {
    stubResults([doc("a", 100)]);
    await getLeaderboardPage();

    const projection = findChain.select.mock.calls[0][0] as string;
    expect(projection).toContain("-_id");
    expect(projection).not.toContain("stats");
    expect(projection).not.toContain("breakdown");
  });

  it("fills in sensible defaults for missing snapshot fields", async () => {
    stubResults([
      {
        username: "sparse",
        login: "",
        score: 0,
        analyzedAt: new Date("2025-01-01T00:00:00Z"),
      },
    ]);

    const { entries } = await getLeaderboardPage();
    expect(entries[0].login).toBe("sparse");
    expect(entries[0].profileUrl).toBe("https://github.com/sparse");
    expect(entries[0].name).toBeNull();
    expect(entries[0].grade).toBe("F");
    expect(entries[0].primaryLanguage).toBeNull();
  });
});

describe("getLeaderboardPage — pagination bounds", () => {
  it("defaults to page 1 with the default page size", async () => {
    stubResults([]);
    const result = await getLeaderboardPage();

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(findChain.skip).toHaveBeenCalledWith(0);
  });

  it("coerces invalid or negative pagination input", async () => {
    stubResults([]);
    const result = await getLeaderboardPage({ page: "-3", pageSize: "abc" });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("caps the page size to bound the response payload", async () => {
    stubResults([]);
    const result = await getLeaderboardPage({ pageSize: 5000 });

    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(findChain.limit).toHaveBeenCalledWith(MAX_PAGE_SIZE);
  });

  it("reports at least one total page even when empty", async () => {
    stubResults([], 0, 0);
    const result = await getLeaderboardPage();

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.entries).toEqual([]);
  });

  it("computes totalPages from the filtered total", async () => {
    stubResults([doc("a", 10)], 45);
    const result = await getLeaderboardPage({ pageSize: 20 });
    expect(result.totalPages).toBe(3);
  });
});

describe("getLeaderboardPage — search", () => {
  it("applies a case-insensitive search across username and name", async () => {
    stubResults([doc("torvalds", 980)], 1, 120);

    const result = await getLeaderboardPage({ q: "TORV" });

    const filter = vi.mocked(ProfileAnalysisModel.find).mock.calls[0][0] as unknown as {
      $or: Array<Record<string, RegExp>>;
    };
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].username.flags).toContain("i");
    expect(filter.$or[0].username.source).toBe("TORV");
    expect(result.query).toBe("TORV");
    // The unfiltered count is preserved so the UI can distinguish
    // "no matches" from "no data at all".
    expect(result.totalDevelopers).toBe(120);
  });

  it("ignores a blank search term", async () => {
    stubResults([doc("a", 10)]);
    await getLeaderboardPage({ q: "   " });

    expect(vi.mocked(ProfileAnalysisModel.find).mock.calls[0][0]).toEqual({});
  });

  it("does not let a regex-special search term break the query", async () => {
    stubResults([]);
    await getLeaderboardPage({ q: "a(b" });

    const filter = vi.mocked(ProfileAnalysisModel.find).mock.calls[0][0] as unknown as {
      $or: Array<Record<string, RegExp>>;
    };
    expect(filter.$or[0].username.source).toBe("a\\(b");
  });
});

describe("GET /api/leaderboard", () => {
  function makeReq(url: string) {
    return new Request(url) as unknown as import("next/server").NextRequest;
  }

  it("returns a ranked page", async () => {
    stubResults([doc("alpha", 900)]);

    const res = await GET(makeReq("http://localhost/api/leaderboard?page=1&pageSize=10"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: { entries: Array<{ username: string; rank: number }> };
    };
    expect(body.success).toBe(true);
    expect(body.data.entries[0]).toMatchObject({ username: "alpha", rank: 1 });
  });

  it("returns an empty page rather than an error when no data exists", async () => {
    stubResults([], 0, 0);

    const res = await GET(makeReq("http://localhost/api/leaderboard"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: { entries: unknown[]; totalDevelopers: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.entries).toEqual([]);
    expect(body.data.totalDevelopers).toBe(0);
  });

  it("returns a friendly 503 without leaking the underlying error", async () => {
    vi.mocked(ProfileAnalysisModel.countDocuments).mockRejectedValue(
      new Error("ECONNREFUSED mongodb://secret-host:27017"),
    );
    findChain.select.mockReturnValue(findChain);
    findChain.sort.mockReturnValue(findChain);
    findChain.skip.mockReturnValue(findChain);
    findChain.limit.mockReturnValue(findChain);
    findChain.lean.mockResolvedValue([]);

    const res = await GET(makeReq("http://localhost/api/leaderboard"));
    expect(res.status).toBe(503);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("LEADERBOARD_UNAVAILABLE");
    expect(body.error.message).not.toContain("ECONNREFUSED");
    expect(body.error.message).not.toContain("secret-host");
  });
});
