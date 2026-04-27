export type GroupKey = "Run" | "Ride" | "Swim" | "WalkHike" | "Other";

export const SPORT_GROUPS: Record<GroupKey, readonly string[]> = {
  Run: ["Run", "TrailRun", "VirtualRun"],
  Ride: [
    "Ride",
    "MountainBikeRide",
    "GravelRide",
    "EBikeRide",
    "EBikeMountainBikeRide",
    "VirtualRide",
    "Velomobile",
  ],
  Swim: ["Swim"],
  WalkHike: ["Walk", "Hike"],
  Other: [],
};

const NAMED_GROUPS: GroupKey[] = ["Run", "Ride", "Swim", "WalkHike"];

export function groupForSportType(sportType: string): GroupKey {
  for (const group of NAMED_GROUPS) {
    if (SPORT_GROUPS[group].includes(sportType)) return group;
  }
  return "Other";
}

// Strava's `total_elevation_gain` for these sports includes elevation gained
// while on a chairlift, which is not earned by the athlete. The dashboard
// excludes them from the elevation headline and the biggest-climb highlight.
export const LIFT_ASSISTED_SPORT_TYPES: readonly string[] = ["AlpineSki", "Snowboard"];

export function isLiftAssisted(sportType: string): boolean {
  return LIFT_ASSISTED_SPORT_TYPES.includes(sportType);
}
