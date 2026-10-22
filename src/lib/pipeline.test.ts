import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  closeMinute,
  consume,
  initialSim,
  lag,
  produce,
  setRunning,
  type Sim,
} from "./pipeline.ts";

/** Run with `npm test`. */

const drain = (s: Sim, g: Parameters<typeof consume>[1]) => {
  while (lag(s, g) > 0 && s.running[g]) s = consume(s, g)[0];
  return s;
};

describe("pipeline", () => {
  it("gives every trades consumer its own offset", () => {
    let s = produce(produce(initialSim()));
    s = drain(s, "persist");
    assert.equal(s.offsets.persist, 2);
    assert.equal(lag(s, "broadcaster"), 2);
  });

  it("leaves a stopped consumer's offset alone, and it resumes from there", () => {
    let s = setRunning(initialSim(), "persist", false);
    s = produce(produce(produce(s)));
    s = drain(s, "persist");
    assert.equal(lag(s, "persist"), 3);
    s = drain(setRunning(s, "persist", true), "persist");
    assert.equal(s.offsets.persist, 3);
  });

  it("only publishes a bar the aggregator has seen trades for", () => {
    let s = produce(initialSim());
    assert.equal(closeMinute(s)[1], null);
    s = drain(s, "aggregator");
    const [after, topic] = closeMinute(s);
    assert.equal(topic, "bars");
    assert.deepEqual(after.log.bars, [false]);
    assert.equal(after.bar.trades, 0);
  });

  it("cannot seal a bar while the aggregator is stopped", () => {
    let s = drain(produce(initialSim()), "aggregator");
    s = setRunning(s, "aggregator", false);
    assert.equal(closeMinute(s)[1], null);
  });

  it("flags an unusual bar and hands it to the dispatcher", () => {
    let s = drain(produce(produce(initialSim()), true), "aggregator");
    s = closeMinute(s)[0];
    const [flagged, topic] = consume(s, "detector");
    assert.equal(topic, "anomalies");
    assert.equal(flagged.log.anomalies.length, 1);
    assert.equal(drain(flagged, "dispatcher").offsets.dispatcher, 1);
  });

  it("does not flag an ordinary bar", () => {
    let s = drain(produce(initialSim()), "aggregator");
    s = closeMinute(s)[0];
    assert.equal(consume(s, "detector")[1], null);
  });
});
