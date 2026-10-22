import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { argvOf, formatTrace, parse, scanRow, trace } from "./wirefish.ts";

/** Run with `npm test`. Messages must match cli/cli.c word for word. */

const err = (line: string) => {
  const p = parse(argvOf(line));
  return p.kind === "error" ? p.message : p.kind;
};

describe("parse", () => {
  it("accepts the README's examples", () => {
    for (const line of [
      "--scan --target google.com --ports 80-443",
      "--trace --target 8.8.8.8 --json",
      "--monitor --iface eth0 --interval 500",
    ])
      assert.equal(parse(argvOf(line)).kind, "ok");
  });

  it("applies the defaults", () => {
    const p = parse(argvOf("--scan --target a"));
    assert.ok(p.kind === "ok");
    assert.equal(p.cmd.portsFrom, 1);
    assert.equal(p.cmd.portsTo, 1024);
  });

  it("returns help whenever --help appears", () => {
    assert.equal(err("--scan --bogus --help"), "help");
  });

  it("reproduces cli_parse's errors", () => {
    assert.equal(
      err(""),
      "Error: Must specify one mode: --scan, --trace, or --monitor",
    );
    assert.equal(
      err("--scan --trace"),
      "Error: Only one mode (--scan, --trace, --monitor) allowed",
    );
    assert.equal(err("--scan"), "Error: --target required for scan mode");
    assert.equal(
      err("--subnet 192.168.1.0/24"),
      "Error: Unknown argument '--subnet'",
    );
    assert.equal(
      err("--scan --target a --ports 80"),
      "Error: Range must be in format 'from-to' (ex, 80-443)",
    );
    assert.equal(
      err("--scan --target a --ports 443-80"),
      "Error: Range start (443) cannot be greater than end (80)",
    );
    assert.equal(
      err("--scan --target a --ports 80-9x"),
      "Error: Invalid characters at end of range '80-9x'",
    );
    assert.equal(
      err("--scan --target a --ports 0-80"),
      "Error: Ports must be in range 1-65535",
    );
    assert.equal(
      err("--monitor --interval abc"),
      "Error: Invalid interval value 'abc' (must be a number)",
    );
    assert.equal(
      err("--monitor --interval 0"),
      "Error: Interval must be positive",
    );
    assert.equal(
      err("--trace --target a --json --csv"),
      "Error: Cannot use both --json and --csv",
    );
    assert.equal(
      err("--trace --target"),
      "Error: --target requires a hostname or IP",
    );
  });
});

describe("simulated results", () => {
  it("are deterministic per target", () => {
    assert.deepEqual(scanRow("a.example", 22), scanRow("a.example", 22));
  });
  it("end a trace at the destination", () => {
    const p = parse(argvOf("--trace --target host.example"));
    assert.ok(p.kind === "ok");
    const hops = trace(p.cmd);
    assert.ok(hops[hops.length - 1].dest);
    assert.match(formatTrace(hops, p.cmd).at(-1) ?? "", /DEST/);
  });
});
