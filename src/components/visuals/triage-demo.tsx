"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { DemoFrame } from "@/components/ui/demo-frame";
import {
  ARRIVALS,
  CLOSING,
  LEVEL_NAMES,
  QUESTIONS,
  SEED_QUEUE,
  TRAUMA_LINE,
  isEmergency,
  parsePain,
  sbar,
  sortQueue,
  suggestLevel,
  type Answers,
  type Level,
  type Patient,
} from "@/lib/triage";
import { NO_RESTORE } from "@/lib/no-restore";

/**
 * Triage Flow, end to end, with the visitor in both seats: first the patient
 * doing the intake, then the staff member who reviews the summary and sets
 * the final level, then the waiting room the patient lands in.
 *
 * Rules from the real repo live in lib/triage.ts. The conversation itself is
 * scripted (the real nurse is a language model), which the caption says.
 */

type Msg = { from: "nurse" | "you"; text: string; flag?: boolean };
type Pane = "intake" | "review" | "queue";

const ARRIVAL_MS = 9000;

const levelTone = (l: Level) =>
  l <= 2 ? "border-copper text-copper" : "border-edge text-silk-dim";

function LevelBadge({ level }: { level: Level }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-trace border px-1.5 font-mono text-micro ${levelTone(level)}`}
    >
      L{level} {LEVEL_NAMES[level].toLowerCase()}
    </span>
  );
}

export function TriageDemo() {
  const id = useId();
  const reduced = useReducedMotion();
  const [pane, setPane] = useState<Pane>("intake");
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "nurse", text: QUESTIONS[0].ask },
  ]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [emergency, setEmergency] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [override, setOverride] = useState<Level | null>(null);
  const [approved, setApproved] = useState(false);
  const [queue, setQueue] = useState<Patient[]>([...SEED_QUEUE]);
  const [clock, setClock] = useState(10);
  const logRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const done = step >= QUESTIONS.length || emergency;
  const suggested = suggestLevel(answers, emergency);
  const finalLevel = override ?? suggested;
  const report = sbar(answers, emergency, suggested);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [msgs]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Walk-ins keep arriving while the board is on screen, so the visitor's
  // patient has to find its place among moving traffic. Not under reduced
  // motion: a list that reorders itself on a timer is exactly the kind of
  // movement that setting asks us not to make.
  useEffect(() => {
    if (!inView || reduced) return;
    let n = 0;
    const t = setInterval(() => {
      const next = ARRIVALS[n % ARRIVALS.length];
      n++;
      setClock((c) => c + 2);
      setQueue((q) => {
        const arrived = Math.max(...q.map((p) => p.arrived)) + 2;
        // Keep the board short: the oldest READY non-visitor patient is seen.
        const trimmed =
          q.length >= 7
            ? (() => {
                const seen = sortQueue(q).find(
                  (p) => !p.mine && p.status === "READY",
                );
                return q.filter((p) => p !== seen);
              })()
            : q;
        return [
          ...trimmed,
          {
            ...next,
            id: String(1042 + n),
            arrived,
            status: "SUBMITTED",
          },
        ];
      });
    }, ARRIVAL_MS);
    return () => clearInterval(t);
  }, [inView, reduced]);

  function say(text: string) {
    const t = text.trim().slice(0, 160);
    if (!t || done) return;
    const flag = isEmergency(t);
    const q = QUESTIONS[step];
    const value = q.key === "pain" ? parsePain(t) : t;
    const next: Msg[] = [{ from: "you", text: t, flag }];
    if (flag) {
      next.push({ from: "nurse", text: TRAUMA_LINE });
      setEmergency(true);
      setAnswers((a) => ({ ...a, complaint: a.complaint ?? t }));
    } else if (q.key === "pain" && value === undefined) {
      next.push({ from: "nurse", text: "Just a number from 1 to 10 is fine." });
    } else {
      setAnswers((a) => ({ ...a, [q.key]: value }));
      const s = step + 1;
      setStep(s);
      next.push({
        from: "nurse",
        text: s < QUESTIONS.length ? QUESTIONS[s].ask : CLOSING,
      });
    }
    setMsgs((m) => [...m, ...next]);
    setDraft("");
  }

  // The app finalises a red-flag intake on its own after 1.5 s
  // (patient/chat/page.tsx), without waiting for the button.
  useEffect(() => {
    if (!emergency || submitted) return;
    const t = setTimeout(() => submit(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergency, submitted]);

  function submit() {
    setSubmitted(true);
    setPane("review");
    setQueue((q) => [
      ...q.filter((p) => !p.mine),
      {
        id: "you",
        name: "You",
        complaint: answers.complaint ?? "Intake",
        level: suggested,
        arrived: clock,
        status: "SUBMITTED",
        mine: true,
      },
    ]);
  }

  function approve() {
    setApproved(true);
    setQueue((q) =>
      q.map((p) => (p.mine ? { ...p, level: finalLevel, status: "READY" } : p)),
    );
    setPane("queue");
  }

  function reset() {
    setMsgs([{ from: "nurse", text: QUESTIONS[0].ask }]);
    setStep(0);
    setAnswers({});
    setEmergency(false);
    setSubmitted(false);
    setOverride(null);
    setApproved(false);
    setQueue((q) => q.filter((p) => !p.mine));
    setPane("intake");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    say(draft);
  }

  const sorted = sortQueue(queue);
  const quick = done ? [] : QUESTIONS[step].quick;

  const tab = (p: Pane, label: string, enabled: boolean) => (
    <button
      type="button"
      role="tab"
      aria-selected={pane === p}
      aria-controls={`${id}-${p}`}
      {...NO_RESTORE}
      disabled={!enabled}
      onClick={() => setPane(p)}
      className={`min-h-11 flex-1 cursor-pointer border-b-2 px-2 text-micro disabled:cursor-not-allowed disabled:opacity-40 ${
        pane === p
          ? "border-copper text-silk"
          : "border-transparent text-silk-faint hover:text-silk"
      }`}
    >
      {label}
    </button>
  );

  // Below lg one pane at a time (tabs); from lg all three side by side.
  const paneClass = (p: Pane) =>
    `${pane === p ? "flex" : "hidden"} min-w-0 flex-col lg:flex`;

  return (
    <DemoFrame
      label="Triage Flow · intake to waiting room"
      meta="you play the patient, then the staff"
      caption={
        <>
          Three steps of the real app in one place. The red-flag check, the five
          levels, the SBAR summary shape and the waiting-room order (urgency
          first, then arrival time) all come from the Triage Flow code. The
          nurse is scripted here; in the app it is a language model (Llama 3.3),
          and its suggestion is only ever a suggestion: a staff member sets the
          final level. Try typing &ldquo;chest pain&rdquo; to see the red-flag
          path. Patients on the board are made up.
        </>
      }
    >
      <div ref={rootRef}>
        <div
          role="tablist"
          aria-label="Demo steps"
          className="flex border-b border-hairline lg:hidden"
        >
          {tab("intake", "1 · Intake", true)}
          {tab("review", "2 · Staff review", submitted)}
          {tab("queue", "3 · Waiting room", true)}
        </div>

        <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-hairline">
          {/* 1. Intake */}
          <section
            id={`${id}-intake`}
            aria-label="Patient intake"
            className={paneClass("intake")}
          >
            <h3 className="hidden px-4 pt-3 font-mono text-micro text-silk-faint lg:block">
              1 · patient intake
            </h3>
            <div
              ref={logRef}
              role="log"
              aria-live="polite"
              className="flex h-72 flex-col gap-2 overflow-y-auto px-4 py-3 text-micro"
            >
              <AnimatePresence initial={false}>
                {msgs.map((m, i) => (
                  <motion.p
                    key={i}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`max-w-[85%] rounded-trace px-3 py-2 leading-relaxed ${
                      m.from === "you"
                        ? `self-end border ${m.flag ? "border-copper text-copper" : "border-edge text-silk"}`
                        : "self-start bg-substrate text-silk-dim"
                    }`}
                  >
                    <span className="sr-only">
                      {m.from === "you" ? "You: " : "Nurse: "}
                    </span>
                    {m.text}
                    {m.flag && (
                      <span className="mt-1 block font-mono text-copper">
                        red flag matched
                      </span>
                    )}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>

            {quick.length > 0 && (
              <ul
                aria-label="Quick answers"
                className="flex flex-wrap gap-2 px-4 pb-3"
              >
                {quick.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => say(q)}
                      className="inline-flex min-h-8 cursor-pointer items-center rounded-trace border border-hairline px-2 text-micro text-silk-dim hover:border-copper hover:text-copper pointer-coarse:min-h-11"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto border-t border-hairline px-4 py-3">
              {done && !submitted ? (
                <button
                  type="button"
                  onClick={submit}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-trace border border-copper bg-copper px-4 text-micro font-semibold text-substrate hover:opacity-90"
                >
                  Submit Intake
                </button>
              ) : submitted ? (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-trace border border-edge px-4 text-micro text-silk-dim hover:border-copper hover:text-copper"
                >
                  Start a new intake
                </button>
              ) : (
                <form onSubmit={onSubmit} className="flex gap-2">
                  <label htmlFor={`${id}-msg`} className="sr-only">
                    Your answer
                  </label>
                  <input
                    id={`${id}-msg`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={160}
                    autoComplete="off"
                    placeholder="Or type your own answer"
                    className="min-h-11 min-w-0 flex-1 rounded-trace border border-edge bg-substrate px-3 text-micro text-silk placeholder:text-silk-faint focus-visible:border-copper"
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-trace border border-edge px-3 text-micro text-silk-dim hover:border-copper hover:text-copper"
                  >
                    Send
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* 2. Staff review */}
          <section
            id={`${id}-review`}
            aria-label="Staff review"
            className={paneClass("review")}
          >
            <h3 className="hidden px-4 pt-3 font-mono text-micro text-silk-faint lg:block">
              2 · staff review
            </h3>
            {submitted ? (
              <div className="flex flex-1 flex-col gap-3 px-4 py-3 text-micro">
                <dl className="space-y-2 rounded-trace border border-hairline bg-substrate p-3">
                  {(
                    [
                      ["S", "situation", report.situation],
                      ["B", "background", report.background],
                      ["A", "assessment", report.assessment],
                      ["R", "recommendation", report.recommendation],
                    ] as const
                  ).map(([k, name, text]) => (
                    <div key={k} className="flex gap-2">
                      <dt
                        className="w-5 shrink-0 font-mono text-copper"
                        title={name}
                      >
                        [{k}]
                      </dt>
                      <dd className="text-silk-dim">{text}</dd>
                    </div>
                  ))}
                </dl>
                <fieldset disabled={approved}>
                  <legend className="mb-2 text-silk-faint">
                    Final level (the AI only suggests; you decide)
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {([1, 2, 3, 4, 5] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        aria-pressed={finalLevel === l}
                        onClick={() => setOverride(l === suggested ? null : l)}
                        className={`inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-trace border font-mono disabled:cursor-default pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
                          finalLevel === l
                            ? "border-copper bg-copper text-substrate"
                            : "border-edge text-silk-dim hover:border-copper"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-silk-faint">
                    {override && override !== suggested
                      ? `Overriding the suggestion (L${suggested}) to L${override}.`
                      : `Suggested: L${suggested} ${LEVEL_NAMES[suggested].toLowerCase()}.`}
                  </p>
                </fieldset>
                <button
                  type="button"
                  onClick={approve}
                  {...NO_RESTORE}
                  disabled={approved}
                  className="mt-auto inline-flex min-h-11 cursor-pointer items-center justify-center rounded-trace border border-copper px-4 font-semibold text-copper hover:bg-copper hover:text-substrate disabled:cursor-default disabled:opacity-50"
                >
                  {approved
                    ? "Approved: patient is READY"
                    : "Approve and send to queue"}
                </button>
              </div>
            ) : (
              <p className="m-4 flex flex-1 items-center justify-center rounded-trace border border-dashed border-hairline p-6 text-center text-micro text-silk-faint">
                Finish the intake and press Submit Intake. The summary lands
                here for a staff member to check.
              </p>
            )}
          </section>

          {/* 3. Waiting room */}
          <section
            id={`${id}-queue`}
            aria-label="Waiting room"
            className={paneClass("queue")}
          >
            <div className="flex items-baseline justify-between px-4 pt-3">
              <h3 className="font-mono text-micro text-silk-faint">
                <span className="lg:hidden">waiting room</span>
                <span className="hidden lg:inline">3 · waiting room</span>
              </h3>
              <span className="font-mono text-micro text-silk-faint">
                {queue.filter((p) => p.status === "SUBMITTED").length} to review
                · {queue.filter((p) => p.status === "READY").length} ready
              </span>
            </div>
            <ol className="flex flex-col gap-1.5 px-4 py-3">
              {sorted.map((p, i) => (
                <motion.li
                  key={p.id}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  className={`flex items-center gap-2 rounded-trace border px-2.5 py-2 text-micro ${
                    p.mine ? "border-copper bg-copper-wash" : "border-hairline"
                  }`}
                >
                  <span className="w-4 font-mono text-silk-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate ${p.mine ? "text-copper" : "text-silk"}`}
                    >
                      {p.complaint}
                    </span>
                    <span className="font-mono text-silk-faint">
                      #{p.id} · {p.name} · {p.status.toLowerCase()}
                    </span>
                  </span>
                  <LevelBadge level={p.level} />
                </motion.li>
              ))}
            </ol>
            <p className="mt-auto px-4 pb-3 font-mono text-micro text-silk-faint">
              order by urgency_score asc, created_at asc
            </p>
          </section>
        </div>
      </div>
    </DemoFrame>
  );
}
