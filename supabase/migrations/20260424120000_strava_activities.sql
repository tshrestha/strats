-- Cache table for Strava SummaryActivity records, populated by lib/strava/sync.ts.
-- Hybrid schema: typed columns for fields we filter/sort on, plus `raw JSONB`
-- holding the full SummaryActivity payload for forward compatibility.
--
-- Accessed only by server-side code using the service-role key, which bypasses
-- RLS. RLS is intentionally left disabled, matching strava_tokens / oauth_states.
-- If any code path ever uses the anon key against this table, RLS must be
-- enabled first and explicit policies added.

create table if not exists public.strava_activities (
  id                    bigint           not null,
  connection_key        text             not null,
  name                  text             not null,
  sport_type            text             not null,
  start_date            timestamptz      not null,
  start_date_local      timestamptz      not null,
  distance              double precision not null,
  moving_time           integer          not null,
  total_elevation_gain  double precision not null,
  commute               boolean          not null,
  trainer               boolean          not null,
  has_heartrate         boolean          not null,
  raw                   jsonb            not null,
  synced_at             timestamptz      not null default now(),
  primary key (connection_key, id)
);

create index if not exists strava_activities_start_date_idx
  on public.strava_activities (connection_key, start_date_local desc);

create index if not exists strava_activities_sport_type_idx
  on public.strava_activities (connection_key, sport_type);

-- Atomic full-rebuild of the cache for a single connection.
-- Used by lib/strava/sync.ts to replace all rows in one transaction so the page
-- never observes a half-populated cache.
create or replace function public.replace_strava_activities(
  p_connection_key text,
  p_rows jsonb
) returns integer
language plpgsql
as $$
declare
  inserted_count integer;
begin
  delete from public.strava_activities where connection_key = p_connection_key;

  insert into public.strava_activities (
    id,
    connection_key,
    name,
    sport_type,
    start_date,
    start_date_local,
    distance,
    moving_time,
    total_elevation_gain,
    commute,
    trainer,
    has_heartrate,
    raw,
    synced_at
  )
  select
    (r->>'id')::bigint,
    p_connection_key,
    r->>'name',
    r->>'sport_type',
    (r->>'start_date')::timestamptz,
    (r->>'start_date_local')::timestamptz,
    (r->>'distance')::double precision,
    (r->>'moving_time')::integer,
    (r->>'total_elevation_gain')::double precision,
    coalesce((r->>'commute')::boolean, false),
    coalesce((r->>'trainer')::boolean, false),
    coalesce((r->>'has_heartrate')::boolean, false),
    r->'raw',
    now()
  from jsonb_array_elements(p_rows) as r;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
