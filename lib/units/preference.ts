import "server-only";

import { cookies } from "next/headers";

import type { UnitSystem } from "./format";

export const UNIT_SYSTEM_COOKIE = "units";
export const DEFAULT_UNIT_SYSTEM: UnitSystem = "imperial";

export async function getUnitSystem(): Promise<UnitSystem> {
  try {
    const store = await cookies();
    const v = store.get(UNIT_SYSTEM_COOKIE)?.value;
    if (v === "metric" || v === "imperial") return v;
  } catch {
    // cookies() can throw outside a request context (e.g. during a static
    // optimization pass). Fall through to the default in that case.
  }
  return DEFAULT_UNIT_SYSTEM;
}
