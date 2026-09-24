import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  IDENTITY,
  apply,
  axisAngle,
  dragRotation,
  multiply,
  orthonormalise,
  project,
  type Mat3,
  type Vec3,
} from "./rotation.ts";

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const closeVec = (a: Vec3, b: Vec3, eps = 1e-9) =>
  a.forEach((v, i) => close(v, b[i], eps));

/** A rotation preserves length and has determinant +1. */
function assertRotation(m: Mat3, eps = 1e-9) {
  const det =
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6]);
  close(det, 1, eps);
  const v: Vec3 = [3, -4, 12];
  const r = apply(m, v);
  close(Math.hypot(...r), 13, eps * 13);
}

describe("axisAngle", () => {
  it("quarter turn about +y takes +x to −z and +z to +x", () => {
    const m = axisAngle([0, 1, 0], Math.PI / 2);
    closeVec(apply(m, [1, 0, 0]), [0, 0, -1]);
    closeVec(apply(m, [0, 0, 1]), [1, 0, 0]);
  });

  it("zero axis or zero angle is the identity", () => {
    assert.deepEqual(axisAngle([0, 0, 0], 1), IDENTITY);
    assert.deepEqual(axisAngle([1, 0, 0], 0), IDENTITY);
  });

  it("does not require a normalised axis", () => {
    const a = axisAngle([0, 5, 0], 0.7);
    const b = axisAngle([0, 1, 0], 0.7);
    a.forEach((v, i) => close(v, b[i]));
  });
});

describe("dragRotation", () => {
  it("dragging right moves the front of the object right", () => {
    const front = apply(dragRotation(40, 0, 0.01), [0, 0, 100]);
    assert.ok(front[0] > 0);
    close(front[1], 0);
  });

  it("dragging down moves the front of the object down (SVG y is down)", () => {
    const front = apply(dragRotation(0, 40, 0.01), [0, 0, 100]);
    assert.ok(front[1] > 0);
    close(front[0], 0);
  });
});

describe("orthonormalise", () => {
  it("keeps a long chain of small rotations a pure rotation", () => {
    // Enough frames to be ~10 minutes of ambient rotation at 60fps.
    let m: Mat3 = IDENTITY;
    for (let i = 0; i < 36_000; i++) {
      m = multiply(axisAngle([Math.sin(i), 1, Math.cos(i * 0.3)], 0.001), m);
      if (i % 120 === 0) m = orthonormalise(m);
    }
    assertRotation(orthonormalise(m));
  });

  it("repairs a sheared matrix", () => {
    const sheared: Mat3 = [1.01, 0.02, 0, 0, 0.99, 0.01, 0.03, 0, 1];
    assertRotation(orthonormalise(sheared), 1e-12);
  });
});

describe("project", () => {
  it("the origin lands on the centre at unit scale", () => {
    const p = project([0, 0, 0], 1000, 200, 400, 200);
    assert.deepEqual([p.x, p.y, p.scale], [400, 200, 1]);
    close(p.depth, 0.5);
  });

  it("nearer points are larger and further from the centre", () => {
    const near = project([100, 0, 150], 1000, 200, 0, 0);
    const far = project([100, 0, -150], 1000, 200, 0, 0);
    assert.ok(near.scale > 1 && far.scale < 1);
    assert.ok(near.x > 100 && far.x < 100);
    assert.ok(near.depth > far.depth);
  });
});
