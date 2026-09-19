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

import type { ContributionData, GitHubProfile, GitHubRepo } from "./types";

const GITHUB_API_BASE = "https://api.github.com";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  license?: { spdx_id?: string | null; key?: string | null; name?: string | null } | null;
  topics?: string[] | null;
  watchers_count?: number;
  open_issues_count?: number;
}

/** Result of probing a repository's README file. */
interface ReadmeProbeResult {
  excerpt: string | null;
  hasReadme: boolean;
  isUsable: boolean;
  filename?: string;
}

/**
 * Fetch and clean the README for a given repo.
 *
 * Uses GitHub's native `GET /repos/{owner}/{repo}/readme` endpoint which
 * dynamically resolves the default branch's README regardless of casing or
 * extension (`README.md`, `README`, `readme.txt`, `README.markdown`, etc.).
 * Falls back to `/contents/README.md` if the `/readme` endpoint fails.
 */
async function fetchReadmeDetails(
  owner: string,
  repo: string,
  headers: Record<string, string>,
  maxLength: number,
): Promise<ReadmeProbeResult> {
  const encOwner = encodeURIComponent(owner);
  const encRepo = encodeURIComponent(repo);

  // 1. Try GitHub's preferred /readme endpoint
  try {
    const readmeUrl = `${GITHUB_API_BASE}/repos/${encOwner}/${encRepo}/readme`;
    let res = await fetch(readmeUrl, { headers });

    // Fallback: try contents/README.md if /readme returned 404
    if (res.status === 404) {
      const contentsUrl = `${GITHUB_API_BASE}/repos/${encOwner}/${encRepo}/contents/README.md`;
      const fallbackRes = await fetch(contentsUrl, { headers });
      if (fallbackRes.ok) {
        res = fallbackRes;
      }
    }

    if (!res.ok) {
      return { excerpt: null, hasReadme: false, isUsable: false };
    }

    const data = (await res.json()) as {
      content?: string;
      encoding?: string;
      name?: string;
      path?: string;
    };

    if (!data.content || data.encoding !== "base64") {
      return { excerpt: null, hasReadme: true, isUsable: false, filename: data.name ?? "README" };
    }

    const raw = Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("utf-8");
    const cleaned = raw
      .replace(/<!--[\s\S]*?-->/g, "")           // strip HTML comments
      .replace(/!\[.*?\]\(.*?\)/g, "")           // strip images
      .replace(/```[\s\S]*?```/g, "")             // strip code blocks
      .replace(/^#{1,6}\s+/gm, "")               // strip heading markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // links → text
      .replace(/[*_~`]/g, "")                     // strip emphasis chars
      .replace(/\s+/g, " ")                       // collapse whitespace
      .trim();

    // A README is considered usable if it has meaningful content (> 10 characters after stripping)
    const isUsable = cleaned.length >= 10;
    const excerpt = cleaned.length > maxLength ? cleaned.slice(0, maxLength) + "…" : cleaned;

    return {
      excerpt: isUsable ? excerpt : null,
      hasReadme: true,
      isUsable,
      filename: data.name ?? data.path ?? "README.md",
    };
  } catch {
    return { excerpt: null, hasReadme: false, isUsable: false };
  }
}

/** Legacy wrapper returning just the excerpt for compatibility. */
async function fetchReadmeExcerpt(
  owner: string,
  repo: string,
  headers: Record<string, string>,
  maxLength: number,
): Promise<string | null> {
  const result = await fetchReadmeDetails(owner, repo, headers, maxLength);
  return result.excerpt;
}

/** Build request headers, attaching User-Agent and bearer token when configured. */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "GitRoasted-Profile-Analyzer",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
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
    hasProfileReadme: false,
    profileReadme: null,
  };
}

/**
 * Map a raw GitHub repository payload onto the normalized GitHubRepo shape.
 *
 * Accurately detects licenses (including custom, non-SPDX, or "other" licenses),
 * descriptions, topics, and homepages.
 */
function mapRepo(raw: RawGitHubRepo): GitHubRepo {
  const rawLicense = raw.license;
  const spdx = rawLicense?.spdx_id?.trim() || null;
  const key = rawLicense?.key?.trim() || null;
  const name = rawLicense?.name?.trim() || null;

  // A license is present if rawLicense exists with any non-empty name, key, or SPDX ID.
  const hasLicense = Boolean(
    rawLicense &&
      ((spdx && spdx.toUpperCase() !== "NONE") ||
        (key && key.toLowerCase() !== "none") ||
        (name && name.toLowerCase() !== "none")),
  );

  const licenseSpdxOrKey =
    spdx && spdx.toUpperCase() !== "NOASSERTION" ? spdx : key || name || null;

  const desc = typeof raw.description === "string" ? raw.description.trim() : null;
  const hasDescription = desc !== null && desc.length > 0;

  const hp = typeof raw.homepage === "string" ? raw.homepage.trim() : null;
  const hasHomepage = hp !== null && hp.length > 0;

  const topics = Array.isArray(raw.topics)
    ? raw.topics.filter((t) => typeof t === "string" && t.trim().length > 0)
    : [];
  const hasTopics = topics.length > 0;

  return {
    name: raw.name ?? "",
    description: hasDescription ? desc : null,
    hasDescription,
    language: raw.language ?? null,
    stargazersCount: raw.stargazers_count ?? 0,
    forksCount: raw.forks_count ?? 0,
    fork: raw.fork ?? false,
    homepage: hasHomepage ? hp : null,
    hasHomepage,
    pushedAt: raw.pushed_at ?? "",
    license: licenseSpdxOrKey,
    licenseName: name || licenseSpdxOrKey,
    hasLicense,
    topics,
    hasTopics,
    watchers: raw.watchers_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
  };
}

/** Maximum number of repository pages to scan (10 pages * 100 = 1,000 repos). */
const MAX_REPO_PAGES = 10;

/**
 * Fetch the public profile and public repositories for a GitHub username.
 *
 * Fully supports:
 *  - Repository pagination beyond page 1
 *  - Case-insensitive profile README detection (`username/username`)
 *  - Verification of README usability before claiming presence
 *  - Graceful rate-limit and upstream error handling
 *
 * @param username The GitHub login to look up.
 * @returns A normalized, typed result describing success, not-found, or an upstream error.
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

  // Canonical login from profile response
  const canonicalLogin = rawProfile.login || username;

  // 2. Fetch all repositories across pages.
  const rawRepos: RawGitHubRepo[] = [];
  let page = 1;

  while (page <= MAX_REPO_PAGES) {
    let reposResponse: Response;
    try {
      reposResponse = await fetch(
        `${GITHUB_API_BASE}/users/${encodeURIComponent(canonicalLogin)}/repos?per_page=100&page=${page}&sort=updated`,
        { headers },
      );
    } catch {
      if (page === 1) {
        return {
          ok: false,
          kind: "upstream_error",
          message: "Failed to reach the GitHub API.",
        };
      }
      // On subsequent pages, retain the repos already fetched
      break;
    }

    if (!reposResponse.ok) {
      if (page === 1) {
        return {
          ok: false,
          kind: "upstream_error",
          message: `GitHub repositories request failed with status ${reposResponse.status}.`,
        };
      }
      break;
    }

    let pageRepos: RawGitHubRepo[];
    try {
      const parsed = await reposResponse.json();
      pageRepos = Array.isArray(parsed) ? (parsed as RawGitHubRepo[]) : [];
    } catch {
      if (page === 1) {
        return {
          ok: false,
          kind: "upstream_error",
          message: "Failed to read the GitHub API response.",
        };
      }
      break;
    }

    rawRepos.push(...pageRepos);

    // If fewer than 100 repos returned, this was the last page
    if (pageRepos.length < 100) {
      break;
    }

    page += 1;
  }

  const mappedProfile = mapProfile(rawProfile);
  const mappedRepos = rawRepos.map(mapRepo);

  // 3. Detect and verify Profile README:
  // Look for a repository named {canonicalLogin} case-insensitively.
  const profileRepoMatch = mappedRepos.find(
    (r) => r.name.toLowerCase() === canonicalLogin.toLowerCase(),
  );
  const profileRepoName = profileRepoMatch?.name || canonicalLogin;

  // 4. Select top repositories for README inspection:
  // Top non-forked repos sorted by stars (up to 15 repos for deep documentation audit).
  const nonForkedRepos = mappedRepos.filter((r) => !r.fork);
  const topRepos = [...nonForkedRepos]
    .sort((a, b) => b.stargazersCount - a.stargazersCount)
    .slice(0, 15);

  const [profileReadmeResult, ...topReadmeResults] = await Promise.allSettled([
    fetchReadmeDetails(canonicalLogin, profileRepoName, headers, 600),
    ...topRepos.map((r) => fetchReadmeDetails(canonicalLogin, r.name, headers, 300)),
  ]);

  if (profileReadmeResult.status === "fulfilled") {
    const pResult = profileReadmeResult.value;
    if (pResult.hasReadme && pResult.isUsable && pResult.excerpt) {
      mappedProfile.profileReadme = pResult.excerpt;
      mappedProfile.hasProfileReadme = true;
    } else {
      mappedProfile.hasProfileReadme = false;
      mappedProfile.profileReadme = null;
    }
  }

  topRepos.forEach((repo, i) => {
    const r = topReadmeResults[i];
    if (r?.status === "fulfilled") {
      repo.hasReadme = r.value.hasReadme;
      if (r.value.excerpt) {
        repo.readmeExcerpt = r.value.excerpt;
      }
    }
  });

  return { ok: true, profile: mappedProfile, repos: mappedRepos };
}

/* ── Contribution data ─────────────────────────────────────────────────────── */

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

/** Weeks in the trailing-year contribution calendar. */
const CONTRIBUTION_WEEKS = 52;

/**
 * GraphQL query for the trailing-year contribution calendar. The calendar is
 * the only public source of true commit/PR/issue counts, and it requires an
 * authenticated request.
 */
const CONTRIBUTIONS_QUERY = `
query ContributionCalendar($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
  }
}`;

/** Minimal shape of the GraphQL contribution calendar response we read. */
interface RawContributionsResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions?: number;
          weeks?: Array<{
            contributionDays?: Array<{
              contributionCount?: number;
              date?: string;
            }>;
          }>;
        };
      };
    } | null;
  };
  errors?: unknown;
}

/** A single contributing day, normalized from either data source. */
interface ContributionDay {
  date: string;
  count: number;
}

/**
 * Longest run of consecutive calendar days with at least one contribution.
 *
 * Days are sorted by date first so the result does not depend on input order,
 * and a gap of more than one day resets the run.
 */
function computeLongestStreak(days: ContributionDay[]): number {
  const active = days
    .filter((d) => d.count > 0 && !Number.isNaN(Date.parse(d.date)))
    .map((d) => ({ ...d, time: Date.parse(d.date) }))
    .sort((a, b) => a.time - b.time);

  let longest = 0;
  let current = 0;
  let previousTime: number | null = null;

  for (const day of active) {
    if (previousTime === null) {
      current = 1;
    } else {
      const gapDays = Math.round((day.time - previousTime) / MS_PER_DAY);
      if (gapDays === 0) continue; // duplicate date — ignore
      current = gapDays === 1 ? current + 1 : 1;
    }
    previousTime = day.time;
    if (current > longest) longest = current;
  }

  return longest;
}

/** Number of distinct ISO weeks (Monday-based) that contain a contribution. */
function countActiveWeeks(days: ContributionDay[]): number {
  const weeks = new Set<string>();
  for (const day of days) {
    if (day.count <= 0) continue;
    const time = Date.parse(day.date);
    if (Number.isNaN(time)) continue;
    // Bucket by the Monday of that day's week.
    const d = new Date(time);
    const dayOfWeek = (d.getUTCDay() + 6) % 7; // Monday = 0
    const monday = time - dayOfWeek * MS_PER_DAY;
    weeks.add(new Date(monday).toISOString().slice(0, 10));
  }
  return weeks.size;
}

/**
 * Fetch the trailing-year contribution calendar via the GitHub GraphQL API.
 * Requires `GITHUB_TOKEN`. Returns null when unavailable for any reason.
 */
async function fetchContributionCalendar(
  username: string,
): Promise<ContributionData | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.trim().length === 0) return null;

  try {
    const res = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: { login: username },
      }),
    });

    if (!res || !res.ok) return null;

    const payload = (await res.json()) as RawContributionsResponse;
    // GraphQL reports errors with a 200 status, so check the envelope too.
    if (payload.errors) return null;

    const calendar =
      payload.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) return null;

    const days: ContributionDay[] = [];
    for (const week of calendar.weeks ?? []) {
      for (const day of week.contributionDays ?? []) {
        if (typeof day.date === "string") {
          days.push({ date: day.date, count: day.contributionCount ?? 0 });
        }
      }
    }

    const total =
      typeof calendar.totalContributions === "number"
        ? calendar.totalContributions
        : days.reduce((sum, d) => sum + d.count, 0);

    return {
      totalContributions: Math.max(0, total),
      activeWeeks: Math.min(CONTRIBUTION_WEEKS, countActiveWeeks(days)),
      longestStreakDays: computeLongestStreak(days),
      estimated: false,
    };
  } catch {
    return null;
  }
}

/** Minimal shape of a public event we read for the fallback estimate. */
interface RawPublicEvent {
  created_at?: string;
}

/**
 * Fallback estimate built from the user's recent public events.
 *
 * This is a much weaker signal than the contribution calendar — it only covers
 * the last ~90 days and at most 100 events — so the result is flagged
 * `estimated: true` and the scorer caps how much credit it can earn.
 * Returns null when even this cannot be read.
 */
async function fetchContributionEstimate(
  username: string,
): Promise<ContributionData | null> {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/users/${encodeURIComponent(username)}/events/public?per_page=100`,
      { headers: buildHeaders() },
    );
    if (!res || !res.ok) return null;

    const parsed = await res.json();
    if (!Array.isArray(parsed)) return null;

    const events = parsed as RawPublicEvent[];
    const counts = new Map<string, number>();
    for (const event of events) {
      if (typeof event?.created_at !== "string") continue;
      const time = Date.parse(event.created_at);
      if (Number.isNaN(time)) continue;
      const key = new Date(time).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const days: ContributionDay[] = [...counts.entries()].map(([date, count]) => ({
      date,
      count,
    }));

    return {
      totalContributions: events.length,
      activeWeeks: Math.min(CONTRIBUTION_WEEKS, countActiveWeeks(days)),
      longestStreakDays: computeLongestStreak(days),
      estimated: true,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch trailing-year contribution data for a username.
 *
 * Prefers the authenticated GraphQL contribution calendar and falls back to a
 * rougher estimate derived from recent public events. Never throws and never
 * reports a failure as an error: a null result simply means the Consistency
 * dimension will degrade gracefully.
 *
 * @param username The GitHub login to look up.
 */
export async function fetchContributionData(
  username: string,
): Promise<ContributionData | null> {
  const calendar = await fetchContributionCalendar(username);
  if (calendar) return calendar;
  return fetchContributionEstimate(username);
}
