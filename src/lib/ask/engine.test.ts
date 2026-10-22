import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ask, buildIndex, editDistance, tokenize } from "./engine.ts";
import { INDEX, SUGGESTIONS } from "@/lib/ask/knowledge";

/**
 * Run with `npm test`. Most of these run against the real knowledge base, so
 * a content edit that breaks an answer, or makes the assistant claim a skill
 * it should not, fails here.
 */

const answerId = (q: string) => {
  const r = ask(INDEX, q);
  return r.kind === "answer" ? r.entry.id : "unknown";
};

describe("tokenize", () => {
  it("drops filler, stems, and maps synonyms", () => {
    assert.deepEqual(tokenize("What is his CV?"), ["resume"]);
    assert.deepEqual(tokenize("internships"), ["coop"]);
  });

  it("keeps symbols that matter in technology names", () => {
    assert.deepEqual(tokenize("C++ and Next.js"), ["cpp", "nextjs"]);
  });

  it("folds known phrases into one token", () => {
    assert.deepEqual(
      tokenize("GitHub Actions", [["github actions", "githubactions"]]),
      ["githubactions"],
    );
  });
});

describe("editDistance", () => {
  it("counts single edits", () => {
    assert.equal(editDistance("kafka", "kafka"), 0);
    assert.equal(editDistance("tradewach", "tradewatch"), 1);
    assert.equal(editDistance("kitten", "sitting", 5), 3);
  });
});

describe("ask, on a fixture", () => {
  // BM25 needs a corpus to judge rarity against, so pad the fixture.
  const filler = Array.from({ length: 10 }, (_, i) => ({
    id: `f${i}`,
    title: `Filler ${i}`,
    keywords: ["padding"],
    answer: "Nothing to see.",
  }));
  const index = buildIndex([
    {
      id: "a",
      title: "Apples",
      keywords: ["fruit"],
      answer: "Apples are red.",
    },
    { id: "b", title: "Boats", keywords: ["sea"], answer: "Boats float." },
    ...filler,
  ]);

  it("returns the best match", () => {
    const r = ask(index, "tell me about apples");
    assert.equal(r.kind, "answer");
    assert.equal(r.kind === "answer" && r.entry.id, "a");
  });

  it("says unknown when nothing matches", () => {
    assert.equal(ask(index, "quantum chromodynamics").kind, "unknown");
    assert.equal(ask(index, "").kind, "unknown");
  });
});

describe("ask, on the real knowledge base", () => {
  const cases: [string, string][] = [
    ["Is he looking for an internship?", "availability"],
    ["is he available for a co-op", "availability"],
    ["what's his GPA", "education"],
    ["where does he study", "education"],
    ["tell me about TradeWatch", "tradewatch"],
    ["tradewach", "tradewatch"],
    ["what tech does triage flow use", "triage-flow-stack"],
    ["how does wirefish work", "wirefish-how"],
    ["does he know Kafka", "skill-Kafka"],
    ["is he good at java", "skill-Java"],
    ["c++", "skill-C++"],
    ["github actions experience", "skill-GitHub Actions"],
    ["how can I email him", "contact"],
    ["can I see his cv", "resume"],
    ["where is he based", "location"],
    ["does he speak french", "certifications"],
    ["what clubs is he in", "involvement"],
    ["how old is he", "age"],
    ["when was he born", "age"],
    ["what are his hobbies", "hobby"],
    ["what does he do for fun", "hobby"],
    ["what are his strengths", "strength"],
    ["can I try a demo", "demo"],
    ["does he play sports", "hobby"],
    ["does he play soccer", "football"],
    ["who is the goat of football", "goat"],
    ["who is the GOAT", "goat"],
    ["who is the greatest football player ever", "goat"],
    ["is messi better than ronaldo", "messi"],
    ["what about messi", "messi"],
    ["cr7", "football"],
    ["tell me a joke", "joke"],
    ["who is the worst football player", "worst"],
    ["who is the worst footballer", "worst"],
    ["is ronaldo overrated", "worst"],
    ["ronaldo is trash", "worst"],
    ["cristiano sucks", "worst"],
    ["is ronaldo worse than messi", "worst"],
    ["who is the most overrated footballer", "worst"],
    ["is he a ronaldo fan", "football"],
    ["what is his personality like", "personality"],
    ["how would you describe him", "personality"],
    ["does he work well under pressure", "personality"],
    ["is he a team player", "personality"],
    ["what kind of work environment does he want", "culture"],
    ["does he have teaching experience", "involvement"],
  ];
  for (const [q, id] of cases) {
    it(`"${q}" → ${id}`, () => assert.equal(answerId(q), id));
  }

  // The important half: it must not answer what it does not know.
  const unknowns = [
    "does he know Rust",
    "does he have Kubernetes experience",
    "what's his favourite food",
    "what is his salary expectation",
    "asdfghjkl",
  ];
  for (const q of unknowns) {
    it(`"${q}" → unknown`, () => assert.equal(answerId(q), "unknown"));
  }

  it("never gives a football answer to a question about him", () => {
    for (const q of [
      "what is his worst project",
      "is he bad at java",
      "is he a bad programmer",
    ])
      assert.notEqual(answerId(q), "worst", q);
  });

  it("never answers a Ronaldo insult with agreement", () => {
    for (const q of [
      "who is the worst football player",
      "is ronaldo overrated",
      "cristiano is washed",
      "ronaldo is a fraud",
    ])
      assert.equal(answerId(q), "worst", q);
  });

  it("answers every suggested question", () => {
    for (const q of SUGGESTIONS) assert.notEqual(answerId(q), "unknown", q);
  });
});
