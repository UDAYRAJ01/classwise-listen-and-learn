import { chapterSlug } from "@/lib/slugs";
import type { NoteContent, SyllabusBook, TrickKind } from "@/lib/types";

const clean = (v: unknown, max = 2000): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const plain = (v: unknown, max = 2000): string => clean(v, max).replace(/\*\*/g, "");

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normalizeSyllabus(raw: { books?: unknown }): SyllabusBook[] {
  const seen = new Set<string>();
  return list<{ name?: unknown; chapters?: unknown }>(raw.books)
    .slice(0, 4)
    .map((book, bi) => {
      const chapters = list<{ title?: unknown; gist?: unknown }>(book.chapters)
        .map((c) => ({
          title: clean(c.title, 140).replace(
            /^(chapter|ch\.?|lesson|unit|पाठ|अध्याय)\s*[\d०-९]+\s*[:.\-–]\s*/i,
            "",
          ),
          gist: clean(c.gist, 160),
        }))
        .filter((c) => c.title.length > 0)
        .slice(0, 40)
        .map((c, ci) => {
          let slug = chapterSlug(bi, ci, c.title);
          while (seen.has(slug)) slug = `${slug}-x`;
          seen.add(slug);
          return { slug, number: ci + 1, title: c.title, gist: c.gist };
        });
      return { name: clean(book.name, 120) || `Book ${bi + 1}`, chapters };
    })
    .filter((b) => b.chapters.length > 0);
}

const KINDS: TrickKind[] = ["acronym", "rhyme", "story", "visual", "pattern", "shortcut"];

export function normalizeNote(raw: Partial<NoteContent>, fallbackTitle: string): NoteContent {
  return {
    title: plain(raw.title, 160) || fallbackTitle,
    oneLiner: clean(raw.oneLiner, 400),
    summary: clean(raw.summary, 1600),
    keyPoints: list<{ heading?: unknown; points?: unknown }>(raw.keyPoints)
      .map((g) => ({
        heading: plain(g.heading, 160),
        points: list<unknown>(g.points)
          .map((p) => clean(p, 600))
          .filter(Boolean)
          .slice(0, 8),
      }))
      .filter((g) => g.heading && g.points.length)
      .slice(0, 10),
    keyTerms: list<{ term?: unknown; meaning?: unknown }>(raw.keyTerms)
      .map((t) => ({ term: plain(t.term, 120), meaning: clean(t.meaning, 500) }))
      .filter((t) => t.term && t.meaning)
      .slice(0, 18),
    formulas: list<{ name?: unknown; formula?: unknown; spoken?: unknown; note?: unknown }>(
      raw.formulas,
    )
      .map((f) => ({
        name: plain(f.name, 160),
        formula: plain(f.formula, 400),
        spoken: clean(f.spoken, 500),
        note: clean(f.note, 400),
      }))
      .filter((f) => f.formula)
      .slice(0, 16),
    tricks: list<{ title?: unknown; kind?: unknown; trick?: unknown; explanation?: unknown }>(
      raw.tricks,
    )
      .map((t) => ({
        title: plain(t.title, 160),
        kind: (KINDS.includes(t.kind as TrickKind) ? t.kind : "shortcut") as TrickKind,
        trick: clean(t.trick, 600),
        explanation: clean(t.explanation, 800),
      }))
      .filter((t) => t.trick)
      .slice(0, 14),
    questions: list<{ question?: unknown; answer?: unknown; marks?: unknown }>(raw.questions)
      .map((q) => {
        const m = typeof q.marks === "number" ? Math.round(q.marks) : 1;
        return {
          question: clean(q.question, 600),
          answer: clean(q.answer, 2400),
          marks: Math.min(Math.max(m, 1), 6),
        };
      })
      .filter((q) => q.question && q.answer)
      .slice(0, 14),
    quickRevision: list<unknown>(raw.quickRevision)
      .map((p) => clean(p, 400))
      .filter(Boolean)
      .slice(0, 16),
    examTips: list<unknown>(raw.examTips)
      .map((p) => clean(p, 400))
      .filter(Boolean)
      .slice(0, 10),
    funFact: clean(raw.funFact, 500),
    mcqs: list<{ question?: unknown; options?: unknown; answer?: unknown; explanation?: unknown }>(
      raw.mcqs,
    )
      .map((q) => ({
        question: clean(q.question, 500),
        options: list<unknown>(q.options)
          .map((o) => plain(o, 200))
          .filter(Boolean),
        answer: typeof q.answer === "number" ? Math.round(q.answer) : -1,
        explanation: clean(q.explanation, 500),
      }))
      .filter((q) => q.question && q.options.length === 4 && q.answer >= 0 && q.answer < 4)
      .slice(0, 12),
    mistakes: list<{ mistake?: unknown; correct?: unknown }>(raw.mistakes)
      .map((m) => ({ mistake: clean(m.mistake, 400), correct: clean(m.correct, 600) }))
      .filter((m) => m.mistake && m.correct)
      .slice(0, 8),
  };
}
