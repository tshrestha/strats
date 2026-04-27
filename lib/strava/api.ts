import "server-only";

import { getAccessToken } from "./tokens";

const ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

export interface SummaryActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  type?: string;
  elapsed_time?: number;
  commute?: boolean;
  trainer?: boolean;
  has_heartrate?: boolean;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  [key: string]: unknown;
}

export interface ListAthleteActivitiesParams {
  page: number;
  per_page: number;
  before?: number;
  after?: number;
}

export async function listAthleteActivitiesPage(
  params: ListAthleteActivitiesParams,
): Promise<SummaryActivity[]> {
  const token = await getAccessToken();
  const url = new URL(ACTIVITIES_URL);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("per_page", String(params.per_page));
  if (params.before !== undefined) url.searchParams.set("before", String(params.before));
  if (params.after !== undefined) url.searchParams.set("after", String(params.after));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    let stravaMessage = "";
    try {
      const body = (await response.json()) as { message?: string };
      if (body && typeof body.message === "string") stravaMessage = body.message;
    } catch {
      // Body wasn't JSON; fall through with empty message.
    }
    const suffix = stravaMessage ? `: ${stravaMessage}` : "";
    throw new Error(`Strava returned ${response.status} ${response.statusText}${suffix}`);
  }

  return (await response.json()) as SummaryActivity[];
}
