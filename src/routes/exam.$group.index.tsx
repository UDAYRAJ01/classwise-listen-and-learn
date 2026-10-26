import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Info } from "lucide-react";
import { useMemo } from "react";

import { Crumbs } from "@/components/crumbs";
import { revisionLine } from "@/components/exam/revision-button";
import { ErrorCard } from "@/components/state-cards";
import { SubjectIcon } from "@/components/subject-icon";
import { getSubject, TONE_CLASSES } from "@/lib/catalog";
import {
  chapterParam,
  EXAM_GROUPS,
  isExamGroup,
  isExamSubject,
  revisionKey,
  revisionState,
  SUBJECT_NAMES,
  type ExamChapterStat,
  type ExamGroup,
  type ExamSubject,
} from "@/lib/exam";
import { examOverviewQuery } from "@/lib/exam-queries";
import { localDay, useNotebook } from "@/lib/notebook-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exam/$group/")({
  validateSearch: (s: Record<string, unknown>): { subject?: ExamSubject } =>
    isExamSubject(s["subject"]) ? { subject: s["subject"] } : {},
  loader: async ({ params, context }) => {
    if (!isExamGroup(params.group)) throw notFound();
    await context.queryClient.ensureQueryData(examOverviewQuery(params.group));
    return { group: params.group };
  },
  head: ({ loaderData }) => {
    const g = loaderData ? EXAM_GROUPS[loaderData.group] : null;
    const title = g
      ? `${g.short} Chapter-wise Weightage & Index (last 10 years PYQ) | PadhoSuno`
      : "Exam index — PadhoSuno";
    const description = g
      ? `${g.name}: Class 11–12 ke chapters asli past papers mein kitni baar aaye, kaunse concept sabse zyada poochhe gaye — easy explanation, memory trick aur NCERT page ke saath.`
      : "JEE / NEET chapter index";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: GroupPage,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorCard message="Chapter list load nahi hui. Internet check karke dobara try karein." onRetry={reset} />
    </div>
  ),
});

function GroupPage() {
  const { group } = Route.useLoaderData() as { group: ExamGroup };
  const meta = EXAM_GROUPS[group];
  const search = Route.useSearch();
  const subject: ExamSubject =
    search.subject && meta.subjects.includes(search.subject) ? search.subject : meta.subjects[0]!;
  const { data } = useSuspenseQuery(examOverviewQuery(group));
  const current = data.subjects.find((s) => s.subject === subject)!;
  const max = Math.max(1, ...current.chapters.map((c) => c.questions));
  const { revisions } = useNotebook();
  const today = localDay();

  const due = useMemo(
    () =>
      data.subjects.flatMap((s) =>
        s.chapters
          .filter((c) => revisionState(revisions[revisionKey(group, s.subject, c.grade, c.slug)], today) === "due")
          .map((c) => ({ ...c, subject: s.subject })),
      ),
    [data, revisions, group, today],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
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
          { label: meta.short },
        ]}
      />
      <header className="mt-6">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{meta.name} — chapter index</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {data.totalQuestions} asli sawal, {data.papers.length} paper. Chapters us order mein jitni baar woh aaye — upar wale
          pehle pakko.
        </p>
      </header>

      {due.length > 0 && (
        <section className="sticker mt-6 rounded-2xl bg-sticky p-4 text-sticky-foreground" aria-label="Aaj ka revision">
          <p className="flex items-center gap-2 font-bold">
            <CalendarClock className="h-5 w-5" /> Aaj revise karo ({due.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {due.map((c) => (
              <Link
                key={`${c.subject}-${c.grade}-${c.slug}`}
                to="/exam/$group/$subject/$chapter"
                params={{ group, subject: c.subject, chapter: chapterParam(c.grade, c.slug) }}
                className="rounded-full bg-card px-3 py-1 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {c.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav className="no-scrollbar mt-8 flex gap-2 overflow-x-auto" aria-label="Subject">
        {meta.subjects.map((s) => {
          const info = getSubject("cbse", 11, s);
          const tone = info ? TONE_CLASSES[info.tone] : null;
          const total = data.subjects.find((x) => x.subject === s)?.total ?? 0;
          return (
            <Link
              key={s}
              to="/exam/$group"
              params={{ group }}
              search={{ subject: s }}
              replace
              resetScroll={false}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 font-semibold",
                s === subject ? "border-ink bg-ink text-paper" : "border-border bg-card hover:bg-muted",
              )}
            >
              {info && (
                <span className={cn("grid h-6 w-6 place-items-center rounded-md text-paper", tone?.solid)}>
                  <SubjectIcon name={info.icon} className="h-3.5 w-3.5" />
                </span>
              )}
              {SUBJECT_NAMES[s]} <span className="text-xs opacity-70">{total}</span>
            </Link>
          );
        })}
      </nav>

      {current.chapters.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          Is subject ke sawal abhi chapter-wise jode ja rahe hain. Thodi der baad dekho.
        </div>
      ) : (
        <ol className="mt-6 space-y-2">
          {current.chapters.map((c, i) => (
            <ChapterRow
              key={`${c.grade}-${c.slug}`}
              rank={i + 1}
              c={c}
              max={max}
              group={group}
              subject={subject}
              revision={revisionLine(revisions[revisionKey(group, subject, c.grade, c.slug)], today)}
              revised={Boolean(revisions[revisionKey(group, subject, c.grade, c.slug)])}
            />
          ))}
        </ol>
      )}

      {current.outOfSyllabus > 0 && (
        <p className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {current.outOfSyllabus} purane sawal un topics se the jo ab NCERT book mein nahi hain (book chhoti ki gayi hai) —
          unhe chapter ginti mein nahi joda. Jinka chapter ab bhi hai, wo us chapter ke page par "Purane syllabus ke sawal"
          mein milenge. Inme se kuch topics exam syllabus mein ab bhi ho sakte hain, isliye apna latest syllabus ek baar
          zaroor dekh lo.
        </p>
      )}
    </div>
  );
}

function ChapterRow({
  rank,
  c,
  max,
  group,
  subject,
  revision,
  revised,
}: {
  rank: number;
  c: ExamChapterStat;
  max: number;
  group: ExamGroup;
  subject: ExamSubject;
  revision: string;
  revised: boolean;
}) {
  const span = c.years.length ? `${c.years.length} saal mein aaya (${c.years[0]}–${c.years[c.years.length - 1]})` : "";
  return (
    <li>
      <Link
        to="/exam/$group/$subject/$chapter"
        params={{ group, subject, chapter: chapterParam(c.grade, c.slug) }}
        className="press group grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
      >
        <span className="font-display text-lg font-extrabold text-muted-foreground">#{rank}</span>
        <span className="min-w-0">
          <span className="block font-semibold leading-snug">{c.title}</span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.questions / max) * 100}%` }} />
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Class {c.grade} · {span}
            {c.topConcept ? ` · Sabse zyada: ${c.topConcept}` : ""}
            {revised ? ` · ${revision}` : ""}
          </span>
        </span>
        <span className="flex items-center gap-2 text-right">
          <span>
            <span className="block font-display text-xl font-extrabold">{c.questions}</span>
            <span className="block text-[11px] text-muted-foreground">
              {group === "jee" ? `Main ${c.main} · Adv ${c.advanced}` : "sawal"}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
    </li>
  );
}
