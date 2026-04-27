import { type NextRequest, NextResponse } from "next/server";

import { VISITOR_COOKIE_NAME, issueVisitorCookieValue, verifyVisitorCookie } from "@/lib/visitor";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|woff|woff2)$).*)",
  ],
};

export function proxy(request: NextRequest): NextResponse {
  const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (verifyVisitorCookie(existing)) {
    return NextResponse.next();
  }

  const fresh = issueVisitorCookieValue();
  request.cookies.set(VISITOR_COOKIE_NAME, fresh);

  const response = NextResponse.next({ request });
  response.cookies.set({
    name: VISITOR_COOKIE_NAME,
    value: fresh,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}
