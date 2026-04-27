import { type NextRequest, NextResponse } from "next/server";

import { logError } from "@/lib/log";
import { consumeState } from "@/lib/strava/state";
import { exchangeCodeForTokens, writeTokens } from "@/lib/strava/tokens";
import { VISITOR_COOKIE_NAME, verifyVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_SCOPE = "activity:read_all";

function html(title: string, body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5}.err{color:#b00}</style>
</head><body>${body}</body></html>`;
}

function htmlResponse(status: number, title: string, body: string): NextResponse {
  return new NextResponse(html(title, body), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const visitorCookie = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (!verifyVisitorCookie(visitorCookie)) {
    return htmlResponse(
      400,
      "Strava — Session Lost",
      `<h1 class="err">Session lost</h1><p>Your browser session was lost mid-connection (cookies may have been cleared). No account was connected.</p><p><a href="/auth/strava">Try again</a></p>`,
    );
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const scope = searchParams.get("scope");
  const error = searchParams.get("error");

  if (error) {
    return htmlResponse(
      400,
      "Strava — Authorization Failed",
      `<h1 class="err">Authorization failed</h1><p>Strava returned: <code>${error}</code>.</p><p><a href="/auth/strava">Try again</a></p>`,
    );
  }

  if (!state || !(await consumeState(state))) {
    return htmlResponse(
      400,
      "Strava — Invalid State",
      `<h1 class="err">Invalid state</h1><p>The <code>state</code> parameter was missing, expired, or not recognized. This can happen if the browser tab was idle too long.</p><p><a href="/auth/strava">Try again</a></p>`,
    );
  }

  const grantedScopes = scope ? scope.split(",") : [];
  if (!grantedScopes.includes(REQUIRED_SCOPE)) {
    return htmlResponse(
      400,
      "Strava — Missing Scope",
      `<h1 class="err">Missing required permission</h1><p>This app needs the <code>${REQUIRED_SCOPE}</code> scope to read your activities, but it was not granted.</p><p><a href="/auth/strava">Try again</a> and make sure all permissions are checked on the Strava consent screen.</p>`,
    );
  }

  if (!code) {
    return htmlResponse(
      400,
      "Strava — Missing Code",
      `<h1 class="err">Missing authorization code</h1><p><a href="/auth/strava">Try again</a></p>`,
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await writeTokens(tokens);
    return htmlResponse(
      200,
      "Strava — Connected",
      `<h1>Connected!</h1><p>Authenticated as athlete <code>#${tokens.athleteId}</code>.</p>`,
    );
  } catch (err) {
    logError(`Token exchange failed: ${err instanceof Error ? err.message : String(err)}`);
    return htmlResponse(
      502,
      "Strava — Exchange Failed",
      `<h1 class="err">Token exchange failed</h1><p>The authorization code could not be traded for tokens. It may have expired; try again.</p><p><a href="/auth/strava">Try again</a></p>`,
    );
  }
}
