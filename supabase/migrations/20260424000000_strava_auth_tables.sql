-- Tables backing the Strava OAuth flow under Next.js + Netlify (serverless).
-- Both tables are accessed only by server-side code using the service-role key,
-- which bypasses RLS. RLS is intentionally left disabled here; if any code path
-- ever uses the anon key against these tables, RLS must be enabled first and
-- explicit policies added.

create table if not exists public.oauth_states (
  state text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.strava_tokens (
  connection_key text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  athlete_id bigint not null,
  updated_at timestamptz not null default now()
);
