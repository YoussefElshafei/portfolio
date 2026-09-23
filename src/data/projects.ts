/**
 * Project content.
 *
 * Every claim here comes from source material supplied by Youssef. Nothing is
 * embellished and nothing is inferred. Where a project's own documentation
 * makes a stronger claim than the work supports, the weaker, accurate version
 * is what appears (see BridgeAid and TradeWatch notes below).
 *
 * `node.x` / `node.y` are the project's precomputed coordinates in the graph's
 * viewBox. Authored by hand and committed — no force simulation, so the diagram
 * is identical on every visit. See DESIGN_BRIEF.md §2.2.
 */

export type ProjectLink = {
  kind: "demo" | "repo" | "repo-private";
  href: string;
  label: string;
  /** Extra context for assistive tech where the label alone is ambiguous. */
  a11yLabel?: string;
};

export type ProjectImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type Project = {
  id: string;
  /** Machine fact, rendered in mono. */
  index: string;
  name: string;
  tagline: string;
  /** Present only while the work is unfinished. Rendered as a visible badge. */
  status?: { label: string; detail: string };
  summary: string;
  /** The throughline. Rendered before the detail bullets, not after. */
  framing: { problem: string; constraint: string; tradeoff: string };
  details: readonly string[];
  /** Stated verbatim; also the source of the graph's edges. */
  stack: readonly string[];
  links: readonly ProjectLink[];
  image?: ProjectImage;
  /** An abstract visual built from the project's own concept, not a stock image. */
  visual?: "pipeline" | "terminal";
  /** Renders the Live Signal widget beneath the visual. TradeWatch only. */
  liveSignal?: true;
  /** Rendered plainly where the work was not solo. */
  team?: string;
  node: { x: number; y: number };
};

export const PROJECTS: readonly Project[] = [
  {
    id: "tradewatch",
    index: "01",
    name: "TradeWatch",
    tagline: "Market Intelligence & Paper-Trading Platform",
    status: {
      label: "In progress",
      detail: "Phase 3 of 12 complete",
    },
    summary:
      "A market intelligence and paper-trading platform — live market data ingestion, historical storage, configurable trading strategies, backtesting, simulated trading, statistical anomaly detection, and alerting, behind a FastAPI backend and a React dashboard.",
    framing: {
      problem:
        "Knowing whether market activity is actually unusual, in a system that has to keep up with live data continuously. Not something answerable with a one-off script.",
      constraint:
        "Kafka gives fan-out — two independent consumer groups reading the same trade topic, one storing raw trades, one aggregating into bars — but only at-least-once delivery, so every downstream write has to be idempotent or the numbers drift.",
      tradeoff:
        "The ingestion pipeline was hardened first — delivery guarantees, layered architecture enforced in CI, config that fails loudly instead of defaulting silently — before any strategy or ML logic was written. Phase 3 of 12, deliberately: a trading strategy running on an unreliable pipeline is worse than no strategy. The anomaly detector is scoped to statistically unusual relative to a symbol's own history, explicitly not fraud or manipulation detection — a claim the statistics can't support, so it isn't made.",
    },
    details: [
      "Real-time pipeline: a market data provider feeds Kafka, which fans out to two independent consumer groups — one storing raw trades in PostgreSQL, one aggregating into 1-minute bars with 5m/1h/1d rollups.",
      "At-least-once delivery with idempotent writes; offsets are only committed after data is durably stored.",
      "Over 30 days of real historical backfill, aggregated into multi-timeframe bars.",
      "Statistical anomaly detection flags market activity that is unusual relative to a symbol's own recent behaviour — explicitly not a claim of fraud or manipulation detection.",
      "Simulates trading only: no brokerage connectivity, no real money moves.",
      "Layered architecture (domain / application / infrastructure) enforced by import-linter in CI.",
      "Typed settings that fail startup with every missing config variable named at once.",
      "Five independent CI jobs: lint and type-check, unit and API tests, integration tests against real Postgres, a startup check, and the frontend.",
      "No performance number appears anywhere in the project unless a benchmark produced it.",
    ],
    stack: [
      "Python",
      "FastAPI",
      "Kafka",
      "PostgreSQL",
      "Redis",
      "Alembic",
      "React",
      "TypeScript",
      "Vite",
      "Docker",
      "GitHub Actions",
    ],
    links: [
      {
        kind: "repo-private",
        href: "https://github.com/YoussefElshafei/TradeWatch",
        label: "GitHub (private)",
        a11yLabel:
          "TradeWatch on GitHub — private repository, not publicly accessible",
      },
    ],
    visual: "pipeline",
    liveSignal: true,
    node: { x: 340, y: 120 },
  },

  {
    id: "triage-flow",
    index: "02",
    name: "Triage Flow",
    tagline: "AI-Assisted Triage & Live Queue System",
    summary:
      "A full-stack triage workflow enabling AI-assisted patient intake with staff-controlled urgency validation.",
    framing: {
      problem:
        "Hospital-style intake needs to be fast, because patients want to know their status, and safe, because urgency can't be decided by an unsupervised model.",
      constraint:
        "LLM output is unstructured and occasionally wrong; raw model text can't be allowed to drive queue ordering directly.",
      tradeoff:
        "A server-side validation layer sits between the LLM and the queue — the model proposes a structured summary and urgency, staff review and finalize every case. This gives up fully autonomous triage, the flashier demo, for a system where the AI is never the last word on a medical decision.",
    },
    details: [
      "LLM output is extracted into server-validated structured JSON (symptoms, urgency level, red flags, clinical summary) — the AI never makes the final call; staff review and finalize every case.",
      "Real-time queue updates via Server-Sent Events, with dynamic wait-time estimation.",
      "Deployed on Vercel with managed PostgreSQL; Docker for local development.",
    ],
    stack: [
      "Next.js",
      "React",
      "PostgreSQL",
      "Docker",
      "LLM API",
      "Server-Sent Events",
    ],
    links: [
      {
        kind: "demo",
        href: "https://triage-flow-nine.vercel.app/",
        label: "Live demo",
        a11yLabel: "Triage Flow live demo",
      },
    ],
    node: { x: 600, y: 100 },
  },

  {
    id: "bridgeaid",
    index: "03",
    name: "BridgeAid",
    tagline: "Full-Stack Disaster Response Platform",
    summary:
      "A natural disaster response platform built with React, Flask, Python, JavaScript and Tailwind CSS.",
    framing: {
      problem:
        "Disaster response needs live incident data people can actually trust, not just map pins.",
      constraint:
        "Public reports can be wrong or spam, but the entire value of the platform is speed.",
      tradeoff:
        "The live map only updates from verified reports, trading raw report volume for reliability. The platform stops at donation links and volunteer registration rather than touching real aid transactions or payments, keeping scope inside what could be built safely.",
    },
    details: [
      "Live map, built on Leaflet, that updates dynamically from verified user incident reports — unverified reports don't appear.",
      "Report verification includes AI-assisted cross-checking against other reports and official datasets, aimed at reducing false or panic-driven reports.",
      "Education Hub with interactive quizzes, downloadable resources and embedded learning content.",
      "Recovery Dashboard: incident count and people-affected figures with a local/global toggle. This is a simulated recovery-progress visualisation, not live real-world recovery data.",
      "Aid requests capture location, urgency level, household size and aid type (food, shelter, medical, supplies).",
      "Volunteer registration with category selection (food bank, shelter, disaster relief) and active/standby status.",
      "Security: JWT authentication, server-side input validation and API request throttling.",
    ],
    stack: [
      "React",
      "Flask",
      "Python",
      "JavaScript",
      "Tailwind CSS",
      "Vite",
      "Leaflet",
      "PostgreSQL",
      "JWT",
    ],
    links: [
      {
        kind: "repo",
        href: "https://github.com/YoussefElshafei/BridgeAid-Project",
        label: "GitHub",
        a11yLabel: "BridgeAid on GitHub",
      },
    ],
    image: {
      src: "/images/bridgeaid-1.webp",
      width: 1664,
      height: 710,
      alt: "BridgeAid's Live Disaster Map: a Leaflet map of the Hamilton and Burlington region with a marked incident, above the caption 'Showing 2 confirmed incident(s)'.",
    },
    team: "Team of 4: Youssef Elshafei, Adib El Dada, Ahmed Elmanufi, Youssef Elsayyad.",
    node: { x: 330, y: 255 },
  },

  {
    id: "wirefish",
    index: "04",
    name: "WireFish",
    tagline: "Network Diagnostics & Monitoring Toolkit",
    summary:
      "A Linux command-line network diagnostics suite written in C, unifying host scanning, ICMP traceroute and interface bandwidth monitoring into one tool.",
    framing: {
      problem:
        "Diagnosing a network issue usually means switching between separate tools — ping, traceroute, a bandwidth monitor — that each have their own output format and share no context.",
      constraint:
        "Doing ICMP scanning and traceroute properly means constructing raw ICMP packets by hand and reading responses off a raw socket. There's no high-level library standing in between to hide the mechanics, and Linux requires elevated privileges to do it at all.",
      tradeoff:
        "Built the packet construction and raw-socket handling by hand in C instead of reaching for a library like libpcap — slower to build, but it's the version where you actually understand what's happening at the wire level. Built collaboratively with modular, Git-tracked C code so scanning, traceroute and bandwidth monitoring could be worked on independently.",
    },
    details: [
      "Raw-socket ICMP scanning and traceroute, manually constructing ICMP packets including headers and the 16-bit internet checksum.",
      "Real-time bandwidth monitor: polls Linux's /proc/net/dev and computes instantaneous and rolling RX/TX bitrate as rate_bps = (Δbytes × 8) / Δt_sec.",
      "Single unified CLI binary with text, JSON and CSV output modes.",
      "Modular file layout (app/, cli/, scanner/, tracer/, monitor/, fmt/, net/, log/) with a dedicated logging subsystem (debug/info/warn/error) instead of scattered printf calls.",
      "MIT licensed.",
    ],
    stack: ["C", "Linux", "Raw Sockets", "ICMP", "POSIX", "Make"],
    links: [
      {
        kind: "repo",
        href: "https://github.com/YoussefElshafei/WireFish-Project",
        label: "GitHub",
        a11yLabel: "WireFish on GitHub",
      },
    ],
    visual: "terminal",
    team: "Built collaboratively in a Git-based team workflow with 3 teammates.",
    node: { x: 120, y: 70 },
  },

  {
    id: "airport-bot",
    index: "05",
    name: "Airport Luggage Transport Bot",
    tagline: "Autonomous Luggage Handling Control Interface",
    summary:
      "A Python-based control interface for an autonomous robot managing airport luggage flow.",
    framing: {
      problem:
        "Automating luggage flow means software logic driving real physical hardware — a bug here doesn't just return the wrong value, it moves a motor.",
      constraint:
        "The control interface has to translate Python-level logic into precise motor control sequences for stepper motors on Arduino, where timing and step counts affect correctness directly.",
      tradeoff:
        "Prioritised system logic, efficiency and safe automated path handling over adding scope. Correctness and safety of the physical automation mattered more than expanding what the robot could do, since hardware has much less tolerance for good enough than pure software does.",
    },
    details: [
      "Programmed motor control sequences and integrated stepper motors with Arduino hardware.",
      "Focused on system logic, efficiency and safe automated path handling.",
    ],
    stack: ["Python", "Arduino", "Hardware Integration"],
    links: [],
    image: {
      src: "/images/airport-bot-1.webp",
      width: 800,
      height: 616,
      alt: "Airport luggage transport robot.",
    },
    node: { x: 600, y: 300 },
  },

  {
    id: "catan",
    index: "06",
    name: "Catan Simulator",
    tagline: "Rule-Based AI Agent for Settlers of Catan",
    summary:
      "A McMaster course project (SFWRENG 2AA4, Assignment 3) extending a Java-based Catan simulator with undo/redo and a rule-based AI agent, built with a 4-person team.",
    framing: {
      problem:
        "Add undo/redo and a rule-based AI opponent to an existing Catan simulator without rewriting or destabilising the core game logic that was already working.",
      constraint:
        "The assignment's actual grading criterion was clean extensibility — every new feature had to be introduced through a deliberately chosen Gang-of-Four design pattern, not just does it work.",
      tradeoff:
        "Implemented undo/redo via the Command pattern, with a CommandManager owning the undo and redo stacks, and replaced the AI's monolithic decision function with a Template Method skeleton plus a Visitor for scoring candidate moves — all while leaving the existing Board, Player, RuleValidator, Tile and Vertex classes completely untouched. Chose architectural discipline (SOLID: single responsibility, open/closed, Liskov substitution, dependency inversion, all named explicitly in the project docs) over the fastest path to a working AI.",
    },
    details: [
      "Rule-based AI scores candidate moves each turn — earning a victory point scores highest at 1.0, building without a VP scores 0.8, spending down a hand scores 0.5 — and resolves hard constraints (hand size over 7, blocked road segments, contesting longest road) before picking a move.",
      "Every game action can be undone and redone within a turn via the Command pattern.",
    ],
    stack: ["Java", "Design Patterns", "Python (visualizer)"],
    links: [
      {
        kind: "repo",
        href: "https://github.com/adibeldada/Catan-Simulator",
        label: "GitHub",
        a11yLabel:
          "Catan Simulator on GitHub, hosted under teammate Adib El Dada's account",
      },
    ],
    team: "Team of 4: Adib El Dada, Youssef Elshafei, Youssef Khafagy, Riken Allen. The repository is hosted under a teammate's account.",
    node: { x: 140, y: 345 },
  },
];

export const PROJECT_BY_ID: ReadonlyMap<string, Project> = new Map(
  PROJECTS.map((p) => [p.id, p]),
);
