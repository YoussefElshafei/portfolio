"use client";

import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { TerminalWindow } from "@/components/ui/terminal-window";
import {
  HELP,
  MONITOR_SAMPLES,
  SCAN_HEADER,
  argvOf,
  formatMonitor,
  formatTrace,
  monitor,
  parse,
  scanCsvRow,
  scanJson,
  scanRow,
  scanTableRow,
  trace,
  type CommandLine,
  type ScanRow,
} from "@/lib/wirefish";
import { NO_RESTORE } from "@/lib/no-restore";

/**
 * WireFish, as a terminal you can type into.
 *
 * The command line is the real one: lib/wirefish.ts is a port of the tool's
 * argument parser, so every flag, default and error message is what the C
 * program would print. The *results* are simulated (a web page cannot open
 * raw sockets), generated from the target name and using documentation-only
 * addresses. The title bar and the caption both say so.
 *
 * Everything inside is a machine fact, so the whole block is mono (§2.6).
 */

type Line = { id: number; text: string; tone?: "cmd" | "err" | "dim" | "ok" };

const PROMPT = "you@wirefish:~$";
const MAX_LINES = 500;
/** A scan of the full default range prints 1024 rows; past this the demo
 *  stops printing (the tool would carry on). */
const MAX_SCAN_ROWS = 2048;

const EXAMPLES = [
  "wirefish --scan --target scanme.example --ports 1-1024",
  "wirefish --trace --target host.example",
  "wirefish --monitor --iface eth0 --interval 250",
  "wirefish --scan --target db.example --ports 5400-5500 --json",
  "wirefish --scan --subnet 192.168.1.0/24",
] as const;

const SHELL_HELP = [
  "Simulated shell. Commands: wirefish [MODE] [OPTIONS], help, clear",
  "Try `wirefish --help` for the tool's own usage text.",
];

/** Hidden commands for anyone who tries the obvious things. */
const EGGS: Record<
  string,
  { lines: string[]; tone?: Line["tone"]; contact?: boolean }
> = {
  sudo: {
    lines: ["you is not in the sudoers file. This incident will be reported."],
    tone: "err",
  },
  "rm -rf /": {
    lines: ["rm: nice try. This shell is read-only, and so is my portfolio."],
    tone: "err",
  },
  whoami: { lines: ["you (hopefully a recruiter)"] },
  ls: { lines: ["projects/  demos/  resume-on-request.txt  .secrets"] },
  "ls -a": {
    lines: [".  ..  projects/  demos/  resume-on-request.txt  .secrets"],
  },
  "cat .secrets": {
    lines: ["The GOAT is Cristiano Ronaldo. That's the only secret."],
    tone: "ok",
  },
  siuu: { lines: ["SIUUUUUUU"], tone: "ok" },
  "hire youssef": {
    lines: ["Excellent choice. Taking you to the contact section…"],
    tone: "ok",
    contact: true,
  },
  exit: { lines: ["There is no escape. Try `hire youssef` instead."] },
  vim: { lines: ["You'd never get out. Try `help`."], tone: "dim" },
  ping: { lines: ["pong"] },
};

let nextId = 0;
const line = (text: string, tone?: Line["tone"]): Line => ({
  id: nextId++,
  text,
  tone,
});

export function TerminalBlock() {
  const id = useId();
  const reduced = useReducedMotion();
  const [lines, setLines] = useState<Line[]>(() => [
    line("WireFish demo shell · output is simulated", "dim"),
    line("Type a command or tap one below. `help` lists what works.", "dim"),
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [ports, setPorts] = useState<ScanRow[]>([]);
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);
  const screenRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancel = useRef<() => void>(() => {});

  useEffect(() => {
    const s = screenRef.current;
    if (s) s.scrollTop = s.scrollHeight;
  }, [lines]);

  useEffect(() => () => cancel.current(), []);

  const print = useCallback((...ls: Line[]) => {
    setLines((prev) => [...prev, ...ls].slice(-MAX_LINES));
  }, []);

  /** Runs `steps` one after another, `ms` apart (instantly under reduced
   *  motion), and can be stopped with Ctrl+C. */
  const play = useCallback(
    (steps: (() => void)[], ms: number) => {
      setBusy(true);
      let i = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stop = () => {
        if (timer) clearTimeout(timer);
        setBusy(false);
      };
      cancel.current = () => {
        if (timer) clearTimeout(timer);
        setBusy(false);
      };
      const tick = () => {
        if (i >= steps.length) return stop();
        steps[i++]();
        timer = setTimeout(tick, reduced ? 0 : ms);
      };
      tick();
    },
    [reduced],
  );

  function runScan(cmd: CommandLine) {
    const total = cmd.portsTo - cmd.portsFrom + 1;
    const count = Math.min(total, MAX_SCAN_ROWS);
    const rows = Array.from({ length: count }, (_, k) =>
      scanRow(cmd.target, cmd.portsFrom + k),
    );
    setPorts([]);
    if (cmd.json) {
      setPorts(rows);
      print(line(scanJson(rows)));
      return;
    }
    const head = cmd.csv ? ["port,state,latency_ms"] : SCAN_HEADER;
    const fmt = cmd.csv ? scanCsvRow : scanTableRow;
    const CHUNK = 48;
    const steps: (() => void)[] = [() => print(...head.map((h) => line(h)))];
    for (let k = 0; k < rows.length; k += CHUNK) {
      const chunk = rows.slice(k, k + CHUNK);
      steps.push(() => {
        print(
          ...chunk.map((r) =>
            line(fmt(r), r.state === "open" ? "ok" : undefined),
          ),
        );
        setPorts((p) => [...p, ...chunk]);
      });
    }
    if (total > count)
      steps.push(() =>
        print(line(`… demo stops printing after ${MAX_SCAN_ROWS} rows`, "dim")),
      );
    play(steps, 45);
  }

  function runTrace(cmd: CommandLine) {
    const out = formatTrace(trace(cmd), cmd);
    setPorts([]);
    // A table header prints at once; each hop arrives as its probe returns.
    const headLen = cmd.json ? 0 : cmd.csv ? 1 : 2;
    const steps: (() => void)[] = [];
    if (headLen)
      steps.push(() => print(...out.slice(0, headLen).map((t) => line(t))));
    for (const t of out.slice(headLen)) steps.push(() => print(line(t)));
    play(steps, 260);
  }

  function runMonitor(cmd: CommandLine) {
    setPorts([]);
    const samples = monitor(cmd);
    const iface = cmd.iface || "eth0";
    // Like the tool, collect first (10 samples at --interval) and print the
    // table at the end. Capped at 300 ms a sample so the demo never stalls.
    const steps: (() => void)[] = [];
    for (let k = 1; k <= MONITOR_SAMPLES; k++)
      steps.push(() =>
        setLines((prev) => {
          const text = `sampling ${iface} ${"▮".repeat(k)}${"▯".repeat(MONITOR_SAMPLES - k)} ${k}/${MONITOR_SAMPLES}`;
          const last = prev[prev.length - 1];
          return last?.text.startsWith("sampling ")
            ? [...prev.slice(0, -1), { ...last, text }]
            : [...prev, line(text, "dim")];
        }),
      );
    steps.push(() => print(...formatMonitor(samples, cmd).map((t) => line(t))));
    play(steps, Math.min(cmd.intervalMs, 300));
  }

  function run(raw: string) {
    const text = raw.trim();
    print(line(`${PROMPT} ${text}`, "cmd"));
    setDraft("");
    if (!text) return;
    history.current = [...history.current, text].slice(-50);
    cursor.current = -1;
    const argv = argvOf(text);
    const [prog, ...args] = argv;
    if (prog === "clear") {
      setLines([]);
      setPorts([]);
      return;
    }
    if (prog === "help") return print(...SHELL_HELP.map((t) => line(t, "dim")));
    // Easter eggs. Not listed in `help`, on purpose.
    const key = [text.toLowerCase(), prog].find((k) => Object.hasOwn(EGGS, k));
    const egg = key ? EGGS[key] : undefined;
    if (egg) {
      print(...egg.lines.map((t) => line(t, egg.tone)));
      if (egg.contact)
        document
          .getElementById("contact")
          ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (prog !== "wirefish" && prog !== "./wirefish")
      return print(line(`${prog}: command not found (try \`help\`)`, "err"));
    const parsed = parse(args);
    if (parsed.kind === "help")
      return print(...HELP.split("\n").map((t) => line(t)));
    if (parsed.kind === "error") return print(line(parsed.message, "err"));
    const { cmd } = parsed;
    if (cmd.mode === "scan") runScan(cmd);
    else if (cmd.mode === "trace") runTrace(cmd);
    else runMonitor(cmd);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!busy) run(draft);
    } else if (e.key === "c" && e.ctrlKey && busy) {
      e.preventDefault();
      cancel.current();
      print(line("^C", "dim"));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const h = history.current;
      if (!h.length) return;
      e.preventDefault();
      let c = cursor.current;
      c =
        e.key === "ArrowUp"
          ? c < 0
            ? h.length - 1
            : Math.max(0, c - 1)
          : c + 1;
      if (c >= h.length) {
        cursor.current = -1;
        setDraft("");
      } else {
        cursor.current = c;
        setDraft(h[c]);
      }
    }
  }

  const open = ports.filter((p) => p.state === "open").length;

  return (
    <figure className="mt-8 w-full">
      <TerminalWindow
        title="wirefish"
        meta="simulated output"
        bodyClassName=""
        className="glow"
      >
        <div
          ref={screenRef}
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
          onClick={() => inputRef.current?.focus()}
          className="h-[22rem] overflow-y-auto px-4 pt-4 text-micro leading-relaxed"
        >
          {lines.map((l) => (
            <pre
              key={l.id}
              className={`break-all whitespace-pre-wrap ${
                l.tone === "cmd"
                  ? "text-silk"
                  : l.tone === "err"
                    ? "text-copper"
                    : l.tone === "ok"
                      ? "text-signal"
                      : l.tone === "dim"
                        ? "text-silk-faint"
                        : "text-silk-dim"
              }`}
            >
              {l.text || " "}
            </pre>
          ))}
          <div className="flex items-baseline gap-2 pb-4">
            <label htmlFor={`${id}-cmd`} className="shrink-0 text-copper">
              {PROMPT}
              <span className="sr-only"> command</span>
            </label>
            <input
              ref={inputRef}
              id={`${id}-cmd`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={200}
              placeholder={busy ? "running… (Ctrl+C)" : "wirefish --help"}
              className="min-h-8 min-w-0 flex-1 bg-transparent text-silk caret-copper placeholder:text-silk-faint pointer-coarse:min-h-11"
            />
          </div>
        </div>

        {ports.length > 0 && (
          <div className="border-t border-hairline px-4 py-3">
            <p className="mb-2 text-micro text-silk-faint">
              ports {ports[0].port}–{ports[ports.length - 1].port} ·{" "}
              <span className="text-signal">{open} open</span> ·{" "}
              {ports.filter((p) => p.state === "filtered").length} filtered
            </p>
            {/* One cell per port scanned, as a picture of the table above.
                Decorative: the table is the content. */}
            <div aria-hidden="true" className="flex flex-wrap gap-px">
              {ports.slice(0, 1024).map((p) => (
                <span
                  key={p.port}
                  title={`${p.port} ${p.state}`}
                  className={`size-1.5 ${
                    p.state === "open"
                      ? "bg-signal"
                      : p.state === "filtered"
                        ? "bg-copper"
                        : "bg-hairline"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-hairline px-4 py-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              {...NO_RESTORE}
              disabled={busy}
              onClick={() => run(ex)}
              className="inline-flex min-h-8 max-w-full cursor-pointer items-center truncate rounded-trace border border-hairline px-2 text-left text-micro text-silk-dim hover:border-copper hover:text-copper disabled:cursor-wait disabled:opacity-50 pointer-coarse:min-h-11"
            >
              {ex.replace("wirefish ", "")}
            </button>
          ))}
          {busy && (
            <button
              type="button"
              onClick={() => {
                cancel.current();
                print(line("^C", "dim"));
              }}
              className="inline-flex min-h-8 cursor-pointer items-center rounded-trace border border-copper px-2 text-micro text-copper pointer-coarse:min-h-11"
            >
              Ctrl+C
            </button>
          )}
        </div>
      </TerminalWindow>
      <figcaption className="mt-3 text-micro text-silk-faint">
        Type real WireFish commands. The parser is a line-for-line port of the
        tool&apos;s C argument handling, so flags, defaults and error messages
        are exactly what the program prints (try the last example: WireFish has
        no <code className="font-mono">--subnet</code> flag). The table, CSV and
        JSON layouts match its formatter. The results themselves are simulated,
        since a web page cannot send raw network traffic, and every address is a
        reserved example address.
      </figcaption>
    </figure>
  );
}
