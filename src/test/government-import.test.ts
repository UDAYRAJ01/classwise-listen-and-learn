import { expect, it } from "vitest";
import { validatePaperQuestions, type ExtractedQuestion } from "../../scripts/government/validation";
const q: ExtractedQuestion = { number:1, page:3, body:"Original question", options:["one","two","three","four"], kind:"single", section:"gs", topic:"Polity", concept:"Parliament" };
it("rejects missing questions instead of claiming complete papers", () => { expect(() => validatePaperQuestions([q],100)).toThrow("Missing question 2"); });
it("rejects duplicate bilingual numbering", () => { expect(() => validatePaperQuestions([q,q],1)).toThrow("Duplicate"); });
it("rejects cut-off passages and missing options", () => {
  expect(() => validatePaperQuestions([{...q,body:"[CONTINUED]"}],1)).toThrow("Incomplete");
  expect(() => validatePaperQuestions([{...q,options:["one"]}],1)).toThrow("Incomplete");
});
it("accepts exactly complete, numbered paper questions", () => { expect(validatePaperQuestions([q],1)).toEqual([q]); });