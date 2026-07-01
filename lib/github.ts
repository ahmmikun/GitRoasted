/**
 * GitHub_Client for GitRoasted.
 *
 * Wraps the GitHub REST API (https://api.github.com) to fetch a public
 * profile and its public repositories. Uses `GITHUB_TOKEN` for higher rate
 * limits when present. All outcomes are normalized into a typed
 * `GitHubFetchResult` so callers never have to catch:
 *  - a 404 on the profile maps to `not_found`
 *  - any 403 / 429 / 5xx response or network failure maps to `upstream_error`
 *  - an existing profile (even with no repositories) returns `ok: true`
 */

import type { GitHubProfile, GitHubRepo } from "./types";

const GITHUB_API_BASE = "https://api.github.com";

/** Discriminated result of fetching GitHub data for a username. */
export type GitHubFetchResult =
  | { ok: true; profile: GitHubProfile; repos: GitHubRepo[] }
  | { ok: false; kind: "not_found" | "upstream_error"; message: string };

/** Shape of the raw GitHub REST `/users/{username}` response we read. */
interface RawGitHubUser {
  login?: string;
  name?: string | null;
  avatar_url?: string;
  bio?: string | null;
  followers?: number;
  following?: number;
  public_repos?: number;
  html_url?: string;
  blog?: string | null;
  company?: string | null;
  location?: string | null;
  created_at?: string;
}

/** Shape of a raw GitHub REST repository object we read. */
interface RawGitHubRepo {
  name?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  fork?: boolean;
  homepage?: string | null;
  pushed_at?: string;
}

/**
 * Fetch and clean the README for a given repo. Returns null when the repo has
 * no README (404) or on any error — missing READMEs are the common case and
 * must never surface as an error to callers.
 */
async function fetchReadmeExcerpt(
  owner: string,
  repo: string,
  headers: Record<string, string>,
  maxLength: number,
): Promise<string | null> {
  try {
    const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/README.md`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== "base64") return null;
    const raw = Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("utf-8");
    const cleaned = raw
      .replace(/!\[.*?\]\(.*?\)/g, "")           // strip images
      .replace(/```[\s\S]*?```/g, "")             // strip code blocks
      .replace(/^#{1,6}\s+/gm, "")               // strip heading markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // links → text
      .replace(/[*_~`]/g, "")                     // strip emphasis chars
      .replace(/\s+/g, " ")                       // collapse whitespace
      .trim();
    if (!cleaned) return null;
    return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + "…" : cleaned;
  } catch {
    return null;
  }
}

/** Build request headers, attaching the bearer token when configured. */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Map a raw GitHub user payload onto the normalized GitHubProfile shape. */
function mapProfile(raw: RawGitHubUser): GitHubProfile {
  return {
    login: raw.login ?? "",
    name: raw.name ?? null,
    avatarUrl: raw.avatar_url ?? "",
    bio: raw.bio ?? null,
    followers: raw.followers ?? 0,
    following: raw.following ?? 0,
    publicRepos: raw.public_repos ?? 0,
    profileUrl: raw.html_url ?? "",
    blog: raw.blog ? raw.blog : null,
    company: raw.company ?? null,
    location: raw.location ?? null,
    createdAt: raw.created_at ?? "",
  };
}

/** Map a raw GitHub repository payload onto the normalized GitHubRepo shape. */
function mapRepo(raw: RawGitHubRepo): GitHubRepo {
  return {
    name: raw.name ?? "",
    description: raw.description ?? null,
    language: raw.language ?? null,
    stargazersCount: raw.stargazers_count ?? 0,
    forksCount: raw.forks_count ?? 0,
    fork: raw.fork ?? false,
    homepage: raw.homepage ? raw.homepage : null,
    pushedAt: raw.pushed_at ?? "",
  };
}

/**
 * Fetch the public profile and public repositories for a GitHub username.
 *
 * @param username The GitHub login to look up.
 * @returns A normalized, typed result describing success, not-found, or an
 *          upstream error.
 */
export async function fetchGitHubData(
  username: string,
): Promise<GitHubFetchResult> {
  const headers = buildHeaders();
  const encoded = encodeURIComponent(username);

  // 1. Fetch the profile.
  let profileResponse: Response;
  try {
    profileResponse = await fetch(`${GITHUB_API_BASE}/users/${encoded}`, {
      headers,
    });
  } catch {
    return {
      ok: false,
      kind: "upstream_error",
      message: "Failed to reach the GitHub API.",
    };
  }

  if (profileResponse.status === 404) {
    return {
      ok: false,
      kind: "not_found",
      message: `GitHub user "${username}" was not found.`,
    };
  }

  if (!profileResponse.ok) {
    return {
      ok: false,
      kind: "upstream_error",
      message: `GitHub profile request failed with status ${profileResponse.status}.`,
    };
  }

  let rawProfile: RawGitHubUser;
  try {
    rawProfile = (await profileResponse.json()) as RawGitHubUser;
  } catch {
    return {
      ok: false,
      kind: "upstream_error",
      message: "Failed to read the GitHub API response.",
    };
  }

  // 2. Fetch the repositories.
  let reposResponse: Response;
  try {
    reposResponse = await fetch(
      `${GITHUB_API_BASE}/users/${encoded}/repos?per_page=100&sort=updated`,
      { headers },
    );
  } catch {
    return {
      ok: false,
      kind: "upstream_error",
      message: "Failed to reach the GitHub API.",
    };
  }

  if (!reposResponse.ok) {
    return {
      ok: false,
      kind: "upstream_error",
      message: `GitHub repositories request failed with status ${reposResponse.status}.`,
    };
  }

  let rawRepos: RawGitHubRepo[];
  try {
    const parsed = await reposResponse.json();
    rawRepos = Array.isArray(parsed) ? (parsed as RawGitHubRepo[]) : [];
  } catch {
    return {
      ok: false,
      kind: "upstream_error",
      message: "Failed to read the GitHub API response.",
    };
  }

  const mappedProfile = mapProfile(rawProfile);
  const mappedRepos = rawRepos.map(mapRepo);

  // Top 3 non-forked repos by stars — fetch their READMEs in parallel with the
  // profile README. All failures are silently swallowed via Promise.allSettled.
  const topRepos = [...mappedRepos]
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazersCount - a.stargazersCount)
    .slice(0, 3);

  const readmeResults = await Promise.allSettled([
    fetchReadmeExcerpt(username, username, headers, 600), // profile README
    ...topRepos.map((r) => fetchReadmeExcerpt(username, r.name, headers, 300)),
  ]);

  mappedProfile.profileReadme =
    readmeResults[0]?.status === "fulfilled" ? readmeResults[0].value : null;

  topRepos.forEach((repo, i) => {
    const r = readmeResults[i + 1];
    if (r?.status === "fulfilled") repo.readmeExcerpt = r.value;
  });

  return { ok: true, profile: mappedProfile, repos: mappedRepos };
}
