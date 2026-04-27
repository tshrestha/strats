import "server-only";

import { getServiceRoleClient } from "../supabase";
import { getConnectionKey } from "../visitor";
import { listAthleteActivitiesPage, type SummaryActivity } from "./api";

const PER_PAGE = 200;
const MAX_PAGES = 5;

interface CacheRowInput {
  id: number;
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
}

function toRow(src: SummaryActivity): CacheRowInput {
  return {
    id: src.id,
    name: src.name,
    sport_type: src.sport_type,
    start_date: src.start_date,
    start_date_local: src.start_date_local,
    distance: src.distance,
    moving_time: src.moving_time,
    total_elevation_gain: src.total_elevation_gain,
    commute: src.commute ?? false,
    trainer: src.trainer ?? false,
    has_heartrate: src.has_heartrate ?? false,
    raw: src,
  };
}

export async function syncActivities(): Promise<{ count: number; syncedAt: string }> {
  const connectionKey = await getConnectionKey();
  const collected: SummaryActivity[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await listAthleteActivitiesPage({ page, per_page: PER_PAGE });
    collected.push(...batch);
    if (batch.length < PER_PAGE) break;
  }

  const rows = collected.map(toRow);
  const supabase = getServiceRoleClient();

  // Atomicity: a Postgres function does DELETE + INSERT in a single transaction.
  // The Supabase JS client doesn't expose multi-statement transactions, so this
  // RPC is how we keep the cache from being observed half-populated.
  const { error } = await supabase.rpc("replace_strava_activities", {
    p_connection_key: connectionKey,
    p_rows: rows,
  });
  if (error) {
    throw new Error(`Failed to replace strava_activities: ${error.message}`);
  }

  return { count: rows.length, syncedAt: new Date().toISOString() };
}

export async function getLastSyncedAt(): Promise<string | null> {
  const connectionKey = await getConnectionKey();
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("strava_activities")
    .select("synced_at")
    .eq("connection_key", connectionKey)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to read last sync time: ${error.message}`);
  return data?.synced_at ?? null;
}
