import { Fragment } from "react";

/**
 * WireFish command synopsis.
 *
 * Replaces a generated logo with something that shows what the tool actually
 * does. Every string here is sourced: the three invocations are verbatim from
 * the project's own CLI, and the notes restate the summary rather than adding
 * to it.
 *
 * Deliberately a *synopsis*, not a simulated session. Rendering fake scan
 * results — invented hosts, invented hop latencies, invented bitrates — would
 * be fabricated evidence, which is the thing this whole site is organised
 * against. Real commands, no invented output.
 *
 * Real text, not an image: selectable, searchable, readable by a screen
 * reader, sharp at any zoom, and a few hundred bytes instead of a screenshot.
 *
 * Everything inside is a machine fact, so the whole block is mono (§2.6).
 * No fake window chrome and no traffic-light dots.
 */

const INVOCATIONS = [
  {
    cmd: "wirefish --scan --subnet 192.168.1.0/24",
    note: "raw-socket ICMP host scan across a subnet",
  },
  {
    cmd: "wirefish --trace <host>",
    note: "hop-by-hop ICMP traceroute",
  },
  {
    cmd: "wirefish --monitor --iface eth0 --interval 100",
    note: "RX/TX bitrate polled from /proc/net/dev",
  },
];

/**
 * Splits a command so it can only wrap at spaces.
 *
 * CSS treats a hyphen as a soft wrap opportunity, so at 375px `--interval`
 * broke across two lines as `--` and `interval`, which reads like a different
 * flag. Each token is kept atomic and the spaces between them carry the breaks.
 */
function Command({ cmd }: { cmd: string }) {
  const tokens = cmd.split(" ");
  return (
    <span className="text-silk">
      {tokens.map((token, i) => (
        <Fragment key={`${token}-${i}`}>
          {i > 0 && " "}
          <span className="whitespace-nowrap">{token}</span>
        </Fragment>
      ))}
    </span>
  );
}

export function TerminalBlock() {
  return (
    <figure className="mt-8 w-full max-w-figure">
      <div className="overflow-hidden rounded-trace border border-hairline bg-surface">
        <div className="flex items-baseline justify-between border-b border-hairline px-4 py-2.5">
          <span className="font-mono text-micro text-silk-dim">wirefish</span>
          <span className="font-mono text-micro text-silk-faint">
            text · json · csv
          </span>
        </div>

        {/*
          Lines wrap rather than scroll horizontally. A real terminal wraps, and
          at 375px a scrolling code block clipped `--interval 100` mid-token
          with nothing to signal there was more to the right.
        */}
        <div className="px-4 py-4">
          <pre className="font-mono text-micro leading-relaxed">
            <code>
              {INVOCATIONS.map(({ cmd, note }, i) => (
                <span key={cmd} className="block">
                  {i > 0 && <span className="block h-3" aria-hidden="true" />}
                  <span className="block whitespace-pre-wrap">
                    <span className="text-copper" aria-hidden="true">
                      ${" "}
                    </span>
                    <Command cmd={cmd} />
                  </span>
                  <span className="block whitespace-pre-wrap text-silk-faint">
                    {"  # "}
                    {note}
                  </span>
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
      <figcaption className="mt-3 text-micro text-silk-faint">
        One binary for scanning, traceroute and bandwidth monitoring.
      </figcaption>
    </figure>
  );
}
