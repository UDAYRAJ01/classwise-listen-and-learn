import { describe, expect, it } from "vitest";

import { segmentSubjects } from "../../scripts/exam/segment";

const block = (s: string, n: number) => Array.from({ length: n }, () => s);

describe("subject blocks of a past paper", () => {
  it("fixes two Chemistry questions that were read as Physics", () => {
    const labels = [...block("physics", 19), ...block("chemistry", 16), "physics", "physics", "chemistry", ...block("maths", 19)];
    const out = segmentSubjects(labels);
    expect(out.filter((s) => s === "chemistry")).toHaveLength(19);
    expect(out.filter((s) => s === "physics")).toHaveLength(19);
    expect(out.slice(35, 38)).toEqual(["chemistry", "chemistry", "chemistry"]);
  });

  it("keeps straight-through numbered papers in their real three blocks", () => {
    const labels = [...block("physics", 18), ...block("chemistry", 18), ...block("maths", 18)];
    expect(segmentSubjects(labels)).toEqual(labels);
  });

  it("folds a stray label into the block around it", () => {
    const labels = [...block("physics", 45), ...block("chemistry", 20), "biology", ...block("chemistry", 24), ...block("biology", 90)];
    const out = segmentSubjects(labels);
    expect(out.filter((s) => s === "chemistry")).toHaveLength(45);
    expect(out.filter((s) => s === "biology")).toHaveLength(90);
  });

  it("works whatever order the subjects come in", () => {
    const labels = [...block("chemistry", 25), ...block("maths", 25), ...block("physics", 25)];
    expect(segmentSubjects(labels)).toEqual(labels);
  });
});
