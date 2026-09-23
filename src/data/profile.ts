/**
 * Everything on the site that isn't a project. Supplied content only — nothing
 * inferred, nothing padded.
 */

export const ABOUT = [
  "Software Engineering (B.Eng.) and Business Management (B.Com.) student at McMaster University, blending technical problem-solving with strategic thinking.",
  "Focused on building scalable, real-world systems that align engineering execution with business impact.",
] as const;

export const EDUCATION = {
  school: "McMaster University",
  location: "Hamilton, ON",
  degrees: [
    "Bachelor of Engineering (B.Eng.) in Software Engineering",
    "Bachelor of Commerce (B.Com.) in Business Management",
  ],
} as const;

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

export const EXPERIENCE = [
  {
    role: "Academic Tutor & Peer Mentor",
    kind: "Volunteer & paid",
    period: "2025—Present",
    points: [
      "Taught the fundamentals of coding and logical thinking to children in the local community.",
      "Designed simple projects in Python and Scratch to build curiosity and confidence in programming.",
      "Encouraged teamwork, creativity and persistence in problem-solving.",
    ],
  },
] as const;

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

export const INVOLVEMENT = [
  {
    name: "McMaster Software Engineering Society & Engineering and Management Society",
    note: "Active member — technical workshops, peer learning, industry events.",
  },
  {
    name: "McMaster Engineering Software Competition",
    note: "Placed top 5 of all contestants.",
  },
  {
    name: "United Nations Sustainable Development Goals Competition",
    note: "Multidisciplinary team building a tech-driven solution aligned with UN SDGs.",
  },
] as const;
