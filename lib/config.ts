import "server-only";

import { trackSecret } from "./log";

export interface Config {
  stravaClientId: string;
  stravaClientSecret: string;
  stravaRedirectUri: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;

  const required = [
    "STRAVA_CLIENT_ID",
    "STRAVA_CLIENT_SECRET",
    "STRAVA_REDIRECT_URI",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Copy .env.example to .env.local and fill in the values.`,
    );
  }

  trackSecret(process.env.STRAVA_CLIENT_SECRET);
  trackSecret(process.env.SUPABASE_SERVICE_ROLE_KEY);

  cached = {
    stravaClientId: process.env.STRAVA_CLIENT_ID!,
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET!,
    stravaRedirectUri: process.env.STRAVA_REDIRECT_URI!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };
  return cached;
}
