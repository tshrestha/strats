"use client";

import type { UnitSystem } from "@/lib/units/format";
import { setUnitSystem } from "@/lib/units/actions";

interface Props {
  current: UnitSystem;
}

export function UnitToggle({ current }: Props) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-zinc-300 text-xs font-medium">
      <form action={setUnitSystem.bind(null, "metric")}>
        <button
          type="submit"
          className={
            "px-3 py-1 " +
            (current === "metric"
              ? "bg-zinc-800 text-white"
              : "bg-white text-zinc-700 hover:bg-zinc-50")
          }
          aria-pressed={current === "metric"}
        >
          km
        </button>
      </form>
      <form action={setUnitSystem.bind(null, "imperial")}>
        <button
          type="submit"
          className={
            "px-3 py-1 border-l border-zinc-300 " +
            (current === "imperial"
              ? "bg-zinc-800 text-white"
              : "bg-white text-zinc-700 hover:bg-zinc-50")
          }
          aria-pressed={current === "imperial"}
        >
          mi
        </button>
      </form>
    </div>
  );
}
