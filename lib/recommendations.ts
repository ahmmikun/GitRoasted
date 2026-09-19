/**
 * Improvement_Engine — turns a Developer_Score breakdown into a practical
 * roadmap.
 *
 * Design rules, enforced by the tests:
 *  - Every recommendation is triggered by a specific measured shortfall. If the
 *    data does not support it, it is not emitted.
 *  - No generic filler ("code more", "build more projects").
 *  - Each item names the metric it affects and explains why it was raised, so a
 *    developer can verify the reasoning against their own profile.
 *  - Impact is described qualitatively (which dimension has headroom), never as
 *    a fabricated promise like "+100 points".
 *  - Recommendations are grouped by the effort required, not by severity, so the
 *    quick wins are genuinely quick.
 */

import { DIMENSION_META, findDimension } from "./scoring";
import type { DimensionScore, GitHubProfile, GitHubStats, ScoreDimensionKey } from "./types";

/** How much work a recommendation represents. */
export type RecommendationTier = "quickWin" | "shortTerm" | "longTerm";

export interface Recommendation {
  /** Stable identifier, useful as a React key and in tests. */
  id: string;
  title: string;
  /** Why this was raised, referencing the user's own numbers. */
  why: string;
  /** The scoring dimension this affects. */
  metric: string;
  metricKey: ScoreDimensionKey;
  /** Qualitative statement of available headroom. */
  impact: string;
  /** The concrete next action. */
  action: string;
  /** A practical illustration of the action. */
  example: string;
  tier: RecommendationTier;
  /** Specific repositories that triggered this recommendation. */
  affectedRepos?: Array<{ name: string; missing: string; fix?: string }>;
}

export interface ImprovementRoadmap {
  quickWins: Recommendation[];
  shortTerm: Recommendation[];
  longTerm: Recommendation[];
  /** Dimensions with the most unearned points, strongest gap first. */
  focusDimensions: Array<{ key: ScoreDimensionKey; label: string; missing: number; max: number }>;
  /** True when the profile is strong enough that little is worth flagging. */
  isStrongProfile: boolean;
  /** Total number of recommendations across all tiers. */
  count: number;
}

/** Ratio of a dimension's ceiling that counts as "needs attention". */
const WEAK_RATIO = 0.6;

/** Describe available headroom without promising an exact score change. */
function headroom(dimension: DimensionScore | undefined): string {
  if (!dimension) return "Affects your overall score.";
  const missing = Math.max(0, dimension.max - dimension.score);
  if (missing === 0) {
    return `${dimension.label} is already maxed out at ${dimension.max}.`;
  }
  return `${dimension.label} currently sits at ${dimension.score} of ${dimension.max}, so there are up to ${missing} points of headroom here.`;
}

/** Proportion of a dimension's cap that has been earned (0..1). */
function earnedRatio(dimension: DimensionScore | undefined): number {
  if (!dimension || dimension.max <= 0) return 1;
  return dimension.score / dimension.max;
}

/** Build a recommendation, wiring in the dimension metadata. */
function rec(
  id: string,
  tier: RecommendationTier,
  metricKey: ScoreDimensionKey,
  dimension: DimensionScore | undefined,
  fields: {
    title: string;
    why: string;
    action: string;
    example: string;
    affectedRepos?: Array<{ name: string; missing: string; fix?: string }>;
  },
): Recommendation {
  return {
    id,
    tier,
    metricKey,
    metric: DIMENSION_META[metricKey].label,
    impact: headroom(dimension),
    ...fields,
  };
}

/** Safe numeric accessor for optional stat fields. */
function n(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Whether a string field is meaningfully present. */
function has(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Build the improvement roadmap for an analyzed profile.
 *
 * @param profile   Normalized profile data.
 * @param stats     Aggregate repository statistics.
 * @param breakdown The score breakdown produced by the scoring engine.
 */
export function buildRoadmap(
  profile: GitHubProfile,
  stats: GitHubStats,
  breakdown: DimensionScore[],
): ImprovementRoadmap {
  const quickWins: Recommendation[] = [];
  const shortTerm: Recommendation[] = [];
  const longTerm: Recommendation[] = [];

  const quality = findDimension(breakdown, "quality");
  const bonuses = findDimension(breakdown, "bonuses");
  const activity = findDimension(breakdown, "activity");
  const consistency = findDimension(breakdown, "consistency");
  const community = findDimension(breakdown, "community");
  const impact = findDimension(breakdown, "impact");
  const diversity = findDimension(breakdown, "diversity");

  const totalRepos = n(stats.totalReposAnalyzed);
  const originals = n(stats.originalRepos);

  /* ── Quick wins: profile metadata and repo hygiene ───────────────────────── */

  if (!has(profile.bio)) {
    quickWins.push(
      rec("add-bio", "quickWin", "bonuses", bonuses, {
        title: "Add a bio to your GitHub profile",
        why: "Your profile has no bio, which is one of the profile-completeness signals the Bonuses dimension checks.",
        action:
          "Write a one-line bio describing what you build and the stack you work in.",
        example:
          'For example: "Backend engineer working on distributed systems in Go and Rust."',
      }),
    );
  }

  if (!has(profile.blog)) {
    quickWins.push(
      rec("add-website", "quickWin", "bonuses", bonuses, {
        title: "Link a website or portfolio",
        why: "No website or link is set on your profile, so the Bonuses dimension is missing that signal.",
        action:
          "Add a portfolio, blog, or even your most relevant project URL to the website field.",
        example:
          "Point it at a live demo of your strongest project if you do not have a personal site.",
      }),
    );
  }

  // Only recommend creating a profile README if genuinely missing or unusable
  const hasValidProfileReadme =
    profile.hasProfileReadme === true || has(profile.profileReadme ?? null);

  if (!hasValidProfileReadme) {
    quickWins.push(
      rec("profile-readme", "quickWin", "bonuses", bonuses, {
        title: "Create a profile README",
        why: "No profile README was found, which is the largest single Bonuses signal.",
        action:
          "Create a repository named exactly after your username and add a README.md to it.",
        example: `Create the repo "${profile.login}/${profile.login}" with a short intro, what you are working on, and how to reach you.`,
      }),
    );
  }

  const undescribedList = stats.undescribedRepoNames ?? [];
  const undescribed =
    undescribedList.length > 0 ? undescribedList.length : n(stats.reposWithoutDescription);

  if (totalRepos > 0 && undescribed > 0) {
    const repoExamples =
      undescribedList.length > 0
        ? ` (e.g. ${undescribedList.slice(0, 3).map((r) => `"${r}"`).join(", ")})`
        : "";
    quickWins.push(
      rec("add-descriptions", "quickWin", "quality", quality, {
        title: `Describe your ${undescribed} undescribed repositor${undescribed === 1 ? "y" : "ies"}`,
        why: `${undescribed} of your ${totalRepos} repositories have no description${repoExamples}, and description coverage is the heaviest Quality signal.`,
        action: `Add a one-sentence description to ${undescribedList.length > 0 ? undescribedList.slice(0, 3).join(", ") : "each repository"} explaining what it does and who it is for.`,
        example:
          'A good description reads like "CLI that converts OpenAPI specs into typed TypeScript clients" — not "my project".',
        affectedRepos: undescribedList.map((name) => ({
          name,
          missing: "description",
          fix: "Add a clear repository description in repository settings.",
        })),
      }),
    );
  }

  const untaggedList = stats.untaggedRepoNames ?? [];
  const missingTopics =
    untaggedList.length > 0
      ? untaggedList.length
      : Math.max(0, originals - n(stats.reposWithTopics));

  if (originals > 0 && missingTopics > 0) {
    const repoExamples =
      untaggedList.length > 0
        ? ` (e.g. ${untaggedList.slice(0, 3).map((r) => `"${r}"`).join(", ")})`
        : "";
    quickWins.push(
      rec("add-topics", "quickWin", "quality", quality, {
        title: "Add topics to your repositories",
        why: `${missingTopics} of your ${originals} original repositories have no topics${repoExamples}, so they are harder to discover and score lower on Quality.`,
        action: `Tag ${untaggedList.length > 0 ? untaggedList.slice(0, 3).join(", ") : "each repository"} with 3–5 relevant topics.`,
        example:
          'A Rust CLI might use "rust", "cli", "developer-tools", "command-line".',
        affectedRepos: untaggedList.map((name) => ({
          name,
          missing: "topics",
          fix: "Add 3-5 relevant topics under repository 'About' settings.",
        })),
      }),
    );
  }

  const unlicensedList = stats.unlicensedRepoNames ?? [];
  const missingLicenses =
    unlicensedList.length > 0
      ? unlicensedList.length
      : Math.max(0, originals - n(stats.reposWithLicense));

  if (originals > 0 && missingLicenses > 0) {
    const repoExamples =
      unlicensedList.length > 0
        ? ` (e.g. ${unlicensedList.slice(0, 3).map((r) => `"${r}"`).join(", ")})`
        : "";
    quickWins.push(
      rec("add-license", "quickWin", "quality", quality, {
        title: "Add a licence to your public repositories",
        why: `${missingLicenses} of your ${originals} original repositories have no detectable licence${repoExamples}, which counts against Quality and discourages reuse.`,
        action: `Add a LICENSE file to ${unlicensedList.length > 0 ? unlicensedList.slice(0, 3).join(", ") : "your repositories"} — GitHub can generate one for you from the Add file menu.`,
        example:
          "MIT is the common default for small libraries and tools; Apache-2.0 adds an explicit patent grant.",
        affectedRepos: unlicensedList.map((name) => ({
          name,
          missing: "license",
          fix: "Add a LICENSE file (e.g. MIT, Apache-2.0, or GPL).",
        })),
      }),
    );
  }

  /* ── Short term: documentation, demos, and getting back to active ────────── */

  const missingReadmeList = stats.missingReadmeRepoNames ?? [];
  const shouldRecommendReadme =
    missingReadmeList.length > 0 || (totalRepos > 0 && n(stats.reposWithReadme) === 0);

  if (totalRepos > 0 && shouldRecommendReadme) {
    const missingNote =
      missingReadmeList.length > 0
        ? ` (e.g. on ${missingReadmeList.slice(0, 3).join(", ")})`
        : "";
    shortTerm.push(
      rec("write-readmes", "shortTerm", "quality", quality, {
        title: "Write a real README for your top repositories",
        why: `We could not read a README on your public repositories${missingNote}, and README presence is part of the Quality score.`,
        action:
          "For your top repositories, write a README covering what it does, how to install it, and a usage example.",
        example:
          "Open with one sentence on the problem it solves, then a copy-pasteable install command and a short code sample.",
        affectedRepos: missingReadmeList.map((name) => ({
          name,
          missing: "readme",
          fix: "Create a README.md file in the root directory.",
        })),
      }),
    );
  }

  if (originals > 0 && n(stats.reposWithHomepage) === 0) {
    shortTerm.push(
      rec("add-demo-links", "shortTerm", "quality", quality, {
        title: "Publish a demo or docs link for your best project",
        why: "None of your repositories have a homepage set, so the demo-link portion of Quality is unearned.",
        action:
          "Deploy one project and set the repository's website field to that URL.",
        example:
          "GitHub Pages is enough for a static demo; for a library, link to its documentation page instead.",
      }),
    );
  }

  const daysSincePush = stats.daysSinceLastPush;
  if (typeof daysSincePush === "number" && daysSincePush > 60) {
    shortTerm.push(
      rec("resume-pushing", "shortTerm", "activity", activity, {
        title: "Push work to a public repository again",
        why: `Your most recent public push was ${daysSincePush} days ago, and the Activity dimension weights recency heavily.`,
        action:
          "Pick one existing repository and land a real change — a fix, a dependency bump, or a documented improvement.",
        example:
          "Even a small, genuine commit resets your recency signal; the score rewards a live profile, not a busy one.",
      }),
    );
  }

  if (totalRepos > 0 && n(stats.recentlyUpdatedRepos) <= 1) {
    shortTerm.push(
      rec("spread-activity", "shortTerm", "activity", activity, {
        title: "Maintain more than one project at a time",
        why: `Only ${n(stats.recentlyUpdatedRepos)} of your ${totalRepos} repositories were updated in the last 90 days, so the Activity breadth signal is nearly empty.`,
        action:
          "Choose two or three repositories worth keeping alive and give each a small maintenance pass.",
        example:
          "Update dependencies, close stale issues, or tighten the README on each one.",
      }),
    );
  }

  if (consistency && earnedRatio(consistency) < WEAK_RATIO) {
    shortTerm.push(
      rec("build-consistency", "shortTerm", "consistency", consistency, {
        title: "Contribute on a more regular cadence",
        why: consistency.detail,
        action:
          "Aim for contributions spread across most weeks rather than concentrated bursts — Consistency rewards the number of active weeks, not raw volume.",
        example:
          "A short, focused session twice a week scores better than one large push per quarter.",
      }),
    );
  }

  /* ── Long term: reach, community, and breadth ────────────────────────────── */

  if (impact && earnedRatio(impact) < WEAK_RATIO) {
    longTerm.push(
      rec("grow-impact", "longTerm", "impact", impact, {
        title: "Grow the reach of your strongest project",
        why: `Your repositories have ${n(stats.totalStars)} star(s) and ${n(stats.totalForks)} fork(s) in total, so Impact — the heaviest dimension — is largely unearned.`,
        action:
          "Pick your single most useful project, polish its documentation, and share it where its audience already is.",
        example:
          "Publish it to the relevant package registry, then write up the problem it solves for a community that has that problem.",
      }),
    );
  }

  if (community && earnedRatio(community) < WEAK_RATIO) {
    longTerm.push(
      rec("build-community", "longTerm", "community", community, {
        title: "Participate in other people's projects",
        why: `Your profile has ${n(profile.followers)} follower(s), so the Community dimension has significant headroom.`,
        action:
          "Contribute to repositories you already use: fix a bug, improve docs, or help triage issues.",
        example:
          "Start with issues labelled good-first-issue in a dependency you rely on, and stay involved in the review discussion.",
      }),
    );
  }

  const distinct = n(stats.distinctLanguages ?? stats.topLanguages?.length);
  if (totalRepos > 0 && distinct > 0 && distinct <= 2) {
    longTerm.push(
      rec("broaden-languages", "longTerm", "diversity", diversity, {
        title: "Show work in another language or ecosystem",
        why: `Only ${distinct} language${distinct === 1 ? "" : "s"} (${(stats.topLanguages ?? []).join(", ")}) appear across your public repositories, which caps the Diversity dimension.`,
        action:
          "Ship one real project in an adjacent language or runtime and keep it public.",
        example:
          "If everything is TypeScript, a small Go or Rust service demonstrates range without abandoning your main stack.",
      }),
    );
  }

  if (totalRepos > 0 && originals <= 2) {
    longTerm.push(
      rec("publish-original-work", "longTerm", "impact", impact, {
        title: "Publish more original repositories",
        why: `Only ${originals} of your ${totalRepos} analyzed repositories are original rather than forks, so there is little of your own work for Impact to measure.`,
        action:
          "Turn something you have already built privately into a documented public repository.",
        example:
          "Internal scripts and side tools usually only need secrets removed and a README added before they can be published.",
      }),
    );
  }

  const focusDimensions = [...breakdown]
    .map((d) => ({ key: d.key, label: d.label, missing: d.max - d.score, max: d.max }))
    .filter((d) => d.missing > 0)
    .sort((a, b) => b.missing / b.max - a.missing / a.max || b.max - a.max)
    .slice(0, 3);

  const count = quickWins.length + shortTerm.length + longTerm.length;

  return {
    quickWins,
    shortTerm,
    longTerm,
    focusDimensions,
    // Nothing worth flagging means the profile is already strong on every
    // measurable signal — we say so rather than inventing filler advice.
    isStrongProfile: count === 0,
    count,
  };
}
