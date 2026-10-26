import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Headphones, Timer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Emph } from "@/components/emph";
import { NarrationBar } from "@/components/note/narration-bar";
import { Button } from "@/components/ui/button";
import { useNarration } from "@/hooks/use-narration";
import type { BoardId, Lang } from "@/lib/catalog";
import { fetchSubjectRevisions } from "@/lib/content.functions";
import { notebook, useNotebook } from "@/lib/notebook-store";
import { sentence } from "@/lib/text";
import { spokenLabels, type Track } from "@/lib/tracks";
import type { SyllabusBook } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Plays the 1-minute revision of every ready chapter in a subject, back to back. */
export function ExamMode({
  board,
  grade,
  subject,
  subjectName,
  lang,
  books,
  className,
}: {
  board: BoardId;
  grade: number;
  subject: string;
  subjectName: string;
  lang: Lang;
  books: SyllabusBook[];
  className?: string;
}) {
  const { prefs } = useNotebook();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["revisions", board, grade, subject, lang],
    queryFn: () => fetchSubjectRevisions({ data: { board, grade, subject, lang } }),
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const order = new Map(books.flatMap((b) => b.chapters).map((c, i) => [c.slug, i]));
    return (data ?? [])
      .filter((r) => order.has(r.chapter))
      .sort((a, b) => (order.get(a.chapter) ?? 0) - (order.get(b.chapter) ?? 0));
  }, [data, books]);

  const tracks: Track[] = useMemo(() => {
    const L = spokenLabels(lang);
    return items.map((it, i) => ({
      index: i,
      blockId: `rev-${i}`,
      label: it.title,
      text: [sentence(it.title), sentence(L.revision), ...it.points.map(sentence)].join(" "),
      noteId: it.noteId,
      sourceIndex: it.trackIndex,
    }));
  }, [items, lang]);

  const narration = useNarration({
    noteId: `exam:${board}:${grade}:${subject}:${lang}`,
    tracks,
    lang,
    title: `${subjectName} — Exam revision`,
  });

  useEffect(() => {
    if (!open || !prefs.follow || !narration.activeBlockId || narration.status === "paused") return;
    document
      .getElementById(`blk-${narration.activeBlockId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [open, narration.activeBlockId, prefs.follow, narration.status]);

  if (items.length === 0) return null;

  const minutes = Math.max(1, Math.round(items.length * 1.2));

  return (
    <section className={cn(open && "pb-28", className)}>
      {!open ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <Timer className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-extrabold">
              Exam Mode{books.length > 1 ? ` · poora ${subjectName}` : ""}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {items.length} chapters · {minutes} min revision
            </p>
          </div>
          <Button
            variant="ink"
            size="sm"
            className="h-9 rounded-full px-3.5"
            onClick={() => {
              setOpen(true);
              narration.playAt(0);
            }}
          >
            <Headphones /> Suno
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent">Exam Mode</p>
              <h2 className="font-display text-lg font-extrabold">1-minute revision</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Exam mode band karo"
              onClick={() => {
                narration.stop();
                setOpen(false);
              }}
            >
              <X />
            </Button>
          </div>
          <ol className="mt-6 space-y-4">
            {items.map((it, i) => (
              <li
                key={it.chapter}
                id={`blk-rev-${i}`}
                className={cn(
                  "scroll-mt-32 rounded-2xl border border-border p-4 transition-[outline,box-shadow] duration-300",
                  narration.activeBlockId === `rev-${i}` && "reading-now",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => narration.playAt(i)}
                    className="text-left font-display text-lg font-bold hover:underline"
                  >
                    {it.title}
                  </button>
                  <Link
                    to="/learn/$board/$grade/$subject/$chapter"
                    params={{ board, grade: String(grade), subject, chapter: it.chapter }}
                    search={{ lang }}
                    onClick={() => notebook.setPrefs({ lang })}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"
                  >
                    Poore notes <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {it.points.map((p, j) => (
                    <li key={j} className="flex gap-2 text-[0.95rem]">
                      <span className="text-tone-leaf" aria-hidden>
                        ✓
                      </span>
                      <span>
                        <Emph text={p} />
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <NarrationBar
            narration={narration}
            total={tracks.length}
            ready
            download={{
              noteId: `exam:${board}:${grade}:${subject}:${lang}`,
              tracks,
              title: `${subjectName} — Exam revision`,
            }}
            follow={prefs.follow}
            onFollowChange={(follow) => notebook.setPrefs({ follow })}
          />
        </div>
      )}
    </section>
  );
}
