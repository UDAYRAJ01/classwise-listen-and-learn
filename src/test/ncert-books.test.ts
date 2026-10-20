import { describe, expect, it } from "vitest";

import { ncertBooks, ncertChapterPdf } from "@/lib/ncert-books";

describe("NCERT textbook links", () => {
  it("uses the new 2026 Class 9 maths book in two parts", () => {
    expect(ncertBooks(9, "maths")?.map((b) => b.code)).toEqual(["iemh1", "iemh2"]);
  });
  it("builds a zero-padded chapter PDF link", () => {
    expect(ncertChapterPdf(ncertBooks(10, "science")![0]!, 3)).toBe(
      "https://ncert.nic.in/textbook/pdf/jesc103.pdf",
    );
  });
});
