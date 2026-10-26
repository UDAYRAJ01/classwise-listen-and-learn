import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Info, Printer } from "lucide-react";

import { barIconClass, ScreenHeader } from "@/components/app/screen-header";
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
    <>
    <ScreenHeader
      titleAs="p"
      back={<Link to="/exam/$group" params={{ group }} search={{ subject }} />}
      title={`${meta.short} · ${SUBJECT_NAMES[subject]}`}
      subtitle="NCERT se hata unit"
      actions={
        <button type="button" className={barIconClass} onClick={() => window.print()} aria-label="Print ya PDF">
          <Printer />
        </button>
      }
    />
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-4">
      <header>
        <h1 className="font-display text-[1.6rem] font-extrabold leading-tight sm:text-4xl">{view.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
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
      </header>

      <p className="mt-5 flex gap-3 rounded-2xl bg-sticky px-4 py-3 text-sm text-sticky-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Nayi NCERT book (2023 se) mein ye unit nahi hai. Purane {meta.short} papers mein{" "}
          {view.questions.length} baar aaya{latest ? ` (aakhri ${latest})` : ""}. Apne saal ke syllabus mein ho to
          hi practise karo.
        </span>
      </p>

      <section className="mt-8" aria-labelledby="old-unit-q">
        <h2 id="old-unit-q" className="font-display text-xl font-extrabold">
          Asli sawal — naye pehle
        </h2>
        <div className="mt-4 space-y-3">
          {view.questions.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      </section>
    </div>
    </>
  );
}
