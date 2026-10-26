import { describe, expect, it } from "vitest";

import { segmentSubjects, snapBlocks } from "../../scripts/exam/segment";

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

describe("fixed question counts per subject", () => {
  const jee = () => 1 / 3;
  const neet = (s: string) => (s === "biology" ? 1 / 2 : 1 / 4);

  it("moves a boundary that a mislabel shifted by one", () => {
    const labels = [...block("physics", 26), ...block("chemistry", 24), ...block("maths", 25)];
    const out = snapBlocks(labels, jee);
    expect(out.filter((s) => s === "physics")).toHaveLength(25);
    expect(out.filter((s) => s === "chemistry")).toHaveLength(25);
  });

  it("uses half the paper for NEET Biology wherever it is printed", () => {
    const labels = [...block("biology", 89), ...block("chemistry", 46), ...block("physics", 45)];
    const out = snapBlocks(labels, neet);
    expect(out.slice(0, 90).every((s) => s === "biology")).toBe(true);
    expect(out.filter((s) => s === "chemistry")).toHaveLength(45);
  });

  it("leaves a paper alone when its blocks are far from the usual sizes", () => {
    const labels = [...block("physics", 20), ...block("chemistry", 30), ...block("maths", 25)];
    expect(snapBlocks(labels, jee)).toEqual(labels);
  });
});
