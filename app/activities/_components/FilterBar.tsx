"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { UnitSystem } from "@/lib/units/format";

const KM_PER_MILE = 1.609344;

type FilterKey =
  | "sport_type"
  | "distance"
  | "moving_time"
  | "elevation"
  | "start_date"
  | "commute"
  | "trainer"
  | "has_heartrate";

function distanceLabel(system: UnitSystem): string {
  return system === "imperial" ? "Distance (mi)" : "Distance (km)";
}

function distanceUnit(system: UnitSystem): string {
  return system === "imperial" ? "mi" : "km";
}

// URL params for distance are always in canonical km (the storage column is meters,
// the URL uses km for human readability). When the user is in imperial mode the
// FilterBar converts on input commit and on display.
function kmToUserUnit(km: number, system: UnitSystem): number {
  return system === "imperial" ? km / KM_PER_MILE : km;
}
function userUnitToKm(value: number, system: UnitSystem): number {
  return system === "imperial" ? value * KM_PER_MILE : value;
}

interface ActiveFilter {
  key: FilterKey;
  summary: string;
  // The set of URL-param keys this filter owns.
  paramKeys: string[];
}

interface Props {
  currentSearch: string;
  sportTypes: string[];
  system: UnitSystem;
}

const BOOL_LABELS: Record<"commute" | "trainer" | "has_heartrate", string> = {
  commute: "Commute",
  trainer: "Trainer",
  has_heartrate: "Has heartrate",
};

function filterLabels(system: UnitSystem): Record<FilterKey, string> {
  return {
    sport_type: "Sport type",
    distance: distanceLabel(system),
    moving_time: "Moving time (min)",
    elevation: "Elevation (m)",
    start_date: "Start date",
    commute: "Commute",
    trainer: "Trainer",
    has_heartrate: "Has heartrate",
  };
}

function readActiveFilters(p: URLSearchParams, system: UnitSystem): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const labels = filterLabels(system);

  const sportTypes = p.get("sport_type");
  if (sportTypes) {
    out.push({
      key: "sport_type",
      summary: `Sport: ${sportTypes.split(",").join(", ")}`,
      paramKeys: ["sport_type"],
    });
  }

  const dMin = p.get("distance_min");
  const dMax = p.get("distance_max");
  if (dMin || dMax) {
    // URL is canonical km; pill renders in active system.
    const displayMin = dMin ? formatRange(kmToUserUnit(Number(dMin), system)) : null;
    const displayMax = dMax ? formatRange(kmToUserUnit(Number(dMax), system)) : null;
    out.push({
      key: "distance",
      summary: rangeSummary("Distance", displayMin, displayMax, distanceUnit(system)),
      paramKeys: ["distance_min", "distance_max"],
    });
  }

  const mMin = p.get("moving_time_min");
  const mMax = p.get("moving_time_max");
  if (mMin || mMax) {
    out.push({
      key: "moving_time",
      summary: rangeSummary("Moving time", mMin, mMax, "min"),
      paramKeys: ["moving_time_min", "moving_time_max"],
    });
  }

  const eMin = p.get("elevation_min");
  const eMax = p.get("elevation_max");
  if (eMin || eMax) {
    out.push({
      key: "elevation",
      summary: rangeSummary("Elevation", eMin, eMax, "m"),
      paramKeys: ["elevation_min", "elevation_max"],
    });
  }

  const sdAfter = p.get("start_date_after");
  const sdBefore = p.get("start_date_before");
  if (sdAfter || sdBefore) {
    out.push({
      key: "start_date",
      summary: rangeSummary("Date", sdAfter, sdBefore, ""),
      paramKeys: ["start_date_after", "start_date_before"],
    });
  }

  for (const k of ["commute", "trainer", "has_heartrate"] as const) {
    const v = p.get(k);
    if (v === "true" || v === "false") {
      out.push({
        key: k,
        summary: `${labels[k]}: ${v}`,
        paramKeys: [k],
      });
    }
  }

  return out;
}

function formatRange(n: number): string {
  // 1 decimal but trim trailing zero for readability ("10" not "10.0")
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function rangeSummary(label: string, min: string | null, max: string | null, unit: string): string {
  const u = unit ? ` ${unit}` : "";
  if (min && max) return `${label}: ${min}${u} – ${max}${u}`;
  if (min) return `${label} ≥ ${min}${u}`;
  return `${label} ≤ ${max}${u}`;
}

export function FilterBar({ currentSearch, sportTypes, system }: Props) {
  const router = useRouter();
  const liveParams = useSearchParams();
  const labels = filterLabels(system);
  // Use live params on the client; fall back to server-provided string for SSR.
  const params = useMemo(() => {
    const live = liveParams?.toString() ?? "";
    return new URLSearchParams(live || currentSearch);
  }, [liveParams, currentSearch]);

  const active = readActiveFilters(params, system);
  const activeKeys = new Set(active.map((a) => a.key));
  const available = (Object.keys(labels) as FilterKey[]).filter((k) => !activeKeys.has(k));

  const [editing, setEditing] = useState<FilterKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function commit(mutator: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    next.delete("page");
    next.delete("syncError");
    mutator(next);
    const s = next.toString();
    router.push(s ? `/activities?${s}` : "/activities");
    setEditing(null);
    setPickerOpen(false);
  }

  function removeFilter(f: ActiveFilter) {
    commit((p) => {
      for (const k of f.paramKeys) p.delete(k);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {active.map((f) => (
          <span
            key={f.key}
            className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm"
          >
            <button
              type="button"
              onClick={() => setEditing(f.key)}
              className="hover:underline"
            >
              {f.summary}
            </button>
            <button
              type="button"
              onClick={() => removeFilter(f)}
              aria-label={`Remove ${f.key} filter`}
              className="text-zinc-500 hover:text-zinc-900"
            >
              ✕
            </button>
          </span>
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            disabled={available.length === 0}
            className="rounded-full border border-dashed border-zinc-400 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            + Add filter
          </button>
          {pickerOpen && available.length > 0 && (
            <div className="absolute z-10 mt-1 w-48 rounded border border-zinc-200 bg-white shadow-md">
              <ul className="py-1">
                {available.map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(k);
                        setPickerOpen(false);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50"
                    >
                      {labels[k]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <FilterEditor
          filterKey={editing}
          params={params}
          sportTypes={sportTypes}
          system={system}
          onCancel={() => setEditing(null)}
          onApply={(mutator) => commit(mutator)}
        />
      )}
    </div>
  );
}

interface EditorProps {
  filterKey: FilterKey;
  params: URLSearchParams;
  sportTypes: string[];
  system: UnitSystem;
  onApply: (mutator: (p: URLSearchParams) => void) => void;
  onCancel: () => void;
}

function FilterEditor({ filterKey, params, sportTypes, system, onApply, onCancel }: EditorProps) {
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
      {filterKey === "sport_type" && (
        <SportTypeEditor params={params} sportTypes={sportTypes} onApply={onApply} onCancel={onCancel} />
      )}
      {(filterKey === "distance" || filterKey === "moving_time" || filterKey === "elevation") && (
        <RangeEditor filterKey={filterKey} params={params} system={system} onApply={onApply} onCancel={onCancel} />
      )}
      {filterKey === "start_date" && (
        <DateRangeEditor params={params} onApply={onApply} onCancel={onCancel} />
      )}
      {(filterKey === "commute" || filterKey === "trainer" || filterKey === "has_heartrate") && (
        <BooleanEditor filterKey={filterKey} params={params} onApply={onApply} onCancel={onCancel} />
      )}
    </div>
  );
}

function ApplyCancel({ onApply, onCancel }: { onApply: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onApply}
        className="rounded bg-zinc-800 px-3 py-1 text-sm text-white hover:bg-zinc-700"
      >
        Apply
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm hover:bg-zinc-50"
      >
        Cancel
      </button>
    </div>
  );
}

function SportTypeEditor({
  params,
  sportTypes,
  onApply,
  onCancel,
}: {
  params: URLSearchParams;
  sportTypes: string[];
  onApply: EditorProps["onApply"];
  onCancel: () => void;
}) {
  const initial = (params.get("sport_type") ?? "").split(",").filter(Boolean);
  const [picked, setPicked] = useState<string[]>(initial);

  function toggle(t: string) {
    setPicked((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Sport type</div>
      {sportTypes.length === 0 ? (
        <p className="text-sm text-zinc-600">No sport types in cache yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sportTypes.map((t) => (
            <label key={t} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={picked.includes(t)} onChange={() => toggle(t)} />
              {t}
            </label>
          ))}
        </div>
      )}
      <ApplyCancel
        onCancel={onCancel}
        onApply={() =>
          onApply((p) => {
            if (picked.length === 0) p.delete("sport_type");
            else p.set("sport_type", picked.join(","));
          })
        }
      />
    </div>
  );
}

function RangeEditor({
  filterKey,
  params,
  system,
  onApply,
  onCancel,
}: {
  filterKey: "distance" | "moving_time" | "elevation";
  params: URLSearchParams;
  system: UnitSystem;
  onApply: EditorProps["onApply"];
  onCancel: () => void;
}) {
  const minKey = `${filterKey}_min`;
  const maxKey = `${filterKey}_max`;
  const labels = filterLabels(system);
  const isDistance = filterKey === "distance";
  // Distance inputs display in the active system; URL is canonical km. Other
  // ranges (moving_time, elevation) have no system conversion.
  const initialMin = params.get(minKey) ?? "";
  const initialMax = params.get(maxKey) ?? "";
  const [min, setMin] = useState(
    isDistance && initialMin !== ""
      ? formatRange(kmToUserUnit(Number(initialMin), system))
      : initialMin,
  );
  const [max, setMax] = useState(
    isDistance && initialMax !== ""
      ? formatRange(kmToUserUnit(Number(initialMax), system))
      : initialMax,
  );

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{labels[filterKey]}</div>
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          min
          <input
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="w-24 rounded border border-zinc-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-1">
          max
          <input
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="w-24 rounded border border-zinc-300 px-2 py-1"
          />
        </label>
      </div>
      <ApplyCancel
        onCancel={onCancel}
        onApply={() =>
          onApply((p) => {
            const writeParam = (key: string, raw: string) => {
              if (raw === "") {
                p.delete(key);
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              const stored = isDistance ? userUnitToKm(n, system) : n;
              p.set(key, isDistance ? stored.toFixed(2) : String(stored));
            };
            writeParam(minKey, min);
            writeParam(maxKey, max);
          })
        }
      />
    </div>
  );
}

function DateRangeEditor({
  params,
  onApply,
  onCancel,
}: {
  params: URLSearchParams;
  onApply: EditorProps["onApply"];
  onCancel: () => void;
}) {
  const [after, setAfter] = useState(params.get("start_date_after") ?? "");
  const [before, setBefore] = useState(params.get("start_date_before") ?? "");
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Start date</div>
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          after
          <input
            type="date"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-1">
          before
          <input
            type="date"
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1"
          />
        </label>
      </div>
      <ApplyCancel
        onCancel={onCancel}
        onApply={() =>
          onApply((p) => {
            if (after === "") p.delete("start_date_after");
            else p.set("start_date_after", after);
            if (before === "") p.delete("start_date_before");
            else p.set("start_date_before", before);
          })
        }
      />
    </div>
  );
}

function BooleanEditor({
  filterKey,
  params,
  onApply,
  onCancel,
}: {
  filterKey: "commute" | "trainer" | "has_heartrate";
  params: URLSearchParams;
  onApply: EditorProps["onApply"];
  onCancel: () => void;
}) {
  const initial = params.get(filterKey);
  const [val, setVal] = useState<"true" | "false" | "any">(
    initial === "true" ? "true" : initial === "false" ? "false" : "any",
  );
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{BOOL_LABELS[filterKey]}</div>
      <div className="flex items-center gap-3 text-sm">
        {(["true", "false", "any"] as const).map((opt) => (
          <label key={opt} className="flex items-center gap-1">
            <input
              type="radio"
              name={`bool-${filterKey}`}
              value={opt}
              checked={val === opt}
              onChange={() => setVal(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
      <ApplyCancel
        onCancel={onCancel}
        onApply={() =>
          onApply((p) => {
            if (val === "any") p.delete(filterKey);
            else p.set(filterKey, val);
          })
        }
      />
    </div>
  );
}
