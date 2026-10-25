import { describe, expect, it } from "vitest";

import { BOARD_IDS, GRADES, getSubject, getSubjects, gradeLabel } from "@/lib/catalog";
import { normalizeNote, normalizeSyllabus } from "@/lib/server/normalize.server";
import { chapterSlug, customTopicSlug, isCustomSlug } from "@/lib/slugs";
import { splitEmphasis, stripEmphasis, stripMarkup } from "@/lib/text";
import { buildTracks, TERMS_PER_TRACK } from "@/lib/tracks";
import type { NoteContent } from "@/lib/types";

describe("catalog", () => {
  it("covers every class from 1 to 12 on both boards", () => {
    for (const board of BOARD_IDS) {
      for (const grade of GRADES) {
        expect(getSubjects(board, grade).length).toBeGreaterThan(0);
      }
    }
    expect(GRADES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("has NCERT Science for CBSE Class 10 but not for Class 2", () => {
    expect(getSubject("cbse", 10, "science")?.name).toBe("Science");
    expect(getSubject("cbse", 2, "science")).toBeNull();
  });

  it("labels ICSE senior classes as ISC", () => {
    expect(gradeLabel("icse", 11)).toBe("ISC Class 11");
    expect(gradeLabel("icse", 10)).toBe("Class 10");
  });

  it("follows the ISC Class 11 change: Commerce became Business Studies, plus Entrepreneurship", () => {
    expect(getSubject("icse", 11, "commerce")).toBeNull();
    expect(getSubject("icse", 11, "business-studies")).not.toBeNull();
    expect(getSubject("icse", 11, "entrepreneurship")).not.toBeNull();
    // Class 12 (exam 2027) still studies the old Commerce course.
    expect(getSubject("icse", 12, "commerce")).not.toBeNull();
    expect(getSubject("icse", 12, "entrepreneurship")).toBeNull();
  });

  it("offers ISC English Literature (Modern) in Class 11 and 12 only", () => {
    expect(getSubject("icse", 11, "english-modern")).not.toBeNull();
    expect(getSubject("icse", 12, "english-modern")).not.toBeNull();
    expect(getSubject("icse", 10, "english-modern")).toBeNull();
  });
});

describe("slugs", () => {
  it("builds official chapter slugs from book and chapter position", () => {
    expect(chapterSlug(0, 8, "Light – Reflection and Refraction")).toBe(
      "b1-c9-light-reflection-and-refraction",
    );
    expect(chapterSlug(1, 0, "कृतिका")).toBe("b2-c1");
  });

  it("makes stable custom topic slugs, including Hindi topics", () => {
    const a = customTopicSlug("  Photosynthesis   kaise hota hai ");
    expect(a).toBe(customTopicSlug("photosynthesis kaise hota hai"));
    expect(isCustomSlug(a)).toBe(true);
    expect(customTopicSlug("प्रकाश संश्लेषण")).toMatch(/^t-[0-9a-z]{1,6}$/);
  });
});

describe("text markup", () => {
  it("turns **keywords** into highlighted segments", () => {
    expect(splitEmphasis("Light **reflects** here")).toEqual([
      { text: "Light ", strong: false },
      { text: "reflects", strong: true },
      { text: " here", strong: false },
    ]);
    expect(stripMarkup("**Ohm's law** V = IR")).toBe("Ohm's law V = IR");
  });

  it("keeps Python's power operator ** and **= in notes", () => {
    expect(stripEmphasis("**Power** ke liye 3 ** 4 = 81 aur x **= 3")).toBe(
      "Power ke liye 3 ** 4 = 81 aur x **= 3",
    );
    expect(stripEmphasis("Sahi term **1 / (i ** 3)** hai; y**2")).toBe("Sahi term 1 / (i ** 3) hai; y**2");
    expect(stripEmphasis("star rows ***; **; *")).toBe("star rows ***; **; *");
    expect(stripEmphasis("Operators: +=, //=, **=. **==** compares")).toBe(
      "Operators: +=, //=, **=. == compares",
    );
  });

  it("still highlights letters inside a word and drops an unfinished highlight", () => {
    expect(stripEmphasis("stala**G**mite")).toBe("stalaGmite");
    expect(stripEmphasis("Photo **synth")).toBe("Photo synth");
  });
});

describe("saved notes", () => {
  it("keep code operators in formulas and quiz options", () => {
    const n = normalizeNote(
      {
        formulas: [{ name: "**Cube**", formula: "cube = x ** 3", spoken: "", note: "" }],
        mcqs: [{ question: "q", options: ["x ** 2", "x * 2", "x // 2", "x % 2"], answer: 0, explanation: "" }],
      } as never,
      "Python",
    );
    expect(n.formulas[0]?.name).toBe("Cube");
    expect(n.formulas[0]?.formula).toBe("cube = x ** 3");
    expect(n.mcqs?.[0]?.options[0]).toBe("x ** 2");
  });
});

const NOTE: NoteContent = {
  title: "Electricity",
  oneLiner: "Current **flows**",
  summary: "Intro",
  keyPoints: [
    { heading: "Current", points: ["I = Q/t"] },
    { heading: "Resistance", points: ["R = V/I"] },
  ],
  keyTerms: Array.from({ length: 8 }, (_, i) => ({ term: `T${i}`, meaning: `M${i}` })),
  formulas: [{ name: "Ohm", formula: "V = IR", spoken: "V equals I R", note: "" }],
  tricks: [{ title: "VIR", kind: "acronym", trick: "Very Important Rule", explanation: "V = IR" }],
  questions: [
    { question: "Q1?", answer: "A1", marks: 1 },
    { question: "Q2?", answer: "A2", marks: 3 },
  ],
  quickRevision: ["One"],
  examTips: ["Tip"],
  funFact: "Fun",
};

describe("audio tracks", () => {
  it("gives every short-notes group, trick and question its own part", () => {
    const tracks = buildTracks(NOTE, "en");
    const ids = tracks.map((t) => t.blockId);
    expect(ids).toEqual([
      "intro",
      "kp-0",
      "kp-1",
      "terms-0",
      "terms-1",
      "formulas",
      "trick-0",
      "q-0",
      "q-1",
      "revision",
      "tips",
    ]);
    expect(tracks.map((t) => t.index)).toEqual(ids.map((_, i) => i));
  });

  it("groups important words six at a time", () => {
    expect(TERMS_PER_TRACK).toBe(6);
    const terms = buildTracks(NOTE, "en").filter((t) => t.blockId.startsWith("terms-"));
    expect(terms[0]?.text).toContain("T5");
    expect(terms[0]?.text).not.toContain("T6");
    expect(terms[1]?.text).toContain("T6");
  });

  it("speaks formulas the readable way and never reads ** markers aloud", () => {
    const tracks = buildTracks(NOTE, "en");
    expect(tracks.find((t) => t.blockId === "formulas")?.text).toContain("V equals I R");
    expect(tracks.every((t) => !t.text.includes("**"))).toBe(true);
  });

  it("uses Hindi section words for Hindi notes", () => {
    const q = buildTracks(NOTE, "hi").find((t) => t.blockId === "q-0");
    expect(q?.text.startsWith("प्रश्न 1:")).toBe(true);
  });
});

describe("normalizers", () => {
  it("clamps question marks between 1 and 6 and strips markup from titles", () => {
    const n = normalizeNote(
      {
        ...NOTE,
        title: "**Electricity**",
        questions: [
          { question: "a", answer: "b", marks: 0 },
          { question: "c", answer: "d", marks: 12 },
        ],
      },
      "Fallback",
    );
    expect(n.title).toBe("Electricity");
    expect(n.questions.map((q) => q.marks)).toEqual([1, 6]);
  });

  it("drops chapter-number prefixes and assigns slugs in order", () => {
    const books = normalizeSyllabus({
      books: [
        { name: "First Flight", chapters: [{ title: "Chapter 1: A Letter to God", gist: "x" }] },
      ],
    });
    expect(books[0]?.chapters[0]).toEqual({
      slug: "b1-c1-a-letter-to-god",
      number: 1,
      title: "A Letter to God",
      gist: "x",
    });
  });
});

describe("quiz", () => {
  it("keeps only questions with exactly 4 options and a valid answer", () => {
    const n = normalizeNote(
      {
        ...NOTE,
        mcqs: [
          { question: "ok", options: ["a", "b", "c", "d"], answer: 2, explanation: "" },
          { question: "three options", options: ["a", "b", "c"], answer: 0, explanation: "" },
          { question: "bad answer", options: ["a", "b", "c", "d"], answer: 4, explanation: "" },
        ],
      },
      "x",
    );
    expect(n.mcqs?.map((q) => q.question)).toEqual(["ok"]);
  });

  it("is never read aloud", () => {
    const withQuiz = {
      ...NOTE,
      mcqs: [{ question: "Q?", options: ["a", "b", "c", "d"], answer: 0, explanation: "" }],
    };
    expect(buildTracks(withQuiz, "en").length).toBe(buildTracks(NOTE, "en").length);
  });
});

describe("study streak", () => {
  it("counts consecutive days ending today or yesterday", async () => {
    const { streakFrom } = await import("@/lib/notebook-store");
    const today = new Date(2026, 9, 20);
    expect(streakFrom(["2026-10-18", "2026-10-19", "2026-10-20"], today)).toBe(3);
    expect(streakFrom(["2026-10-18", "2026-10-19"], today)).toBe(2);
    expect(streakFrom(["2026-10-17"], today)).toBe(0);
    expect(streakFrom([], today)).toBe(0);
  });
});
