import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Languages } from "lucide-react";

import { BoardSwitch } from "@/components/board-switch";
import { Crumbs } from "@/components/crumbs";
import { SubjectIcon } from "@/components/subject-icon";
import { BOARDS, GRADES, getSubjects, gradeLabel, isBoard, parseGrade, TONE_CLASSES, type BoardId } from "@/lib/catalog";
import { useNotebook } from "@/lib/notebook-store";
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
  const { done } = useNotebook();
  const doneIn = (slug: string) => done.filter((k) => k.startsWith(`${board}/${grade}/${slug}/`)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Crumbs items={[{ label: BOARDS[board].name }, { label }]} />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-hand text-xl text-accent">{BOARDS[board].books}</p>
          <h1 className="text-5xl font-extrabold sm:text-6xl">{label}</h1>
          <p className="mt-2 text-lg text-muted-foreground">Subject chuno — har chapter ke notes, tricks aur audio milenge.</p>
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
                className="grid h-11 min-w-11 place-items-center rounded-xl border-2 border-ink px-3 font-display text-lg font-bold hover:bg-muted data-[active=true]:bg-ink data-[active=true]:text-paper"
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
          return (
            <li key={s.slug}>
              <Link
                to="/learn/$board/$grade/$subject"
                params={{ board, grade: String(grade), subject: s.slug }}
                className="sticker press group flex h-full items-center gap-4 rounded-2xl bg-card p-5"
              >
                <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-ink", tone.solid)}>
                  <SubjectIcon name={s.icon} className="h-7 w-7 text-paper" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-bold leading-tight">{s.name}</span>
                  <span className="block text-muted-foreground">{s.hi}</span>
                  {doneIn(s.slug) > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-tone-leaf/15 px-2 py-0.5 text-xs font-bold text-tone-leaf">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {doneIn(s.slug)} yaad ho gaye
                    </span>
                  )}
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-12 flex items-start gap-3 rounded-2xl border-2 border-dashed border-ink/40 p-5">
        <Languages className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p className="text-muted-foreground">
          Notes <strong className="text-foreground">Hinglish</strong>, <strong className="text-foreground">हिंदी</strong> ya{" "}
          <strong className="text-foreground">English</strong> mein padh aur sun sakte ho. Chapter kholne ke baad upar se
          bhasha badlo.
        </p>
      </div>
    </div>
  );
}
