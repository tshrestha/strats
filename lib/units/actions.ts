"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import type { UnitSystem } from "./format";
import { UNIT_SYSTEM_COOKIE } from "./preference";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setUnitSystem(system: UnitSystem): Promise<void> {
  if (system !== "metric" && system !== "imperial") {
    throw new Error(`Invalid unit system: ${String(system)}`);
  }
  const store = await cookies();
  store.set(UNIT_SYSTEM_COOKIE, system, {
    path: "/",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
  });
  revalidatePath("/", "layout");
}
