/**
 * The rules behind the Triage Flow demo, taken from the Triage Flow repo.
 *
 *  - `RED_FLAGS` and `isEmergency` are copied from src/app/api/chat/route.ts.
 *    Any message containing one of these phrases skips the conversation: the
 *    reply is the fixed trauma-team line and the intake is finalised at
 *    Level 1.
 *  - The five levels and their names are from src/components/UrgencyBadge.tsx.
 *  - `sortQueue` is the staff dashboard's SQL ordering
 *    (src/app/api/staff/sessions/route.ts):
 *    `ORDER BY urgency_score ASC, created_at ASC`.
 *  - The SBAR shape (Situation, Background, Assessment, Recommendation) is
 *    the scribe prompt's in src/app/api/triage/finalize/route.ts.
 *
 * What the demo does NOT reproduce: the nurse and the scribe are a language
 * model (Llama 3.3 via Groq) in the real app. Here the nurse asks fixed
 * questions and the summary is a template, so the demo can run in the
 * browser for free and never says something medical it shouldn't. That is
 * stated on the page.
 */

export const RED_FLAGS = [
  "dying",
  "chest pain",
  "cannot breathe",
  "severe bleeding",
  "10/10",
  "bleeding a lot",
] as const;

export const isEmergency = (message: string) =>
  RED_FLAGS.some((flag) => message.toLowerCase().includes(flag));

/** The app's fixed reply to a red flag, verbatim. */
export const TRAUMA_LINE =
  "I am alerting the trauma team now. Please click 'Submit Intake' below immediately.";

export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVEL_NAMES: Record<Level, string> = {
  1: "Emergent",
  2: "Urgent",
  3: "Moderate",
  4: "Low",
  5: "Non-Urgent",
};

/* ------------------------------------------------------------------ *
 * The scripted nurse
 * ------------------------------------------------------------------ */

export type Answers = {
  complaint?: string;
  duration?: string;
  pain?: number;
};

export type Question = {
  key: keyof Answers;
  ask: string;
  /** Tap-to-answer options, so the demo works without typing on a phone. */
  quick: readonly string[];
};

export const QUESTIONS: readonly Question[] = [
  {
    key: "complaint",
    ask: "Hi, I'm the intake nurse. What brings you in today?",
    quick: [
      "Twisted my ankle playing soccer",
      "Bad headache and a fever",
      "Rash on both arms",
      "Chest pain when I breathe",
    ],
  },
  {
    key: "duration",
    ask: "I'm sorry to hear that. How long has this been going on?",
    quick: ["Since this morning", "About two days", "Over a week"],
  },
  {
    key: "pain",
    ask: "On a scale of 1 to 10, how bad is the pain right now?",
    quick: ["3", "6", "8"],
  },
] as const;

export const CLOSING =
  "Thank you. I have all the details. Please click the 'Submit Intake' button below to alert our medical team.";

/** Reads a pain score out of free text ("about a 7", "7/10", "7"). */
export function parsePain(text: string): number | undefined {
  const m = text.match(/\b(10|[1-9])\b/);
  return m ? Number(m[1]) : undefined;
}

/* ------------------------------------------------------------------ *
 * Summary and suggested level
 * ------------------------------------------------------------------ */

/**
 * The suggested level. A stand-in for the scribe model's judgement, kept
 * deliberately simple and visible: the point of the demo is what happens
 * around it (a person reviews it and can override it), not the rule itself.
 */
export function suggestLevel(a: Answers, emergency: boolean): Level {
  if (emergency) return 1;
  const pain = a.pain ?? 0;
  if (pain >= 8) return 2;
  if (pain >= 5) return 3;
  if (/week/i.test(a.duration ?? "")) return 5;
  return 4;
}

export type Sbar = {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
};

export function sbar(a: Answers, emergency: boolean, level: Level): Sbar {
  const complaint = a.complaint?.trim() || "Not stated";
  return {
    situation: emergency
      ? `Red-flag statement during intake: "${complaint}". Conversation stopped and escalated.`
      : `Presents with: ${complaint.toLowerCase()}.`,
    background: emergency
      ? "Not collected. Intake ended at the red flag."
      : `Onset: ${(a.duration ?? "not stated").toLowerCase()}. No profile on file (demo).`,
    assessment: emergency
      ? "Possible time-critical presentation."
      : `Self-reported pain ${a.pain ?? "?"}/10.`,
    recommendation: `Suggested urgency: Level ${level} (${LEVEL_NAMES[level]}). For staff review.`,
  };
}

/* ------------------------------------------------------------------ *
 * The staff queue
 * ------------------------------------------------------------------ */

export type Status = "SUBMITTED" | "READY";

export type Patient = {
  id: string;
  name: string;
  complaint: string;
  level: Level;
  /** Minutes since the board opened. Stands in for `created_at`. */
  arrived: number;
  status: Status;
  mine?: boolean;
};

/** `ORDER BY urgency_score ASC, created_at ASC`. */
export function sortQueue(patients: readonly Patient[]): Patient[] {
  return [...patients].sort(
    (a, b) => a.level - b.level || a.arrived - b.arrived,
  );
}

/** Made-up patients, so the board is not empty. Names are initials only. */
export const SEED_QUEUE: readonly Patient[] = [
  {
    id: "1038",
    name: "M. K.",
    complaint: "Laceration, left hand",
    level: 3,
    arrived: 2,
    status: "READY",
  },
  {
    id: "1039",
    name: "A. R.",
    complaint: "Shortness of breath",
    level: 2,
    arrived: 5,
    status: "READY",
  },
  {
    id: "1040",
    name: "J. T.",
    complaint: "Lower back pain",
    level: 4,
    arrived: 7,
    status: "READY",
  },
  {
    id: "1041",
    name: "S. P.",
    complaint: "Sore throat",
    level: 5,
    arrived: 9,
    status: "SUBMITTED",
  },
];

/** Walk-ins that arrive while the board is on screen. */
export const ARRIVALS: readonly Omit<Patient, "id" | "arrived" | "status">[] = [
  { name: "D. L.", complaint: "Sprained wrist", level: 4 },
  { name: "N. B.", complaint: "High fever, child", level: 3 },
  { name: "E. W.", complaint: "Allergic reaction, lips swelling", level: 2 },
  { name: "G. H.", complaint: "Medication refill", level: 5 },
  { name: "R. C.", complaint: "Head injury, dizzy", level: 2 },
];
