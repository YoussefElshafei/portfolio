import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BOARD,
  candidateSettlements,
  finishTurn,
  newGame,
  step,
  total,
  value,
  withStartingRoads,
} from "./catan.ts";

/** Run with `npm test`. */

describe("board", () => {
  it("has the 24 corners and 30 sides of a seven-hex board", () => {
    assert.equal(BOARD.vertices.length, 24);
    assert.equal(BOARD.edges.length, 30);
  });
});

describe("ValueEvaluator", () => {
  const hand = (n: number) => ({
    wood: n,
    brick: 0,
    wheat: 0,
    sheep: 0,
    ore: 0,
  });
  it("matches the repo's numbers", () => {
    assert.equal(value({ kind: "settlement", vertex: 0 }, hand(9)), 1.0);
    assert.equal(value({ kind: "settlement", vertex: 0 }, hand(8)), 0.5);
    assert.equal(value({ kind: "city", vertex: 0 }, hand(10)), 1.0);
    assert.equal(value({ kind: "road", edge: 0 }, hand(7)), 0.8);
    assert.equal(value({ kind: "road", edge: 0 }, hand(6)), 0.5);
    assert.equal(value({ kind: "pass" }, hand(9)), 0);
  });
});

describe("the AI turn", () => {
  it("spends a hand over 7 through the constraint branch first", () => {
    let g = withStartingRoads(
      newGame({ wood: 3, brick: 3, wheat: 2, sheep: 1, ore: 0 }),
    );
    g = step(g); // roll
    g = step(g); // constraints
    assert.equal(g.checks?.overSeven, true);
    assert.equal(g.pc, "constrained");
  });

  it("never places a settlement next to another building", () => {
    const g = withStartingRoads(
      newGame({ wood: 5, brick: 5, wheat: 5, sheep: 5 }),
    );
    for (const a of candidateSettlements(g)) {
      assert.ok(a.kind === "settlement");
      const near = BOARD.edges
        .filter((e) => e.a === a.vertex || e.b === a.vertex)
        .map((e) => (e.a === a.vertex ? e.b : e.a));
      assert.ok(near.every((n) => !g.buildings.some((b) => b.vertex === n)));
    }
  });

  it("ends in a pass and never goes into debt", () => {
    const g = finishTurn(
      withStartingRoads(
        newGame({ wood: 4, brick: 4, wheat: 3, sheep: 2, ore: 3 }),
      ),
    );
    assert.equal(g.pc, "done");
    assert.ok(Object.values(g.hand).every((n) => n >= 0));
    assert.ok(total(g.hand) >= 0);
  });

  it("is reproducible for a seed", () => {
    const run = () =>
      finishTurn(
        withStartingRoads(
          newGame({ wood: 4, brick: 4, wheat: 4, sheep: 4, ore: 4 }, 3),
        ),
      );
    assert.deepEqual(run(), run());
  });
});
