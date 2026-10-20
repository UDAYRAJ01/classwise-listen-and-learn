import { describe, expect, it } from "vitest";

import { mergeNotebooks, sanitize } from "@/lib/notebook-store";

const ref = (chapter: string, at: number) => ({
  board: "cbse" as const,
  grade: 10,
  subject: "science",
  chapter,
  title: chapter,
  at,
});

describe("mergeNotebooks", () => {
  it("keeps saved chapters, done marks and study days from both devices", () => {
    const a = sanitize({ saved: [ref("c1", 1)], done: ["x"], days: ["2026-10-19"] });
    const b = sanitize({ saved: [ref("c2", 2), ref("c1", 5)], done: ["y"], days: ["2026-10-20"] });
    const m = mergeNotebooks(a, b);
    expect(m.saved.map((s) => s.chapter)).toEqual(["c1", "c2"]);
    expect(m.saved).toHaveLength(2);
    expect(m.done.sort()).toEqual(["x", "y"]);
    expect(m.days).toEqual(["2026-10-19", "2026-10-20"]);
  });
});
