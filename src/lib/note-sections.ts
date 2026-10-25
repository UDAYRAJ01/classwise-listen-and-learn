// The visible parts of a chapter's notes, in reading order. Shared by the
// notes page, the "padh liya" tracker and the audio → part mapping.

import type { PartialNote } from "./types";

export const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "notes", label: "Short Notes" },
  { id: "terms", label: "Important Words" },
  { id: "formulas", label: "Formulas" },
  { id: "tricks", label: "Tricks" },
  { id: "mistakes", label: "Galtiyan na karein" },
  { id: "questions", label: "Important Q&A" },
  { id: "revision", label: "1-Min Revision" },
  { id: "tips", label: "Exam Tips" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

const has = (arr: unknown[] | undefined) => (arr?.length ?? 0) > 0;

/** Parts that actually have content for this note. */
export function visibleSections(content: PartialNote): (typeof SECTIONS)[number][] {
  return SECTIONS.filter((s) => {
    switch (s.id) {
      case "summary":
        return true;
      case "notes":
        return has(content.keyPoints);
      case "terms":
        return has(content.keyTerms);
      case "formulas":
        return has(content.formulas);
      case "tricks":
        return has(content.tricks);
      case "mistakes":
        return has(content.mistakes);
      case "questions":
        return has(content.questions);
      case "revision":
        return has(content.quickRevision);
      case "tips":
        return has(content.examTips) || !!content.funFact;
    }
  });
}

/** Which part an audio block belongs to (see buildTracks for block ids). */
export function sectionForBlock(blockId: string): SectionId | null {
  if (blockId === "intro") return "summary";
  if (blockId.startsWith("kp-")) return "notes";
  if (blockId.startsWith("terms-")) return "terms";
  if (blockId === "formulas") return "formulas";
  if (blockId.startsWith("trick-")) return "tricks";
  if (blockId === "mistakes") return "mistakes";
  if (blockId.startsWith("q-")) return "questions";
  if (blockId === "revision") return "revision";
  if (blockId === "tips") return "tips";
  return null;
}
