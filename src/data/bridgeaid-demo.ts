/**
 * Data for the BridgeAid map demo.
 *
 * Everything here is illustrative. The sample incidents are invented, and the
 * caption under the map says so. The places are real Hamilton neighbourhoods
 * and landmarks; coordinates are approximate (to about a block), which is
 * all a pin on a city-scale map needs.
 *
 * Report locations are a fixed list rather than free-text address search on
 * purpose: geocoding would mean a third-party API, a network dependency and a
 * failure mode, for a feature whose only job is to show the concept.
 */

export type LatLng = readonly [number, number];

/** Centre of the initial view: downtown Hamilton. */
export const HAMILTON: LatLng = [43.2557, -79.8711];

export const DISASTER_TYPES = [
  "Flood",
  "Fire",
  "Storm damage",
  "Power outage",
  "Medical need",
] as const;

export type DisasterType = (typeof DISASTER_TYPES)[number];

export type Incident = {
  id: string;
  type: DisasterType;
  label: string;
  at: LatLng;
};

/** Pre-placed on load, drawn as red pins. Invented, labelled as such below the map. */
export const SAMPLE_INCIDENTS: readonly Incident[] = [
  {
    id: "s1",
    type: "Flood",
    label: "Water over the road, Red Hill Valley",
    at: [43.233, -79.788],
  },
  {
    id: "s2",
    type: "Fire",
    label: "Brush fire, Dundas",
    at: [43.2658, -79.9552],
  },
  {
    id: "s3",
    type: "Storm damage",
    label: "Downed trees, Gage Park",
    at: [43.2446, -79.8286],
  },
  {
    id: "s4",
    type: "Power outage",
    label: "Several blocks without power, Stoney Creek",
    at: [43.2183, -79.7676],
  },
  {
    id: "s5",
    type: "Medical need",
    label: "Assistance requested, Downtown",
    at: [43.2567, -79.869],
  },
];

/** The "where" dropdown in the Report form. */
export const REPORT_LOCATIONS: readonly { name: string; at: LatLng }[] = [
  { name: "Downtown (Gore Park)", at: [43.2567, -79.869] },
  { name: "McMaster University", at: [43.2609, -79.9192] },
  { name: "Westdale Village", at: [43.2622, -79.9075] },
  { name: "Dundurn Castle", at: [43.2692, -79.8849] },
  { name: "Bayfront Park", at: [43.2717, -79.8728] },
  { name: "Tim Hortons Field", at: [43.2519, -79.8302] },
  { name: "Hamilton Mountain (Upper James & Mohawk)", at: [43.2243, -79.887] },
  { name: "Ancaster Village", at: [43.2179, -79.9876] },
  { name: "Dundas", at: [43.2658, -79.9552] },
  { name: "Stoney Creek (Battlefield Park)", at: [43.2188, -79.7665] },
];
