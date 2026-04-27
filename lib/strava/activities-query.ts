import "server-only";

import { getServiceRoleClient } from "../supabase";
import type { SummaryActivity } from "./api";

const CONNECTION_KEY = "default";

export const ALLOWED_COLUMNS = [
  "name",
  "sport_type",
  "start_date_local",
  "distance",
  "moving_time",
  "total_elevation_gain",
  "average_speed",
  "max_speed",
  "average_heartrate",
  "max_heartrate",
  "commute",
  "trainer",
  "has_heartrate",
] as const;

export type ColumnName = (typeof ALLOWED_COLUMNS)[number];

export const DEFAULT_COLUMNS: ColumnName[] = [
  "name",
  "sport_type",
  "start_date_local",
  "distance",
  "moving_time",
  "total_elevation_gain",
];

export const DEFAULT_PER_PAGE = 30;
export const MAX_PER_PAGE = 100;

export interface Filters {
  sportTypes?: string[];
  distanceMin?: number; // km, user-facing
  distanceMax?: number;
  movingTimeMin?: number; // minutes, user-facing
  movingTimeMax?: number;
  elevationMin?: number; // meters
  elevationMax?: number;
  startDateAfter?: string; // YYYY-MM-DD
  startDateBefore?: string;
  commute?: boolean;
  trainer?: boolean;
  hasHeartrate?: boolean;
}

export interface Pagination {
  page: number;
  perPage: number;
}

export interface ActivityRow {
  id: number;
  connection_key: string;
  name: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  commute: boolean;
  trainer: boolean;
  has_heartrate: boolean;
  raw: SummaryActivity;
  synced_at: string;
}

function parseNumber(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseBool(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseDate(value: string | null): string | undefined {
  if (!value) return undefined;
  // Accept YYYY-MM-DD only; anything else is dropped.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export function parseFiltersFromSearchParams(params: URLSearchParams): Filters {
  const sportTypeRaw = params.get("sport_type");
  const sportTypes = sportTypeRaw
    ? sportTypeRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    sportTypes: sportTypes && sportTypes.length > 0 ? sportTypes : undefined,
    distanceMin: parseNumber(params.get("distance_min")),
    distanceMax: parseNumber(params.get("distance_max")),
    movingTimeMin: parseNumber(params.get("moving_time_min")),
    movingTimeMax: parseNumber(params.get("moving_time_max")),
    elevationMin: parseNumber(params.get("elevation_min")),
    elevationMax: parseNumber(params.get("elevation_max")),
    startDateAfter: parseDate(params.get("start_date_after")),
    startDateBefore: parseDate(params.get("start_date_before")),
    commute: parseBool(params.get("commute")),
    trainer: parseBool(params.get("trainer")),
    hasHeartrate: parseBool(params.get("has_heartrate")),
  };
}

export function parsePaginationFromSearchParams(params: URLSearchParams): Pagination {
  const rawPage = parseNumber(params.get("page")) ?? 1;
  const rawPerPage = parseNumber(params.get("per_page")) ?? DEFAULT_PER_PAGE;
  const page = Math.max(1, Math.floor(rawPage));
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Math.floor(rawPerPage)));
  return { page, perPage };
}

export function parseColumnsFromSearchParams(params: URLSearchParams): ColumnName[] {
  // Accept either `?cols=A,B` or `?cols=A&cols=B`. The form-based picker submits
  // the latter; hand-built URLs typically use the former.
  const all = params.getAll("cols");
  if (all.length === 0) return [...DEFAULT_COLUMNS];
  const requested = all.flatMap((v) => v.split(",").map((s) => s.trim()).filter(Boolean));
  const allowed = new Set<string>(ALLOWED_COLUMNS);
  const filtered = requested.filter((c): c is ColumnName => allowed.has(c));
  return filtered.length > 0 ? filtered : [...DEFAULT_COLUMNS];
}

function dateToUtcIso(yyyymmdd: string): string {
  return `${yyyymmdd}T00:00:00Z`;
}

export async function queryActivities(
  filters: Filters,
  pagination: Pagination,
): Promise<{ rows: ActivityRow[]; totalCount: number }> {
  const supabase = getServiceRoleClient();
  let q = supabase
    .from("strava_activities")
    .select("*", { count: "exact" })
    .eq("connection_key", CONNECTION_KEY);

  if (filters.sportTypes && filters.sportTypes.length > 0) {
    q = q.in("sport_type", filters.sportTypes);
  }
  if (filters.distanceMin !== undefined) {
    q = q.gte("distance", filters.distanceMin * 1000);
  }
  if (filters.distanceMax !== undefined) {
    q = q.lte("distance", filters.distanceMax * 1000);
  }
  if (filters.movingTimeMin !== undefined) {
    q = q.gte("moving_time", Math.round(filters.movingTimeMin * 60));
  }
  if (filters.movingTimeMax !== undefined) {
    q = q.lte("moving_time", Math.round(filters.movingTimeMax * 60));
  }
  if (filters.elevationMin !== undefined) {
    q = q.gte("total_elevation_gain", filters.elevationMin);
  }
  if (filters.elevationMax !== undefined) {
    q = q.lte("total_elevation_gain", filters.elevationMax);
  }
  if (filters.startDateAfter) {
    q = q.gte("start_date_local", dateToUtcIso(filters.startDateAfter));
  }
  if (filters.startDateBefore) {
    q = q.lt("start_date_local", dateToUtcIso(filters.startDateBefore));
  }
  if (filters.commute !== undefined) q = q.eq("commute", filters.commute);
  if (filters.trainer !== undefined) q = q.eq("trainer", filters.trainer);
  if (filters.hasHeartrate !== undefined) q = q.eq("has_heartrate", filters.hasHeartrate);

  const offset = (pagination.page - 1) * pagination.perPage;
  q = q.order("start_date_local", { ascending: false }).range(offset, offset + pagination.perPage - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(`Failed to query strava_activities: ${error.message}`);
  return { rows: (data ?? []) as ActivityRow[], totalCount: count ?? 0 };
}

export async function getDistinctSportTypes(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("strava_activities")
    .select("sport_type")
    .eq("connection_key", CONNECTION_KEY);
  if (error) throw new Error(`Failed to read sport types: ${error.message}`);
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row && typeof (row as { sport_type?: unknown }).sport_type === "string") {
      set.add((row as { sport_type: string }).sport_type);
    }
  }
  return Array.from(set).sort();
}
