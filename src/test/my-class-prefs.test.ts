import { describe, expect, it } from "vitest";

import { mergeNotebooks, sanitize } from "@/lib/notebook-store";

describe("saved class (Meri class)", () => {
  it("keeps a valid board + class pair", () => {
    const s = sanitize({ prefs: { board: "icse", grade: 7 } as never });
    expect(s.prefs.board).toBe("icse");
    expect(s.prefs.grade).toBe(7);
  });

  it("drops a class outside 1–12 or without a board", () => {
    expect(sanitize({ prefs: { board: "cbse", grade: 13 } as never }).prefs.grade).toBeNull();
    expect(sanitize({ prefs: { board: "cbse", grade: 0 } as never }).prefs.board).toBeNull();
    expect(sanitize({ prefs: { board: null, grade: 9 } as never }).prefs.grade).toBeNull();
    expect(sanitize({ prefs: { board: "state", grade: 9 } as never }).prefs.board).toBeNull();
  });

  it("a class picked on one device is not wiped by a device that never picked one", () => {
    const phone = sanitize({ prefs: { board: "cbse", grade: 10 } as never });
    const laptop = sanitize({});
    const m = mergeNotebooks(laptop, phone);
    expect(m.prefs.board).toBe("cbse");
    expect(m.prefs.grade).toBe(10);
  });

  it("when both devices picked a class, the first one wins", () => {
    const a = sanitize({ prefs: { board: "icse", grade: 12 } as never });
    const b = sanitize({ prefs: { board: "cbse", grade: 6 } as never });
    const m = mergeNotebooks(a, b);
    expect(m.prefs.board).toBe("icse");
    expect(m.prefs.grade).toBe(12);
  });
});
