import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BookOpen, ChevronDown, Lightbulb, NotebookText, Printer, Repeat, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Crumbs } from "@/components/crumbs";
import { QuestionCard } from "@/components/exam/question-card";
import { RevisionButton } from "@/components/exam/revision-button";
import { MathMarkdown } from "@/components/math-markdown";
import { ErrorCard } from "@/components/state-cards";
import { Button } from "@/components/ui/button";
import {
  EXAM_GROUPS,
  EXAM_NAMES,
  isExamGroup,
  isExamSubject,
  parseChapterParam,
  pdfAtPage,
  placeLabel,
  revisionKey,
  SUBJECT_NAMES,
  type ExamChapterView,
  type ExamGroup,
  type ExamName,
  type ExamSubject,
  type NcertPlace,
} from "@/lib/exam";
import { examChapterQuery } from "@/lib/exam-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exam/$group/$subject/$chapter")({
  loader: async ({ params, context }) => {
    const { group, subject, chapter } = params;
    if (!isExamGroup(group) || !isExamSubject(subject) || !EXAM_GROUPS[group].subjects.includes(subject))
      throw notFound();
    if (!parseChapterParam(chapter)) throw notFound();
    const view = await context.queryClient.ensureQueryData(examChapterQuery(group, subject, chapter));
    if (!view) throw notFound();
    return { group, subject, chapter, title: view.title, count: view.questions.length };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Chapter not found — PadhoSuno" }] };
    const g = EXAM_GROUPS[loaderData.group as ExamGroup];
    const title = `${loaderData.title} — ${g.short} PYQ, concepts & tricks | PadhoSuno`;
    const description = `${loaderData.title} (${SUBJECT_NAMES[loaderData.subject as ExamSubject]}) ke ${loaderData.count} asli ${g.short} sawal concept-wise: kya baar-baar aata hai, easy samjhaav, memory trick, solution aur NCERT page.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ChapterIndexPage,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorCard message="Chapter index load nahi hua. Internet check karke dobara try karein." onRetry={reset} />
    </div>
  ),
});

function ChapterIndexPage() {
  const { group, subject, chapter } = Route.useLoaderData() as {
    group: ExamGroup;
    subject: ExamSubject;
    chapter: string;
  };
  const { data } = useSuspenseQuery(examChapterQuery(group, subject, chapter));
  const view = data!;
  const meta = EXAM_GROUPS[group];
  const byExam: Partial<Record<ExamName, number>> = {};
  for (const q of view.questions) byExam[q.exam] = (byExam[q.exam] ?? 0) + 1;
  const years = [...new Set(view.questions.map((q) => q.year))].sort((a, b) => b - a);
  const unmapped = view.questions.filter((q) => !view.concepts.some((c) => c.id === q.conceptId));

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
          { label: view.title },
        ]}
      />

      <header className="mt-6">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">
          {meta.short} · {SUBJECT_NAMES[subject]} · Class {view.grade}
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{view.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-ink px-3 py-1 font-semibold text-paper">{view.questions.length} asli sawal</span>
          {Object.entries(byExam).map(([e, n]) => (
            <span key={e} className="rounded-full bg-muted px-3 py-1 font-semibold">
              {EXAM_NAMES[e as ExamName]}: {n}
            </span>
          ))}
          {years.length > 0 && (
            <span className="rounded-full bg-muted px-3 py-1 font-semibold">
              {years.length} saal mein: {years.slice(0, 10).join(", ")}
            </span>
          )}
        </div>
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <Button variant="paper" size="sm" asChild>
            <Link
              to="/learn/$board/$grade/$subject/$chapter"
              params={{ board: "cbse", grade: String(view.grade), subject, chapter: view.slug }}
            >
              <NotebookText /> Is chapter ke notes
            </Link>
          </Button>
          {view.pdfUrl && (
            <Button variant="paper" size="sm" asChild>
              <a href={view.pdfUrl} target="_blank" rel="noreferrer">
                <BookOpen /> NCERT chapter (PDF)
              </a>
            </Button>
          )}
          <Button variant="paper" size="sm" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
        </div>
      </header>

      <section className="sticker mt-6 rounded-2xl bg-card p-5" aria-label="Revision">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Repeat className="h-5 w-5 text-primary" /> Revision system
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Index padh liya ya revise kar liya? “Revise kiya” dabao — agla revision 1, 3, 7, 15, 30 din baad yaad dilayenge.
        </p>
        <RevisionButton revKey={revisionKey(group, subject, view.grade, view.slug)} className="mt-3" />
      </section>

      {view.questions.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-card px-4 py-3">
          Humne jitne {meta.short} paper dekhe, unme is chapter ki nayi NCERT book wale topics se koi sawal nahi aaya.
          Iska matlab yeh chapter kam weightage wala hai — pehle upar wale chapters pakko, phir NCERT se iska ek baar
          revision kar lo.
        </p>
      ) : (
        !view.ready && (
          <p className="mt-6 rounded-2xl bg-sticky px-4 py-3 text-sticky-foreground">
            Is chapter ka concept index abhi likha ja raha hai. Tab tak neeche asli sawal dekh sakte ho.
          </p>
        )
      )}

      {view.plan && (
        <p className="mt-6 flex gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-accent" />
          <span>
            <span className="font-bold">Kaise padhein: </span>
            <MathMarkdown inline className="inline">{view.plan}</MathMarkdown>
          </span>
        </p>
      )}

      {view.revision.length > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-ink bg-card p-5 print-plain" aria-labelledby="one-screen">
          <h2 id="one-screen" className="font-display text-xl font-extrabold">
            Ek screen revision
          </h2>
          <ol className="mt-3 space-y-2">
            {view.revision.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-highlight text-xs font-bold">
                  {i + 1}
                </span>
                <MathMarkdown inline>{r}</MathMarkdown>
              </li>
            ))}
          </ol>
        </section>
      )}

      {view.concepts.length > 0 && (
        <section className="mt-10" aria-labelledby="concepts">
          <h2 id="concepts" className="font-display text-2xl font-extrabold">
            Concepts — jo sabse zyada aaye, pehle
          </h2>
          <div className="mt-4 space-y-4">
            {view.concepts.map((c, i) => (
              <ConceptCard key={c.id} c={c} rank={i + 1} view={view} />
            ))}
          </div>
        </section>
      )}

      {unmapped.length > 0 && (
        <section className="mt-10" aria-labelledby="other-q">
          <h2 id="other-q" className="font-display text-xl font-extrabold">
            {view.concepts.length ? "Baaki sawal" : "Asli sawal"} ({unmapped.length})
          </h2>
          <div className="mt-3 space-y-3">
            {unmapped.map((q) => (
              <QuestionCard key={q.id} q={q} />
            ))}
          </div>
        </section>
      )}

      {view.oldSyllabus.length > 0 && (
        <section className="mt-10" aria-labelledby="old-q">
          <details className="rounded-2xl border border-dashed border-border bg-card p-4 sm:p-5">
            <summary className="cursor-pointer">
              <h2 id="old-q" className="inline font-display text-xl font-extrabold">
                Purane syllabus ke sawal ({view.oldSyllabus.length})
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ye topics NCERT ki nayi book (2023 se) mein nahi hain:{" "}
                {[...new Set(view.oldSyllabus.map((q) => q.topic).filter(Boolean))].slice(0, 6).join(", ")}. Isliye
                upar ki ginti mein nahi jode. Apne exam ke current syllabus mein ho to hi padhna.
              </p>
            </summary>
            <div className="mt-4 space-y-3">
              {view.oldSyllabus.map((q) => (
                <QuestionCard key={q.id} q={q} />
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}

function NcertChip({ place }: { place: NcertPlace }) {
  return (
    <a
      href={pdfAtPage(place)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold hover:bg-muted"
      title={place.heading}
    >
      <BookOpen className="h-3.5 w-3.5 text-primary" />
      {placeLabel(place)}
      {place.heading && place.kind === "section" ? ` · ${place.heading.slice(0, 40)}` : ""}
      <span className="text-muted-foreground">
        · page {place.printedPage ?? `${place.page} (PDF)`}
      </span>
    </a>
  );
}

function ConceptCard({
  c,
  rank,
  view,
}: {
  c: ExamChapterView["concepts"][number];
  rank: number;
  view: ExamChapterView;
}) {
  const [open, setOpen] = useState(false);
  const qs = view.questions.filter((q) => q.conceptId === c.id);
  const places = (c.ncert ?? []).map((r) => view.places[r]).filter((p): p is NcertPlace => Boolean(p));
  const share = view.questions.length ? Math.round((c.count / view.questions.length) * 100) : 0;
  return (
    <article className="rounded-2xl border border-border bg-card p-5 print-plain">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Concept #{rank}</p>
          <h3 className="font-display text-xl font-extrabold">{c.name}</h3>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-extrabold leading-none">{c.count}×</p>
          <p className="text-xs text-muted-foreground">{share}% sawal is chapter ke</p>
        </div>
      </header>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {Object.entries(c.exams).map(([e, n]) => (
          <span key={e} className="rounded-full bg-muted px-2 py-0.5 font-semibold">
            {EXAM_NAMES[e as ExamName]} {n}
          </span>
        ))}
        {c.years.map((y) => (
          <span key={y} className="rounded-full border border-border px-2 py-0.5">
            {y}
          </span>
        ))}
      </div>

      {c.explain && <MathMarkdown className="mt-3">{c.explain}</MathMarkdown>}
      {c.key && (
        <div className="mt-3 rounded-xl bg-highlight/45 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide">Yaad rakho</p>
          <MathMarkdown inline>{c.key}</MathMarkdown>
        </div>
      )}
      {c.hook && (
        <div className="mt-3 flex gap-2 rounded-xl bg-sticky px-3 py-2 text-sticky-foreground">
          <Lightbulb className="mt-1 h-4 w-4 shrink-0" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide">Memory trick</p>
            <MathMarkdown inline>{c.hook}</MathMarkdown>
          </div>
        </div>
      )}
      {(c.why || c.next || c.trap) && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {c.why && (
            <div className="rounded-xl bg-muted/70 px-3 py-2">
              <dt className="font-bold">Baar-baar kyun aata hai</dt>
              <dd>
                <MathMarkdown inline>{c.why}</MathMarkdown>
              </dd>
            </div>
          )}
          {c.next && (
            <div className="rounded-xl bg-muted/70 px-3 py-2">
              <dt className="font-bold">Aage aise aa sakta hai</dt>
              <dd>
                <MathMarkdown inline>{c.next}</MathMarkdown>
              </dd>
            </div>
          )}
          {c.trap && (
            <div className="rounded-xl bg-destructive/8 px-3 py-2">
              <dt className="flex items-center gap-1 font-bold">
                <TriangleAlert className="h-3.5 w-3.5" /> Galti yahan hoti hai
              </dt>
              <dd>
                <MathMarkdown inline>{c.trap}</MathMarkdown>
              </dd>
            </div>
          )}
        </dl>
      )}

      {places.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">NCERT mein yahan likha hai</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {places.map((p) => (
              <NcertChip key={`${p.kind}-${p.ref}`} place={p} />
            ))}
          </div>
        </div>
      )}

      <div className="no-print mt-4">
        <Button variant="chip" onClick={() => setOpen((v) => !v)} data-active={open} aria-expanded={open}>
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
          {open ? "Sawal chhupao" : `Pichhle saal ke ${qs.length} sawal dekho`}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {qs.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      )}
    </article>
  );
}
