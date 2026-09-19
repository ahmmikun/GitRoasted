// Task 3.2: Unit tests for the GitHub client.
// Mocks the global fetch to cover success, 404, 403/5xx, network errors, and empty repos.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGitHubData } from "./github";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const rawProfile = {
  login: "testuser",
  name: "Test User",
  avatar_url: "https://avatars.githubusercontent.com/testuser",
  bio: "Just testing",
  followers: 42,
  following: 7,
  public_repos: 5,
  html_url: "https://github.com/testuser",
  blog: "https://example.com",
  company: "TestCo",
  location: "Earth",
  created_at: "2020-01-01T00:00:00Z",
};

const rawRepos = [
  {
    name: "my-repo",
    description: "A test repo",
    language: "TypeScript",
    stargazers_count: 10,
    forks_count: 3,
    fork: false,
    homepage: null,
    pushed_at: "2024-01-01T00:00:00Z",
  },
];

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

function errorResponse(status: number) {
  return { ok: false, status };
}

function networkError() {
  return Promise.reject(new Error("Network failure"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchGitHubData", () => {
  it("returns ok:true with normalized profile and repos on success", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(rawProfile))
      .mockResolvedValueOnce(jsonResponse(rawRepos))
      // profile README (username/username) → 404 (no profile README)
      .mockResolvedValueOnce({ ok: false, status: 404 })
      // top repo README (my-repo) → 404
      .mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchGitHubData("testuser");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.profile.login).toBe("testuser");
    expect(result.profile.name).toBe("Test User");
    expect(result.profile.avatarUrl).toBe(rawProfile.avatar_url);
    expect(result.profile.followers).toBe(42);
    expect(result.profile.blog).toBe("https://example.com");
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].name).toBe("my-repo");
    expect(result.repos[0].stargazersCount).toBe(10);
    expect(result.repos[0].forksCount).toBe(3);
    expect(result.repos[0].fork).toBe(false);
  });

  it("returns not_found when the profile endpoint returns 404", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404));
    const result = await fetchGitHubData("nonexistent");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("not_found");
    expect(result.message).toContain("nonexistent");
  });

  it("returns upstream_error for a 403 response (forbidden / rate-limited)", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403));
    const result = await fetchGitHubData("someone");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("upstream_error");
  });

  it("returns upstream_error for a 429 response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429));
    const result = await fetchGitHubData("someone");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("upstream_error");
  });

  it("returns upstream_error for a 500 server error", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));
    const result = await fetchGitHubData("someone");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("upstream_error");
  });

  it("returns upstream_error when the profile request throws (network failure)", async () => {
    mockFetch.mockImplementationOnce(() => networkError());
    const result = await fetchGitHubData("someone");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("upstream_error");
  });

  it("returns upstream_error when the repos request throws (network failure)", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(rawProfile))
      .mockImplementationOnce(() => networkError());
    const result = await fetchGitHubData("testuser");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("upstream_error");
  });

  it("returns upstream_error when the repos endpoint returns non-ok status", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(rawProfile))
      .mockResolvedValueOnce(errorResponse(503));
    const result = await fetchGitHubData("testuser");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("upstream_error");
  });

  it("returns ok:true with an empty repos array when the user has no public repos", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(rawProfile))
      .mockResolvedValueOnce(jsonResponse([]))
      // profile README only (no top repos to fetch)
      .mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchGitHubData("testuser");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repos).toHaveLength(0);
  });

  it("normalizes null/undefined optional fields to null or sensible defaults", async () => {
    const minimalProfile = { login: "min", html_url: "https://github.com/min" };
    mockFetch
      .mockResolvedValueOnce(jsonResponse(minimalProfile))
      .mockResolvedValueOnce(jsonResponse([]))
      // profile README only
      .mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchGitHubData("min");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.name).toBeNull();
    expect(result.profile.bio).toBeNull();
    expect(result.profile.blog).toBeNull();
  });

  it("detects an existing valid profile README case-insensitively and sets hasProfileReadme", async () => {
    const mixedProfile = {
      login: "Ahmmikun",
      avatar_url: "https://example.com/avatar.png",
      html_url: "https://github.com/Ahmmikun",
    };
    const userRepos = [
      {
        name: "ahmmikun", // lowercase repo matching login case-insensitively
        description: "Special profile repository",
        fork: false,
        stargazers_count: 5,
        forks_count: 0,
      },
    ];

    const readmeContent = Buffer.from("# Hi, I'm Ahmmikun\nFull stack developer working on TypeScript and React!").toString("base64");

    mockFetch
      .mockResolvedValueOnce(jsonResponse(mixedProfile))
      .mockResolvedValueOnce(jsonResponse(userRepos))
      // Profile README probe on /repos/Ahmmikun/ahmmikun/readme
      .mockResolvedValueOnce(jsonResponse({
        name: "README.md",
        encoding: "base64",
        content: readmeContent,
      }))
      // Top repo README probe
      .mockResolvedValueOnce(jsonResponse({
        name: "README.md",
        encoding: "base64",
        content: readmeContent,
      }));

    const result = await fetchGitHubData("Ahmmikun");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.profile.hasProfileReadme).toBe(true);
    expect(result.profile.profileReadme).toContain("Hi, I'm Ahmmikun");
  });

  it("marks profile README as missing when content is empty or whitespace-only", async () => {
    const profile = { login: "emptyreadme", html_url: "https://github.com/emptyreadme" };
    const emptyBase64 = Buffer.from("   <!-- placeholder -->   \n").toString("base64");

    mockFetch
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({
        name: "README.md",
        encoding: "base64",
        content: emptyBase64,
      }));

    const result = await fetchGitHubData("emptyreadme");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.profile.hasProfileReadme).toBe(false);
    expect(result.profile.profileReadme).toBeNull();
  });

  it("paginates repositories beyond page 1", async () => {
    const profile = { login: "manyrepos", html_url: "https://github.com/manyrepos" };
    // Generate 100 dummy repos for page 1
    const page1Repos = Array.from({ length: 100 }, (_, i) => ({
      name: `repo-${i + 1}`,
      stargazers_count: 0,
      forks_count: 0,
      fork: false,
    }));
    // Generate 25 dummy repos for page 2 (< 100 terminates pagination)
    const page2Repos = Array.from({ length: 25 }, (_, i) => ({
      name: `repo-${101 + i}`,
      stargazers_count: 0,
      forks_count: 0,
      fork: false,
    }));

    mockFetch
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(jsonResponse(page1Repos)) // page 1
      .mockResolvedValueOnce(jsonResponse(page2Repos)) // page 2
      .mockResolvedValueOnce({ ok: false, status: 404 }); // profile readme

    const result = await fetchGitHubData("manyrepos");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.repos).toHaveLength(125);
    expect(result.repos[0].name).toBe("repo-1");
    expect(result.repos[124].name).toBe("repo-125");
  });

  it("gracefully retains page 1 repositories if page 2 encounters a rate limit", async () => {
    const profile = { login: "ratelimited", html_url: "https://github.com/ratelimited" };
    const page1Repos = Array.from({ length: 100 }, (_, i) => ({
      name: `repo-${i + 1}`,
      stargazers_count: 0,
      forks_count: 0,
      fork: false,
    }));

    mockFetch
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(jsonResponse(page1Repos)) // page 1 succeeds
      .mockResolvedValueOnce({ ok: false, status: 403 }) // page 2 rate-limited
      .mockResolvedValueOnce({ ok: false, status: 404 }); // profile readme

    const result = await fetchGitHubData("ratelimited");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Repositories from page 1 are preserved
    expect(result.repos).toHaveLength(100);
  });

  it("correctly identifies custom and NOASSERTION licenses", async () => {
    const profile = { login: "customlicense", html_url: "https://github.com/customlicense" };
    const repos = [
      {
        name: "custom-licensed-repo",
        license: { spdx_id: "NOASSERTION", key: "other", name: "Custom Company License" },
        fork: false,
        stargazers_count: 0,
        forks_count: 0,
      },
    ];

    mockFetch
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(jsonResponse(repos))
      .mockResolvedValueOnce({ ok: false, status: 404 }) // profile readme
      .mockResolvedValueOnce({ ok: false, status: 404 }); // repo readme

    const result = await fetchGitHubData("customlicense");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.repos[0].hasLicense).toBe(true);
    expect(result.repos[0].licenseName).toBe("Custom Company License");
  });
});
