import { NextResponse } from "next/server";

import { syncActivities } from "@/lib/strava/sync";

export const runtime = "nodejs";

function safeReturnTo(raw: string | null): string {
  if (!raw) return "/activities";
  // Same-origin path only: must start with `/activities`. Reject anything else
  // (protocol-relative URLs starting with `//`, absolute URLs, paths to other
  // routes) to prevent open-redirect.
  if (!raw.startsWith("/activities")) return "/activities";
  if (raw.startsWith("//")) return "/activities";
  return raw;
}

function appendError(returnTo: string, message: string): string {
  const [pathOnly, existingQuery = ""] = returnTo.split("?");
  const params = new URLSearchParams(existingQuery);
  params.delete("syncError");
  params.set("syncError", message);
  return `${pathOnly}?${params.toString()}`;
}

export async function POST(request: Request) {
  let returnTo = "/activities";
  try {
    const form = await request.formData();
    returnTo = safeReturnTo(typeof form.get("returnTo") === "string" ? (form.get("returnTo") as string) : null);
  } catch {
    // fall through with default
  }

  try {
    await syncActivities();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const url = new URL(appendError(returnTo, message), request.url);
    return NextResponse.redirect(url, 303);
  }

  const url = new URL(returnTo, request.url);
  return NextResponse.redirect(url, 303);
}
