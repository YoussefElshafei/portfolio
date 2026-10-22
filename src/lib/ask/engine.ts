/**
 * The "Ask about me" engine: retrieval over a small curated knowledge base,
 * entirely in the browser.
 *
 * No model and no network, on purpose (DESIGN_BRIEF.md §2.8). It cannot be
 * rate-limited, cannot cost anything, cannot fail with a server error, and
 * cannot invent an answer: every reply is a passage written from the site's
 * own content. When nothing matches well enough, it says so and points to
 * email instead of guessing.
 *
 * How a question is answered:
 *
 *  1. Normalise: lowercase, fold known multi-word terms ("github actions")
 *     into single tokens, drop filler words, crude stemming, and map
 *     synonyms onto one canonical word ("cv" and "resume" → "resume").
 *  2. Correct typos against the knowledge base's own vocabulary (edit
 *     distance 1, or 2 for long words), never toward words it doesn't know.
 *  3. Score every entry with BM25, the standard bag-of-words ranking
 *     function, over each entry's title, keywords and text (title and
 *     keywords weighted up).
 *  4. Refuse when the best score is low, or when the only words that matched
 *     are generic ones ("he", "experience") while the question also names
 *     something the base has never heard of ("does he know Rust?").
 *
 * Pure and dependency-free, so it is unit-tested under `node --test`.
 */

export type Entry = {
  id: string;
  /** Short label, also used for the suggestion chip that leads here. */
  title: string;
  /** Extra words a visitor might use for this entry. */
  keywords: readonly string[];
  /** The reply, as plain text. */
  answer: string;
  /** Optional link shown under the reply. */
  link?: { href: string; label: string };
  /** Ids of entries worth suggesting next. */
  related?: readonly string[];
  /**
   * The subject this entry is *the* answer for: a project's name for its
   * overview, a technology for its skill entry, "resume" for the résumé.
   * A question that is only about this subject comes here directly.
   */
  primary?: readonly string[];
  /**
   * Words of which the question must contain at least one before this entry
   * may answer. Keeps a topical entry from catching a question that only
   * shares its mood: "what is his worst project" must not get a football
   * answer.
   */
  requires?: readonly string[];
};

export type Reply =
  { kind: "answer"; entry: Entry; score: number } | { kind: "unknown" };

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

const STOP = new Set(
  (
    "a an the and or but if of to in on at by for with about as from into " +
    "is are was were be been being am do does did doing done have has had " +
    "i me my we our you your he him his she her they them their it its " +
    "what which who whom whose when where why how this that these those " +
    "there here can could would should will shall may might must " +
    "tell show give let please any some much many more most very so just " +
    "also than then too not no yes ok okay hi hello hey thanks thank " +
    "youssef elshafei youssefs elshafeis"
  ).split(" "),
);

/**
 * Canonical forms. The left side is what a visitor might type (after
 * stemming), the right side is the word the knowledge base uses.
 */
const SYNONYMS: Record<string, string> = {
  cv: "resume",
  résumé: "resume",
  coop: "coop",
  internship: "coop",
  intern: "coop",
  job: "coop",
  hire: "coop",
  hiring: "coop",
  employ: "coop",
  employment: "coop",
  position: "coop",
  role: "coop",
  available: "availability",
  start: "availability",
  university: "education",
  school: "education",
  college: "education",
  study: "education",
  studying: "education",
  student: "education",
  degree: "education",
  major: "education",
  program: "education",
  mcmaster: "education",
  grade: "gpa",
  marks: "gpa",
  average: "gpa",
  email: "contact",
  reach: "contact",
  message: "contact",
  touch: "contact",
  phone: "contact",
  linkedin: "linkedin",
  github: "github",
  repo: "github",
  repository: "github",
  code: "github",
  tech: "skill",
  technology: "skill",
  technologie: "skill",
  language: "skill",
  framework: "skill",
  tool: "skill",
  know: "skill",
  knows: "skill",
  familiar: "skill",
  experience: "skill",
  experienced: "skill",
  proficient: "skill",
  stack: "stack",
  built: "project",
  build: "project",
  made: "project",
  portfolio: "project",
  club: "involvement",
  society: "involvement",
  volunteer: "involvement",
  volunteering: "involvement",
  extracurricular: "involvement",
  competition: "involvement",
  award: "award",
  honour: "award",
  honor: "award",
  certification: "certification",
  certificate: "certification",
  french: "french",
  speak: "french",
  live: "location",
  located: "location",
  based: "location",
  city: "location",
  team: "team",
  teammate: "team",
  solo: "team",
  alone: "team",
  group: "team",
  old: "age",
  born: "age",
  birthday: "age",
  birth: "age",
  hobby: "hobby",
  hobbie: "hobby",
  interest: "hobby",
  fun: "hobby",
  spare: "hobby",
  free: "hobby",
  weekend: "hobby",
  sport: "hobby",
  gym: "hobby",
  workout: "hobby",
  basketball: "hobby",
  pickleball: "hobby",
  soccer: "football",
  footballer: "football",
  futbol: "football",
  cristiano: "ronaldo",
  cr7: "ronaldo",
  siuu: "ronaldo",
  siuuu: "ronaldo",
  greatest: "goat",
  leo: "messi",
  worse: "worst",
  overrated: "worst",
  overated: "worst",
  trash: "worst",
  bad: "worst",
  terrible: "worst",
  awful: "worst",
  suck: "worst",
  sucks: "worst",
  hate: "worst",
  washed: "worst",
  flop: "worst",
  fraud: "worst",
  weak: "worst",
  personality: "personality",
  character: "personality",
  trait: "personality",
  describe: "personality",
  attitude: "personality",
  player: "personality",
  culture: "culture",
  environment: "culture",
  workplace: "culture",
  ideal: "culture",
  strength: "strength",
  strong: "strength",
  standout: "strength",
  demo: "demo",
  interactive: "demo",
  playable: "demo",
  teach: "tutor",
  teaching: "tutor",
  tutoring: "tutor",
  kid: "tutor",
  children: "tutor",
};

/**
 * Words that say what kind of question it is but not what it is about. A
 * match on these alone is not evidence the base knows the subject.
 */
const GENERIC = new Set([
  "skill",
  "project",
  "use",
  "used",
  "using",
  "work",
  "year",
  "good",
  "best",
]);

/** Words that carry no subject at all, ignored when routing. */
const FILLER = new Set(["use", "used", "using", "good", "best", "year"]);

export type Phrase = readonly [phrase: string, token: string];

function stem(w: string) {
  // Folded technology names ("nextjs", "githubactions") are not English.
  if (w.endsWith("js") || w.length > 12) return w;
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("es") && /(ch|sh|x|ss)es$/.test(w))
    return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss"))
    return w.slice(0, -1);
  return w;
}

export function tokenize(text: string, phrases: readonly Phrase[] = []) {
  let t = ` ${text.toLowerCase()} `;
  // Symbols that carry meaning in technology names, before punctuation goes.
  t = t
    .replace(/c\+\+/g, " cpp ")
    .replace(/c#/g, " csharp ")
    .replace(/\.js\b/g, "js")
    .replace(/co-op/g, "coop")
    .replace(/[’']s\b/g, "");
  for (const [phrase, token] of phrases) {
    t = t.split(` ${phrase} `).join(` ${token} `);
  }
  return t
    .replace(/[^a-z0-9éè]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map((w) => {
      const s = stem(w);
      return SYNONYMS[w] ?? SYNONYMS[s] ?? s;
    });
}

/** Levenshtein distance with an early exit once it exceeds `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* ------------------------------------------------------------------ *
 * Index and ranking
 * ------------------------------------------------------------------ */

type Doc = {
  entry: Entry;
  tf: Map<string, number>;
  len: number;
  primary: ReadonlySet<string>;
  requires: ReadonlySet<string> | null;
};

export type Index = {
  docs: readonly Doc[];
  df: ReadonlyMap<string, number>;
  avgLen: number;
  vocab: ReadonlySet<string>;
  phrases: readonly Phrase[];
};

export function buildIndex(
  entries: readonly Entry[],
  phrases: readonly Phrase[] = [],
): Index {
  const docs: Doc[] = entries.map((entry) => {
    const terms = [
      // Title and keywords are what an entry is *about*, so they count more
      // than words that merely appear in its answer.
      ...Array(3).fill(tokenize(entry.title, phrases)).flat(),
      ...Array(2)
        .fill(tokenize(entry.keywords.join(" "), phrases))
        .flat(),
      ...tokenize(entry.answer, phrases),
    ] as string[];
    const tf = new Map<string, number>();
    for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    for (const term of tokenize((entry.primary ?? []).join(" "), phrases))
      tf.set(term, (tf.get(term) ?? 0) + 1);
    return {
      entry,
      tf,
      len: terms.length,
      primary: new Set(tokenize((entry.primary ?? []).join(" "), phrases)),
      requires: entry.requires
        ? new Set(tokenize(entry.requires.join(" "), phrases))
        : null,
    };
  });
  const df = new Map<string, number>();
  for (const d of docs)
    for (const term of d.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  return { docs, df, avgLen, vocab: new Set(df.keys()), phrases };
}

const K1 = 1.2;
/** Length normalisation, lower than the textbook 0.75: a project's overview
 *  is long because it has a lot to say, not because it is less relevant. */
const B = 0.3;
/** Below this, the best match is treated as no match. Tuned against the
 *  tests in engine.test.ts, not by eye. */
export const MIN_SCORE = 2.2;
/** A match this strong stands even if part of the question went unmatched. */
export const STRONG_SCORE = 7;

function bm25(index: Index, doc: Doc, terms: readonly string[]) {
  const n = index.docs.length;
  let score = 0;
  for (const term of new Set(terms)) {
    const f = doc.tf.get(term);
    if (!f) continue;
    const df = index.df.get(term) ?? 0;
    const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
    score +=
      (idf * (f * (K1 + 1))) /
      (f + K1 * (1 - B + (B * doc.len) / index.avgLen));
  }
  return score;
}

/** Each query word, corrected to the base's vocabulary where it is close. */
export function resolveTerms(index: Index, query: string) {
  const known: string[] = [];
  const unknown: string[] = [];
  for (const w of tokenize(query, index.phrases)) {
    if (index.vocab.has(w)) {
      known.push(w);
      continue;
    }
    const max = w.length >= 7 ? 2 : w.length >= 4 ? 1 : 0;
    let best: string | null = null;
    let bestD = max + 1;
    if (max > 0) {
      for (const v of index.vocab) {
        const d = editDistance(w, v, max);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
    }
    if (best) known.push(best);
    else unknown.push(w);
  }
  return { known, unknown };
}

export function ask(index: Index, query: string): Reply {
  const { known, unknown } = resolveTerms(index, query);
  if (known.length === 0) return { kind: "unknown" };
  const eligible = (d: Doc) =>
    !d.requires || known.some((t) => d.requires!.has(t));

  // Routing first. A question that names one subject and nothing unknown
  // ("TradeWatch?", "does he know Kafka?", "cv") goes to that subject's
  // entry, however common the word is across the base. Ranking alone gets
  // this wrong: a project's name appears in a dozen entries, which is
  // exactly what makes BM25 treat it as uninformative.
  if (unknown.length === 0) {
    const subject = new Set(known.filter((t) => !FILLER.has(t)));
    const routed = index.docs.find(
      (d) =>
        d.primary.size > 0 &&
        eligible(d) &&
        [...subject].every((t) => d.primary.has(t)),
    );
    if (routed) return { kind: "answer", entry: routed.entry, score: Infinity };
  }

  let best: Doc | null = null;
  let bestScore = 0;
  for (const d of index.docs) {
    if (!eligible(d)) continue;
    const s = bm25(index, d, known);
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  if (!best || bestScore < MIN_SCORE) return { kind: "unknown" };

  // "Does he know Rust?": "know" maps to "skill" and matches the skills
  // entry, but the thing actually asked about is unknown. Answering with
  // the skills list would look like a yes.
  const matched = known.filter((t) => best.tf.has(t));
  const specific = matched.filter((t) => !GENERIC.has(t));
  if (specific.length === 0 && unknown.length > 0) return { kind: "unknown" };
  // "What's his favourite food?": "food" appears in one project's text, but
  // half the question is about something the base has never heard of, and
  // the match is weak. A partial, weak match is not an answer.
  if (unknown.length >= specific.length && bestScore < STRONG_SCORE)
    return { kind: "unknown" };

  return { kind: "answer", entry: best.entry, score: bestScore };
}
