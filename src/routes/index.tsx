import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Flame, Play, RotateCcw, Target } from "lucide-react";
import { useState } from "react";

import { AccountLink } from "@/components/app/account-link";
import { BookTile, shelfGridClass, shelfItems } from "@/components/app/book-cover";
import { ClassPicker, ClassSheet } from "@/components/app/class-picker";
import { SearchButton } from "@/components/search-dialog";
import { Logo } from "@/components/site-header";
import { SubjectIcon } from "@/components/subject-icon";
import { getSubjects, gradeLabel, SUBJECTS, TONE_CLASSES } from "@/lib/catalog";
import { classLabel, myClass, type ClassRef } from "@/lib/my-class";
import {
  chapterStatus,
  notebook,
  refKey,
  streakFrom,
  useNotebook,
  type ChapterRef,
} from "@/lib/notebook-store";
import { classBooksQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PadhoSuno — Class 1–12 Short Notes, Tricks & Audio (NCERT, CBSE, ICSE)" },
      {
        name: "description",
        content:
          "Class 1 se 12 tak NCERT, CBSE aur ICSE ke har chapter ke short notes, yaad karne ki tricks, important questions aur audio — padho bhi, suno bhi.",
      },
      { property: "og:title", content: "PadhoSuno — Padho bhi, suno bhi, turant yaad" },
      {
        property: "og:description",
        content:
          "Har chapter ke short notes + memory tricks + audio. Class 1–12, NCERT, CBSE & ICSE. Hindi, English, Hinglish.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const hydrated = useHydrated();
  const nb = useNotebook();
  const cls = myClass(nb.prefs, nb.recent);
  const [sheet, setSheet] = useState(false);
  const pick = (board: ClassRef["board"], grade: number) => notebook.setPrefs({ board, grade });

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="flex h-14 items-center gap-1 pl-4 pr-2">
          <Logo className="mr-auto" />
          <SearchButton compact />
          <AccountLink />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 md:pt-10">
        {!hydrated ? (
          <HomeSkeleton />
        ) : cls ? (
          <MyShelf cls={cls} onChangeClass={() => setSheet(true)} />
        ) : (
          <Welcome onPick={pick} />
        )}
      </div>

      <ClassSheet
        open={sheet}
        onOpenChange={setSheet}
        board={cls?.board ?? "cbse"}
        grade={cls?.grade ?? null}
        onPick={pick}
      />
    </>
  );
}

function Welcome({ onPick }: { onPick: (board: ClassRef["board"], grade: number) => void }) {
  return (
    <section className="mx-auto max-w-lg pt-2 md:max-w-xl md:pt-6">
      <h1 className="font-display text-[2.1rem] font-extrabold leading-[1.05] md:text-5xl">
        Padho bhi.
        <br />
        Suno bhi.
      </h1>
      <p className="mt-2 text-muted-foreground">
        Class 1–12 · NCERT · ICSE — har chapter ke notes, tricks aur audio.
      </p>
      <div className="mt-6 rounded-3xl border border-border bg-card p-4 shadow-sticker md:p-6">
        <h2 className="font-display text-lg font-extrabold">Apni class chuno</h2>
        <ClassPicker className="mt-3" board="cbse" grade={null} onPick={onPick} />
      </div>
    </section>
  );
}

function MyShelf({ cls, onChangeClass }: { cls: ClassRef; onChangeClass: () => void }) {
  const nb = useNotebook();
  const { data: books, isPending } = useQuery(classBooksQuery(cls.board, cls.grade));
  const items = shelfItems(getSubjects(cls.board, cls.grade), books);
  const last = nb.recent[0];
  const streak = streakFrom(nb.days);

  return (
    <>
      <h1 className="sr-only">PadhoSuno — {classLabel(cls)} ki books</h1>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onChangeClass}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card pl-4 pr-3 text-sm font-bold shadow-sticker-sm transition-colors hover:bg-muted"
          aria-label={`${classLabel(cls)} — class badlo`}
        >
          {classLabel(cls)}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        {streak > 0 && (
          <span
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent/12 px-3.5 text-sm font-bold text-accent"
            title={`${streak} din se lagatar padhai`}
          >
            <Flame className="h-4 w-4" /> {streak} din
          </span>
        )}
      </div>

      {last && <ContinueCard r={last} />}

      <section className="mt-7" aria-labelledby="my-books">
        <h2 id="my-books" className="font-display text-lg font-extrabold md:text-xl">
          Meri books
        </h2>
        <ul className={cn(shelfGridClass, "mt-3")}>
          {isPending && !books
            ? Array.from({ length: 9 }, (_, i) => (
                <li key={i} aria-hidden>
                  <span className="block aspect-[5/7] animate-pulse rounded-md bg-muted" />
                  <span className="mt-2 block h-3 w-3/4 animate-pulse rounded bg-muted" />
                </li>
              ))
            : items.map((it, i) => (
                <li key={`${it.subject.slug}-${it.index}`}>
                  <BookTile
                    board={cls.board}
                    grade={cls.grade}
                    subject={it.subject}
                    book={it.book}
                    bookIndex={it.index}
                    multi={it.multi}
                    eager={i < 6}
                  />
                </li>
              ))}
        </ul>
      </section>

      {cls.grade >= 11 && (
        <Link
          to="/exam"
          className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 pr-4 transition-colors hover:bg-muted"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-paper">
            <Target className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold">JEE / NEET index</span>
            <span className="block truncate text-xs text-muted-foreground">
              10 saal ke asli paper · chapter-wise
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}
    </>
  );
}

function ContinueCard({ r }: { r: ChapterRef }) {
  const nb = useNotebook();
  const subject = SUBJECTS[r.subject];
  const status = chapterStatus(nb, refKey(r));
  const finished = status === "read" || status === "done";
  const tone = TONE_CLASSES[subject?.tone ?? "ink"];
  return (
    <Link
      to="/learn/$board/$grade/$subject/$chapter"
      params={{ board: r.board, grade: String(r.grade), subject: r.subject, chapter: r.chapter }}
      search={r.custom ? { title: r.title } : {}}
      className="mt-4 flex items-center gap-3 rounded-2xl bg-primary p-3 pr-3.5 text-primary-foreground shadow-sticker transition-transform active:scale-[0.99]"
    >
      <span className={cn("grid h-14 w-12 shrink-0 place-items-center rounded-lg text-paper shadow-book", tone.solid)}>
        <SubjectIcon name={subject?.icon ?? "BookOpen"} className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.68rem] font-bold uppercase tracking-wider opacity-75">
          {finished ? "Phir se dohrao" : "Aage padho"}
        </span>
        <span className="block truncate font-display text-base font-bold leading-snug">{r.title}</span>
        <span className="block truncate text-xs opacity-75">
          {subject?.name} · {gradeLabel(r.board, r.grade)}
        </span>
      </span>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-foreground text-primary">
        {finished ? (
          <RotateCcw className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 translate-x-px" fill="currentColor" />
        )}
      </span>
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden>
      <span className="block h-10 w-40 animate-pulse rounded-full bg-muted" />
      <span className="mt-4 block h-20 animate-pulse rounded-2xl bg-muted" />
      <ul className={cn(shelfGridClass, "mt-10")}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <span className="block aspect-[5/7] animate-pulse rounded-md bg-muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}
