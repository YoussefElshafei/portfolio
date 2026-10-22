/**
 * WireFish's command line, ported from the WireFish repo for the in-page
 * terminal.
 *
 *  - `parse` is `cli_parse` (cli/cli.c): same flags, same defaults, same
 *    checks in the same order, and the same error messages word for word.
 *  - `HELP` is `cli_print_help`, verbatim.
 *  - `formatScan`, `formatTrace` and `formatMonitor` reproduce fmt/fmt.c's
 *    table, CSV and JSON layouts, column widths included.
 *  - Monitor mode collects 10 samples (`DEFAULT_MONITOR_SAMPLES` in
 *    app/app.c) and keeps a rolling average over the last 10 rates
 *    (`WINDOW_SIZE` in monitor/monitor.c).
 *
 * What is NOT real: the results. A web page cannot open TCP connections or
 * send ICMP, so ports, hops and byte counts are generated from the target's
 * name. Every address is from the ranges reserved for documentation
 * (RFC 5737) or private use, and the page says the output is simulated.
 */

export const DEFAULT_PORTS_FROM = 1;
export const DEFAULT_PORTS_TO = 1024;
export const DEFAULT_TTL_START = 1;
export const DEFAULT_TTL_MAX = 30;
export const DEFAULT_INTERVAL_MS = 100;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_TTL = 1;
const MAX_TTL = 255;
export const MONITOR_SAMPLES = 10;
const WINDOW_SIZE = 10;

export type Mode = "scan" | "trace" | "monitor";

export type CommandLine = {
  mode: Mode;
  json: boolean;
  csv: boolean;
  target: string;
  iface: string;
  portsFrom: number;
  portsTo: number;
  ttlStart: number;
  ttlMax: number;
  intervalMs: number;
};

export type Parsed =
  | { kind: "ok"; cmd: CommandLine }
  | { kind: "help" }
  | { kind: "error"; message: string };

export const HELP = `Usage: wirefish [MODE] [OPTIONS]

WireFish - Network reconnaissance and monitoring tool

Modes (choose one):
  --scan              TCP port scanning
  --trace             ICMP traceroute
  --monitor           Network interface monitoring

Scan Options:
  --target <host>     Target hostname or IP (required)
  --ports <from-to>   Port range (default: ${DEFAULT_PORTS_FROM}-${DEFAULT_PORTS_TO})

Trace Options:
  --target <host>     Target hostname or IP (required)
  --ttl <start-max>   TTL range (default: ${DEFAULT_TTL_START}-${DEFAULT_TTL_MAX})

Monitor Options:
  --iface <name>      Network interface (default: auto-detect)
  --interval <ms>     Sample interval in milliseconds (default: ${DEFAULT_INTERVAL_MS})

Output Options:
  --json              Output in JSON format
  --csv               Output in CSV format

Other:
  --help              Show this help message

Examples:
  wirefish --scan --target google.com --ports 80-443
  wirefish --trace --target 8.8.8.8 --json
  wirefish --monitor --iface eth0 --interval 500`;

class CliError extends Error {}
const fail = (message: string): never => {
  throw new CliError(message);
};

/** C's `strtol(str, &end, 10)`: leading whitespace and sign, then digits. */
function strtol(s: string): { value: number; rest: string; consumed: boolean } {
  const m = s.match(/^\s*([+-]?\d+)/);
  if (!m) return { value: 0, rest: s, consumed: false };
  return { value: Number(m[1]), rest: s.slice(m[0].length), consumed: true };
}

function parseRange(str: string): [number, number] {
  const dash = str.indexOf("-");
  if (dash < 0) fail("Error: Range must be in format 'from-to' (ex, 80-443)");
  const from = strtol(str);
  if (!from.consumed)
    fail(`Error: Invalid number before '-' in range '${str}'`);
  if (str.length - from.rest.length !== dash)
    fail(`Error: Invalid characters in range '${str}'`);
  const afterDash = str.slice(dash + 1);
  const to = strtol(afterDash);
  if (!to.consumed) fail(`Error: Invalid number after '-' in range '${str}'`);
  if (to.rest !== "")
    fail(`Error: Invalid characters at end of range '${str}'`);
  if (from.value > to.value)
    fail(
      `Error: Range start (${from.value}) cannot be greater than end (${to.value})`,
    );
  return [from.value, to.value];
}

/** `argv` without the program name. */
export function parse(argv: readonly string[]): Parsed {
  if (argv.includes("--help")) return { kind: "help" };
  let mode: Mode | null = null;
  const out = {
    json: false,
    csv: false,
    target: "",
    iface: "",
    portsFrom: DEFAULT_PORTS_FROM,
    portsTo: DEFAULT_PORTS_TO,
    ttlStart: DEFAULT_TTL_START,
    ttlMax: DEFAULT_TTL_MAX,
    intervalMs: DEFAULT_INTERVAL_MS,
  };
  const oneMode = (m: Mode) => {
    if (mode !== null)
      fail("Error: Only one mode (--scan, --trace, --monitor) allowed");
    mode = m;
  };
  try {
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      const next = (msg: string) => {
        if (i + 1 >= argv.length) fail(msg);
        return argv[++i];
      };
      if (a === "--scan") oneMode("scan");
      else if (a === "--trace") oneMode("trace");
      else if (a === "--monitor") oneMode("monitor");
      else if (a === "--json") out.json = true;
      else if (a === "--csv") out.csv = true;
      else if (a === "--target")
        out.target = next("Error: --target requires a hostname or IP").slice(
          0,
          255,
        );
      else if (a === "--ports")
        [out.portsFrom, out.portsTo] = parseRange(
          next("Error: --ports requires a range (ex, 80-443)"),
        );
      else if (a === "--ttl")
        [out.ttlStart, out.ttlMax] = parseRange(
          next("Error: --ttl requires a range (e.g., 1-30)"),
        );
      else if (a === "--iface")
        out.iface = next(
          "Error: --iface requires an interface name (e.g., eth0)",
        ).slice(0, 63);
      else if (a === "--interval") {
        const v = next("Error: --interval requires a number (milliseconds)");
        const n = strtol(v);
        if (!n.consumed || n.rest !== "")
          fail(`Error: Invalid interval value '${v}' (must be a number)`);
        out.intervalMs = n.value;
        if (out.intervalMs <= 0) fail("Error: Interval must be positive");
      } else fail(`Error: Unknown argument '${a}'`);
    }
    if (mode === null)
      fail("Error: Must specify one mode: --scan, --trace, or --monitor");
    const m = mode as unknown as Mode;
    if ((m === "scan" || m === "trace") && out.target === "")
      fail(`Error: --target required for ${m} mode`);
    if (out.json && out.csv) fail("Error: Cannot use both --json and --csv");
    if (
      m === "scan" &&
      [out.portsFrom, out.portsTo].some((p) => p < MIN_PORT || p > MAX_PORT)
    )
      fail(`Error: Ports must be in range ${MIN_PORT}-${MAX_PORT}`);
    if (
      m === "trace" &&
      [out.ttlStart, out.ttlMax].some((t) => t < MIN_TTL || t > MAX_TTL)
    )
      fail(`Error: TTL values must be in range ${MIN_TTL}-${MAX_TTL}`);
    return { kind: "ok", cmd: { mode: m, ...out } };
  } catch (e) {
    if (e instanceof CliError) return { kind: "error", message: e.message };
    throw e;
  }
}

/** Splits a typed line like a shell would, honouring simple quotes. */
export function argvOf(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/* ------------------------------------------------------------------ *
 * Simulated results
 * ------------------------------------------------------------------ */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A tiny seeded PRNG (mulberry32), so a target always gives the same answer. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMMON = [
  21, 22, 25, 53, 80, 110, 143, 443, 587, 993, 3000, 3306, 5432, 6379, 8080,
  8443,
];

export type PortState = "open" | "closed" | "filtered";
export type ScanRow = { port: number; state: PortState; latencyMs: number };

export function scanRow(target: string, port: number): ScanRow {
  const h = hash(`${target}:${port}`);
  const isOpen = COMMON.includes(port) && hash(`${target}#${port}`) % 3 !== 0;
  if (isOpen) return { port, state: "open", latencyMs: 2 + (h % 38) };
  // A connect() that times out is FILTERED; one refused is CLOSED. Neither
  // has a meaningful latency, which the tool prints as "-".
  if (h % 97 === 0) return { port, state: "filtered", latencyMs: -1 };
  return { port, state: "closed", latencyMs: -1 };
}

export const SCAN_HEADER = [
  "PORT  STATE      LATENCY(ms)",
  "----  ---------  ----------",
];
const pad = (s: string | number, n: number) => String(s).padEnd(n);

export function scanTableRow(r: ScanRow) {
  return `${pad(r.port, 4)}  ${pad(r.state, 9)}  ${r.latencyMs >= 0 ? r.latencyMs : "-"}`;
}
export function scanCsvRow(r: ScanRow) {
  return `${r.port},${r.state},${r.latencyMs >= 0 ? r.latencyMs : ""}`;
}
export function scanJson(rows: readonly ScanRow[]) {
  return `{"type":"scan","results":[${rows
    .map(
      (r) =>
        `{"port":${r.port},"state":"${r.state}","latency_ms":${r.latencyMs >= 0 ? r.latencyMs : "null"}}`,
    )
    .join(",")}]}`;
}

export type Hop = {
  hop: number;
  ip: string;
  host: string;
  rttMs: number;
  timeout: boolean;
  dest: boolean;
};

export function trace(cmd: CommandLine): Hop[] {
  const rand = rng(hash(cmd.target));
  const length = 5 + Math.floor(rand() * 5);
  const hops: Hop[] = [];
  let rtt = 1 + rand() * 2;
  for (let ttl = cmd.ttlStart; ttl <= cmd.ttlMax; ttl++) {
    const n = ttl - cmd.ttlStart + 1;
    const dest = n >= length;
    rtt += 1 + rand() * 6;
    const timeout = !dest && n > 2 && rand() < 0.15;
    const ip = dest
      ? `203.0.113.${10 + (hash(cmd.target) % 200)}`
      : n === 1
        ? "192.168.1.1"
        : n === 2
          ? "10.24.0.1"
          : `198.51.100.${(hash(cmd.target + n) % 250) + 1}`;
    hops.push({
      hop: ttl,
      ip: timeout ? "*" : ip,
      host: timeout ? "?" : dest ? cmd.target : n === 1 ? "gateway" : "?",
      rttMs: timeout ? -1 : Math.round(rtt),
      timeout,
      dest,
    });
    if (dest) break;
  }
  return hops;
}

function hostColumn(host: string) {
  if (host.length <= 26) return pad(host, 26);
  return `${host.slice(0, 11)}...${host.slice(-12)}`;
}

export function formatTrace(hops: readonly Hop[], cmd: CommandLine): string[] {
  const status = (h: Hop) =>
    h.timeout ? "TIMEOUT" : h.dest ? "DEST" : "TTL_EXCEEDED";
  const rtt = (h: Hop) => (h.timeout || h.rttMs < 0 ? "-" : String(h.rttMs));
  if (cmd.json)
    return [
      `{"type":"trace","hops":[${hops
        .map(
          (h) =>
            `{"hop":${h.hop},"ip":"${h.ip}","host":"${h.host}",` +
            (h.timeout
              ? `"rtt_ms":null,"timeout":true}`
              : `"rtt_ms":${h.rttMs},"timeout":false}`),
        )
        .join(",")}]}`,
    ];
  if (cmd.csv)
    return [
      "hop,ip,host,rtt_ms,timeout",
      ...hops.map((h) => `${h.hop},${h.ip},${h.host},${rtt(h)},${h.timeout}`),
    ];
  return [
    "HOP  IP               HOST                       RTT(ms)  STATUS      ",
    "---  ---------------- -------------------------- -------  ------------",
    ...hops.map(
      (h) =>
        `${pad(h.hop, 3)}  ${pad(h.ip, 16)} ${hostColumn(h.host)} ${pad(rtt(h), 7)}  ${pad(status(h), 12)}`,
    ),
  ];
}

export type Sample = {
  iface: string;
  rxBytes: number;
  txBytes: number;
  rxBps: number;
  txBps: number;
  rxAvgBps: number;
  txAvgBps: number;
};

export function monitor(cmd: CommandLine): Sample[] {
  const iface = cmd.iface || "eth0";
  const rand = rng(hash(iface));
  let rx = 48_000_000 + Math.floor(rand() * 1e6);
  let tx = 6_000_000 + Math.floor(rand() * 1e5);
  const rxRing: number[] = [];
  const txRing: number[] = [];
  const out: Sample[] = [];
  const dt = cmd.intervalMs / 1000;
  for (let i = 0; i < MONITOR_SAMPLES; i++) {
    const drx = Math.floor((180_000 + rand() * 120_000) * dt);
    const dtx = Math.floor((20_000 + rand() * 14_000) * dt);
    rx += drx;
    tx += dtx;
    // bytes → bits per second, like monitor_run
    const rxBps = (drx * 8) / dt;
    const txBps = (dtx * 8) / dt;
    rxRing.push(rxBps);
    txRing.push(txBps);
    if (rxRing.length > WINDOW_SIZE) rxRing.shift();
    if (txRing.length > WINDOW_SIZE) txRing.shift();
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    out.push({
      iface,
      rxBytes: rx,
      txBytes: tx,
      rxBps,
      txBps,
      rxAvgBps: avg(rxRing),
      txAvgBps: avg(txRing),
    });
  }
  return out;
}

export function formatMonitor(
  samples: readonly Sample[],
  cmd: CommandLine,
): string[] {
  const f = (n: number) => n.toFixed(2);
  if (cmd.json)
    return [
      `{"type":"monitor","samples":[${samples
        .map(
          (s) =>
            `{"iface":"${s.iface}","rx_bytes":${s.rxBytes},"tx_bytes":${s.txBytes},"rx_bps":${f(s.rxBps)},"tx_bps":${f(s.txBps)},"rx_avg_bps":${f(s.rxAvgBps)},"tx_avg_bps":${f(s.txAvgBps)}}`,
        )
        .join(",")}]}`,
    ];
  if (cmd.csv)
    return [
      "iface,rx_bytes,tx_bytes,rx_bps,tx_bps,rx_avg_bps,tx_avg_bps",
      ...samples.map(
        (s) =>
          `${s.iface},${s.rxBytes},${s.txBytes},${f(s.rxBps)},${f(s.txBps)},${f(s.rxAvgBps)},${f(s.txAvgBps)}`,
      ),
    ];
  return [
    "IFACE  RX_BYTES   TX_BYTES   RX_BPS      TX_BPS      RX_AVG_BPS   TX_AVG_BPS",
    "-----  --------   --------   ----------  ----------  -----------  -----------",
    ...samples.map(
      (s) =>
        `${pad(s.iface, 5)}  ${pad(s.rxBytes, 8)}  ${pad(s.txBytes, 8)}  ${pad(f(s.rxBps), 10)}  ${pad(f(s.txBps), 10)}  ${pad(f(s.rxAvgBps), 11)}  ${pad(f(s.txAvgBps), 11)}`,
    ),
  ];
}
