import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isEmergency,
  parsePain,
  sortQueue,
  suggestLevel,
  type Patient,
} from "./triage.ts";

/** Run with `npm test`. */

describe("isEmergency", () => {
  it("matches the repo's red-flag phrases anywhere, in any case", () => {
    assert.equal(isEmergency("I have CHEST PAIN when I breathe"), true);
    assert.equal(isEmergency("the pain is 10/10"), true);
    assert.equal(isEmergency("twisted my ankle"), false);
  });
});

describe("parsePain", () => {
  it("reads a score out of free text", () => {
    assert.equal(parsePain("about a 7 I think"), 7);
    assert.equal(parsePain("10"), 10);
    assert.equal(parsePain("it hurts"), undefined);
  });
});

describe("suggestLevel", () => {
  it("is Level 1 for a red flag regardless of the answers", () => {
    assert.equal(suggestLevel({ pain: 2 }, true), 1);
  });
  it("rises with pain", () => {
    assert.equal(suggestLevel({ pain: 9 }, false), 2);
    assert.equal(suggestLevel({ pain: 6 }, false), 3);
    assert.equal(suggestLevel({ pain: 2 }, false), 4);
  });
});

describe("sortQueue", () => {
  it("orders by urgency, then arrival, like the dashboard's SQL", () => {
    const p = (id: string, level: 1 | 2 | 3 | 4 | 5, arrived: number) =>
      ({
        id,
        name: id,
        complaint: "",
        level,
        arrived,
        status: "READY",
      }) as Patient;
    const out = sortQueue([
      p("a", 3, 1),
      p("b", 2, 5),
      p("c", 3, 0),
      p("d", 2, 2),
    ]);
    assert.deepEqual(
      out.map((x) => x.id),
      ["d", "b", "c", "a"],
    );
  });
});
