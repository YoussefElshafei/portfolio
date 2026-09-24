/**
 * Everything on the site that isn't a project. Supplied content only — nothing
 * inferred, nothing padded.
 */

export const ABOUT = [
  "Software Engineering and Business Management (B.Eng.Mgt) student at McMaster University, blending technical problem-solving with strategic thinking.",
  "Focused on building scalable, real-world systems that align engineering execution with business impact.",
] as const;

export const EDUCATION = {
  school: "McMaster University",
  location: "Hamilton, ON",
  degrees: [
    "Bachelor of Software Engineering and Business Management (B.Eng.Mgt)",
  ],
  /**
   * On the 4-point scale, per McMaster's own conversion from its 12-point
   * scale (confirmed by the owner).
   */
  gpa: "4.0 / 4.0",
} as const;

/**
 * Short recognition lines for the About profile. The SDG competition is written
 * up in full under Involvement, so here it gets one line and a pointer there,
 * not a second write-up.
 *
 * No percentile or class-rank claim appears anywhere on the site. One was seen
 * on a reference site during research and was never verified, so it is not
 * stated as fact.
 */
export const RECOGNITION = [
  { name: "Dean's Honour List", detail: "McMaster University" },
  // Awarding body not supplied, so no detail line rather than a guessed one.
  { name: "Award of Excellence" },
  {
    name: "UN Sustainable Development Goals Competition",
    detail: "Multidisciplinary team, technology driven solution",
    href: "#involvement",
  },
] as const;

export type SkillGroup = { name: string; items: readonly string[] };

export const SKILLS: readonly SkillGroup[] = [
  {
    name: "Languages & frameworks",
    items: [
      "Java",
      "C",
      "Python",
      "Bash",
      "C++",
      "HTML/CSS",
      "JavaScript",
      "React",
      "Flask",
      "Vite",
    ],
  },
  {
    name: "Tools & OS",
    items: [
      "Linux/Ubuntu",
      "Git",
      "GitHub Actions",
      "Quartus Prime",
      "AutoCAD",
      "Autodesk Inventor",
      "Adobe Premiere Pro",
    ],
  },
  {
    name: "Concepts",
    items: [
      "Object-Oriented Programming",
      "Full-Stack Development",
      "Frontend & Backend Development",
      "Algorithms",
      "Shell Scripting",
      "Continuous Integration",
      "Software Design",
      "CAD Design",
      "Product Development",
      "Version Control",
    ],
  },
];

export type Certification = {
  name: string;
  issuer: string;
  /** Machine fact, rendered in mono. */
  date: string;
  note?: string;
};

export const CERTIFICATIONS: readonly Certification[] = [
  {
    name: "DELF B1 — French Language Diploma",
    issuer: "Ministère de l'Éducation nationale",
    date: "Jul 2024",
    note: "Certified independent user, CEFR B1 level.",
  },
  {
    name: "Exploring Cybersecurity",
    issuer: "IBM SkillsBuild",
    date: "Sep 2026",
  },
];

export type InvolvementKind = "ROLE" | "SOCIETY" | "COMPETITION" | "CLUB";

export type InvolvementEntry = {
  title: string;
  org: string;
  kind: InvolvementKind;
  /**
   * Only where a date range is actually confirmed. Omitted rather than
   * guessed: an invented year would be a claim, and the timeline is laid out
   * so a dateless entry looks intentional rather than missing something.
   */
  period?: string;
  description: string;
};

/**
 * One timeline for experience and involvement together. The tutoring role
 * used to be its own "Experience" section of one entry; it now leads this
 * list, as the only entry with a confirmed date range.
 */
export const INVOLVEMENT: readonly InvolvementEntry[] = [
  {
    title: "Academic Tutor & Peer Mentor",
    org: "Local community, volunteer & paid",
    kind: "ROLE",
    period: "2025—Present",
    description:
      "Taught the fundamentals of coding and logical thinking to children in the local community. Designed simple Python and Scratch projects to build curiosity and confidence, and encouraged teamwork, creativity and persistence in problem-solving.",
  },
  {
    title: "Active member",
    org: "McMaster Software Engineering Society & Engineering and Management Society",
    kind: "SOCIETY",
    description: "Technical workshops, peer learning and industry events.",
  },
  {
    title: "Top 5 finish",
    org: "McMaster Engineering Software Competition",
    kind: "COMPETITION",
    description: "Placed top 5 of all contestants.",
  },
  {
    title: "Team member",
    org: "United Nations Sustainable Development Goals Competition",
    kind: "COMPETITION",
    description:
      "Multidisciplinary team building a tech-driven solution aligned with UN SDGs.",
  },
  {
    title: "Member",
    org: "Google Developer Group on Campus, McMaster University",
    kind: "CLUB",
    description:
      "Participates in workshops and community events centered on Google's developer tools and cloud technologies.",
  },
];
