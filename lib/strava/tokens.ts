import "server-only";

import { getConfig } from "../config";
import { trackSecret } from "../log";
import { getServiceRoleClient } from "../supabase";

const CONNECTION_KEY = "default";
const REFRESH_MARGIN_SECONDS = 60;
const TOKEN_URL = "https://www.strava.com/oauth/token";

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athleteId: number;
}

interface TokenRow {
  connection_key: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  athlete_id: number;
}

function rowToTokenSet(row: TokenRow): TokenSet {
  trackSecret(row.access_token);
  trackSecret(row.refresh_token);
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_at: Math.floor(new Date(row.expires_at).getTime() / 1000),
    athleteId: row.athlete_id,
  };
}

export async function readTokens(): Promise<TokenSet | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("strava_tokens")
    .select("connection_key, access_token, refresh_token, expires_at, athlete_id")
    .eq("connection_key", CONNECTION_KEY)
    .maybeSingle();
  if (error) throw new Error(`Failed to read strava_tokens: ${error.message}`);
  if (!data) return null;
  return rowToTokenSet(data as TokenRow);
}

export async function writeTokens(tokens: TokenSet): Promise<void> {
  trackSecret(tokens.access_token);
  trackSecret(tokens.refresh_token);
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from("strava_tokens").upsert(
    {
      connection_key: CONNECTION_KEY,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      athlete_id: tokens.athleteId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_key" },
  );
  if (error) throw new Error(`Failed to write strava_tokens: ${error.message}`);
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

async function postTokenForm(params: Record<string, string>): Promise<StravaTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!response.ok) {
    throw new Error(`Strava token endpoint returned ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as StravaTokenResponse;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenSet> {
  const config = getConfig();
  const resp = await postTokenForm({
    client_id: config.stravaClientId,
    client_secret: config.stravaClientSecret,
    code,
    grant_type: "authorization_code",
  });
  if (resp.athlete?.id === undefined) {
    throw new Error("Strava token response did not include athlete id");
  }
  return {
    access_token: resp.access_token,
    refresh_token: resp.refresh_token,
    expires_at: resp.expires_at,
    athleteId: resp.athlete.id,
  };
}

async function refreshTokens(refreshToken: string, athleteId: number): Promise<TokenSet> {
  const config = getConfig();
  const resp = await postTokenForm({
    client_id: config.stravaClientId,
    client_secret: config.stravaClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return {
    access_token: resp.access_token,
    refresh_token: resp.refresh_token,
    expires_at: resp.expires_at,
    athleteId: resp.athlete?.id ?? athleteId,
  };
}

export async function getAccessToken(): Promise<string> {
  const tokens = await readTokens();
  if (!tokens) {
    throw new Error(
      "No Strava tokens persisted. Visit /auth/strava in a browser to connect your account.",
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at - now > REFRESH_MARGIN_SECONDS) {
    return tokens.access_token;
  }
  const fresh = await refreshTokens(tokens.refresh_token, tokens.athleteId);
  await writeTokens(fresh);
  return fresh.access_token;
}

export function buildAuthorizeUrl(state: string): string {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.stravaClientId,
    redirect_uri: config.stravaRedirectUri,
    response_type: "code",
    scope: "read,activity:read_all",
    approval_prompt: "auto",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}
