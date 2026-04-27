import {
  ALLOWED_COLUMNS,
  type ColumnName,
} from "@/lib/strava/activities-query";

const LABELS: Record<ColumnName, string> = {
  name: "Name",
  sport_type: "Sport",
  start_date_local: "Date",
  distance: "Distance",
  moving_time: "Moving time",
  total_elevation_gain: "Elevation",
  average_speed: "Avg speed",
  max_speed: "Max speed",
  average_heartrate: "Avg HR",
  max_heartrate: "Max HR",
  commute: "Commute",
  trainer: "Trainer",
  has_heartrate: "Has HR",
};

interface Props {
  selected: ColumnName[];
  basePath: string;
  baseParams: string; // URL-encoded query string, with `cols` and `syncError` already removed
}

export function ColumnPicker({ selected, basePath, baseParams }: Props) {
  const selectedSet = new Set<string>(selected);
  const carry = new URLSearchParams(baseParams);
  // Remove `cols` so the form's checkboxes are the sole source of cols values.
  carry.delete("cols");

  return (
    <details className="rounded border border-zinc-200 bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
        Columns ({selected.length})
      </summary>
      <form action={basePath} method="get" className="space-y-3 p-3">
        {Array.from(carry.entries()).map(([k, v], i) => (
          <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
        ))}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ALLOWED_COLUMNS.map((col) => (
            <label key={col} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="cols"
                value={col}
                defaultChecked={selectedSet.has(col)}
                className="rounded border-zinc-300"
              />
              {LABELS[col]}
            </label>
          ))}
        </div>
        <button
          type="submit"
          className="rounded bg-zinc-800 px-3 py-1 text-sm text-white hover:bg-zinc-700"
        >
          Apply columns
        </button>
      </form>
    </details>
  );
}
