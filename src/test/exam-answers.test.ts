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

  it("accepts either letter when the key allows two for a single-correct question", () => {
    expect(normalizeAnswer("A or B", "single")).toBe("A,B");
    expect(answersMatch("B", "A,B", "single")).toBe(true);
    expect(answersMatch("C", "A,B", "single")).toBe(false);
    expect(answersMatch("B", "A,B", "multiple")).toBe(false);
  });

  it("treats dropped questions as bonus", () => {
    expect(normalizeAnswer("Dropped", "single")).toBe("BONUS");
    expect(normalizeAnswer("Due to internal review, all candidates are awarded +4 marks.", "multiple")).toBe("BONUS");
  });

  it("reads a key that prints the option's value instead of its number", () => {
    expect(normalizeAnswer("(12)", "single", ["12", "6", "18", "9"])).toBe("A");
    expect(normalizeAnswer("(111)", "single", ["$111$", "$100$", "$90$", "$122$"])).toBe("A");
    // A value that matches no option, or two options, is not guessed.
    expect(normalizeAnswer("(15)", "single", ["12", "6", "18", "9"])).toBeNull();
    expect(normalizeAnswer("(12)", "single", ["12", "12", "18", "9"])).toBeNull();
  });

  it("treats a coaching key's NA as no answer", () => {
    expect(normalizeAnswer("(NA)", "single")).toBeNull();
    expect(normalizeAnswer("N.A.", "single")).toBeNull();
  });

  it("accepts a worked answer inside the key's range and rejects one outside", () => {
    expect(answersMatch("4.02", "3.9-4.1")).toBe(true);
    expect(answersMatch("4.3", "3.9-4.1")).toBe(false);
    expect(answersMatch("A,C", "A,C")).toBe(true);
    expect(answersMatch("A", "A,C")).toBe(false);
  });
});
