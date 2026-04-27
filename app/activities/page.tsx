import Link from "next/link";

import {
  ALLOWED_COLUMNS,
  type ActivityRow,
  type ColumnName,
  DEFAULT_PER_PAGE,
  getDistinctSportTypes,
  parseColumnsFromSearchParams,
  parseFiltersFromSearchParams,
  parsePaginationFromSearchParams,
  queryActivities,
} from "@/lib/strava/activities-query";
import { formatDateTime, formatRelativeTime } from "@/lib/strava/format";
import { getLastSyncedAt, syncActivities } from "@/lib/strava/sync";
import { readTokens } from "@/lib/strava/tokens";
import { type UnitsBundle, unitsFor } from "@/lib/units/format";
import { getUnitSystem } from "@/lib/units/preference";

import { ColumnPicker } from "./_components/ColumnPicker";
import { FilterBar } from "./_components/FilterBar";

const CACHE_CAP = 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function searchParamsToString(params: Record<string, string | string[] | undefined>): string {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) url.append(key, v);
    } else if (typeof value === "string") {
      url.set(key, value);
    }
  }
  return url.toString();
}

function withParam(base: URLSearchParams, key: string, value: string | null): string {
  const next = new URLSearchParams(base);
  if (value === null) next.delete(key);
  else next.set(key, value);
  const s = next.toString();
  return s ? `/activities?${s}` : "/activities";
}

const COLUMN_LABELS: Record<ColumnName, string> = {
  name: "Name",
  sport_type: "Sport",
  start_date_local: "Date",
  distance: "Distance",
  moving_time: "Moving time",
  total_elevation_gain: "Elevation",
  average_speed: "Avg speed",
  max_speed: "Max speed",
  average_heartrate: "Avg HR",
  max_heartrate: "Max HR",
  commute: "Commute",
  trainer: "Trainer",
  has_heartrate: "Has HR",
};

function renderCell(row: ActivityRow, col: ColumnName, u: UnitsBundle): React.ReactNode {
  switch (col) {
    case "name":
      return (
        <a
          href={`https://www.strava.com/activities/${row.id}`}
          target="_blank"
          rel="noopener"
          className="text-blue-700 hover:underline"
        >
          {row.name}
        </a>
      );
    case "sport_type":
      return row.sport_type;
    case "start_date_local":
      return formatDateTime(row.start_date_local);
    case "distance":
      return u.distance(row.distance);
    case "moving_time":
      return u.duration(row.moving_time);
    case "total_elevation_gain":
      return u.elevation(row.total_elevation_gain);
    case "average_speed":
      return u.speed(row.raw?.average_speed as number | undefined);
    case "max_speed":
      return u.speed(row.raw?.max_speed as number | undefined);
    case "average_heartrate":
      return u.heartrate(row.raw?.average_heartrate as number | undefined);
    case "max_heartrate":
      return u.heartrate(row.raw?.max_heartrate as number | undefined);
    case "commute":
      return row.commute ? "yes" : "no";
    case "trainer":
      return row.trainer ? "yes" : "no";
    case "has_heartrate":
      return row.has_heartrate ? "yes" : "no";
  }
}

export default async function ActivitiesPage({ searchParams }: PageProps) {
  const system = await getUnitSystem();
  const u = unitsFor(system);
  const params = await searchParams;
  const tokens = await readTokens();

  if (!tokens) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold">Activities</h1>
        <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
          <p className="mb-2">Strava is not connected yet.</p>
          <Link
            href="/auth/strava"
            className="inline-block rounded bg-orange-500 px-3 py-1.5 text-white hover:bg-orange-600"
          >
            Connect with Strava
          </Link>
        </div>
      </main>
    );
  }

  const searchString = searchParamsToString(params);
  const urlParams = new URLSearchParams(searchString);

  // Lazy sync on empty cache. Capture errors and continue rendering.
  let lastSyncedAt = await getLastSyncedAt();
  let syncError: string | null = null;
  if (lastSyncedAt === null) {
    try {
      const result = await syncActivities();
      lastSyncedAt = result.syncedAt;
    } catch (err) {
      syncError = err instanceof Error ? err.message : String(err);
    }
  }

  // Refresh-action errors come back as ?syncError=...
  const refreshErrorParam = urlParams.get("syncError");
  if (refreshErrorParam && !syncError) {
    syncError = refreshErrorParam;
  }

  const filters = parseFiltersFromSearchParams(urlParams);
  const pagination = parsePaginationFromSearchParams(urlParams);
  const cols = parseColumnsFromSearchParams(urlParams);

  let rows: ActivityRow[] = [];
  let totalCount = 0;
  let queryError: string | null = null;
  try {
    const result = await queryActivities(filters, pagination);
    rows = result.rows;
    totalCount = result.totalCount;
  } catch (err) {
    queryError = err instanceof Error ? err.message : String(err);
  }

  // Cache-cap detection: count all rows for the connection (no filters).
  let cacheRowCount = 0;
  try {
    const all = await queryActivities({}, { page: 1, perPage: 1 });
    cacheRowCount = all.totalCount;
  } catch {
    // Already surfaced above if relevant.
  }

  const sportTypes = await getDistinctSportTypes().catch(() => [] as string[]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.perPage));
  const baseForPagination = new URLSearchParams(urlParams);
  baseForPagination.delete("page");
  baseForPagination.delete("syncError");

  const baseForCols = new URLSearchParams(urlParams);
  baseForCols.delete("syncError");

  // Hidden inputs for the refresh form: carry every current param so the redirect
  // returns the user to the same view.
  const refreshHiddenParams = new URLSearchParams(urlParams);
  refreshHiddenParams.delete("syncError");

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Activities</h1>
        <form action="/activities/refresh" method="post" className="flex items-center gap-3 text-sm">
          <span className="text-zinc-600">
            Last synced {formatRelativeTime(lastSyncedAt)}
          </span>
          <input type="hidden" name="returnTo" value={`/activities${refreshHiddenParams.toString() ? "?" + refreshHiddenParams.toString() : ""}`} />
          <button
            type="submit"
            className="rounded border border-zinc-300 bg-white px-3 py-1 hover:bg-zinc-50"
          >
            Refresh from Strava
          </button>
        </form>
      </header>

      {syncError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <strong>Sync error:</strong> {syncError}
        </div>
      )}

      {queryError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <strong>Query error:</strong> {queryError}
        </div>
      )}

      <FilterBar currentSearch={searchString} sportTypes={sportTypes} system={system} />

      <ColumnPicker selected={cols} basePath="/activities" baseParams={baseForCols.toString()} />

      {cacheRowCount >= CACHE_CAP && (
        <p className="text-sm text-zinc-600">
          Showing the most recent {CACHE_CAP} activities. Older activities are not in the cache.
        </p>
      )}

      <p className="text-sm text-zinc-600">
        {totalCount} matching {totalCount === 1 ? "activity" : "activities"}
      </p>

      {rows.length === 0 && !queryError ? (
        <p className="rounded border border-zinc-200 bg-zinc-50 p-4 text-zinc-600">
          No activities matched these filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-300 bg-zinc-100 text-left">
                {cols.map((col) => (
                  <th key={col} className="px-3 py-2 font-medium">
                    {COLUMN_LABELS[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={i % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                >
                  {cols.map((col) => (
                    <td key={col} className="px-3 py-2 align-top">
                      {renderCell(row, col, u)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <nav className="flex items-center justify-between text-sm">
          <div>
            Page {pagination.page} of {totalPages} · {pagination.perPage} per page
          </div>
          <div className="flex gap-2">
            {pagination.page > 1 ? (
              <Link
                href={withParam(baseForPagination, "page", String(pagination.page - 1))}
                className="rounded border border-zinc-300 bg-white px-3 py-1 hover:bg-zinc-50"
              >
                ← Previous
              </Link>
            ) : null}
            {pagination.page < totalPages ? (
              <Link
                href={withParam(baseForPagination, "page", String(pagination.page + 1))}
                className="rounded border border-zinc-300 bg-white px-3 py-1 hover:bg-zinc-50"
              >
                Next →
              </Link>
            ) : null}
          </div>
        </nav>
      )}

      <p className="text-xs text-zinc-400">
        Available columns: {ALLOWED_COLUMNS.join(", ")} · default per_page {DEFAULT_PER_PAGE}
      </p>
    </main>
  );
}
