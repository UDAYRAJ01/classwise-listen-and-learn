import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Languages } from "lucide-react";

import { BoardSwitch } from "@/components/board-switch";
import { Crumbs } from "@/components/crumbs";
import { SubjectProgressBar } from "@/components/progress-bits";
import { SubjectIcon } from "@/components/subject-icon";
import {
  BOARDS,
  GRADES,
  getSubjects,
  gradeLabel,
  isBoard,
  parseGrade,
  TONE_CLASSES,
  type BoardId,
} from "@/lib/catalog";
import { useNotebook } from "@/lib/notebook-store";
import { subjectProgress, touchedInSubject } from "@/lib/progress";
import { classChaptersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/$board/$grade/")({
  loader: ({ params }) => {
    const grade = parseGrade(params.grade);
    if (!isBoard(params.board) || grade === null) throw notFound();
    return { board: params.board as BoardId, grade };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Class not found — PadhoSuno" }] };
    const b = BOARDS[loaderData.board];
    const label = gradeLabel(loaderData.board, loaderData.grade);
    const title = `${label} ${b.short} Notes — Sab Subjects | PadhoSuno`;
    const description = `${b.name} ${label} ke sabhi subjects ke short notes, memory tricks, important questions aur audio. Hindi, English aur Hinglish mein.`;
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
  component: SubjectsPage,
});

function SubjectsPage() {
  const { board, grade } = Route.useLoaderData();
  const subjects = getSubjects(board, grade);
  const label = gradeLabel(board, grade);
  const nb = useNotebook();
  // Totals are a bonus: the cards work without them (e.g. offline).
  const { data: chapters } = useQuery(classChaptersQuery(board, grade));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Crumbs items={[{ label: BOARDS[board].name }, { label }]} />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-hand text-xl text-accent">{BOARDS[board].books}</p>
          <h1 className="text-5xl font-extrabold sm:text-6xl">{label}</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Subject chuno — har chapter ke notes, tricks aur audio milenge.
          </p>
        </div>
        <BoardSwitch value={board} grade={grade} />
      </div>

      <nav aria-label="Class" className="no-scrollbar -mx-4 mt-8 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-2">
          {GRADES.map((g) => (
            <li key={g}>
              <Link
                to="/learn/$board/$grade"
                params={{ board, grade: String(g) }}
                data-active={g === grade}
                className="grid h-11 min-w-11 place-items-center rounded-xl border border-border px-3 font-display text-lg font-bold hover:bg-muted data-[active=true]:bg-ink data-[active=true]:text-paper"
              >
                {g}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => {
          const tone = TONE_CLASSES[s.tone];
          const where = { board, grade, subject: s.slug };
          const slugs = chapters?.[s.slug];
          const prog = slugs ? subjectProgress(nb, where, slugs) : null;
          const touched = touchedInSubject(nb, where);
          const readN = prog ? prog.done + prog.read : touched.done + touched.read;
          const anyActivity = readN > 0 || (prog ? prog.started : touched.started) > 0;
          return (
            <li key={s.slug}>
              <Link
                to="/learn/$board/$grade/$subject"
                params={{ board, grade: String(grade), subject: s.slug }}
                className="sticker press group flex h-full flex-col gap-4 rounded-2xl bg-card p-5"
              >
                <span className="flex items-center gap-4">
                  <span
                    className={cn(
                      "grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border",
                      tone.solid,
                    )}
                  >
                    <SubjectIcon name={s.icon} className="h-7 w-7 text-paper" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl font-bold leading-tight">
                      {s.name}
                    </span>
                    <span className="block text-muted-foreground">{s.hi}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
                </span>
                {prog && prog.total > 0 ? (
                  <span className="block">
                    <span className="flex items-baseline justify-between text-xs font-bold text-muted-foreground">
                      <span>
                        {anyActivity ? (
                          <>
                            <span className="text-foreground">{readN}</span>/{prog.total} padhe
                          </>
                        ) : (
                          `${prog.total} chapters`
                        )}
                      </span>
                      {anyActivity && (
                        <span>{prog.left === 0 ? "Sab ho gaye ✓" : `${prog.left} baaki`}</span>
                      )}
                    </span>
                    <SubjectProgressBar
                      className="mt-1.5 h-2"
                      total={prog.total}
                      done={prog.done}
                      read={prog.read}
                      started={prog.started}
                    />
                  </span>
                ) : (
                  anyActivity && (
                    <span className="text-xs font-bold text-tone-leaf">{readN} chapters padhe</span>
                  )
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-12 flex items-start gap-3 rounded-2xl border border-dashed border-border p-5">
        <Languages className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p className="text-muted-foreground">
          Notes <strong className="text-foreground">Hinglish</strong>,{" "}
          <strong className="text-foreground">हिंदी</strong> ya{" "}
          <strong className="text-foreground">English</strong> mein padh aur sun sakte ho. Chapter
          kholne ke baad upar se bhasha badlo.
        </p>
      </div>
    </div>
  );
}
