import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Info, Printer } from "lucide-react";

import { Crumbs } from "@/components/crumbs";
import { QuestionCard } from "@/components/exam/question-card";
import { ErrorCard } from "@/components/state-cards";
import { Button } from "@/components/ui/button";
import {
  EXAM_GROUPS,
  EXAM_NAMES,
  isExamGroup,
  isExamSubject,
  isOldUnit,
  OLD_UNITS,
  SUBJECT_NAMES,
  type ExamGroup,
  type ExamName,
  type ExamSubject,
} from "@/lib/exam";
import { examOldUnitQuery } from "@/lib/exam-queries";

export const Route = createFileRoute("/exam/$group/$subject/old/$unit")({
  loader: async ({ params, context }) => {
    const { group, subject, unit } = params;
    if (!isExamGroup(group) || !isExamSubject(subject) || !EXAM_GROUPS[group].subjects.includes(subject))
      throw notFound();
    if (!isOldUnit(subject, unit)) throw notFound();
    const view = await context.queryClient.ensureQueryData(examOldUnitQuery(group, subject, unit));
    if (!view.questions.length) throw notFound();
    return { group, subject, unit, name: OLD_UNITS[subject][unit]!, count: view.questions.length };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Unit not found — PadhoSuno" }] };
    const g = EXAM_GROUPS[loaderData.group as ExamGroup];
    const title = `${loaderData.name} — ${g.short} ke purane sawal (NCERT se hata unit) | PadhoSuno`;
    const description = `${loaderData.name} (${SUBJECT_NAMES[loaderData.subject as ExamSubject]}) ke ${loaderData.count} asli ${g.short} sawal — yeh unit NCERT ki nayi book se hata diya gaya hai. Solution aur trick ke saath.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: OldUnitPage,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorCard message="Sawal load nahi hue. Internet check karke dobara try karein." onRetry={reset} />
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorCard message="Is unit ke koi purane sawal nahi mile." />
    </div>
  ),
});

function OldUnitPage() {
  const { group, subject, unit } = Route.useLoaderData() as { group: ExamGroup; subject: ExamSubject; unit: string };
  const { data: view } = useSuspenseQuery(examOldUnitQuery(group, subject, unit));
  const meta = EXAM_GROUPS[group];
  const byExam: Partial<Record<ExamName, number>> = {};
  for (const q of view.questions) byExam[q.exam] = (byExam[q.exam] ?? 0) + 1;
  const years = [...new Set(view.questions.map((q) => q.year))].sort((a, b) => b - a);
  const latest = years[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Crumbs
        items={[
          {
            label: "JEE / NEET",
            link: (
              <Link to="/exam" className="hover:text-foreground">
                JEE / NEET
              </Link>
            ),
          },
          {
            label: meta.short,
            link: (
              <Link to="/exam/$group" params={{ group }} search={{ subject }} className="hover:text-foreground">
                {meta.short} · {SUBJECT_NAMES[subject]}
              </Link>
            ),
          },
          { label: view.name },
        ]}
      />

      <header className="mt-6">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">
          {meta.short} · {SUBJECT_NAMES[subject]} · NCERT se hata unit
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{view.name}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-ink px-3 py-1 font-semibold text-paper">{view.questions.length} asli sawal</span>
          {Object.entries(byExam).map(([e, n]) => (
            <span key={e} className="rounded-full bg-muted px-3 py-1 font-semibold">
              {EXAM_NAMES[e as ExamName]}: {n}
            </span>
          ))}
          {years.length > 0 && (
            <span className="rounded-full bg-muted px-3 py-1 font-semibold">
              {years.length} saal mein: {years.join(", ")}
            </span>
          )}
        </div>
        <div className="no-print mt-4">
          <Button variant="paper" size="sm" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
        </div>
      </header>

      <p className="mt-6 flex gap-3 rounded-2xl bg-sticky px-4 py-3 text-sticky-foreground">
        <Info className="mt-1 h-4 w-4 shrink-0" />
        <span>
          Yeh unit NCERT ki nayi book (2023 se) mein nahi hai, isliye iska NCERT page nahi diya. Purane {meta.short}{" "}
          papers mein yeh {view.questions.length} baar aaya
          {latest ? ` (aakhri baar ${latest} mein)` : ""}. Agar yeh tumhare saal ke {meta.short} syllabus mein hai to
          neeche ke sawal zaroor practise karo; nahi hai to chhod do aur upar ke chapters par time lagao.
        </span>
      </p>

      <section className="mt-8" aria-labelledby="old-unit-q">
        <h2 id="old-unit-q" className="font-display text-2xl font-extrabold">
          Asli sawal — naye pehle
        </h2>
        <div className="mt-4 space-y-3">
          {view.questions.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      </section>
    </div>
  );
}
