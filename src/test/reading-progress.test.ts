import { describe, expect, it } from "vitest";

import { dwellNeeded } from "@/hooks/use-read-tracker";
import { sectionForBlock, visibleSections } from "@/lib/note-sections";
import {
  allPartsRead,
  chapterStatus,
  mergeNotebooks,
  sanitize,
} from "@/lib/notebook-store";
import { matchesFilter, subjectProgress } from "@/lib/progress";
import { buildTracks } from "@/lib/tracks";
import type { NoteContent } from "@/lib/types";

const where = { board: "cbse" as const, grade: 10, subject: "science" };
const k = (slug: string) => `cbse/10/science/${slug}`;

describe("padh liya (read) tracking", () => {
  it("marks a chapter read only when every part has been read", () => {
    const parts = ["summary", "notes", "tricks"];
    expect(allPartsRead(["summary", "notes"], parts)).toBe(false);
    expect(allPartsRead(["tricks", "summary", "notes"], parts)).toBe(true);
    expect(allPartsRead([], [])).toBe(false);
  });

  it("ranks memorised above read above started", () => {
    const nb = sanitize({
      done: [k("a")],
      read: [k("a"), k("b")],
      progress: { [k("c")]: ["summary"] },
    });
    expect(chapterStatus(nb, k("a"))).toBe("done");
    expect(chapterStatus(nb, k("b"))).toBe("read");
    expect(chapterStatus(nb, k("c"))).toBe("started");
    expect(chapterStatus(nb, k("d"))).toBe("new");
  });

  it("drops half-read progress for chapters that are already read", () => {
    const nb = sanitize({ read: [k("a")], progress: { [k("a")]: ["summary"] } });
    expect(nb.progress).toEqual({});
  });

  it("keeps read chapters and read parts from both devices when merging", () => {
    const a = sanitize({ read: [k("a")], progress: { [k("c")]: ["summary"] } });
    const b = sanitize({ read: [k("b")], progress: { [k("c")]: ["notes"], [k("a")]: ["x"] } });
    const m = mergeNotebooks(a, b);
    expect(m.read.sort()).toEqual([k("a"), k("b")]);
    expect(m.progress[k("c")]?.sort()).toEqual(["notes", "summary"]);
    expect(m.progress[k("a")]).toBeUndefined();
  });

  it("needs 2 s for a short part and at most 12 s for a very long one", () => {
    expect(dwellNeeded(200, 800)).toBe(2_000);
    expect(dwellNeeded(1_600, 800)).toBe(5_000);
    expect(dwellNeeded(20_000, 800)).toBe(12_000);
  });
});

describe("baaki / padhe counts", () => {
  const nb = sanitize({
    done: [k("c1")],
    read: [k("c1"), k("c2")],
    progress: { [k("c3")]: ["summary"] },
  });
  const p = subjectProgress(nb, where, ["c1", "c2", "c3", "c4", "c5"]);

  it("counts memorised, read, half-read and left chapters", () => {
    expect(p).toMatchObject({ total: 5, done: 1, read: 1, started: 1, left: 3 });
  });

  it("points to the first chapter in book order that is not read", () => {
    expect(p.nextSlug).toBe("c3");
  });

  it("filters: 'Baaki' = not read yet, 'Padh liye' = read or memorised", () => {
    expect(matchesFilter("new", "left")).toBe(true);
    expect(matchesFilter("started", "left")).toBe(true);
    expect(matchesFilter("read", "left")).toBe(false);
    expect(matchesFilter("done", "read")).toBe(true);
    expect(matchesFilter("read", "done")).toBe(false);
  });
});

const NOTE: NoteContent = {
  title: "Light",
  oneLiner: "One",
  summary: "Sum",
  keyPoints: [{ heading: "H", points: ["p"] }],
  keyTerms: [{ term: "T", meaning: "M" }],
  formulas: [],
  tricks: [{ title: "Tr", kind: "acronym", trick: "X", explanation: "Y" }],
  questions: [{ question: "Q?", answer: "A", marks: 1 }],
  quickRevision: ["r"],
  examTips: ["t"],
  funFact: "",
};

describe("common mistakes part", () => {
  it("does not change audio part numbers of older notes without mistakes", () => {
    const before = buildTracks(NOTE, "hinglish").map((t) => t.blockId);
    expect(before).toEqual(["intro", "kp-0", "terms-0", "trick-0", "q-0", "revision", "tips"]);
  });

  it("is read aloud after the tricks and before the questions", () => {
    const withMistakes = { ...NOTE, mistakes: [{ mistake: "Wrong", correct: "Right" }] };
    const ids = buildTracks(withMistakes, "hinglish").map((t) => t.blockId);
    expect(ids.indexOf("mistakes")).toBe(ids.indexOf("trick-0") + 1);
    expect(sectionForBlock("mistakes")).toBe("mistakes");
    expect(visibleSections(withMistakes).map((s) => s.id)).toContain("mistakes");
    expect(visibleSections(NOTE).map((s) => s.id)).not.toContain("mistakes");
  });
});
