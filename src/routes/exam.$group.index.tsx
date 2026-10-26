import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Info } from "lucide-react";
import { useMemo } from "react";

import { ChipRow, chipClass, ScreenHeader } from "@/components/app/screen-header";
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
    <>
      <ScreenHeader
        back={<Link to="/exam" />}
        title={`${meta.short} chapter index`}
        subtitle={`${data.papers.reduce((n, p) => n + p.questions, 0)} asli sawal · ${data.papers.length} paper · zyada aane wale upar`}
      >
        <ChipRow label="Subject">
          {meta.subjects.map((s) => {
            const info = getSubject("cbse", 11, s);
            const total = data.subjects.find((x) => x.subject === s)?.total ?? 0;
            return (
              <li key={s}>
                <Link
                  to="/exam/$group"
                  params={{ group }}
                  search={{ subject: s }}
                  replace
                  resetScroll={false}
                  data-active={s === subject}
                  className={chipClass}
                >
                  {info && <SubjectIcon name={info.icon} className="h-4 w-4" />}
                  {SUBJECT_NAMES[s]} <span className="text-xs opacity-70">{total}</span>
                </Link>
              </li>
            );
          })}
        </ChipRow>
      </ScreenHeader>
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-4">
      {due.length > 0 && (
        <section className="mb-4 rounded-2xl bg-sticky p-4 text-sticky-foreground" aria-label="Aaj ka revision">
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


      {current.chapters.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          Is subject ke sawal abhi chapter-wise jode ja rahe hain. Thodi der baad dekho.
        </div>
      ) : (
        <ol className="space-y-2">
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

      {current.oldUnits.length > 0 && (
        <section className="mt-10" aria-labelledby="old-units">
          <h2 id="old-units" className="font-display text-xl font-extrabold">
            NCERT se hataye gaye units
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Nayi NCERT mein nahi, par purane papers mein aaye. Syllabus mein ho to hi padho.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {current.oldUnits.map((u) => (
              <li key={u.unit}>
                <Link
                  to="/exam/$group/$subject/old/$unit"
                  params={{ group, subject, unit: u.unit }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{u.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {u.questions} sawal · aakhri baar {u.years[u.years.length - 1]}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {current.outOfSyllabus > 0 && (
        <p className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {current.outOfSyllabus} purane sawal hataye gaye topics ke the — ginti mein nahi jode. Wo chapter page par
          "Purane syllabus ke sawal" ya upar ke units mein hain.
        </p>
      )}
    </div>
    </>
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
