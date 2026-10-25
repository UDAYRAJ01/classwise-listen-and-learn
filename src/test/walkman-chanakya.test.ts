import { describe, expect, it } from "vitest";

import { chanakyaToUnicode, looksLikeChanakya } from "@/lib/walkman-chanakya";

describe("Walkman-Chanakya to Unicode (NCERT Hindi PDFs)", () => {
  it("converts common words", () => {
    expect(chanakyaToUnicode("Hkkjr esa")).toBe("भारत में");
    expect(chanakyaToUnicode("osQ")).toBe("के");
    expect(chanakyaToUnicode("fiQj")).toBe("फिर");
    expect(chanakyaToUnicode("ekrk&firk")).toBe("माता-पिता");
  });

  it("puts the ि sign and the र् (reph) in the right place", () => {
    expect(chanakyaToUnicode("Li'kZ")).toBe("स्पर्श");
    expect(chanakyaToUnicode("f'k{kk")).toBe("शिक्षा");
    expect(chanakyaToUnicode("dhfrZuxj")).toBe("कीर्तिनगर");
    expect(chanakyaToUnicode("fujkyk")).toBe("निराला");
  });

  it("handles conjunct glyphs", () => {
    expect(chanakyaToUnicode("mÙkjk[kaM")).toBe("उत्तराखंड");
    expect(chanakyaToUnicode("if=kdk")).toBe("पत्रिका");
    expect(chanakyaToUnicode("laLÑfr")).toBe("संस्कृति");
    expect(chanakyaToUnicode("'kq¼")).toBe("शुद्ध");
    expect(chanakyaToUnicode("Lora=rk")).toBe("स्वतंत्रता");
  });

  it("keeps an exercise equals sign and drops English page footers", () => {
    expect(chanakyaToUnicode("ekrk = ")).toBe("माता = ");
    expect(chanakyaToUnicode("Reprint 2026-27 Hkkjr").trim()).toBe("भारत");
  });

  it("recognises legacy-font text but not Unicode Hindi or English", () => {
    expect(looksLikeChanakya("Hkkjr esa osQ fd gSA ugha dk dh ".repeat(4))).toBe(true);
    expect(looksLikeChanakya("भारत में के कि है। नहीं का की ".repeat(4))).toBe(false);
    expect(looksLikeChanakya("The cat sat on the mat. ".repeat(20))).toBe(false);
  });
});
