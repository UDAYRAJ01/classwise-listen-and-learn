import { describe, expect, it } from "vitest";
import { evidenceCoverage, skeleton, sourceProof } from "../../scripts/agent/review-gates";

describe("agent draft review gates", () => {
  it("matches a clean Hindi quote against PDF text with split, reordered matras", () => {
    const pdfText = "नीमा रोज़ खाना खाते-खाते स्कूल की बातें सनु ाती है।";
    expect(skeleton(pdfText).includes(skeleton("स्कूल की बातें सुनाती है"))).toBe(true);
  });

  it("accepts a different hash only when the cited book lines are in our copy", () => {
    const source = "Hello, I am Ravi. I study in Class 2. My friend and I go to school on foot.";
    const good = evidenceCoverage([{ evidence: '"I am Ravi" "I study in Class 2" "go to school on foot"' }], source);
    expect(sourceProof("a".repeat(64), "b".repeat(64), good).ok).toBe(true);
    const bad = evidenceCoverage([{ evidence: '"Ravi goes by bus" "I study in Class 5" "we take the train"' }], source);
    expect(sourceProof("a".repeat(64), "b".repeat(64), bad).ok).toBe(false);
  });

  it("does not count quotes of the writer instructions as book lines", () => {
    const cov = evidenceCoverage([{ evidence: "Writer instructions: 'Use formulas for grammar rules only if the chapter is a grammar unit.'" }], "x");
    expect(cov.quotes).toBe(0);
  });
});
