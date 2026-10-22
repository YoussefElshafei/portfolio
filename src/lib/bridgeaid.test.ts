import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { distanceM, isNearby, report, type State } from "./bridgeaid.ts";

/** Run with `npm test`. Mirrors the rules in BridgeAid's incidents routes. */

const empty: State = { reports: [], confirmed: [] };
const at = { lat: 43.2557, lng: -79.8711 };
/** About 100 m north. */
const near = { lat: at.lat + 0.0009, lng: at.lng };
/** About 1 km north. */
const far = { lat: at.lat + 0.009, lng: at.lng };

describe("distance", () => {
  it("is haversine metres, with 200 m as the nearby radius", () => {
    assert.ok(
      Math.abs(distanceM(at.lat, at.lng, near.lat, near.lng) - 100) < 2,
    );
    assert.equal(isNearby(at.lat, at.lng, near.lat, near.lng), true);
    assert.equal(isNearby(at.lat, at.lng, far.lat, far.lng), false);
  });
});

describe("report", () => {
  it("confirms only once three different people report it nearby", () => {
    let s = empty;
    let out;
    [s, out] = report(s, { user: "a", incident: "Flooding", ...at, now: 0 });
    assert.equal(out.status === 201 && out.confirmed, null);
    [s, out] = report(s, { user: "b", incident: "Flooding", ...near, now: 1 });
    assert.equal(out.status === 201 && out.confirmed, null);
    [s, out] = report(s, { user: "c", incident: "Flooding", ...at, now: 2 });
    assert.ok(out.status === 201 && out.confirmed);
    assert.equal(s.confirmed.length, 1);
    assert.deepEqual(s.confirmed[0].verifiedUsers, ["a", "b", "c"]);
  });

  it("refuses the same person reporting again within the cooldown", () => {
    let s = empty;
    let out;
    [s] = report(s, { user: "a", incident: "Flooding", ...at, now: 0 });
    [s, out] = report(s, { user: "a", incident: "Flooding", ...near, now: 5 });
    assert.equal(out.status, 429);
    [s, out] = report(s, { user: "a", incident: "Flooding", ...near, now: 11 });
    assert.equal(out.status, 201);
    // Repeats by one person never add up to a confirmation.
    assert.equal(s.confirmed.length, 0);
  });

  it("does not count other incident types or far-away reports", () => {
    let s = empty;
    [s] = report(s, { user: "a", incident: "Flooding", ...at, now: 0 });
    [s] = report(s, { user: "b", incident: "Gas Leak", ...at, now: 0 });
    [s] = report(s, { user: "c", incident: "Flooding", ...far, now: 0 });
    assert.equal(s.confirmed.length, 0);
  });

  it("merges a fourth reporter into the existing incident", () => {
    let s = empty;
    for (const user of ["a", "b", "c"])
      [s] = report(s, { user, incident: "Flooding", ...at, now: 0 });
    const [after, out] = report(s, {
      user: "d",
      incident: "Flooding",
      ...near,
      now: 1,
    });
    s = after;
    assert.ok(out.status === 201 && out.merged);
    assert.equal(s.confirmed.length, 1);
    assert.equal(s.confirmed[0].verifiedUsers.length, 4);
  });
});
