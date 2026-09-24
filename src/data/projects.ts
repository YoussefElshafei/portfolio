/**
 * Project content.
 *
 * Every claim here comes from source material supplied by Youssef. Nothing is
 * embellished and nothing is inferred. Where a project's own documentation
 * makes a stronger claim than the work supports, the weaker, accurate version
 * is what appears (see BridgeAid and TradeWatch notes below).
 *
 * `node.x` / `node.y` / `node.z` are the project's precomputed coordinates in
 * the graph's 3D model space. Authored by hand and committed — no force
 * simulation, so the object is identical on every visit and only its rotation
 * changes. See DESIGN_BRIEF.md §2.2.
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
  /**
   * The write-up, as plain paragraphs: what the project does first, then the
   * hard part and what was chosen because of it. Deliberately not a labelled
   * Problem / Constraint / Trade-off template, which read as a form being
   * filled in rather than a person explaining their work. Rendered after the
   * media and before the detail bullets.
   */
  description: readonly string[];
  details: readonly string[];
  /** Stated verbatim; also the source of the graph's edges. */
  stack: readonly string[];
  links: readonly ProjectLink[];
  image?: ProjectImage;
  /** An abstract visual or small demo built from the project's own concept, not a stock image. */
  visual?: "pipeline" | "terminal" | "bridgeaid-map" | "hex-board";
  /** Renders the Live Signal widget beneath the visual. TradeWatch only. */
  liveSignal?: true;
  /** Rendered plainly where the work was not solo. */
  team?: string;
  /**
   * Named teammates, Youssef excluded. The second source of the graph's
   * edges: two projects that share a person are joined even when they share
   * no technology. Only people actually named in the source material appear
   * here; "3 teammates" with no names contributes nothing.
   */
  collaborators?: readonly string[];
  /**
   * A short annotation drawn under the project's node in the graph. For facts
   * about one project alone, such as a teammate who worked on nothing else
   * here. Deliberately separate from `collaborators`: that field exists to
   * derive edges, and a person on a single project has no second endpoint.
   */
  graphNote?: string;
  /**
   * Position in the graph's 3D model space, authored by hand and committed.
   * x and y are the original flat layout (the view straight on); z is depth,
   * spread so that nodes at similar heights are well separated front to back
   * and the graph stays legible edge-on. Rotation is the only thing that ever
   * changes at runtime; the object itself is rigid.
   */
  node: { x: number; y: number; z: number };
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
    description: [
      "TradeWatch watches live market data and tries to notice when something is behaving strangely compared to how it normally does. Prices and trades stream in continuously, so the system has to keep up in real time rather than analyzing things after the fact.",
      "Under the hood, market data flows through Kafka to two separate processes that both read the same stream: one stores every trade exactly as it came in, and the other builds it into one minute, five minute, hourly, and daily candles. Kafka only guarantees a message will arrive at least once, so both processes are written so that receiving the same trade twice never corrupts the data.",
      "Rather than jumping straight into building trading strategies, most of the work so far has gone into making sure the plumbing underneath is actually trustworthy: the pipeline, the database writes, the CI checks. Right now the project is on phase 3 of 12, and there is no strategy engine or machine learning yet, on purpose. A trading strategy built on top of a shaky pipeline is worse than no strategy at all. The anomaly detector, once it's live, will only ever flag activity that looks unusual for that specific stock compared to its own history. It is not trying to catch fraud or market manipulation, and the project is careful not to claim that it does.",
    ],
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
    node: { x: 340, y: 120, z: -190 },
  },

  {
    id: "triage-flow",
    index: "02",
    name: "Triage Flow",
    tagline: "AI-Assisted Triage & Live Queue System",
    description: [
      "Triage Flow is a tool for hospital style intake that tries to get people seen faster without cutting corners on safety. When someone comes in, an AI assistant listens to their description of what's wrong and turns it into a structured summary: symptoms, urgency, and any red flags a nurse should know about right away.",
      "The tricky part is that language models don't always get things right, and a queue deciding who gets seen next is not a place to guess. So the AI's output is never used directly. It gets validated on the server first, and a staff member always reviews and finalizes the actual urgency level before a patient's spot in the queue is set. The AI proposes, a person decides. Patients can watch their position and estimated wait update live as the queue moves, which was the part everyone actually wanted in the first place: less mystery about how long the wait really is.",
    ],
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
        a11yLabel: "Triage Flow live demo, opens in a new tab",
      },
    ],
    collaborators: ["Youssef Khafagy"],
    // On Triage Flow only, so an annotation on its node rather than an edge.
    graphNote: "with Subhan Razzaq",
    node: { x: 600, y: 100, z: -30 },
  },

  {
    id: "bridgeaid",
    index: "03",
    name: "BridgeAid",
    tagline: "Full-Stack Disaster Response Platform",
    description: [
      "BridgeAid started from a simple frustration: during a wildfire, flood, or storm, the hardest part often isn't the disaster itself, it's not knowing what's actually happening nearby versus what's just a rumor. The platform lets people report incidents, request help, and see a live map of what's been verified in their area.",
      "Because anyone can submit a report, the reports themselves get cross checked against other nearby reports and public datasets before they're allowed onto the map, so a single bad or panicked report can't spread. Volunteers can sign up by category (food, shelter, general disaster relief) and mark themselves active or on standby. There's also a recovery dashboard that shows incident counts locally and globally, though it's worth being upfront that the recovery numbers there are a simulated visualization, not a live feed of real recovery data.",
      "The scope stays to things that could realistically be built and verified: reporting, requests, and volunteer coordination. It stops short of handling actual aid transactions or payments, since that's a different, much higher stakes problem than the one this project set out to solve.",
    ],
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
    // An interactive map demo in place of the screenshot, since BridgeAid is
    // not deployed. The screenshot file stays in public/images unused.
    visual: "bridgeaid-map",
    team: "Team of 4: Youssef Elshafei, Adib El Dada, Ahmed Elmanufi, Youssef Elsayyad.",
    collaborators: ["Adib El Dada", "Ahmed Elmanufi", "Youssef Elsayyad"],
    node: { x: 330, y: 255, z: 40 },
  },

  {
    id: "wirefish",
    index: "04",
    name: "WireFish",
    tagline: "Network Diagnostics & Monitoring Toolkit",
    description: [
      "Most of the time, figuring out what's wrong with a network means switching between three or four different tools, each with its own output format and no shared context between them. WireFish puts the basics (host scanning, traceroute, and bandwidth monitoring) into one command line tool that speaks a consistent language.",
      "Getting traceroute and host scanning to work properly meant building raw ICMP packets by hand, including the checksum, and reading responses straight off a raw socket, since there's no friendly library standing in between to hide that complexity. It was built that way on purpose, in C, alongside three teammates, because the point of the project was actually understanding what happens at the network layer, not just calling a function that already does it.",
    ],
    details: [
      "Raw-socket ICMP scanning and traceroute, manually constructing ICMP packets including headers and the 16-bit internet checksum.",
      "Real-time bandwidth monitor: polls Linux's /proc/net/dev and computes instantaneous and rolling RX/TX bitrate as rate_bps = (Δbytes × 8) / Δt_sec.",
      "Single unified CLI binary with text, JSON and CSV output modes.",
      "Modular file layout (app/, cli/, scanner/, tracer/, monitor/, fmt/, net/, log/) with a dedicated logging subsystem (debug/info/warn/error) instead of scattered printf calls.",
      "Linux requires elevated privileges to open a raw socket at all.",
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
    // Only the one teammate named in the source material. The other two are
    // not named anywhere, so they cannot produce an edge.
    collaborators: ["Youssef Khafagy"],
    node: { x: 120, y: 70, z: 170 },
  },

  {
    id: "catan",
    index: "05",
    name: "Catan Simulator",
    tagline: "Rule-Based AI Agent for Settlers of Catan",
    description: [
      "This one was a McMaster course assignment worked on with three teammates: take an existing Java based Catan simulator and add undo and redo, plus a simple AI opponent that could actually make reasonable decisions on its own.",
      "The catch was that the assignment wasn't really graded on whether the AI won games, it was graded on whether these features could be added cleanly, using proper design patterns, without tearing apart code that already worked. So undo and redo went in through the Command pattern, and the AI's decision making replaced a single messy function with a clear structure: a Template Method for the turn sequence and a Visitor for scoring possible moves. None of the original game logic classes had to be touched.",
    ],
    details: [
      "Rule-based AI scores candidate moves each turn — earning a victory point scores highest at 1.0, building without a VP scores 0.8, spending down a hand scores 0.5 — and resolves hard constraints (hand size over 7, blocked road segments, contesting longest road) before picking a move.",
      "Every game action can be undone and redone within a turn via the Command pattern.",
      "A CommandManager owns the undo and redo stacks. The existing Board, Player, RuleValidator, Tile and Vertex classes were left completely untouched.",
      "SOLID principles (single responsibility, open/closed, Liskov substitution, dependency inversion) are named explicitly in the project docs.",
      "McMaster SFWRENG 2AA4, Assignment 3.",
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
    visual: "hex-board",
    team: "Team of 4: Adib El Dada, Youssef Elshafei, Youssef Khafagy, Riken Allen. The repository is hosted under a teammate's account.",
    collaborators: ["Adib El Dada", "Youssef Khafagy", "Riken Allen"],
    node: { x: 140, y: 345, z: 190 },
  },
];

export const PROJECT_BY_ID: ReadonlyMap<string, Project> = new Map(
  PROJECTS.map((p) => [p.id, p]),
);
