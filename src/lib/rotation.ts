/**
 * Rotation and projection for the 3D project graph.
 *
 * Five nodes do not justify a WebGL library. Everything the graph needs is a
 * 3×3 rotation matrix, the axis-angle formula to build one, and a perspective
 * divide. All of it lives here as pure functions so it can be unit-tested
 * without a browser.
 *
 * Coordinate system: SVG's. x runs right, y runs DOWN, z points toward the
 * viewer. The camera looks down −z from `distance` units away.
 *
 * Matrices are row-major 9-element arrays. They are plain tuples rather than a
 * class so a frame of the animation allocates as little as possible.
 */

export type Vec3 = readonly [number, number, number];
// prettier-ignore
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** a · b, where both are row-major 3×3. */
export function multiply(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/**
 * Rodrigues' rotation formula: rotation by `angle` radians about `axis`.
 * The axis need not be normalised; a zero axis gives the identity.
 */
export function axisAngle(axis: Vec3, angle: number): Mat3 {
  const len = Math.hypot(axis[0], axis[1], axis[2]);
  if (len === 0 || angle === 0) return IDENTITY;
  const x = axis[0] / len;
  const y = axis[1] / len;
  const z = axis[2] / len;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  // prettier-ignore
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

/**
 * Re-orthonormalise with Gram–Schmidt on the rows.
 *
 * The ambient rotation multiplies a small increment into the orientation every
 * frame, indefinitely. Floating-point error accumulates, and after a few
 * minutes an unchecked matrix starts to shear and scale the graph. Cleaning it
 * up every so often keeps it a pure rotation.
 */
export function orthonormalise(m: Mat3): Mat3 {
  let ax = m[0],
    ay = m[1],
    az = m[2];
  let l = Math.hypot(ax, ay, az);
  ax /= l;
  ay /= l;
  az /= l;

  let bx = m[3],
    by = m[4],
    bz = m[5];
  const d = ax * bx + ay * by + az * bz;
  bx -= d * ax;
  by -= d * ay;
  bz -= d * az;
  l = Math.hypot(bx, by, bz);
  bx /= l;
  by /= l;
  bz /= l;

  // Third row is the cross product, which also fixes handedness.
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  return [ax, ay, az, bx, by, bz, cx, cy, cz];
}

/**
 * The rotation a pointer drag of (dx, dy) screen pixels should apply, as a
 * trackball: the point of the object under the cursor moves with the cursor.
 *
 * Dragging right spins about +y so the front face moves right; dragging down
 * spins about −x so the front face moves down (y is down in SVG). The axis is
 * therefore perpendicular to the drag in the screen plane, (−dy, dx, 0), and
 * the angle is proportional to the drag distance.
 */
export function dragRotation(dx: number, dy: number, radPerPx: number): Mat3 {
  return axisAngle([-dy, dx, 0], Math.hypot(dx, dy) * radPerPx);
}

export type Projected = {
  x: number;
  y: number;
  /** Perspective scale at this depth: >1 in front of the centre, <1 behind. */
  scale: number;
  /** Depth mapped to 0 (farthest possible) … 1 (nearest possible). */
  depth: number;
};

/**
 * Simple pinhole perspective. A point at depth z is `distance − z` from the
 * camera, so its screen offset is scaled by distance / (distance − z).
 * `radius` is the model's bounding radius, used to normalise depth.
 */
export function project(
  p: Vec3,
  distance: number,
  radius: number,
  cx: number,
  cy: number,
): Projected {
  const scale = distance / (distance - p[2]);
  return {
    x: cx + p[0] * scale,
    y: cy + p[1] * scale,
    scale,
    depth: (p[2] + radius) / (2 * radius),
  };
}
