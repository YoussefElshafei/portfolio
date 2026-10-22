/**
 * The rule-based AI turn from the Catan Simulator, ported for the in-page
 * demo, one step at a time.
 *
 * From the repo (Catan-Code/src-gen/classes):
 *
 *  - `RuleBasedAIPlayer.takeTurn` is a Template Method: roll and distribute,
 *    then up to 10 times: resolve a constraint if one applies (R3.3),
 *    otherwise pick the highest-value move (R3.2), and pass when the best
 *    move is to pass.
 *  - `AIPlayer.resolveConstraint`: more than 7 cards forces a build; a gap
 *    in its own roads or a threatened longest road forces a road.
 *  - `AIPlayer.pickBestValueMove` scores every candidate with
 *    `ValueEvaluator`, a Visitor, and picks at random among the best.
 *  - `ValueEvaluator`'s numbers, verbatim: settlement and city 1.0 if the
 *    hand keeps at least 5 cards after paying, else 0.5; road 0.8, else
 *    0.5; pass 0.
 *  - `Cost`: road = wood + brick; settlement = wood + brick + wheat +
 *    sheep; city = 2 wheat + 3 ore.
 *  - Placement follows standard Catan rules (connected to your roads, no
 *    settlement next to another), the job of the repo's `RuleValidator`.
 *
 * Simplified: one opponent whose pieces just sit on the board, no robber
 * or trading, and "gap to close" is checked on this small board's road
 * graph the same way the repo does (two of your roads within two steps).
 *
 * Pure and seeded, so a turn is reproducible and unit-tested.
 */

export const RESOURCES = ["wood", "brick", "wheat", "sheep", "ore"] as const;
export type Resource = (typeof RESOURCES)[number];
export type Hand = Record<Resource, number>;

export const COST: Record<"road" | "settlement" | "city", Partial<Hand>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 },
  city: { wheat: 2, ore: 3 },
};

export const total = (h: Hand) => RESOURCES.reduce((s, r) => s + h[r], 0);
const affords = (h: Hand, c: Partial<Hand>) =>
  RESOURCES.every((r) => h[r] >= (c[r] ?? 0));
const pay = (h: Hand, c: Partial<Hand>): Hand =>
  Object.fromEntries(RESOURCES.map((r) => [r, h[r] - (c[r] ?? 0)])) as Hand;

/* ------------------------------------------------------------------ *
 * Board: seven hexes, pointy-top, with their shared corners and sides
 * ------------------------------------------------------------------ */

export type Tile = {
  q: number;
  r: number;
  resource: Resource | "desert";
  number: number | null;
};

export const TILES: readonly Tile[] = [
  { q: 0, r: 0, resource: "desert", number: null },
  { q: 1, r: -1, resource: "wood", number: 6 },
  { q: 1, r: 0, resource: "wheat", number: 8 },
  { q: 0, r: 1, resource: "ore", number: 5 },
  { q: -1, r: 1, resource: "brick", number: 9 },
  { q: -1, r: 0, resource: "sheep", number: 4 },
  { q: 0, r: -1, resource: "wheat", number: 10 },
];

export const HEX = 40;
export const tileCentre = (t: { q: number; r: number }) => ({
  x: HEX * Math.sqrt(3) * (t.q + t.r / 2),
  y: HEX * 1.5 * t.r,
});

export type Vertex = { id: number; x: number; y: number; tiles: number[] };
export type Edge = { id: number; a: number; b: number };

function buildBoard() {
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const byKey = new Map<string, number>();
  const edgeKey = new Set<string>();
  TILES.forEach((t, ti) => {
    const c = tileCentre(t);
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      const x = c.x + HEX * Math.cos(a);
      const y = c.y + HEX * Math.sin(a);
      const k = key(x, y);
      let id = byKey.get(k);
      if (id === undefined) {
        id = vertices.length;
        byKey.set(k, id);
        vertices.push({ id, x, y, tiles: [] });
      }
      vertices[id].tiles.push(ti);
      ids.push(id);
    }
    for (let i = 0; i < 6; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % 6];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edgeKey.has(k)) {
        edgeKey.add(k);
        edges.push({ id: edges.length, a: Math.min(a, b), b: Math.max(a, b) });
      }
    }
  });
  return { vertices, edges };
}

export const BOARD = buildBoard();
const adjacent = (v: number) =>
  BOARD.edges
    .filter((e) => e.a === v || e.b === v)
    .map((e) => (e.a === v ? e.b : e.a));

/* ------------------------------------------------------------------ *
 * Game state and actions
 * ------------------------------------------------------------------ */

export type Owner = "ai" | "opp";
export type Building = { vertex: number; owner: Owner; city: boolean };
export type Road = { edge: number; owner: Owner };

export type Action =
  | { kind: "city"; vertex: number }
  | { kind: "settlement"; vertex: number }
  | { kind: "road"; edge: number }
  | { kind: "pass" };

export type Scored = { action: Action; value: number };

/** Where the code currently is, for highlighting the Java on screen. */
export type Pc =
  | "start"
  /** rollAndDistribute ran */
  | "rolled"
  /** resolveConstraint returned an action; it runs next */
  | "constrained"
  /** resolveConstraint returned null */
  | "noConstraint"
  /** pickBestValueMove returned an action; it runs next */
  | "valued"
  /** the action ran; back to the top of the loop */
  | "executed"
  /** PassAction */
  | "passed"
  | "done";

export type Checks = {
  overSeven: boolean;
  gapToClose: boolean;
  longestThreatened: boolean;
};

export type Game = {
  hand: Hand;
  buildings: Building[];
  roads: Road[];
  pc: Pc;
  roll: [number, number] | null;
  produced: Partial<Hand>;
  checks: Checks | null;
  candidates: Scored[];
  chosen: Action | null;
  /** Why the chosen action was chosen: a constraint, or the best value. */
  reason: string;
  safety: number;
  seed: number;
  log: string[];
};

export function newGame(hand: Partial<Hand> = {}, seed = 7): Game {
  return {
    hand: { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0, ...hand },
    // Two settlements and two roads each, like after the setup rounds.
    buildings: [
      { vertex: vertexNear(-1, -1), owner: "ai", city: false },
      { vertex: vertexNear(1, 0.6), owner: "ai", city: false },
      { vertex: vertexNear(-1, 1), owner: "opp", city: false },
      { vertex: vertexNear(1, -1.2), owner: "opp", city: false },
    ],
    roads: [],
    pc: "start",
    roll: null,
    produced: {},
    checks: null,
    candidates: [],
    chosen: null,
    reason: "",
    safety: 0,
    seed,
    log: [],
  };
}

/** The board vertex closest to a direction from the centre, scaled out. */
function vertexNear(dx: number, dy: number) {
  const tx = dx * HEX * 2;
  const ty = dy * HEX * 1.6;
  let best = 0;
  let bestD = Infinity;
  for (const v of BOARD.vertices) {
    const d = (v.x - tx) ** 2 + (v.y - ty) ** 2;
    if (d < bestD) {
      bestD = d;
      best = v.id;
    }
  }
  return best;
}

/** Gives each starting settlement one road, so there is a network. */
export function withStartingRoads(g: Game): Game {
  const roads: Road[] = [];
  for (const b of g.buildings) {
    const e = BOARD.edges.find(
      (e) =>
        (e.a === b.vertex || e.b === b.vertex) &&
        !roads.some((r) => r.edge === e.id),
    );
    if (e) roads.push({ edge: e.id, owner: b.owner });
  }
  return { ...g, roads };
}

function rand(seed: number): [number, number] {
  // mulberry32, one draw at a time, returning the next seed too
  let t = (seed + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

const occupied = (g: Game, v: number) =>
  g.buildings.some((b) => b.vertex === v);
const myNetwork = (g: Game) => {
  const vs = new Set<number>();
  for (const b of g.buildings) if (b.owner === "ai") vs.add(b.vertex);
  for (const r of g.roads)
    if (r.owner === "ai") {
      const e = BOARD.edges[r.edge];
      vs.add(e.a);
      vs.add(e.b);
    }
  return vs;
};

export function candidateCities(g: Game): Action[] {
  if (!affords(g.hand, COST.city)) return [];
  return g.buildings
    .filter((b) => b.owner === "ai" && !b.city)
    .map((b) => ({ kind: "city", vertex: b.vertex }));
}

export function candidateSettlements(g: Game): Action[] {
  if (!affords(g.hand, COST.settlement)) return [];
  const net = myNetwork(g);
  return BOARD.vertices
    .filter(
      (v) =>
        net.has(v.id) &&
        !occupied(g, v.id) &&
        // distance rule: no settlement on a neighbouring corner
        adjacent(v.id).every((n) => !occupied(g, n)),
    )
    .map((v) => ({ kind: "settlement", vertex: v.id }));
}

export function candidateRoads(g: Game): Action[] {
  if (!affords(g.hand, COST.road)) return [];
  const net = myNetwork(g);
  const taken = new Set(g.roads.map((r) => r.edge));
  return BOARD.edges
    .filter((e) => !taken.has(e.id) && (net.has(e.a) || net.has(e.b)))
    .filter((e) => {
      // A road can't run through an opponent's building.
      const from = net.has(e.a) ? e.a : e.b;
      const b = g.buildings.find((x) => x.vertex === from);
      return !b || b.owner === "ai";
    })
    .map((e) => ({ kind: "road", edge: e.id }));
}

/** ValueEvaluator, verbatim. */
export function value(a: Action, hand: Hand): number {
  const n = total(hand);
  switch (a.kind) {
    case "settlement":
      return n - 4 < 5 ? 0.5 : 1.0;
    case "city":
      return n - 5 < 5 ? 0.5 : 1.0;
    case "road":
      return n - 2 < 5 ? 0.5 : 0.8;
    case "pass":
      return 0;
  }
}

function roadsOf(g: Game, owner: Owner) {
  return g.roads
    .filter((r) => r.owner === owner)
    .map((r) => BOARD.edges[r.edge]);
}

/** Two of your roads whose ends are within two steps: a gap worth closing. */
function hasGapToClose(g: Game) {
  const mine = roadsOf(g, "ai");
  if (mine.length < 2) return false;
  for (const r1 of mine)
    for (const r2 of mine) {
      if (r1 === r2) continue;
      for (const a of [r1.a, r1.b])
        for (const b of [r2.a, r2.b]) {
          if (a === b) continue;
          if (adjacent(a).includes(b)) return true;
          if (adjacent(a).some((m) => adjacent(m).includes(b))) return true;
        }
    }
  return false;
}

/** Road counts stand in for longest road, as in the repo. */
function longestThreatened(g: Game) {
  const mine = roadsOf(g, "ai").length;
  if (mine === 0) return false;
  return roadsOf(g, "opp").length >= mine - 1;
}

function pickRandom<T>(g: Game, xs: T[]): [T, number] {
  const [r, seed] = rand(g.seed);
  return [xs[Math.floor(r * xs.length)], seed];
}

function apply(g: Game, a: Action): Game {
  switch (a.kind) {
    case "city":
      return {
        ...g,
        hand: pay(g.hand, COST.city),
        buildings: g.buildings.map((b) =>
          b.vertex === a.vertex ? { ...b, city: true } : b,
        ),
      };
    case "settlement":
      return {
        ...g,
        hand: pay(g.hand, COST.settlement),
        buildings: [
          ...g.buildings,
          { vertex: a.vertex, owner: "ai", city: false },
        ],
      };
    case "road":
      return {
        ...g,
        hand: pay(g.hand, COST.road),
        roads: [...g.roads, { edge: a.edge, owner: "ai" }],
      };
    case "pass":
      return g;
  }
}

export const label = (a: Action) =>
  a.kind === "pass"
    ? "PassAction"
    : a.kind === "city"
      ? "BuildCityAction"
      : a.kind === "settlement"
        ? "BuildSettlementAction"
        : "BuildRoadAction";

const LOG_MAX = 8;
const log = (g: Game, s: string) => [...g.log, s].slice(-LOG_MAX);

/** Advances the AI's turn by one visible step. */
export function step(g: Game): Game {
  switch (g.pc) {
    case "start":
    case "done": {
      // rollAndDistribute
      const [r1, s1] = rand(g.seed);
      const [r2, s2] = rand(s1);
      const d: [number, number] = [
        1 + Math.floor(r1 * 6),
        1 + Math.floor(r2 * 6),
      ];
      const sum = d[0] + d[1];
      const produced: Partial<Hand> = {};
      for (const b of g.buildings) {
        if (b.owner !== "ai") continue;
        for (const ti of BOARD.vertices[b.vertex].tiles) {
          const t = TILES[ti];
          if (t.number === sum && t.resource !== "desert")
            produced[t.resource] =
              (produced[t.resource] ?? 0) + (b.city ? 2 : 1);
        }
      }
      const hand = { ...g.hand };
      for (const r of RESOURCES) hand[r] += produced[r] ?? 0;
      const got = RESOURCES.filter((r) => produced[r])
        .map((r) => `${produced[r]} ${r}`)
        .join(", ");
      return {
        ...g,
        seed: s2,
        hand,
        roll: d,
        produced,
        pc: "rolled",
        checks: null,
        candidates: [],
        chosen: null,
        reason: "",
        safety: 0,
        log: log(g, `rolled ${sum}: ${got || "nothing produced"}`),
      };
    }
    case "rolled":
    case "executed": {
      if (g.safety >= 10)
        return {
          ...g,
          pc: "passed",
          chosen: { kind: "pass" },
          reason: "safety limit of 10 actions",
        };
      // R3.3: constraints come first
      const checks: Checks = {
        overSeven: total(g.hand) > 7,
        gapToClose: hasGapToClose(g),
        longestThreatened: longestThreatened(g),
      };
      let chosen: Action | null = null;
      let reason = "";
      let seed = g.seed;
      if (checks.overSeven) {
        const pool = [
          candidateCities(g),
          candidateSettlements(g),
          candidateRoads(g),
        ].find((p) => p.length);
        if (pool) {
          [chosen, seed] = pickRandom(g, pool);
          reason = "more than 7 cards, so it must spend";
        }
      }
      if (!chosen && (checks.gapToClose || checks.longestThreatened)) {
        const roads = candidateRoads(g);
        if (roads.length) {
          [chosen, seed] = pickRandom(g, roads);
          reason = checks.gapToClose
            ? "a gap between two of its roads to close"
            : "its longest road is threatened";
        }
      }
      return {
        ...g,
        seed,
        checks,
        chosen,
        reason,
        candidates: [],
        pc: chosen ? "constrained" : "noConstraint",
        log: chosen
          ? log(g, `constraint: ${label(chosen)} (${reason})`)
          : g.log,
      };
    }
    case "noConstraint": {
      // R3.2: score every candidate with the ValueEvaluator visitor
      const candidates: Scored[] = [
        ...candidateCities(g),
        ...candidateSettlements(g),
        ...candidateRoads(g),
      ].map((action) => ({ action, value: value(action, g.hand) }));
      if (!candidates.length)
        return {
          ...g,
          candidates,
          chosen: { kind: "pass" },
          reason: "nothing it can afford",
          pc: "passed",
          log: log(g, "no affordable move: PassAction"),
        };
      const max = Math.max(...candidates.map((c) => c.value));
      const best = candidates
        .filter((c) => c.value === max)
        .map((c) => c.action);
      const [chosen, seed] = pickRandom(g, best);
      return {
        ...g,
        seed,
        candidates,
        chosen,
        reason: `highest value, ${max.toFixed(1)}`,
        pc: "valued",
        log: log(g, `best value ${max.toFixed(1)}: ${label(chosen)}`),
      };
    }
    case "constrained":
    case "valued": {
      const a = g.chosen;
      if (!a || a.kind === "pass") return { ...g, pc: "passed" };
      return {
        ...apply(g, a),
        pc: "executed",
        safety: g.safety + 1,
      };
    }
    case "passed":
      return { ...g, pc: "done", log: log(g, "PassAction: turn over") };
  }
}

/** Runs to the end of the current turn. */
export function finishTurn(g: Game): Game {
  let x = g.pc === "done" ? step(g) : g;
  for (let i = 0; i < 60 && x.pc !== "done"; i++) x = step(x);
  return x;
}
