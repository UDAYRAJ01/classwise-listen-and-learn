import { describe, expect, it } from "vitest";
import { GOVERNMENT_CATEGORIES, PAPER_YEARS, isGovernmentCategory, paperSelection, topicKey, usablePaper, type GovernmentPaper } from "@/lib/government-exams";
describe("government exam scope and evidence", () => {
  it("includes the ten requested families", () => {
    expect(GOVERNMENT_CATEGORIES.map((c) => c.id)).toEqual(["upsc","ssc","railway","banking","defence","police","teaching","state-psc","state-subordinate","judiciary"]);
    expect(isGovernmentCategory("jee")).toBe(false);
  });
  it("uses the ten-year 2017–2026 window", () => { expect(PAPER_YEARS).toEqual([2017,2018,2019,2020,2021,2022,2023,2024,2025,2026]); });
  it("does not count memory or model questions as real PYQs", () => {
    expect(usablePaper({source_kind:"memory_based",status:"ready"})).toBe(false);
    expect(usablePaper({source_kind:"model",status:"ready"})).toBe(false);
    expect(usablePaper({source_kind:"official",status:"located"})).toBe(false);
    expect(usablePaper({source_kind:"official",status:"ready"})).toBe(true);
  });
  it("never mixes stages, state jurisdictions or exams", () => {
    const p={exam:"upsc-cse",jurisdiction:"national",stage:"prelims",section:"gs"};
    for(const other of [{...p,stage:"mains"},{...p,jurisdiction:"UP"},{...p,exam:"ssc-cgl"},{...p,section:"csat"}]) expect(topicKey(other,"Polity")).not.toBe(topicKey(p,"Polity"));
  });
  it("selects an available stage and section when switching exam families",()=>{
    const rows=[{exam:"cds",stage:"written",section:"maths"},{exam:"ctet",stage:"paper-i",section:"all"}] as GovernmentPaper[];
    expect(paperSelection(rows,"cds","prelims","gs")).toEqual({exam:"cds",stage:"written",section:"maths"});
    expect(paperSelection(rows,"ctet","written","maths")).toEqual({exam:"ctet",stage:"paper-i",section:"all"});
  });
});