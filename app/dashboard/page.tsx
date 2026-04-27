import Link from "next/link";

import {
  type ActivityRow,
  queryActivities,
} from "@/lib/strava/activities-query";
import { formatDate, formatRelativeTime } from "@/lib/strava/format";
import {
  DEFAULT_SCOPE,
  SCOPE_LABELS,
  SCOPE_VALUES,
  type ScopeValue,
  cacheScopeGap,
  filterRowsToScope,
  parseScope,
  scopeWindow,
} from "@/lib/strava/scope";
import {
  buildActiveDays,
  computeCurrentStreak,
  computeStats,
} from "@/lib/strava/stats";
import { getLastSyncedAt } from "@/lib/strava/sync";
import { readTokens } from "@/lib/strava/tokens";
import { getServiceRoleClient } from "@/lib/supabase";
import { formatCount, formatHours, unitsFor } from "@/lib/units/format";
import { getUnitSystem } from "@/lib/units/preference";
import { getConnectionKey } from "@/lib/visitor";

const CACHE_CAP = 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function readAllRows(): Promise<{ rows: ActivityRow[]; error: string | null }> {
  const connectionKey = await getConnectionKey();
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("strava_activities")
    .select("*")
    .eq("connection_key", connectionKey)
    .order("start_date_local", { ascending: false });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ActivityRow[], error: null };
}

function ConnectCTA() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-2">Strava is not connected yet.</p>
        <Link
          href="/auth/strava"
          className="inline-block rounded bg-orange-500 px-3 py-1.5 text-white hover:bg-orange-600"
        >
          Connect with Strava
        </Link>
      </div>
    </section>
  );
}

function EmptyCacheState() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-2">No activities cached yet.</p>
        <Link href="/activities" className="text-blue-700 hover:underline">
          Visit /activities to sync from Strava →
        </Link>
      </div>
    </section>
  );
}

interface ScopeBarProps {
  active: ScopeValue;
}

function ScopeBar({ active }: ScopeBarProps) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Time scope">
      {SCOPE_VALUES.map((s) => {
        const isActive = s === active;
        const cls = isActive
          ? "bg-zinc-800 text-white"
          : "bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-300";
        return (
          <Link
            key={s}
            href={`/dashboard?scope=${s}`}
            className={`rounded-full px-3 py-1 text-sm ${cls}`}
            aria-current={isActive ? "page" : undefined}
          >
            {SCOPE_LABELS[s]}
          </Link>
        );
      })}
    </nav>
  );
}

interface CardProps {
  label: string;
  value: string;
  qualifier?: string;
}

function Card({ label, value, qualifier }: CardProps) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900">{value}</div>
      {qualifier && <div className="mt-1 text-xs text-zinc-500">{qualifier}</div>}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const system = await getUnitSystem();
  const u = unitsFor(system);
  const today = new Date();

  const tokens = await readTokens();
  if (!tokens) return <ConnectCTA />;

  const { rows, error: queryError } = await readAllRows();
  if (queryError) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <strong>Query error:</strong> {queryError}
        </div>
      </section>
    );
  }

  const lastSyncedAt = await getLastSyncedAt();

  if (rows.length === 0) return <EmptyCacheState />;

  const params = await searchParams;
  const scopeRaw = typeof params.scope === "string" ? params.scope : null;
  const scope = parseScope(scopeRaw);
  const window = scopeWindow(scope, today);

  const globalActiveDays = buildActiveDays(rows);
  const currentStreakDays = computeCurrentStreak(globalActiveDays, today);

  const scopedRows = filterRowsToScope(rows, window);
  const gap = cacheScopeGap(rows, window);

  const totalCached = rows.length;
  const inScope = scopedRows.length;

  const noteParts: string[] = [
    `Showing ${formatCount(inScope)} of ${formatCount(totalCached)} cached activities`,
    `last synced ${formatRelativeTime(lastSyncedAt)}`,
  ];
  if (totalCached >= CACHE_CAP) {
    noteParts.push(
      `cache is at the ${formatCount(CACHE_CAP)}-row cap — older activities are not included`,
    );
  }
  if (gap.hasGap && gap.cacheStart) {
    noteParts.push(
      `cache covers ${gap.cacheStart} onward; this scope wants earlier data`,
    );
  }
  const note = noteParts.join(" · ");

  if (scopedRows.length === 0) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <ScopeBar active={scope} />
        <p className="text-sm text-zinc-600">{note}</p>
        <p className="rounded border border-zinc-200 bg-zinc-50 p-4 text-zinc-600">
          No activities in this scope. Pick a wider window above.
        </p>
      </section>
    );
  }

  const stats = computeStats(scopedRows, today);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <ScopeBar active={scope} />
      <p className="text-sm text-zinc-600">{note}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Total distance" value={u.distance(stats.totalMeters)} />
        <Card label="Total time" value={formatHours(stats.totalSeconds)} />
        <Card label="Total elevation" value={u.elevation(stats.totalElevationMeters)} />
        <Card label="Days active" value={`${formatCount(stats.daysActive)} days`} />
        <Card label="Total runs" value={formatCount(stats.totalRuns)} />
        <Card label="Total bike rides" value={formatCount(stats.totalRides)} />
        <Card label="Total PRs" value={formatCount(stats.totalPRs)} />
        <Card
          label="Current streak"
          value={`${formatCount(currentStreakDays)} days`}
          qualifier="across all cached activities"
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">By sport</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-300 bg-zinc-100 text-left">
                <th className="px-3 py-2 font-medium">Sport</th>
                <th className="px-3 py-2 font-medium">Count</th>
                <th className="px-3 py-2 font-medium">Distance</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Elevation</th>
              </tr>
            </thead>
            <tbody>
              {stats.breakdown.map((row, i) => (
                <tr
                  key={row.sportType}
                  className={i % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                >
                  <td className="px-3 py-2">
                    {row.sportType}
                    {row.liftAssisted && (
                      <span className="ml-1 text-xs text-zinc-500">(lift-assisted)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatCount(row.count)}</td>
                  <td className="px-3 py-2">{u.distance(row.totalMeters)}</td>
                  <td className="px-3 py-2">{formatHours(row.totalSeconds)}</td>
                  <td className="px-3 py-2">
                    {row.liftAssisted ? "—" : u.elevation(row.totalElevationMeters)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Highlights</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.longestActivity ? (
            <HighlightCard
              label="Longest activity"
              value={u.distance(stats.longestActivity.distanceMeters)}
              activityName={stats.longestActivity.name}
              activityId={stats.longestActivity.id}
              date={formatDate(stats.longestActivity.startDateLocal)}
            />
          ) : null}
          {stats.biggestClimb ? (
            <HighlightCard
              label="Biggest climb"
              value={u.elevation(stats.biggestClimb.elevationMeters)}
              activityName={stats.biggestClimb.name}
              activityId={stats.biggestClimb.id}
              date={formatDate(stats.biggestClimb.startDateLocal)}
            />
          ) : null}
          <HighlightCard
            label="Longest streak (in scope)"
            value={`${formatCount(stats.longestStreakDays)} days`}
            dateRange={
              stats.longestStreakStart && stats.longestStreakEnd
                ? `${stats.longestStreakStart} → ${stats.longestStreakEnd}`
                : null
            }
          />
        </div>
      </section>
    </section>
  );
}

interface HighlightProps {
  label: string;
  value: string;
  activityName?: string;
  activityId?: number;
  date?: string;
  dateRange?: string | null;
}

function HighlightCard({ label, value, activityName, activityId, date, dateRange }: HighlightProps) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900">{value}</div>
      {activityName && activityId !== undefined && (
        <div className="mt-1 text-sm">
          <a
            href={`https://www.strava.com/activities/${activityId}`}
            target="_blank"
            rel="noopener"
            className="text-blue-700 hover:underline"
          >
            {activityName}
          </a>
        </div>
      )}
      {date && <div className="text-xs text-zinc-500">{date}</div>}
      {dateRange && <div className="text-xs text-zinc-500">{dateRange}</div>}
    </div>
  );
}
