export type UnitSystem = "metric" | "imperial";

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;
const MPH_PER_MPS = 2.236936;

function isFiniteNumber(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function fmt(n: number, decimals: number, useGrouping = true): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  });
}

export interface UnitsBundle {
  distance(m: number | null | undefined): string;
  elevation(m: number | null | undefined): string;
  speed(mps: number | null | undefined): string;
  duration(s: number | null | undefined): string;
  heartrate(bpm: number | null | undefined): string;
}

export function unitsFor(system: UnitSystem): UnitsBundle {
  const imperial = system === "imperial";

  return {
    distance(m) {
      if (!isFiniteNumber(m)) return "";
      const v = imperial ? m / METERS_PER_MILE : m / 1000;
      return `${fmt(v, 1)} ${imperial ? "mi" : "km"}`;
    },
    elevation(m) {
      if (!isFiniteNumber(m)) return "";
      const v = imperial ? m * FEET_PER_METER : m;
      return `${fmt(v, 0)} ${imperial ? "ft" : "m"}`;
    },
    speed(mps) {
      if (!isFiniteNumber(mps)) return "";
      const v = imperial ? mps * MPH_PER_MPS : mps * 3.6;
      return `${fmt(v, 1)} ${imperial ? "mph" : "km/h"}`;
    },
    duration(s) {
      if (!isFiniteNumber(s)) return "";
      const total = Math.max(0, Math.floor(s));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const sec = total % 60;
      return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
    },
    heartrate(bpm) {
      if (!isFiniteNumber(bpm)) return "";
      return `${Math.round(bpm)} bpm`;
    },
  };
}

export function formatCount(n: number | null | undefined): string {
  if (!isFiniteNumber(n)) return "";
  return fmt(n, 0);
}

export function formatHours(seconds: number | null | undefined): string {
  if (!isFiniteNumber(seconds)) return "";
  return `${fmt(seconds / 3600, 1)} hours`;
}
