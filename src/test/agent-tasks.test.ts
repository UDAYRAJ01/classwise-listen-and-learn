import { describe, expect, it } from "vitest";
import { agentWriterInstructions } from "@/lib/server/prompts.server";
import { SUBJECTS } from "@/lib/catalog";

const english = SUBJECTS["english"]!;
const hindi = SUBJECTS["hindi"]!;
const source = "My bicycle is red. It has a blue seat and black tyres.";

const base = {
  board: "cbse" as const,
  grade: 2,
  subject: english,
  chapterTitle: "My Bicycle",
  bookName: "Mridang",
  gist: "A child describes a colourful bicycle.",
  source,
};

describe("agentWriterInstructions", () => {
  it("names the exact chapter, book and class the task is for", () => {
    const text = agentWriterInstructions({ ...base, lang: "en" });
    expect(text).toContain("Board: CBSE · NCERT (CBSE).");
    expect(text).toContain("Class: 2.");
    expect(text).toContain("Subject: English.");
    expect(text).toContain("Book: Mridang.");
    expect(text).toContain("Chapter: My Bicycle.");
    expect(text).toContain("Chapter is about: A child describes a colourful bicycle.");
  });

  it("puts the stored textbook text in verbatim so nothing is invented", () => {
    const text = agentWriterInstructions({ ...base, lang: "en" });
    expect(text).toContain(`<<<\n${source}\n>>>`);
    expect(text).toContain("OFFICIAL TEXTBOOK CHAPTER TEXT");
  });

  it("asks for one complete note instead of the app's three parts", () => {
    const text = agentWriterInstructions({ ...base, lang: "en" });
    expect(text).toContain("Write the COMPLETE note in one JSON object");
    expect(text).toContain("title, oneLiner, summary, keyPoints, keyTerms, formulas, tricks, questions, quickRevision, examTips, funFact, mcqs and mistakes");
    expect(text).not.toContain("first half of the notes");
    expect(text).not.toContain("second half of the notes");
    expect(text).toContain("do not write audio");
  });

  it("sizes the note for a young child in Class 2", () => {
    const text = agentWriterInstructions({ ...base, lang: "en" });
    expect(text).toContain("Student is a young child (Class 1-5)");
    expect(text).toContain("keyPoints 3-5 groups with 2-4 points each");
    expect(text).toContain("mcqs: 5 questions");
  });

  it("sizes the note for Class 11 instead", () => {
    const text = agentWriterInstructions({ ...base, grade: 11, lang: "en" });
    expect(text).toContain("Student is in Class 11-12 (board + entrance level)");
    expect(text).toContain("mcqs: 10-12 questions");
    expect(text).not.toContain("Student is a young child (Class 1-5)");
  });

  it("keeps each language's own writing rule", () => {
    expect(agentWriterInstructions({ ...base, lang: "hinglish" })).toContain("Never use Devanagari script");
    expect(agentWriterInstructions({ ...base, lang: "hi" })).toContain("Devanagari script");
    expect(agentWriterInstructions({ ...base, lang: "en" })).toContain("simple, clear Indian-school English");
  });

  it("keeps Hindi verses in Devanagari even when the note language is English", () => {
    const text = agentWriterInstructions({ ...base, subject: hindi, lang: "en" });
    expect(text).toContain("शब्दार्थ");
    expect(text).toContain("keep quotations, verses and word meanings");
  });

  it("marks an ISC class as ISC, not ICSE", () => {
    const text = agentWriterInstructions({ ...base, board: "icse", grade: 12, lang: "en" });
    expect(text).toContain("Board: ICSE · ISC (ISC).");
    expect(text).not.toContain("(ICSE).");
  });
});
