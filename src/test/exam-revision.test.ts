import { describe, expect, it } from "vitest";

import { chapterParam, nextRevision, parseChapterParam, revisionState } from "@/lib/exam";

describe("JEE / NEET revision schedule", () => {
  it("brings a chapter back after 1, then 3, then 7 days", () => {
    const first = nextRevision(undefined, "2026-10-26");
    expect(first).toEqual({ n: 1, last: "2026-10-26", next: "2026-10-27" });
    const second = nextRevision(first, "2026-10-27");
    expect(second.next).toBe("2026-10-30");
    const third = nextRevision(second, "2026-10-30");
    expect(third.next).toBe("2026-11-06");
  });

  it("does not count two revisions on the same day", () => {
    const first = nextRevision(undefined, "2026-10-26");
    expect(nextRevision(first, "2026-10-26")).toBe(first);
  });

  it("marks a chapter due on or after its revision date", () => {
    const r = nextRevision(undefined, "2026-10-26");
    expect(revisionState(r, "2026-10-26")).toBe("later");
    expect(revisionState(r, "2026-10-27")).toBe("due");
    expect(revisionState(undefined, "2026-10-27")).toBe("new");
  });

  it("round-trips chapter links and rejects anything else", () => {
    expect(parseChapterParam(chapterParam(11, "b1-c3-motion-in-a-plane"))).toEqual({
      grade: 11,
      slug: "b1-c3-motion-in-a-plane",
    });
    expect(parseChapterParam("10-b1-c3-x")).toBeNull();
    expect(parseChapterParam("11-../../etc")).toBeNull();
  });
});
