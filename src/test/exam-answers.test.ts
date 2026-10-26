import { describe, expect, it } from "vitest";

import { answersMatch, normalizeAnswer } from "@/lib/exam-answers";

describe("past-paper answers", () => {
  it("reads option answers printed in any style", () => {
    expect(normalizeAnswer("Answer Q5: AC", "multiple")).toBe("A,C");
    expect(normalizeAnswer("(A), (B), and (D)", "multiple")).toBe("A,B,D");
    expect(normalizeAnswer("(3)", "single")).toBe("C");
    expect(normalizeAnswer("Ans. 2", "single")).toBe("B");
  });

  it("keeps numerical answers and ranges", () => {
    expect(normalizeAnswer("[3.9 TO 4.1]", "numerical")).toBe("3.9-4.1");
    expect(normalizeAnswer("[2520]", "integer")).toBe("2520");
  });

  it("treats dropped questions as bonus", () => {
    expect(normalizeAnswer("Dropped", "single")).toBe("BONUS");
  });

  it("accepts a worked answer inside the key's range and rejects one outside", () => {
    expect(answersMatch("4.02", "3.9-4.1")).toBe(true);
    expect(answersMatch("4.3", "3.9-4.1")).toBe(false);
    expect(answersMatch("A,C", "A,C")).toBe(true);
    expect(answersMatch("A", "A,C")).toBe(false);
  });
});
