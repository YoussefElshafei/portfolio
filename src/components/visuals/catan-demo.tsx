"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { DemoFrame } from "@/components/ui/demo-frame";
import {
  BOARD,
  HEX,
  RESOURCES,
  TILES,
  finishTurn,
  label,
  newGame,
  step,
  tileCentre,
  total,
  withStartingRoads,
  type Action,
  type Game,
  type Hand,
  type Pc,
  type Resource,
} from "@/lib/catan";
import { NO_RESTORE } from "@/lib/no-restore";

/**
 * The Catan Simulator's rule-based AI, one step at a time. The visitor sets
 * up the AI's hand, then steps through `takeTurn` and watches which line of
 * the real Template Method runs, which constraint fires, and how the
 * Visitor scores every candidate move. Rules in lib/catan.ts.
 */

/** Map furniture: muted, distinct, outside the site palette on purpose. */
const TILE_FILL: Record<Resource | "desert", string> = {
  wood: "#2f4a35",
  brick: "#5a3326",
  wheat: "#5e5326",
  sheep: "#3e5a33",
  ore: "#3d4250",
  desert: "#4a4436",
};

const CODE: readonly { text: string; at: Pc[] }[] = [
  { text: "public final void takeTurn(GameMaster game) {", at: ["start"] },
  { text: "  game.rollAndDistribute(this);", at: ["rolled"] },
  { text: "  while (safety++ < 10) {", at: [] },
  {
    text: "    PlayerAction constraint = resolveConstraint(game); // R3.3",
    at: ["constrained", "noConstraint"],
  },
  {
    text: "    if (constraint != null) { constraint.execute(game); continue; }",
    at: [],
  },
  {
    text: "    PlayerAction best = pickBestValueMove(game);        // R3.2",
    at: ["valued"],
  },
  { text: "    if (best == null || best instanceof PassAction) {", at: [] },
  {
    text: "      new PassAction(this).execute(game); return;",
    at: ["passed", "done"],
  },
  { text: "    }", at: [] },
  { text: "    best.execute(game);", at: [] },
  { text: "  }", at: [] },
  { text: "}", at: [] },
];

const PRESETS: readonly { name: string; hand: Partial<Hand> }[] = [
  {
    name: "Big hand (> 7)",
    hand: { wood: 3, brick: 3, wheat: 3, sheep: 2, ore: 3 },
  },
  {
    name: "City or settlement?",
    hand: { wood: 1, brick: 1, wheat: 3, sheep: 1, ore: 3 },
  },
  { name: "Just enough for a road", hand: { wood: 1, brick: 1, wheat: 1 } },
];

const STEP_MS = 650;

function bounds() {
  const xs = BOARD.vertices.map((v) => v.x);
  const ys = BOARD.vertices.map((v) => v.y);
  const pad = 16;
  return {
    x: Math.min(...xs) - pad,
    y: Math.min(...ys) - pad,
    w: Math.max(...xs) - Math.min(...xs) + pad * 2,
    h: Math.max(...ys) - Math.min(...ys) + pad * 2,
  };
}
const VIEW = bounds();

const hex = (cx: number, cy: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + (HEX - 1.5) * Math.cos(a)).toFixed(1)},${(cy + (HEX - 1.5) * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

const fresh = (hand: Partial<Hand>) => withStartingRoads(newGame(hand));

export function CatanDemo() {
  const reduced = useReducedMotion();
  const [game, setGame] = useState<Game>(() => fresh(PRESETS[0].hand));
  const [executedBy, setExecutedBy] = useState<"constraint" | "value" | null>(
    null,
  );
  const [auto, setAuto] = useState(false);

  const advance = () => {
    if (game.pc === "constrained") setExecutedBy("constraint");
    else if (game.pc === "valued") setExecutedBy("value");
    const next = step(game);
    setGame(next);
    if (next.pc === "done") setAuto(false);
  };

  // Auto-play: one step every STEP_MS; advance() switches it off at the end.
  useEffect(() => {
    if (!auto || game.pc === "done") return;
    const t = setTimeout(advance, reduced ? 0 : STEP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, game, reduced]);

  const reset = (hand: Partial<Hand>) => {
    setAuto(false);
    setExecutedBy(null);
    setGame(fresh(hand));
  };

  const bump = (r: Resource, d: number) =>
    setGame((g) => ({
      ...g,
      hand: { ...g.hand, [r]: Math.max(0, Math.min(9, g.hand[r] + d)) },
    }));

  const oppRoads = game.roads.filter((r) => r.owner === "opp").length;
  const addOppRoad = () =>
    setGame((g) => {
      const taken = new Set(g.roads.map((r) => r.edge));
      const e = BOARD.edges.find(
        (e) =>
          !taken.has(e.id) &&
          g.roads.some(
            (r) =>
              r.owner === "opp" &&
              [BOARD.edges[r.edge].a, BOARD.edges[r.edge].b].some(
                (v) => v === e.a || v === e.b,
              ),
          ),
      );
      return e
        ? { ...g, roads: [...g.roads, { edge: e.id, owner: "opp" }] }
        : g;
    });

  const highlight = (at: Pc[], i: number) =>
    at.includes(game.pc) ||
    (game.pc === "executed" &&
      ((executedBy === "constraint" && i === 4) ||
        (executedBy === "value" && i === 9)));

  const chosen = game.chosen;
  const isChosen = (a: Action) =>
    !!chosen && JSON.stringify(chosen) === JSON.stringify(a);

  // Group roads: there can be several, all with the same score.
  const rows = (() => {
    const m = new Map<
      string,
      { name: string; value: number; n: number; chosen: boolean }
    >();
    for (const c of game.candidates) {
      const k = `${c.action.kind}`;
      const cur = m.get(k) ?? {
        name: label(c.action),
        value: c.value,
        n: 0,
        chosen: false,
      };
      cur.n++;
      cur.chosen ||= isChosen(c.action);
      m.set(k, cur);
    }
    return [...m.values()];
  })();

  const running = game.pc !== "start" && game.pc !== "done";

  return (
    <DemoFrame
      label="Catan Simulator · the AI's turn, step by step"
      meta="Template Method + Visitor"
      caption={
        <>
          The rule-based AI from the Catan Simulator, ported from its Java
          source. Each step runs one line of{" "}
          <code className="font-mono">takeTurn</code> (a Template Method: the
          order is fixed, the decisions are hooks). Constraints are checked
          first: a hand over 7 cards must be spent, and a gap between its own
          roads or a threatened longest road forces a road. Otherwise every
          legal move is scored by{" "}
          <code className="font-mono">ValueEvaluator</code>, a Visitor, and the
          AI picks the best, at random among ties. Change its hand or give the
          opponent more roads and watch the decision change. One opponent, no
          robber and no trading in this version.
        </>
      }
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,22rem)_1fr] lg:divide-x lg:divide-hairline">
        {/* Board and hand */}
        <div className="flex flex-col">
          <svg
            viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
            className="mx-auto block w-full max-w-[22rem] px-4 pt-4"
            role="img"
            aria-label={`Board: the AI has ${game.buildings.filter((b) => b.owner === "ai").length} buildings and ${game.roads.filter((r) => r.owner === "ai").length} roads`}
          >
            {TILES.map((t, i) => {
              const c = tileCentre(t);
              const hot = game.roll && t.number === game.roll[0] + game.roll[1];
              return (
                <g key={i}>
                  <polygon
                    points={hex(c.x, c.y)}
                    fill={TILE_FILL[t.resource]}
                    stroke={hot ? "var(--copper)" : "var(--substrate)"}
                    strokeWidth={hot ? 2 : 1}
                  />
                  <text
                    x={c.x}
                    y={c.y - 6}
                    textAnchor="middle"
                    className="fill-silk-faint font-mono"
                    fontSize="8"
                  >
                    {t.resource}
                  </text>
                  {t.number && (
                    <text
                      x={c.x}
                      y={c.y + 10}
                      textAnchor="middle"
                      className={`font-mono ${hot ? "fill-copper" : "fill-silk"}`}
                      fontSize="13"
                    >
                      {t.number}
                    </text>
                  )}
                </g>
              );
            })}
            {game.roads.map((r) => {
              const e = BOARD.edges[r.edge];
              const a = BOARD.vertices[e.a];
              const b = BOARD.vertices[e.b];
              return (
                <motion.line
                  key={`${r.owner}-${r.edge}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4 }}
                  stroke={
                    r.owner === "ai" ? "var(--copper)" : "var(--silk-faint)"
                  }
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              );
            })}
            {game.buildings.map((b) => {
              const v = BOARD.vertices[b.vertex];
              const fill =
                b.owner === "ai" ? "var(--copper)" : "var(--silk-dim)";
              return (
                <motion.g
                  key={`${b.owner}-${b.vertex}-${b.city}`}
                  initial={reduced ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{ originX: `${v.x}px`, originY: `${v.y}px` }}
                >
                  {b.city ? (
                    <rect
                      x={v.x - 7}
                      y={v.y - 7}
                      width={14}
                      height={14}
                      fill={fill}
                      stroke="var(--substrate)"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <circle
                      cx={v.x}
                      cy={v.y}
                      r={6}
                      fill={fill}
                      stroke="var(--substrate)"
                      strokeWidth={1.5}
                    />
                  )}
                </motion.g>
              );
            })}
          </svg>
          <p className="px-4 pb-1 text-center font-mono text-micro text-silk-faint">
            <span className="text-copper">■ ● AI</span> · ■ ● opponent ·{" "}
            {game.roll
              ? `rolled ${game.roll[0]}+${game.roll[1]}=${game.roll[0] + game.roll[1]}`
              : "not rolled yet"}
          </p>

          <div className="border-t border-hairline px-4 py-3">
            <p className="mb-2 flex justify-between font-mono text-micro text-silk-faint">
              <span>AI hand</span>
              <span className={total(game.hand) > 7 ? "text-copper" : ""}>
                {total(game.hand)} cards{total(game.hand) > 7 ? " (> 7)" : ""}
              </span>
            </p>
            <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {RESOURCES.map((r) => (
                <li
                  key={r}
                  className="flex flex-col items-center rounded-trace border border-hairline py-1"
                >
                  <span className="font-mono text-micro text-silk-faint">
                    {r}
                  </span>
                  <span className="font-mono text-silk">
                    {game.hand[r]}
                    {game.produced[r] && game.pc === "rolled" ? (
                      <span className="text-signal"> +{game.produced[r]}</span>
                    ) : null}
                  </span>
                  <span className="flex">
                    <button
                      type="button"
                      aria-label={`Remove one ${r}`}
                      {...NO_RESTORE}
                      disabled={running}
                      onClick={() => bump(r, -1)}
                      className="inline-flex size-7 cursor-pointer items-center justify-center text-silk-faint hover:text-copper disabled:cursor-not-allowed disabled:opacity-30 pointer-coarse:size-11"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      aria-label={`Add one ${r}`}
                      {...NO_RESTORE}
                      disabled={running}
                      onClick={() => bump(r, 1)}
                      className="inline-flex size-7 cursor-pointer items-center justify-center text-silk-faint hover:text-copper disabled:cursor-not-allowed disabled:opacity-30 pointer-coarse:size-11"
                    >
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => reset(p.hand)}
                  className="inline-flex min-h-8 cursor-pointer items-center rounded-trace border border-hairline px-2 text-micro text-silk-dim hover:border-copper hover:text-copper pointer-coarse:min-h-11"
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={addOppRoad}
                {...NO_RESTORE}
                disabled={running}
                className="inline-flex min-h-8 cursor-pointer items-center rounded-trace border border-hairline px-2 text-micro text-silk-dim hover:border-copper hover:text-copper disabled:opacity-40 pointer-coarse:min-h-11"
              >
                Opponent builds a road ({oppRoads})
              </button>
            </div>
          </div>
        </div>

        {/* The code, the checks, the scores */}
        <div className="flex min-w-0 flex-col">
          <pre
            tabIndex={0}
            aria-label="RuleBasedAIPlayer.takeTurn, current line highlighted"
            className="overflow-x-auto border-t border-hairline px-0 py-3 font-mono text-micro leading-relaxed lg:border-t-0"
          >
            {CODE.map((l, i) => {
              const on = highlight(l.at, i);
              return (
                <div
                  key={i}
                  aria-current={on ? "step" : undefined}
                  className={`border-l-2 px-4 whitespace-pre transition-colors ${
                    on
                      ? "border-copper bg-copper-wash text-silk"
                      : "border-transparent text-silk-faint"
                  }`}
                >
                  {l.text}
                </div>
              );
            })}
          </pre>

          <div className="grid gap-3 border-t border-hairline px-4 py-3 text-micro sm:grid-cols-2">
            <div>
              <p className="mb-1.5 font-mono text-silk-faint">
                resolveConstraint()
              </p>
              <ul className="space-y-1 font-mono">
                {(
                  [
                    ["hand > 7 cards", game.checks?.overSeven],
                    ["gap to close", game.checks?.gapToClose],
                    ["longest road threatened", game.checks?.longestThreatened],
                  ] as const
                ).map(([name, v]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="text-silk-dim">{name}</span>
                    <span className={v ? "text-copper" : "text-silk-faint"}>
                      {v === undefined ? "·" : v ? "true" : "false"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 font-mono text-silk-faint">
                ValueEvaluator.visit()
              </p>
              {rows.length ? (
                <ul className="space-y-1 font-mono">
                  {rows.map((r) => (
                    <li
                      key={r.name}
                      className={`flex justify-between gap-2 ${r.chosen ? "text-copper" : "text-silk-dim"}`}
                    >
                      <span>
                        {r.name}
                        {r.n > 1 ? ` ×${r.n}` : ""}
                      </span>
                      <span>{r.value.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-silk-faint">
                  {game.pc === "constrained" ||
                  (game.pc === "executed" && executedBy === "constraint")
                    ? "skipped: a constraint already chose"
                    : "not scored yet"}
                </p>
              )}
            </div>
          </div>

          <ol
            aria-live="polite"
            className="min-h-24 space-y-0.5 border-t border-hairline px-4 py-3 font-mono text-micro text-silk-dim"
          >
            {game.log.length === 0 && (
              <li className="text-silk-faint">
                Press Step to start the AI&apos;s turn.
              </li>
            )}
            {game.log.map((l, i) => (
              <li
                key={i}
                className={i === game.log.length - 1 ? "text-silk" : ""}
              >
                {l}
              </li>
            ))}
          </ol>

          <div className="mt-auto flex flex-wrap gap-2 border-t border-hairline px-4 py-3">
            <button
              type="button"
              onClick={advance}
              {...NO_RESTORE}
              disabled={auto}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-trace border border-copper bg-copper px-4 text-micro font-semibold text-substrate hover:opacity-90 disabled:opacity-50"
            >
              {game.pc === "done" ? "Next turn" : "Step"}
            </button>
            <button
              type="button"
              onClick={() =>
                reduced ? setGame((g) => finishTurn(g)) : setAuto((a) => !a)
              }
              className="inline-flex min-h-11 cursor-pointer items-center rounded-trace border border-edge px-4 text-micro text-silk-dim hover:border-copper hover:text-copper"
            >
              {auto ? "Pause" : "Play the whole turn"}
            </button>
            <span className="ml-auto self-center font-mono text-micro text-silk-faint">
              {game.reason && `why: ${game.reason}`}
            </span>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}
