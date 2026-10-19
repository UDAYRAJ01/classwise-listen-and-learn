import { Link } from "@tanstack/react-router";
import { ArrowRight, History } from "lucide-react";

import { SubjectIcon } from "@/components/subject-icon";
import { BOARDS, SUBJECTS, TONE_CLASSES } from "@/lib/catalog";
import { useNotebook, type ChapterRef } from "@/lib/notebook-store";
import { cn } from "@/lib/utils";

export function ChapterRefCard({ r, done }: { r: ChapterRef; done?: boolean }) {
  const subject = SUBJECTS[r.subject];
  const tone = TONE_CLASSES[subject?.tone ?? "ink"];
  return (
    <Link
      to="/learn/$board/$grade/$subject/$chapter"
      params={{ board: r.board, grade: String(r.grade), subject: r.subject, chapter: r.chapter }}
      search={r.custom ? { title: r.title } : {}}
      className="sticker press flex h-full items-start gap-3 rounded-2xl bg-card p-4"
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone.soft)}>
        <SubjectIcon name={subject?.icon ?? "BookOpen"} className={cn("h-5 w-5", tone.text)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {BOARDS[r.board].short} · Class {r.grade} · {subject?.name}
        </span>
        <span className="mt-0.5 line-clamp-2 block font-display text-base font-bold leading-snug">
          {r.title}
        </span>
        {done && (
          <span className="mt-1 inline-block rounded-full bg-tone-leaf/15 px-2 py-0.5 text-xs font-bold text-tone-leaf">
            ✓ Yaad ho gaya
          </span>
        )}
      </span>
    </Link>
  );
}

export function RecentStrip() {
  const { recent, done } = useNotebook();
  if (recent.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold">
          <History className="h-6 w-6 text-accent" /> Jahan chhoda tha
        </h2>
        <Link
          to="/notebook"
          className="inline-flex items-center gap-1 text-sm font-bold hover:underline"
        >
          Sab dekho <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ul className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
        {recent.slice(0, 6).map((r) => (
          <li
            key={`${r.board}${r.grade}${r.subject}${r.chapter}`}
            className="w-72 shrink-0 snap-start"
          >
            <ChapterRefCard
              r={r}
              done={done.includes(`${r.board}/${r.grade}/${r.subject}/${r.chapter}`)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
