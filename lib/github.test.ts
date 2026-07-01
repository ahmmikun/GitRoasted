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
});
