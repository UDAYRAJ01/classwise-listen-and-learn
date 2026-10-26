import { describe, expect, it } from "vitest";

import { trimAnswerFromBox, type Box } from "@/lib/exam-figure";

const line = (text: string, top: number, left = 100, right = 300) => ({
  text,
  box: [left, top, right, top + 12] as Box,
});

describe("trimAnswerFromBox", () => {
  const box: Box = [80, 100, 920, 600];

  it("cuts the crop just above a printed 'Answer: C'", () => {
    const lines = [line("Q.4 Figure 1 shows the configuration", 110), line("Answer: C", 560)];
    expect(trimAnswerFromBox(box, lines)).toEqual([80, 100, 920, 556]);
  });

  it("also cuts above coaching 'Ans. (3)' and 'Sol.' lines, whichever comes first", () => {
    const lines = [line("Sol. Using F = ma", 520), line("Ans. (3)", 480)];
    expect(trimAnswerFromBox(box, lines)[3]).toBe(476);
  });

  it("keeps the crop when the word is part of the question", () => {
    const lines = [line("Correct statement(s) about X is(are)", 450), line("Answer the following", 480)];
    expect(trimAnswerFromBox(box, lines)).toEqual(box);
  });

  it("ignores answer lines of other questions outside the crop", () => {
    const lines = [line("Answer: B", 640), line("Answer: A", 300, 950, 990)];
    expect(trimAnswerFromBox(box, lines)).toEqual(box);
  });

  it("never cuts away the question itself", () => {
    expect(trimAnswerFromBox(box, [line("Answer: C", 120)])).toEqual(box);
  });
});
