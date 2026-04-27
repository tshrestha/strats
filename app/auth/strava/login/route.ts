import { NextResponse } from "next/server";

import { issueState } from "@/lib/strava/state";
import { buildAuthorizeUrl } from "@/lib/strava/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await issueState();
  return NextResponse.redirect(buildAuthorizeUrl(state), 302);
}
