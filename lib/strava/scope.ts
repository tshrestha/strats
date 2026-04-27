import type { ActivityRow } from "./activities-query";

export const SCOPE_VALUES = ["this_year", "1y", "9m", "6m", "3m", "1m"] as const;
export type ScopeValue = (typeof SCOPE_VALUES)[number];

export const DEFAULT_SCOPE: ScopeValue = "this_year";

export const SCOPE_LABELS: Record<ScopeValue, string> = {
  this_year: "This year",
  "1y": "1 year",
  "9m": "9 months",
  "6m": "6 months",
  "3m": "3 months",
  "1m": "1 month",
};

const TRAILING_MONTHS: Record<Exclude<ScopeValue, "this_year">, number> = {
  "1y": 12,
  "9m": 9,
  "6m": 6,
  "3m": 3,
  "1m": 1,
};

export interface ScopeWindow {
  start: Date;
  end: Date;
}

function endOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
}

export function parseScope(raw: string | null | undefined): ScopeValue {
  if (raw && (SCOPE_VALUES as readonly string[]).includes(raw)) {
    return raw as ScopeValue;
  }
  return DEFAULT_SCOPE;
}

export function scopeWindow(scope: ScopeValue, today: Date): ScopeWindow {
  const end = endOfDay(today);
  if (scope === "this_year") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    return { start, end };
  }
  const months = TRAILING_MONTHS[scope];
  const start = new Date(today.getTime());
  start.setUTCMonth(start.getUTCMonth() - months);
  return { start, end };
}

export function filterRowsToScope(rows: ActivityRow[], window: ScopeWindow): ActivityRow[] {
  const startMs = window.start.getTime();
  const endMs = window.end.getTime();
  return rows.filter((row) => {
    const t = new Date(row.start_date_local).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
}

export function cacheScopeGap(
  rows: ActivityRow[],
  window: ScopeWindow,
): { hasGap: boolean; cacheStart: string | null } {
  if (rows.length === 0) return { hasGap: false, cacheStart: null };
  let oldest = Infinity;
  let oldestIso: string | null = null;
  for (const row of rows) {
    const t = new Date(row.start_date_local).getTime();
    if (Number.isFinite(t) && t < oldest) {
      oldest = t;
      oldestIso = row.start_date_local;
    }
  }
  if (oldestIso === null) return { hasGap: false, cacheStart: null };
  const hasGap = oldest > window.start.getTime();
  return { hasGap, cacheStart: oldestIso.slice(0, 10) };
}
