/**
 * The knowledge base behind "Ask about me".
 *
 * Built from the same data files the page renders (projects, profile,
 * skills, site config), so the assistant cannot say something the site does
 * not, and an edit to a project updates both at once. The few facts that are
 * not on the page come from the owner's résumé and are listed in
 * `RESUME_EXTRAS` below, each one visible and reviewable.
 *
 * Scope, as the owner set it on 2026-10-21: what is on this site, the tech
 * stacks, and what is public on the résumé, LinkedIn and GitHub. Nothing
 * else. The business on the résumé is deliberately left out for now.
 */

import { CONTACT, RESUME_PATH, SITE } from "@/config/site";
import {
  ABOUT,
  CERTIFICATIONS,
  EDUCATION,
  INVOLVEMENT,
  RECOGNITION,
} from "@/data/profile";
import { PROJECTS, type Project } from "@/data/projects";
import { SKILL_GROUPS } from "@/data/skills";
import { buildIndex, type Entry, type Phrase } from "@/lib/ask/engine";

/** From the résumé supplied on 2026-10-21. Not shown elsewhere on the page. */
const RESUME_EXTRAS = {
  graduation: "May 2029",
  /** Listed on the résumé but not in the site's skill groups. */
  skills: [
    "Next.js",
    "Docker",
    "Maven",
    "Data Structures & Algorithms",
    "Computer Architecture",
    "Databases",
  ],
} as const;

/** Supplied by the owner in chat on 2026-10-22, for the assistant only. */
const PERSONAL = {
  born: { year: 2006, month: 0 }, // January 2006
  hobbies: ["working out", "soccer", "basketball", "pickleball"],
} as const;

/**
 * Age from the birth month, worked out in the browser when the page loads, so it
 * never goes stale. The day isn't given, so January says "turns N".
 */
function ageText(now = new Date()) {
  const age = now.getFullYear() - PERSONAL.born.year;
  return now.getMonth() === PERSONAL.born.month
    ? `${age - 1}, turning ${age} this month`
    : `${now.getMonth() > PERSONAL.born.month ? age : age - 1}`;
}

const list = (items: readonly string[]) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const sentence = (s: string) => s.trim().replace(/([^.!?])$/, "$1.");

function projectEntries(p: Project): Entry[] {
  const anchor = { href: `#work-${p.id}`, label: `${p.name} on this page` };
  const repo = p.links.find((l) => l.kind !== "demo");
  const demo = p.links.find((l) => l.kind === "demo");
  const status = p.status ? ` Status: ${p.status.detail.toLowerCase()}.` : "";
  return [
    {
      id: `${p.id}`,
      primary: [p.name],
      title: `What is ${p.name}?`,
      keywords: [p.name, p.tagline, "about", "overview", "what"],
      answer: `${p.name} (${p.tagline}). ${p.description[0]}${status}`,
      link: anchor,
      related: [`${p.id}-how`, `${p.id}-stack`],
    },
    {
      id: `${p.id}-how`,
      primary: [p.name, "work", "works", "architecture", "design"],
      title: `How does ${p.name} work?`,
      keywords: [p.name, "how", "works", "architecture", "design", "details"],
      answer: [p.description.slice(1).join(" "), ...p.details.slice(0, 2)]
        .filter(Boolean)
        .map(sentence)
        .join(" "),
      link: anchor,
      related: [`${p.id}-stack`],
    },
    {
      id: `${p.id}-stack`,
      primary: [p.name, "stack", "tech"],
      title: `${p.name} tech stack`,
      keywords: [p.name, "stack", "technologies", "built with", "languages"],
      answer:
        `${p.name} uses ${list(p.stack)}.` +
        (p.team ? ` ${sentence(p.team)}` : " A solo project.") +
        (demo ? ` There is a live demo at ${demo.href}.` : "") +
        (repo
          ? repo.kind === "repo-private"
            ? " The repository is private."
            : ` Code: ${repo.href}`
          : ""),
      link: demo
        ? { href: demo.href, label: "Live demo" }
        : repo && repo.kind === "repo"
          ? { href: repo.href, label: "Repository" }
          : anchor,
      related: [`${p.id}`],
    },
  ];
}

function skillEntries(): Entry[] {
  const out: Entry[] = [];
  for (const group of SKILL_GROUPS) {
    for (const skill of group.skills) {
      const used = skill.projects.map((p) => p.name);
      const where =
        group.name === "Also in the projects"
          ? `It appears in the stack of ${list(used)}`
          : `It is listed under ${group.name.toLowerCase()}` +
            (used.length ? `, and used in ${list(used)}` : "");
      out.push({
        id: `skill-${skill.label}`,
        primary: [...skill.label.split("/"), "experience"],
        title: skill.label,
        keywords: skill.label.split("/"),
        answer: `Yes. ${where}.`,
        link: { href: "#skills", label: "Skills" },
      });
    }
  }
  for (const label of RESUME_EXTRAS.skills) {
    if (out.some((e) => e.id === `skill-${label}`)) continue;
    out.push({
      id: `skill-${label}`,
      primary: [label, "experience"],
      title: label,
      keywords: [label],
      answer: `Yes. ${label} is among the skills he lists.`,
      link: RESUME_PATH
        ? { href: RESUME_PATH, label: "Résumé (PDF)" }
        : undefined,
    });
  }
  return out;
}

const PROJECT_IDS = PROJECTS.map((p) => p.id);

export const ENTRIES: readonly Entry[] = [
  {
    id: "about",
    primary: ["background", "bio", "summary"],
    title: "Who is Youssef?",
    keywords: ["who", "about", "background", "summary", "introduce", "bio"],
    answer: `${SITE.name} is a ${SITE.role.toLowerCase()} at ${SITE.school} in ${SITE.location}. ${ABOUT.join(" ")} ${SITE.availability}.`,
    link: { href: "#about", label: "About" },
    related: ["availability", "projects", "education"],
  },
  {
    id: "availability",
    primary: ["coop", "availability"],
    title: "Is he looking for a co-op?",
    keywords: ["coop", "availability", "seeking", "looking", "open", "term"],
    answer: `Yes. ${SITE.availability}. He's looking for an inclusive team where he can learn and connect with the people around him. The quickest way to reach him is email: ${CONTACT.email}.`,
    link: { href: "#contact", label: "Contact" },
    related: ["contact", "resume"],
  },
  {
    id: "education",
    primary: ["education", "gpa", "graduation"],
    title: "What is he studying?",
    keywords: ["education", "gpa", "graduation", "graduate", "year"],
    answer: `${EDUCATION.degrees.join(", ")} at ${EDUCATION.school}, ${EDUCATION.location}, expected to graduate in ${RESUME_EXTRAS.graduation}. GPA ${EDUCATION.gpa}, Dean's Honour List.`,
    link: { href: "#about", label: "About" },
    related: ["awards", "skills"],
  },
  {
    id: "awards",
    primary: ["award", "recognition"],
    title: "Awards and recognition",
    keywords: ["award", "recognition", "achievement", "honour", "dean"],
    answer: `${list(RECOGNITION.map((r) => ("detail" in r && r.detail ? `${r.name} (${r.detail})` : r.name)))}.`,
    link: { href: "#about", label: "About" },
    related: ["involvement"],
  },
  {
    id: "certifications",
    primary: ["certification", "french", "delf"],
    title: "Certifications and languages",
    keywords: ["certification", "french", "language", "spoken", "delf", "ibm"],
    answer: CERTIFICATIONS.map(
      (c) => `${c.name}, ${c.issuer}, ${c.date}.${c.note ? ` ${c.note}` : ""}`,
    ).join(" "),
    link: { href: "#about", label: "About" },
  },
  {
    id: "contact",
    primary: ["contact", "linkedin", "github"],
    title: "How do I contact him?",
    keywords: ["contact", "linkedin", "github", "reach", "talk", "connect"],
    answer: `Email ${CONTACT.email}, or use the form at the bottom of this page. LinkedIn: ${CONTACT.linkedin}. GitHub: ${CONTACT.github}.`,
    link: { href: "#contact", label: "Contact" },
    related: ["resume"],
  },
  {
    id: "resume",
    primary: ["resume"],
    title: "Can I see his résumé?",
    keywords: ["resume", "pdf", "download"],
    answer: RESUME_PATH
      ? "Yes. His résumé is a PDF you can download from this site."
      : `It isn't posted on this site, but he'll send it on request: ${CONTACT.email}.`,
    link: RESUME_PATH
      ? { href: RESUME_PATH, label: "Résumé (PDF)" }
      : { href: "#contact", label: "Contact" },
  },
  {
    id: "age",
    primary: ["age"],
    title: "How old is he?",
    keywords: ["age", "old", "born", "birthday"],
    answer: `He's ${ageText()} (born January 2006). He's a ${SITE.role.toLowerCase()} at ${SITE.school}, expected to graduate in ${RESUME_EXTRAS.graduation}.`,
    link: { href: "#about", label: "About" },
    related: ["education", "hobby"],
  },
  {
    id: "hobby",
    primary: ["hobby"],
    title: "What does he do outside class?",
    keywords: [
      "hobby",
      "interest",
      "fun",
      "free time",
      "outside",
      "personal",
      "sport",
      "gym",
      "workout",
      ...PERSONAL.hobbies,
    ],
    answer: `Outside class he's into ${list(PERSONAL.hobbies)}. He also tutors kids in his local community, teaching coding and logical thinking with small Python and Scratch projects. He's also active in the McMaster Software Engineering Society, the Engineering and Management Society and Google Developer Group on Campus, and he builds side projects like the five on this page. For anything more personal, ask him: ${CONTACT.email}.`,
    link: { href: "#involvement", label: "Involvement" },
    related: ["involvement", "projects"],
  },
  {
    id: "strength",
    primary: ["strength"],
    title: "What makes him stand out?",
    keywords: ["strength", "stand out", "unique", "fit", "qualities", "why"],
    answer: `He's a strong fit for the roles he takes on, and he aims to meet expectations and then exceed them. He pairs engineering with business: he's in McMaster's combined Software Engineering & Management program with a ${EDUCATION.gpa} GPA and a spot on the Dean's Honour List. He builds working systems end to end, from a Kafka market-data pipeline (TradeWatch) to raw-socket network tools in C (WireFish) and a deployed AI triage app (Triage Flow), and he placed top 5 in the McMaster Engineering Software Competition.`,
    link: { href: "#work", label: "Projects" },
    related: ["projects", "education", "availability"],
  },
  {
    id: "personality",
    primary: ["personality"],
    title: "What is he like to work with?",
    keywords: [
      "personality",
      "character",
      "like",
      "describe",
      "person",
      "pressure",
      "attitude",
      "kind",
      "positive",
      "helpful",
      "social",
      "player",
    ],
    answer:
      "In his own words, he's a talented problem solver who stays relaxed and works well under pressure. He's helpful, social, understanding and kind, and he works with a positive mindset.",
    related: ["culture", "strength", "hobby"],
  },
  {
    id: "culture",
    primary: ["culture"],
    title: "What is he looking for in an internship?",
    keywords: ["culture", "environment", "workplace", "ideal", "goal", "want"],
    answer: `He wants to build a real connection with the community at his internship, in an inclusive environment where he can keep learning, and he brings a positive mindset to it. ${SITE.availability}.`,
    link: { href: "#contact", label: "Contact" },
    related: ["availability", "personality"],
  },
  // Football, at the owner's request (2026-10-22): the assistant is firmly
  // Team Ronaldo. Every stat here is checkable.
  {
    id: "goat",
    primary: ["goat"],
    title: "Who is the GOAT of football?",
    keywords: ["goat", "greatest", "football", "ronaldo", "ever", "all time"],
    answer:
      "Cristiano Ronaldo. Five Ballon d'Ors, five Champions League titles, the Euros with Portugal, league titles in England, Spain and Italy, the most goals in men's international football, and the first player to score 900 official goals. Not up for debate. SIUUU.",
    related: ["football", "messi"],
  },
  // Insult-shaped questions must never land on a Ronaldo answer that reads
  // as agreement. They come here instead, and the answer always defends him.
  {
    id: "worst",
    primary: ["worst"],
    requires: ["football", "ronaldo", "messi", "goat"],
    title: "Who is the worst / most overrated player?",
    keywords: ["worst", "overrated", "bad", "trash", "ronaldo", "football"],
    answer:
      "Definitely not Cristiano Ronaldo. He's the greatest of all time, and the trophies and 900+ goals prove it. If you're looking for overrated, try Messi.",
    related: ["goat", "messi"],
  },
  {
    id: "messi",
    primary: ["messi"],
    title: "What about Messi?",
    keywords: ["messi", "leo", "argentina", "barcelona", "vs", "better"],
    answer:
      "Messi? Talented, sure. But he spent most of his career in one league at one club built around him. Ronaldo went to England, Spain and Italy and won the league in all three, won the Champions League with two different clubs, and has more official goals. Ronaldo is the GOAT.",
    related: ["goat"],
  },
  {
    id: "football",
    primary: ["football", "ronaldo"],
    title: "Is he into football?",
    keywords: ["football", "soccer", "ronaldo", "cr7", "fan", "team", "ballon"],
    answer:
      "Very. He plays soccer himself, and he's Team Ronaldo all the way: CR7 is the hardest worker the sport has seen and the greatest of all time. Ask me who the GOAT is.",
    related: ["goat", "hobby"],
  },
  {
    id: "joke",
    primary: ["joke"],
    title: "Tell me a joke",
    keywords: ["joke", "funny", "laugh"],
    answer:
      "Why did the Kafka consumer break up with the producer? It needed some space to process things at its own offset.",
    related: ["goat"],
  },
  {
    id: "demo",
    primary: ["demo"],
    title: "Can I try his projects?",
    keywords: ["demo", "try", "play", "interactive", "live"],
    answer:
      "Yes. Every project on this page has a demo you can use right here: drive TradeWatch's Kafka pipeline and anomaly check, go through Triage Flow as a patient and then as staff, file reports on BridgeAid's map, type real WireFish commands, and step through the Catan AI's turn. Each caption says what is real and what is simulated.",
    link: { href: "#work", label: "Projects" },
    related: PROJECT_IDS.slice(0, 3),
  },
  {
    id: "location",
    primary: ["location", "hamilton"],
    title: "Where is he based?",
    keywords: ["location", "hamilton", "ontario", "canada"],
    answer: `${SITE.location}, studying at ${SITE.school}.`,
  },
  {
    id: "projects",
    primary: ["project"],
    title: "What has he built?",
    keywords: ["project", "portfolio", "list", "all"],
    answer: `Five projects: ${PROJECTS.map((p) => `${p.name} (${p.tagline})`).join("; ")}.`,
    link: { href: "#work", label: "Projects" },
    related: PROJECT_IDS.slice(0, 3),
  },
  ...PROJECTS.flatMap(projectEntries),
  {
    id: "skills",
    primary: ["skill"],
    title: "What are his skills?",
    keywords: ["skill", "languages", "frameworks", "tools", "stack"],
    answer: SKILL_GROUPS.slice(0, -1)
      .map((g) => `${g.name}: ${list(g.skills.map((s) => s.label))}.`)
      .join(" "),
    link: { href: "#skills", label: "Skills" },
  },
  ...skillEntries(),
  {
    id: "involvement",
    primary: ["involvement", "tutor", "mentor"],
    title: "Clubs, roles and competitions",
    keywords: [
      "involvement",
      "club",
      "society",
      "tutor",
      "mentor",
      "volunteer",
      "leadership",
      "tutor",
      "teach",
      "kids",
    ],
    answer: INVOLVEMENT.map(
      (i) => `${i.title}: ${i.role}${i.period ? ` (${i.period})` : ""}.`,
    ).join(" "),
    link: { href: "#involvement", label: "Involvement" },
  },
  {
    id: "site",
    primary: ["site", "website", "chatbot", "assistant", "bot"],
    title: "How was this site built?",
    keywords: [
      "site",
      "website",
      "built",
      "nextjs",
      "chatbot",
      "bot",
      "assistant",
    ],
    answer:
      "This site is a static Next.js app in TypeScript with Tailwind CSS, hosted on Vercel. This assistant runs entirely in your browser: it matches your question against a knowledge base written from the site's own content, so it never calls an AI service and cannot make things up.",
  },
];

/** Multi-word technology names, folded to single tokens before matching. */
const PHRASES: readonly Phrase[] = [
  ...new Set(
    [
      ...SKILL_GROUPS.flatMap((g) => g.skills.map((s) => s.label)),
      ...PROJECTS.flatMap((p) => p.stack),
      ...RESUME_EXTRAS.skills,
    ]
      .flatMap((l) => l.split("/"))
      .map((l) =>
        l
          .replace(/\s*\(.*?\)\s*/g, "")
          .toLowerCase()
          .trim(),
      )
      .filter((l) => l.includes(" ")),
  ),
].map((phrase) => [phrase, phrase.replace(/[^a-z0-9]/g, "")] as const);

export const INDEX = buildIndex(ENTRIES, PHRASES);

export const SUGGESTIONS = [
  "Is he looking for a co-op?",
  "What is TradeWatch?",
  "What are his skills?",
  "How do I contact him?",
] as const;

export const ENTRY_BY_ID: ReadonlyMap<string, Entry> = new Map(
  ENTRIES.map((e) => [e.id, e]),
);
