/**
 * Developer comparison logic.
 *
 * Pure functions that diff two analyses. Everything here is factual and derived
 * from measured GitHub data plus the shared Developer_Score breakdown:
 *  - each dimension reports which side leads and by how much,
 *  - each headline metric reports the same,
 *  - and the dimensions that actually produced the score gap are surfaced
 *    explicitly, so the difference is explainable rather than mysterious.
 *
 * Deliberately absent: any notion of one developer being "better". The result
 * describes measured differences within the defined metrics only.
 */

import { DIMENSION_META, strongestDimensions, weakestDimensions } from "./scoring";
import type { DimensionScore, ScoreDimensionKey } from "./types";

/** Which side of the comparison leads a given row. */
export type Leader = "a" | "b" | "tie";

/** One comparable numeric metric. */
export interface MetricComparison {
  key: string;
  label: string;
  /** How to render the value: a plain count, or a formatted string. */
  a: number;
  b: number;
  /** Optional pre-formatted display values (e.g. account age in years). */
  displayA?: string;
  displayB?: string;
  leader: Leader;
  difference: number;
  /** True when a higher number is the stronger signal (all current metrics). */
  higherIsBetter: boolean;
}

/** One dimension of the score, compared. */
export interface DimensionComparison {
  key: ScoreDimensionKey;
  label: string;
  description: string;
  max: number;
  a: number;
  b: number;
  leader: Leader;
  /** Absolute point difference in this dimension. */
  difference: number;
}

/** The side of a comparison, with its own derived strengths/weaknesses. */
export interface ComparisonSide {
  username: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  score: number;
  grade: string;
  tier: string;
  /** Dimensions where this developer earned the highest proportion of the cap. */
  strengths: string[];
  /** Dimensions with the largest unearned proportion of the cap. */
  improvementAreas: string[];
}

export interface ComparisonResult {
  a: ComparisonSide;
  b: ComparisonSide;
  /** Absolute difference between the two total scores. */
  scoreDifference: number;
  /** Which side has the higher total score. */
  scoreLeader: Leader;
  dimensions: DimensionComparison[];
  metrics: MetricComparison[];
  /**
   * Dimensions ordered by how much they contributed to the score gap, largest
   * first. Only dimensions with a non-zero difference are included.
   */
  decidingDimensions: DimensionComparison[];
}

/** Input shape for one side: the fields comparison actually needs. */
export interface ComparisonInput {
  username: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  score: number;
  grade: string;
  tier: string;
  breakdown: DimensionScore[];
  followers: number;
  following: number;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
  totalRepos: number;
  distinctLanguages: number;
  topLanguages: string[];
  recentlyUpdatedRepos: number;
  accountCreatedAt: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365.25;

/** Decide which side leads, treating equal values as a tie. */
function leaderOf(a: number, b: number, higherIsBetter = true): Leader {
  if (a === b) return "tie";
  const aLeads = higherIsBetter ? a > b : a < b;
  return aLeads ? "a" : "b";
}

/** Account age in whole-tenths of a year; 0 when the date is unusable. */
export function accountAgeYears(createdAt: string, now: number): number {
  const created = Date.parse(createdAt ?? "");
  if (Number.isNaN(created)) return 0;
  const years = Math.max(0, (now - created) / (MS_PER_DAY * DAYS_PER_YEAR));
  return Math.round(years * 10) / 10;
}

/** Build a metric row from two values. */
function metric(
  key: string,
  label: string,
  a: number,
  b: number,
  display?: { a: string; b: string },
): MetricComparison {
  return {
    key,
    label,
    a,
    b,
    displayA: display?.a,
    displayB: display?.b,
    leader: leaderOf(a, b),
    difference: Math.abs(a - b),
    higherIsBetter: true,
  };
}

/** Look up a dimension score, defaulting to 0 when absent. */
function dimensionValue(breakdown: DimensionScore[], key: ScoreDimensionKey): number {
  return breakdown.find((d) => d.key === key)?.score ?? 0;
}

/** Human-readable dimension labels for a side's strengths/weaknesses. */
function labelsFor(breakdown: DimensionScore[], picker: typeof strongestDimensions): string[] {
  if (breakdown.length === 0) return [];
  return picker(breakdown, 3).map((d) => d.label);
}

/**
 * Compare two analyzed developers.
 *
 * @param a   First developer.
 * @param b   Second developer.
 * @param now Reference time for account-age calculations.
 */
export function compareDevelopers(
  a: ComparisonInput,
  b: ComparisonInput,
  now: number = Date.now(),
): ComparisonResult {
  // Union of dimension keys, preserving the canonical order from side A.
  const keys: ScoreDimensionKey[] = a.breakdown.length > 0
    ? a.breakdown.map((d) => d.key)
    : b.breakdown.map((d) => d.key);

  const dimensions: DimensionComparison[] = keys.map((key) => {
    const aScore = dimensionValue(a.breakdown, key);
    const bScore = dimensionValue(b.breakdown, key);
    const max =
      a.breakdown.find((d) => d.key === key)?.max ??
      b.breakdown.find((d) => d.key === key)?.max ??
      0;

    return {
      key,
      label: DIMENSION_META[key]?.label ?? key,
      description: DIMENSION_META[key]?.description ?? "",
      max,
      a: aScore,
      b: bScore,
      leader: leaderOf(aScore, bScore),
      difference: Math.abs(aScore - bScore),
    };
  });

  const ageA = accountAgeYears(a.accountCreatedAt, now);
  const ageB = accountAgeYears(b.accountCreatedAt, now);

  const metrics: MetricComparison[] = [
    metric("followers", "Followers", a.followers, b.followers),
    metric("publicRepos", "Public repositories", a.publicRepos, b.publicRepos),
    metric("totalStars", "Total stars", a.totalStars, b.totalStars),
    metric("totalForks", "Total forks", a.totalForks, b.totalForks),
    metric("distinctLanguages", "Languages used", a.distinctLanguages, b.distinctLanguages),
    metric(
      "recentlyUpdatedRepos",
      "Repos active in 90 days",
      a.recentlyUpdatedRepos,
      b.recentlyUpdatedRepos,
    ),
    metric("accountAge", "Account age", ageA, ageB, {
      a: `${ageA} yr`,
      b: `${ageB} yr`,
    }),
  ];

  return {
    a: {
      username: a.username,
      login: a.login,
      name: a.name,
      avatarUrl: a.avatarUrl,
      profileUrl: a.profileUrl,
      score: a.score,
      grade: a.grade,
      tier: a.tier,
      strengths: labelsFor(a.breakdown, strongestDimensions),
      improvementAreas: labelsFor(a.breakdown, weakestDimensions),
    },
    b: {
      username: b.username,
      login: b.login,
      name: b.name,
      avatarUrl: b.avatarUrl,
      profileUrl: b.profileUrl,
      score: b.score,
      grade: b.grade,
      tier: b.tier,
      strengths: labelsFor(b.breakdown, strongestDimensions),
      improvementAreas: labelsFor(b.breakdown, weakestDimensions),
    },
    scoreDifference: Math.abs(a.score - b.score),
    scoreLeader: leaderOf(a.score, b.score),
    dimensions,
    decidingDimensions: dimensions
      .filter((d) => d.difference > 0)
      .sort((x, y) => y.difference - x.difference || x.key.localeCompare(y.key)),
    metrics,
  };
}
