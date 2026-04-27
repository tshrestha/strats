import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { getConfig } from "./config";

export const VISITOR_COOKIE_NAME = "strats_vid";

const ID_BYTES = 16;

function sign(id: string): string {
  const secret = getConfig().visitorCookieSecret;
  return createHmac("sha256", secret).update(id).digest("base64url");
}

export function issueVisitorCookieValue(): string {
  const id = randomBytes(ID_BYTES).toString("base64url");
  return `${id}.${sign(id)}`;
}

export function verifyVisitorCookie(value: string | undefined | null): string | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  const expected = Buffer.from(sign(id), "utf8");
  const actual = Buffer.from(sig, "utf8");
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;
  return id;
}

export async function getConnectionKey(): Promise<string> {
  const store = await cookies();
  const raw = store.get(VISITOR_COOKIE_NAME)?.value;
  const id = verifyVisitorCookie(raw);
  if (!id) {
    throw new Error(
      "No valid visitor cookie. Middleware should have issued one — make sure middleware.ts is registered and VISITOR_COOKIE_SECRET is set.",
    );
  }
  return id;
}
