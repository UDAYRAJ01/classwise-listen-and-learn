export const GOVERNMENT_CATEGORIES = [
  { id: "upsc", name: "UPSC", exams: "CSE · Prelims / Mains", archive: "https://www.upsc.gov.in/examinations/previous-question-papers", order: 1 },
  { id: "ssc", name: "SSC", exams: "CGL · CHSL", archive: "https://ssc.gov.in", order: 2 },
  { id: "railway", name: "Railway (RRB)", exams: "NTPC · Group D · ALP", archive: "https://www.rrbcdg.gov.in", order: 3 },
  { id: "banking", name: "Banking", exams: "SBI / IBPS · PO / Clerk", archive: "https://www.ibps.in", order: 4 },
  { id: "defence", name: "Defence", exams: "NDA · CDS · AFCAT", archive: "https://www.upsc.gov.in/examinations/previous-question-papers", order: 5 },
  { id: "police", name: "Police", exams: "Constable · SI", archive: null, order: 6 },
  { id: "teaching", name: "Teaching", exams: "CTET · State TET", archive: "https://ctet.nic.in/category/archive/", order: 7 },
  { id: "state-psc", name: "State PSC", exams: "Rajya-wise · Prelims / Mains", archive: null, order: 8 },
  { id: "state-subordinate", name: "State Subordinate", exams: "Rajya-wise · Post-wise", archive: null, order: 9 },
  { id: "judiciary", name: "Judiciary", exams: "Rajya-wise · Prelims / Mains", archive: null, order: 10 },
] as const;
export type GovernmentCategory = (typeof GOVERNMENT_CATEGORIES)[number]["id"];
export const PAPER_YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i);
export function isGovernmentCategory(value: unknown): value is GovernmentCategory {
  return GOVERNMENT_CATEGORIES.some((c) => c.id === value);
}
export interface GovernmentPaper {
  id: string; slug: string; category: string; exam: string; jurisdiction: string;
  stage: string; section: string; year: number; label: string; source_url: string;
  source_kind: string; key_source: string; key_url: string | null; status: string;
  expected_questions: number | null;
}
export interface GovernmentQuestion {
  id: string; paper_id: string; number: number; page: number; body: string; options: string[];
  kind: string; section: string; topic: string; concept: string;
}
/** Coverage is measured only from reviewed originals, never model/memory-based papers. */
export function usablePaper(p: Pick<GovernmentPaper, "source_kind" | "status">) {
  return p.status === "ready" && ["official", "verified_copy"].includes(p.source_kind);
}
/** Never combine exams, jurisdictions, stages or sections into one frequency. */
export function topicKey(p: Pick<GovernmentPaper, "exam" | "jurisdiction" | "stage" | "section">, topic: string) {
  return JSON.stringify([p.exam, p.jurisdiction, p.stage, p.section, topic]);
}
export interface TopicGuide { easy: string; trick: string; trap: string; revision: string; patterns: string[] }
export interface GovernmentSolution { question_id: string; answer: string; verification: string; content: { explanation: string; methods: string[]; trick: string; trap: string } }
/** Keep the printed label; add one only when the transcription has none. */
export function governmentOptionText(option: string, index: number) {
  return /^\s*(?:\([a-d1-4]\)|[a-d1-4][.)])\s+/i.test(option) ? option : `(${String.fromCharCode(97 + index)}) ${option}`;
}
export function paperSelection(papers: GovernmentPaper[], exam: string, stage: string, section: string) {
  const selectedExam = papers.some(p => p.exam === exam) ? exam : papers[0]?.exam ?? "";
  const rows = papers.filter(p => p.exam === selectedExam);
  const selectedStage = rows.some(p => p.stage === stage) ? stage : rows[0]?.stage ?? "";
  const stages = rows.filter(p => p.stage === selectedStage);
  const selectedSection = stages.some(p => p.section === section) ? section : stages[0]?.section ?? "";
  return { exam: selectedExam, stage: selectedStage, section: selectedSection };
}