import "server-only";

import type { ActivityRow } from "./activities-query";
import { groupForSportType, isLiftAssisted } from "./sport-groups";

export interface SportBreakdownRow {
  sportType: string;
  count: number;
  totalMeters: number;
  totalSeconds: number;
  totalElevationMeters: number;
  liftAssisted: boolean;
}

export interface ActivityHighlight {
  id: number;
  name: string;
  sportType: string;
  startDateLocal: string;
  distanceMeters: number;
  elevationMeters: number;
}

export interface DashboardStats {
  rowCount: number;
  totalMeters: number;
  totalSeconds: number;
  totalElevationMeters: number;
  daysActive: number;
  totalRuns: number;
  totalRides: number;
  totalPRs: number;
  longestStreakDays: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  breakdown: SportBreakdownRow[];
  longestActivity: ActivityHighlight | null;
  biggestClimb: ActivityHighlight | null;
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function buildActiveDays(rows: ActivityRow[]): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    if (typeof row.start_date_local === "string") {
      out.add(dayOf(row.start_date_local));
    }
  }
  return out;
}

function ymdToUTC(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToYmd(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function computeCurrentStreak(activeDays: Set<string>, today: Date): number {
  const todayYmd = utcToYmd(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const yesterdayYmd = utcToYmd(ymdToUTC(todayYmd) - ONE_DAY_MS);

  let cursor: string;
  if (activeDays.has(todayYmd)) cursor = todayYmd;
  else if (activeDays.has(yesterdayYmd)) cursor = yesterdayYmd;
  else return 0;

  let count = 0;
  while (activeDays.has(cursor)) {
    count++;
    cursor = utcToYmd(ymdToUTC(cursor) - ONE_DAY_MS);
  }
  return count;
}

export function computeLongestStreak(
  activeDays: Set<string>,
): { days: number; start: string | null; end: string | null } {
  if (activeDays.size === 0) return { days: 0, start: null, end: null };
  const sorted = Array.from(activeDays).sort();
  let bestLen = 0;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  let runStart = sorted[0];
  let runEnd = sorted[0];
  let runLen = 1;

  function commit() {
    if (runLen > bestLen) {
      bestLen = runLen;
      bestStart = runStart;
      bestEnd = runEnd;
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (ymdToUTC(cur) - ymdToUTC(prev) === ONE_DAY_MS) {
      runEnd = cur;
      runLen++;
    } else {
      commit();
      runStart = cur;
      runEnd = cur;
      runLen = 1;
    }
  }
  commit();
  return { days: bestLen, start: bestStart, end: bestEnd };
}

function readPRCount(row: ActivityRow): number {
  const raw = row.raw as { pr_count?: unknown } | null | undefined;
  const v = raw?.pr_count;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function computeStats(rows: ActivityRow[], today: Date): DashboardStats {
  const buckets = new Map<string, SportBreakdownRow>();
  let totalMeters = 0;
  let totalSeconds = 0;
  let totalElevationMeters = 0;
  let totalRuns = 0;
  let totalRides = 0;
  let totalPRs = 0;
  let longestActivity: ActivityHighlight | null = null;
  let biggestClimb: ActivityHighlight | null = null;
  const activeDays = new Set<string>();

  for (const row of rows) {
    const liftAssisted = isLiftAssisted(row.sport_type);

    totalMeters += row.distance ?? 0;
    totalSeconds += row.moving_time ?? 0;
    if (!liftAssisted) {
      totalElevationMeters += row.total_elevation_gain ?? 0;
    }
    totalPRs += readPRCount(row);

    if (typeof row.start_date_local === "string") {
      activeDays.add(dayOf(row.start_date_local));
    }

    const group = groupForSportType(row.sport_type);
    if (group === "Run") totalRuns++;
    else if (group === "Ride") totalRides++;

    let bucket = buckets.get(row.sport_type);
    if (!bucket) {
      bucket = {
        sportType: row.sport_type,
        count: 0,
        totalMeters: 0,
        totalSeconds: 0,
        totalElevationMeters: 0,
        liftAssisted,
      };
      buckets.set(row.sport_type, bucket);
    }
    bucket.count++;
    bucket.totalMeters += row.distance ?? 0;
    bucket.totalSeconds += row.moving_time ?? 0;
    bucket.totalElevationMeters += row.total_elevation_gain ?? 0;

    const candidate: ActivityHighlight = {
      id: row.id,
      name: row.name,
      sportType: row.sport_type,
      startDateLocal: row.start_date_local,
      distanceMeters: row.distance ?? 0,
      elevationMeters: row.total_elevation_gain ?? 0,
    };
    if (
      longestActivity === null ||
      candidate.distanceMeters > longestActivity.distanceMeters ||
      (candidate.distanceMeters === longestActivity.distanceMeters &&
        candidate.startDateLocal > longestActivity.startDateLocal)
    ) {
      longestActivity = candidate;
    }
    if (
      !liftAssisted &&
      (biggestClimb === null ||
        candidate.elevationMeters > biggestClimb.elevationMeters ||
        (candidate.elevationMeters === biggestClimb.elevationMeters &&
          candidate.startDateLocal > biggestClimb.startDateLocal))
    ) {
      biggestClimb = candidate;
    }
  }

  const breakdown = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  const longest = computeLongestStreak(activeDays);
  void today; // current streak is computed by the page from the global active-day set; today is accepted for symmetry.

  return {
    rowCount: rows.length,
    totalMeters,
    totalSeconds,
    totalElevationMeters,
    daysActive: activeDays.size,
    totalRuns,
    totalRides,
    totalPRs,
    longestStreakDays: longest.days,
    longestStreakStart: longest.start,
    longestStreakEnd: longest.end,
    breakdown,
    longestActivity,
    biggestClimb,
  };
}
