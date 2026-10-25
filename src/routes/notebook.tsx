import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookCheck,
  BookmarkCheck,
  CheckCircle2,
  Flame,
  History,
  ListTodo,
  NotebookPen,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { SubjectProgressBar } from "@/components/progress-bits";
import { ChapterRefCard } from "@/components/recent-strip";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import {
  BOARDS,
  getSubject,
  gradeLabel,
  isBoard,
  parseGrade,
  TONE_CLASSES,
  type BoardId,
} from "@/lib/catalog";
import {
  chapterStatus,
  notebook,
  refKey,
  streakFrom,
  useNotebook,
  type ChapterRef,
} from "@/lib/notebook-store";
import { subjectProgress, touchedInSubject } from "@/lib/progress";
import { classChaptersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notebook")({
  head: () => ({
    meta: [
      { title: "Meri Notebook — Padhe aur Baaki Chapters | PadhoSuno" },
      {
        name: "description",
        content:
          "Kaun se chapters padh liye, kaun se baaki hain, saved chapters aur aapki streak — sab ek jagah.",
      },
      { property: "og:title", content: "Meri Notebook — PadhoSuno" },
      {
        property: "og:description",
        content: "Padhe hue aur baaki chapters, saved notes aur aapki progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotebookPage,
});

type Tab = "progress" | "saved" | "recent";

interface SubjectGroup {
  board: BoardId;
  grade: number;
  subject: string;
  lastAt: number;
}

/** Every subject the student has touched, newest first. */
function useTouchedSubjects(): SubjectGroup[] {
  const nb = useNotebook();
  return useMemo(() => {
    const groups = new Map<string, SubjectGroup>();
    const add = (key: string, at: number) => {
      const [board, g, subject] = key.split("/");
      const grade = parseGrade(g ?? "");
      if (!isBoard(board) || grade === null || !subject || !getSubject(board, grade, subject))
        return;
      const id = `${board}/${grade}/${subject}`;
      const prev = groups.get(id);
      if (!prev || at > prev.lastAt) groups.set(id, { board, grade, subject, lastAt: at });
    };
    for (const r of nb.recent) add(refKey(r), r.at);
    for (const r of nb.saved) add(refKey(r), r.at);
    for (const k of [...nb.read, ...nb.done, ...Object.keys(nb.progress)]) add(k, 0);
    return [...groups.values()].sort((a, b) => b.lastAt - a.lastAt);
  }, [nb]);
}

function NotebookPage() {
  const nb = useNotebook();
  const { saved, recent, done, days } = nb;
  const streak = streakFrom(days);
  const readCount = new Set([...nb.read, ...done]).size;
  const [tab, setTab] = useState<Tab>("progress");
  const list: ChapterRef[] = tab === "saved" ? saved : recent;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-hand text-xl text-accent">Sirf aapke liye</p>
          <h1 className="flex items-center gap-3 text-5xl font-extrabold">
            <NotebookPen className="h-10 w-10" /> Meri Notebook
          </h1>
          <p className="mt-2 text-muted-foreground">
            Isi device par save rehta hai. Login karoge to har device par milega.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
          {[
            { n: readCount, l: "padh liye", icon: BookCheck },
            { n: done.length, l: "yaad ho gaye", icon: CheckCircle2 },
            { n: saved.length, l: "saved", icon: BookmarkCheck },
            { n: streak, l: "din ki streak", icon: Flame },
          ].map((s) => (
            <div key={s.l} className="sticker rounded-2xl bg-card px-5 py-3 text-center">
              <dt className="flex items-center justify-center gap-1.5 font-display text-3xl font-extrabold">
                <s.icon className="h-5 w-5 text-accent" /> {s.n}
              </dt>
              <dd className="font-hand text-base text-muted-foreground">{s.l}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" className="sticker inline-flex flex-wrap gap-1 rounded-xl bg-card p-1">
          {(
            [
              ["progress", "Padhe / Baaki", ListTodo, null],
              ["saved", "Saved", BookmarkCheck, saved.length],
              ["recent", "Haal hi mein padhe", History, recent.length],
            ] as const
          ).map(([id, label, Icon, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-active={tab === id}
              onClick={() => setTab(id)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold hover:bg-muted data-[active=true]:bg-ink data-[active=true]:text-paper"
            >
              <Icon className="h-4 w-4" /> {label}
              {count !== null && <span className="opacity-60">{count}</span>}
            </button>
          ))}
        </div>
        {tab === "recent" && recent.length > 0 && (
          <Button variant="ghost" onClick={() => notebook.clearRecent()}>
            <Trash2 /> History saaf karo
          </Button>
        )}
      </div>

      {tab === "progress" ? (
        <ProgressTab />
      ) : list.length === 0 ? (
        <EmptyCard
          title={
            tab === "saved" ? "Abhi koi chapter save nahi kiya." : "Abhi tak koi chapter nahi padha."
          }
          body={
            tab === "saved"
              ? "Kisi bhi chapter par “Save” dabao, wo yahan aa jayega."
              : "Koi chapter kholo — wo yahan dikhega taaki baad mein wahin se shuru kar sako."
          }
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {list.map((r) => (
            <li key={refKey(r)} className="relative">
              <ChapterRefCard r={r} />
              {tab === "saved" && (
                <button
                  type="button"
                  onClick={() => notebook.toggleSaved(r)}
                  aria-label={`${r.title} ko hatao`}
                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-card text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="paper-ruled sticker mt-8 rounded-3xl p-10 pl-16 text-center">
      <p className="font-hand text-3xl leading-[1.9rem]">{title}</p>
      <p className="mt-2 leading-[1.9rem] text-muted-foreground">{body}</p>
      <Button asChild variant="ink" size="lg" className="mt-6">
        <Link to="/" hash="classes">
          Class chuno
        </Link>
      </Button>
    </div>
  );
}

function ProgressTab() {
  const nb = useNotebook();
  const groups = useTouchedSubjects();
  const classes = useMemo(
    () => [...new Map(groups.map((g) => [`${g.board}/${g.grade}`, g])).values()],
    [groups],
  );
  const results = useQueries({
    queries: classes.map((c) => classChaptersQuery(c.board, c.grade)),
  });
  const chaptersFor = (board: BoardId, grade: number, subject: string) => {
    const i = classes.findIndex((c) => c.board === board && c.grade === grade);
    return results[i]?.data?.[subject] ?? null;
  };
  const unfinished = nb.recent.filter((r) => chapterStatus(nb, refKey(r)) === "started");

  if (groups.length === 0) {
    return (
      <EmptyCard
        title="Abhi koi chapter shuru nahi kiya."
        body="Chapter padhte hi yahan dikhega ki kaun se padh liye aur kaun se baaki hain."
      />
    );
  }

  return (
    <div className="mt-8 space-y-10">
      {unfinished.length > 0 && (
        <section>
          <h2 className="text-xl font-extrabold">Adhure chapters — inhe poora karo</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {unfinished.slice(0, 6).map((r) => (
              <li key={refKey(r)}>
                <ChapterRefCard r={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xl font-extrabold">Subject-wise: kitne padhe, kitne baaki</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const subject = getSubject(g.board, g.grade, g.subject)!;
            const tone = TONE_CLASSES[subject.tone];
            const where = { board: g.board, grade: g.grade, subject: g.subject };
            const slugs = chaptersFor(g.board, g.grade, g.subject);
            const prog = slugs ? subjectProgress(nb, where, slugs) : null;
            const touched = touchedInSubject(nb, where);
            const readN = prog ? prog.done + prog.read : touched.done + touched.read;
            const params = { board: g.board, grade: String(g.grade), subject: g.subject };
            return (
              <li key={`${g.board}/${g.grade}/${g.subject}`} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border",
                      tone.solid,
                    )}
                  >
                    <SubjectIcon name={subject.icon} className="h-5 w-5 text-paper" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {BOARDS[g.board].short} · {gradeLabel(g.board, g.grade)}
                    </p>
                    <p className="font-display text-lg font-bold leading-tight">{subject.name}</p>
                  </div>
                  <p className="text-right font-display text-2xl font-extrabold">
                    {readN}
                    {prog && <span className="text-sm text-muted-foreground">/{prog.total}</span>}
                  </p>
                </div>
                {prog && (
                  <SubjectProgressBar
                    className="mt-4"
                    total={prog.total}
                    done={prog.done}
                    read={prog.read}
                    started={prog.started}
                  />
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  {readN} padhe
                  {prog ? (
                    <>
                      {" · "}
                      <strong className={cn(prog.left === 0 ? "text-tone-leaf" : "text-foreground")}>
                        {prog.left === 0 ? "sab ho gaye ✓" : `${prog.left} baaki`}
                      </strong>
                    </>
                  ) : null}
                  {(prog?.done ?? touched.done) > 0 && ` · ${prog?.done ?? touched.done} yaad`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(!prog || prog.left > 0) && (
                    <Button asChild variant="ink" size="sm">
                      <Link to="/learn/$board/$grade/$subject" params={params} search={{ show: "left" }}>
                        Baaki chapters <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  {readN > 0 && (
                    <Button asChild variant="paper" size="sm">
                      <Link to="/learn/$board/$grade/$subject" params={params} search={{ show: "read" }}>
                        Padhe hue
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
