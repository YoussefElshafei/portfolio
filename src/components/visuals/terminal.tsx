"use client";

import { useInView, useReducedMotion } from "motion/react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * WireFish, as an illustrative terminal session.
 *
 * The three invocations are verbatim from the project's README. The OUTPUT is
 * sample data written for this demo. An earlier version of this component
 * refused to show any output at all, on the grounds that invented results are
 * fabricated evidence. That changed at the owner's request, so the honesty
 * now has to live in the labelling instead:
 *
 *  - Every output line follows only the fields the README documents: per-host
 *    RTT and success counts for --scan; hop, IP, hostname and RTT for
 *    --trace; instantaneous and averaged RX/TX bitrate for --monitor. No
 *    feature is implied that the tool does not have.
 *  - Every address is private (RFC 1918) or from the ranges reserved for
 *    documentation (RFC 5737), and the trace target uses the reserved
 *    `.example` TLD (RFC 2606), so no line points at a real machine.
 *  - The header says "sample output" and the caption says nothing is running.
 *
 * Real text, not an image or a video: selectable, searchable, and a screen
 * reader gets the full transcript at once rather than a typing animation.
 * Everything inside is a machine fact, so the whole block is mono (§2.6).
 */

type Line =
  | { kind: "cmd"; text: string }
  | { kind: "out"; text: string }
  | { kind: "gap" };

const SESSION: readonly Line[] = [
  { kind: "cmd", text: "wirefish --scan --subnet 192.168.1.0/24" },
  { kind: "out", text: "192.168.1.1     up   rtt  1.84 ms   3/3" },
  { kind: "out", text: "192.168.1.23    up   rtt  4.12 ms   3/3" },
  { kind: "out", text: "192.168.1.57    up   rtt 11.06 ms   2/3" },
  { kind: "out", text: "3 hosts up, 254 scanned" },
  { kind: "gap" },
  { kind: "cmd", text: "wirefish --trace host.example" },
  { kind: "out", text: " 1  192.168.1.1    gateway        1.92 ms" },
  { kind: "out", text: " 2  10.24.0.1      unresolved     8.47 ms" },
  { kind: "out", text: " 3  198.51.100.14  unresolved    14.30 ms" },
  { kind: "out", text: " 4  203.0.113.10   host.example  21.65 ms" },
  { kind: "gap" },
  { kind: "cmd", text: "wirefish --monitor --iface eth0 --interval 100" },
  { kind: "out", text: "eth0  rx 1.84 Mbps  tx 212.4 kbps" },
  { kind: "out", text: "eth0  rx 2.10 Mbps  tx 198.7 kbps" },
  { kind: "out", text: "eth0  rx 1.97 Mbps  tx 205.6 kbps" },
  { kind: "out", text: "^C" },
  { kind: "out", text: "avg   rx 1.97 Mbps  tx 205.6 kbps  (3 samples)" },
];

/**
 * The animation as a list of frames, computed once. A frame is a cursor into
 * the session: lines before `line` are fully shown, and line `line` is shown
 * up to `chars` characters. Precomputing it keeps the runtime to a single
 * chain of timeouts and makes the timing identical on every visit.
 */
type Frame = { line: number; chars: number; wait: number };

/**
 * The looping version of the session: the real transcript, then the prompt
 * types `clear` and the screen empties, the way a person resets a real
 * terminal. The erase is motivated rather than a wipe effect, and it is
 * instant because that is what `clear` does.
 */
const LOOP: readonly Line[] = [...SESSION, { kind: "cmd", text: "clear" }];

/** How long the finished session stays on screen before `clear` is typed. */
const HOLD_MS = 2500;

const START: Frame = { line: 0, chars: 0, wait: 0 };
const DONE: Frame = { line: SESSION.length, chars: 0, wait: 0 };

const FRAMES: readonly Frame[] = (() => {
  const frames: Frame[] = [];
  LOOP.forEach((l, i) => {
    if (l.kind === "cmd") {
      const isClear = i === LOOP.length - 1;
      // Typing speed varies a little, deterministically, so it reads as a
      // person rather than a metronome: 28–60ms a keystroke. The very first
      // keystroke waits longer, a beat on an empty prompt before each run,
      // and the first key of `clear` carries the hold on the full session.
      for (let c = 1; c <= l.text.length; c++) {
        const wait =
          c === 1 && i === 0
            ? 600
            : c === 1 && isClear
              ? HOLD_MS
              : 28 + ((c * 37) % 5) * 8;
        frames.push({ line: i, chars: c, wait });
      }
      // Enter. After a command, the tool starts up; after `clear`, the
      // screen empties and the loop begins again.
      frames.push(
        isClear
          ? { ...START, wait: 260 }
          : { line: i + 1, chars: 0, wait: 380 },
      );
    } else {
      frames.push({ line: i + 1, chars: 0, wait: l.kind === "gap" ? 520 : 90 });
    }
  });
  return frames;
})();

const noopSubscribe = () => () => {};

/** Commands wrap only at spaces, never inside `--interval` (see git history). */
function Command({ text }: { text: string }) {
  const tokens = text.split(" ");
  return (
    <>
      {tokens.map((token, i) => (
        <Fragment key={`${token}-${i}`}>
          {i > 0 && " "}
          <span className="whitespace-nowrap">{token}</span>
        </Fragment>
      ))}
    </>
  );
}

function Transcript({
  session,
  frame,
  typing,
}: {
  session: readonly Line[];
  frame: Frame;
  typing: boolean;
}) {
  return (
    <>
      {session.map((l, i) => {
        if (i > frame.line) return null;
        const partial = i === frame.line;
        if (partial && (l.kind !== "cmd" || frame.chars === 0)) return null;

        if (l.kind === "gap") {
          return <span key={i} className="block h-3" />;
        }
        if (l.kind === "out") {
          return (
            <span key={i} className="block whitespace-pre-wrap text-silk-dim">
              {l.text}
            </span>
          );
        }
        const shown = partial ? l.text.slice(0, frame.chars) : l.text;
        return (
          <span key={i} className="block whitespace-pre-wrap">
            <span className="text-copper">$ </span>
            <span className="text-silk">
              <Command text={shown} />
            </span>
            {partial && typing && <Cursor />}
          </span>
        );
      })}
      {/* After the last command finishes, an idle prompt. The cursor is
          steady rather than blinking: the loop itself is the motion here,
          and a blink on top of it would be noise. */}
      {frame.line >= session.length && (
        <span className="block">
          <span className="text-copper">$ </span>
          <Cursor />
        </span>
      )}
      {/* Between lines, the cursor waits on an empty prompt line. */}
      {typing &&
        frame.line < session.length &&
        frame.chars === 0 &&
        session[frame.line].kind === "cmd" && (
          <span className="block">
            <span className="text-copper">$ </span>
            <Cursor />
          </span>
        )}
    </>
  );
}

function Cursor() {
  return (
    <span className="ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[0.15em] bg-silk-dim" />
  );
}

export function TerminalBlock() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // Loops for as long as the block is on screen (DESIGN_BRIEF.md §2.7), and
  // pauses in place while it is not: no timers running for a terminal nobody
  // can see. Scrolling back resumes mid-session rather than restarting.
  const inView = useInView(ref, { amount: 0.4 });
  const position = useRef(0);

  // The server render, and the render that hydrates it, show the finished
  // transcript: full content without JavaScript, and nothing to mismatch.
  // useSyncExternalStore reports false for both of those and true on every
  // client render after, which is the sanctioned way to branch on "running
  // in the browser now" without setting state in an effect. The animation
  // only takes over from there, and only if motion is allowed.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const animate = hydrated && reduced === false;
  const [frame, setFrame] = useState<Frame>(START);
  const shown = animate ? frame : DONE;

  useEffect(() => {
    if (!animate || !inView) return;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const f = FRAMES[position.current];
      timer = setTimeout(() => {
        setFrame(f);
        // The last frame is the post-`clear` blank screen; wrap to the top.
        position.current = (position.current + 1) % FRAMES.length;
        step();
      }, f.wait);
    };
    step();
    return () => clearTimeout(timer);
  }, [animate, inView]);

  const typing = animate && shown.line < LOOP.length;

  return (
    <figure className="mt-8 w-full max-w-column">
      <div className="overflow-hidden rounded-trace border border-hairline bg-surface">
        <div className="flex items-baseline justify-between border-b border-hairline px-4 py-2.5">
          <span className="font-mono text-micro text-silk-dim">wirefish</span>
          <span className="font-mono text-micro text-silk-faint">
            sample output
          </span>
        </div>

        {/*
          Two layers in one grid cell. The invisible one is the finished
          transcript and fixes the height from the start, so the block never
          grows as lines appear and the page below never shifts. The visible
          one is the animation. A screen reader gets the sr-only transcript,
          whole, instead of either.
        */}
        <div ref={ref} className="px-4 py-4">
          <pre className="font-mono text-micro leading-relaxed">
            <code className="grid">
              <span className="sr-only">
                {SESSION.map((l) =>
                  l.kind === "gap"
                    ? "\n"
                    : `${l.kind === "cmd" ? "$ " : ""}${l.text}\n`,
                ).join("")}
              </span>
              <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1"
              >
                <Transcript session={SESSION} frame={DONE} typing={false} />
              </span>
              <span aria-hidden="true" className="col-start-1 row-start-1">
                <Transcript
                  session={animate ? LOOP : SESSION}
                  frame={shown}
                  typing={typing}
                />
              </span>
            </code>
          </pre>
        </div>
      </div>
      <figcaption className="mt-3 text-micro text-silk-faint">
        An illustrative session. The commands are the tool&apos;s real,
        documented interface; the output is sample data written for this page,
        in the format the README describes, using reserved example addresses.
        Nothing here is connected to a running scanner.
      </figcaption>
    </figure>
  );
}
