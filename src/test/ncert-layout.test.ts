import { describe, expect, it } from "vitest";

import { fixSmallCaps, locate, printedOffset, type Line } from "../../scripts/exam/ncert-layout";

/** A text line as the layout reader produces it. */
function line(page: number, y: number, text: string, opts: { bold?: boolean; size?: number; x?: number } = {}): Line {
  const size = opts.size ?? 10;
  return {
    page,
    y,
    x: opts.x ?? 70,
    size,
    text,
    runs: [{ text, bold: opts.bold ?? false, x: opts.x ?? 70, size }],
  };
}

const body = (page: number, y: number) => line(page, y, "this is ordinary body text of the chapter that runs on");

describe("NCERT location index", () => {
  it("points a section at its heading in the chapter, not at the contents box on page 1", () => {
    const lines = [
      line(1, 100, "13.1 Introduction"),
      line(1, 112, "13.2 Periodic and oscillatory motions"),
      line(1, 124, "13.3 Simple harmonic motion"),
      line(1, 136, "13.4 Simple harmonic motion and uniform circular motion"),
      line(1, 148, "Exercises"),
      body(1, 300),
      line(4, 120, "13.3 SIMPLE HARMONIC MOTION", { bold: true }),
      body(4, 140),
      body(4, 160),
    ];
    const s = locate(lines).find((x) => x.kind === "section" && x.ref === "13.3");
    expect(s?.page).toBe(4);
    // "Exercises" in the contents box must not turn later headings into exercise questions.
    expect(locate(lines).some((x) => x.kind === "exercise")).toBe(false);
  });

  it("numbers Maths exercise questions by their exercise set and keeps examples as printed", () => {
    const lines = [
      line(1, 100, "7.1 Introduction", { bold: true }),
      body(1, 120),
      line(2, 100, "7.2 Binomial Theorem for Positive Integral Indices", { bold: true }),
      line(3, 100, "Example 3 Which is larger (1.01)1000000 or 10,000?"),
      line(4, 100, "EXERCISE 7.1"),
      line(4, 120, "1. (1–2x)5"),
      line(4, 140, "2. (2x – 3)6"),
      line(5, 100, "7.3 General and Middle Terms", { bold: true }),
      line(5, 140, "1. a numbered line inside the next section"),
    ];
    const found = locate(lines);
    expect(found.find((x) => x.kind === "example")?.ref).toBe("3");
    expect(found.filter((x) => x.kind === "exercise").map((x) => x.ref)).toEqual(["7.1 Q1", "7.1 Q2"]);
    expect(found.find((x) => x.kind === "section" && x.ref === "7.3")?.page).toBe(5);
  });

  it("works out printed book pages from page numbers in the margin", () => {
    const lines = [1, 2, 3, 4, 5, 6].flatMap((p) => [body(p, 100), line(p, 650, String(77 + p), { x: 500 })]);
    expect(printedOffset(lines)).toBe(77);
  });

  it("repairs small-capital headings that come out in mixed case", () => {
    expect(fixSmallCaps("propertieS of matter anD their meaSUrement")).toBe(
      "Properties of matter and their measurement",
    );
    expect(fixSmallCaps("Simple harmonic motion")).toBe("Simple harmonic motion");
  });
});
