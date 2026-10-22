/**
 * BridgeAid's report-verification rules, ported from the BridgeAid repo
 * (backend/app/incidents/routes.py and backend/app/models.py) for the
 * in-page demo.
 *
 *  - `isNearby`         ← `is_nearby`: haversine distance within 200 m
 *  - `userDuplicate`    ← `user_duplicate`: the same person reporting the
 *                         same kind of incident nearby within 10 minutes is
 *                         refused (the API answers 429)
 *  - `clusterFor`       ← `cluster_for`: the unique people who reported this
 *                         kind of incident nearby
 *  - `upsertConfirmed`  ← `upsert_confirmed`: 3 unique people confirm it; a
 *                         later cluster close to a confirmed incident merges
 *                         into it instead of creating a second pin
 *  - `report`           ← the `report` route, minus geocoding: the demo gets
 *                         coordinates from where you tap
 *
 * The real app then also asks a language model to look for public news of
 * the incident. The demo stops before that step, and says so.
 *
 * Pure and deterministic (the clock is passed in), so it is unit-tested.
 */

export const DISTANCE_THRESHOLD_M = 200;
export const CLUSTER_THRESHOLD = 3;
export const COOLDOWN_MIN = 10;

/** A few of the twelve `INCIDENT_TYPES`, enough for the demo's menu. */
export const INCIDENT_TYPES = [
  "Flooding",
  "Power Outage",
  "Road Blocked",
  "Gas Leak",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export type Report = {
  id: string;
  incident: IncidentType;
  userId: string;
  lat: number;
  lng: number;
  /** Minutes on the demo's clock. */
  t: number;
};

export type Confirmed = {
  id: string;
  incident: IncidentType;
  lat: number;
  lng: number;
  verifiedUsers: string[];
};

export type State = {
  reports: Report[];
  confirmed: Confirmed[];
};

export type Outcome =
  | { status: 429; error: string }
  | {
      status: 201;
      report: Report;
      nearbyUsers: string[];
      confirmed: Confirmed | null;
      /** True when this report grew an incident that was already confirmed. */
      merged: boolean;
    };

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const isNearby = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => distanceM(lat1, lng1, lat2, lng2) <= DISTANCE_THRESHOLD_M;

export function userDuplicate(
  s: State,
  user: string,
  incident: IncidentType,
  lat: number,
  lng: number,
  now: number,
) {
  const cutoff = now - COOLDOWN_MIN;
  // The original scans only the last 200 reports; a demo never gets there.
  return s.reports.some(
    (r) =>
      r.userId === user &&
      r.incident === incident &&
      r.t >= cutoff &&
      isNearby(lat, lng, r.lat, r.lng),
  );
}

export function clusterFor(
  s: State,
  incident: IncidentType,
  lat: number,
  lng: number,
) {
  const nearby = s.reports.filter(
    (r) => r.incident === incident && isNearby(lat, lng, r.lat, r.lng),
  );
  return [...new Set(nearby.map((r) => r.userId))].sort();
}

function upsertConfirmed(
  s: State,
  incident: IncidentType,
  lat: number,
  lng: number,
  users: string[],
): { entry: Confirmed; merged: boolean; confirmed: Confirmed[] } {
  const existing = s.confirmed.find(
    (c) => c.incident === incident && isNearby(lat, lng, c.lat, c.lng),
  );
  if (existing) {
    const entry = {
      ...existing,
      verifiedUsers: [...new Set([...existing.verifiedUsers, ...users])].sort(),
    };
    return {
      entry,
      merged: true,
      confirmed: s.confirmed.map((c) => (c === existing ? entry : c)),
    };
  }
  const entry: Confirmed = {
    id: `${incident}_${lat.toFixed(4)}_${lng.toFixed(4)}`,
    incident,
    lat,
    lng,
    verifiedUsers: users,
  };
  return { entry, merged: false, confirmed: [...s.confirmed, entry] };
}

/** One report, start to finish. Returns the new state and what happened. */
export function report(
  s: State,
  input: {
    user: string;
    incident: IncidentType;
    lat: number;
    lng: number;
    now: number;
  },
): [State, Outcome] {
  const { user, incident, lat, lng, now } = input;
  if (userDuplicate(s, user, incident, lat, lng, now))
    return [s, { status: 429, error: "duplicate report (cooldown active)" }];

  const rep: Report = {
    id: `rep-${s.reports.length + 1}`,
    incident,
    userId: user,
    lat,
    lng,
    t: now,
  };
  let next: State = { ...s, reports: [...s.reports, rep] };
  const users = clusterFor(next, incident, lat, lng);
  let confirmed: Confirmed | null = null;
  let merged = false;
  if (users.length >= CLUSTER_THRESHOLD) {
    const up = upsertConfirmed(next, incident, lat, lng, users);
    next = { ...next, confirmed: up.confirmed };
    confirmed = up.entry;
    merged = up.merged;
  }
  return [
    next,
    { status: 201, report: rep, nearbyUsers: users, confirmed, merged },
  ];
}
