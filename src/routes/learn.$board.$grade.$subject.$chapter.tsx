import { coverFor } from "@/lib/ncert-covers";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Brain,
  CheckCircle2,
  Circle,
  Headphones,
  Printer,
  Share2,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Crumbs } from "@/components/crumbs";
import { Flashcards } from "@/components/note/flashcards";
import { NarrationBar } from "@/components/note/narration-bar";
import { NoteView, SECTIONS } from "@/components/note/note-view";
import { Quiz } from "@/components/note/quiz";
import { ReportDialog } from "@/components/note/report-dialog";
import { ErrorCard, GeneratingBanner } from "@/components/state-cards";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { useGeneration } from "@/hooks/use-generation";
import { useNarration } from "@/hooks/use-narration";
import {
  BOARDS,
  DEFAULT_LANG,
  getSubject,
  gradeLabel,
  isBoard,
  isLang,
  LANGS,
  parseGrade,
  TONE_CLASSES,
  type BoardId,
  type Lang,
  type SubjectMeta,
} from "@/lib/catalog";
import { notebook, refKey, useNotebook } from "@/lib/notebook-store";
import { noteLanguagesQuery, noteQuery, syllabusQuery } from "@/lib/queries";
import { customTopicSlug, isCustomSlug, normalizeTopic, TOPIC_MAX } from "@/lib/slugs";
import { buildTracks } from "@/lib/tracks";
import type { NoteRecord, PartialNote, SyllabusChapter, SyllabusRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChapterSearch {
  lang?: Lang;
  title?: string;
}

interface ChapterMeta {
  title: string;
  bookName: string | null;
  /** Official textbook chapter PDF (NCERT) when known. */
  textbookUrl: string | null;
  cover?: string;
  number: number | null;
  custom: boolean;
  prev: SyllabusChapter | null;
  next: SyllabusChapter | null;
}

function resolveMeta(
  chapter: string,
  syllabus: SyllabusRecord | null,
  note: NoteRecord | null,
  title: string | undefined,
): ChapterMeta | null {
  if (isCustomSlug(chapter)) {
    const t = note?.chapter_title ?? (title && customTopicSlug(title) === chapter ? title : null);
    return t
      ? { title: t, bookName: null, textbookUrl: null, number: null, custom: true, prev: null, next: null }
      : null;
  }
  const all = (syllabus?.books ?? []).flatMap((b) => b.chapters.map((c) => ({ c, book: b.name, code: b.code })));
  const i = all.findIndex((x) => x.c.slug === chapter);
  if (i < 0) {
    return note
      ? {
          title: note.chapter_title,
          bookName: note.book_name,
          textbookUrl: null,
          number: null,
          custom: false,
          prev: null,
          next: null,
        }
      : null;
  }
  const cur = all[i]!;
  return {
    title: cur.c.title,
    bookName: cur.book,
    cover: coverFor(cur.code),
    textbookUrl: cur.code
      ? `https://ncert.nic.in/textbook/pdf/${cur.code}${String(cur.c.pdf ?? cur.c.number).padStart(2, "0")}.pdf`
      : null,
    number: cur.c.number,
    custom: false,
    prev: all[i - 1]?.c ?? null,
    next: all[i + 1]?.c ?? null,
  };
}

export const Route = createFileRoute("/learn/$board/$grade/$subject/$chapter")({
  validateSearch: (s: Record<string, unknown>): ChapterSearch => ({
    ...(isLang(s["lang"]) ? { lang: s["lang"] } : {}),
    ...(typeof s["title"] === "string" && normalizeTopic(s["title"])
      ? { title: normalizeTopic(s["title"]).slice(0, TOPIC_MAX) }
      : {}),
  }),
  loaderDeps: ({ search }) => ({ lang: search.lang ?? DEFAULT_LANG, title: search.title }),
  loader: async ({ params, context, deps }) => {
    const grade = parseGrade(params.grade);
    if (!isBoard(params.board) || grade === null) throw notFound();
    const subject = getSubject(params.board, grade, params.subject);
    if (!subject) throw notFound();
    const [syllabus, note] = await Promise.all([
      context.queryClient.ensureQueryData(syllabusQuery(params.board, grade, subject.slug)),
      context.queryClient.ensureQueryData(
        noteQuery(params.board, grade, subject.slug, params.chapter, deps.lang),
      ),
    ]);
    const meta = resolveMeta(params.chapter, syllabus, note, deps.title);
    if (!meta && syllabus && !isCustomSlug(params.chapter)) throw notFound();
    return {
      board: params.board as BoardId,
      grade,
      subjectSlug: subject.slug,
      chapter: params.chapter,
      lang: deps.lang,
      title: meta?.title ?? null,
      bookName: meta?.bookName ?? null,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.title) return { meta: [{ title: "Chapter notes — PadhoSuno" }] };
    const s = getSubject(loaderData.board, loaderData.grade, loaderData.subjectSlug);
    const label = gradeLabel(loaderData.board, loaderData.grade);
    const b = BOARDS[loaderData.board].short;
    const title = `${loaderData.title} — ${label} ${s?.name} Notes, Tricks & Audio (${b}) | PadhoSuno`;
    const description = `${loaderData.title}: ${label} ${s?.name} (${b}) ke short notes, yaad karne ki tricks, important questions, quick revision aur audio.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: `${loaderData.title} — ${label} ${s?.name} Notes` },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ChapterPage,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorCard
        message="Notes load nahi hue. Internet check karke dobara try karein."
        onRetry={reset}
      />
    </div>
  ),
});

function ChapterPage() {
  const { board, grade, subjectSlug, chapter, lang } = Route.useLoaderData();
  const search = Route.useSearch();
  const subject = getSubject(board, grade, subjectSlug)!;
  const { data: syllabus } = useSuspenseQuery(syllabusQuery(board, grade, subject.slug));
  const { data: note } = useSuspenseQuery(noteQuery(board, grade, subject.slug, chapter, lang));
  const meta = resolveMeta(chapter, syllabus, note, search.title);

  if (!meta) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorCard
          title="Chapter nahi mila"
          message="Ye chapter ab tak khula nahi hai. Subject ki chapter list se dobara kholiye."
        />
        <Button asChild variant="paper" className="mt-6">
          <Link
            to="/learn/$board/$grade/$subject"
            params={{ board, grade: String(grade), subject: subject.slug }}
          >
            <ArrowLeft /> {subject.name} ke chapters
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <ChapterView
      key={`${chapter}:${lang}`}
      board={board}
      grade={grade}
      subject={subject}
      chapter={chapter}
      lang={lang}
      note={note}
      meta={meta}
      searchTitle={search.title}
    />
  );
}

function ChapterView({
  board,
  grade,
  subject,
  chapter,
  lang,
  note,
  meta,
  searchTitle,
}: {
  board: BoardId;
  grade: number;
  subject: SubjectMeta;
  chapter: string;
  lang: Lang;
  note: NoteRecord | null;
  meta: ChapterMeta;
  searchTitle: string | undefined;
}) {
  const queryClient = useQueryClient();
  const { saved, done, prefs } = useNotebook();
  const [cardsOpen, setCardsOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const label = gradeLabel(board, grade);
  const tone = TONE_CLASSES[subject.tone];
  const ref = { board, grade, subject: subject.slug, chapter };
  const key = refKey(ref);
  const isSaved = saved.some((s) => refKey(s) === key);
  const isDone = done.includes(key);

  const gen = useGeneration<PartialNote, NoteRecord>({
    key: `note:${board}:${grade}:${subject.slug}:${chapter}:${lang}`,
    url: "/api/notes",
    body: {
      board,
      grade,
      subject: subject.slug,
      chapter,
      lang,
      ...(meta.custom ? { title: meta.title } : {}),
    },
    enabled: !note,
    onDone: (rec) => {
      queryClient.setQueryData(noteQuery(board, grade, subject.slug, chapter, lang).queryKey, rec);
      void queryClient.invalidateQueries({
        queryKey: noteLanguagesQuery(board, grade, subject.slug, chapter).queryKey,
      });
    },
  });
  const { data: readyLangs } = useQuery(noteLanguagesQuery(board, grade, subject.slug, chapter));

  const record = note ?? gen.result;
  const content: PartialNote = record?.content ?? gen.partial ?? {};
  const streaming = !record && gen.status === "running";

  const tracks = useMemo(() => (record ? buildTracks(record.content, lang) : []), [record, lang]);
  const mcqs = record?.content.mcqs ?? [];
  const blockToTrack = useMemo(() => new Map(tracks.map((t) => [t.blockId, t.index])), [tracks]);
  const narration = useNarration({
    noteId: record?.id ?? null,
    tracks,
    lang,
    title: meta.title,
    warmUp: true,
  });

  // Remember this chapter once its notes exist.
  useEffect(() => {
    if (record) notebook.visit({ ...ref, title: meta.title, custom: meta.custom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  // Closing the tab mid-way loses the half-written notes, so ask first.
  useEffect(() => {
    if (!streaming) return undefined;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [streaming]);

  // Read-along: keep the block being spoken in view.
  useEffect(() => {
    if (!prefs.follow || !narration.activeBlockId || narration.status === "paused") return;
    document
      .getElementById(`blk-${narration.activeBlockId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [narration.activeBlockId, prefs.follow, narration.status]);

  const sections = SECTIONS.filter((s) => {
    switch (s.id) {
      case "summary":
        return true;
      case "notes":
        return (content.keyPoints?.length ?? 0) > 0;
      case "terms":
        return (content.keyTerms?.length ?? 0) > 0;
      case "formulas":
        return (content.formulas?.length ?? 0) > 0;
      case "tricks":
        return (content.tricks?.length ?? 0) > 0;
      case "questions":
        return (content.questions?.length ?? 0) > 0;
      case "revision":
        return (content.quickRevision?.length ?? 0) > 0;
      case "tips":
        return (content.examTips?.length ?? 0) > 0 || !!content.funFact;
    }
  });

  const toggleSave = () => {
    const now = notebook.toggleSaved({ ...ref, title: meta.title, custom: meta.custom });
    toast.success(now ? "Notebook mein save ho gaya" : "Notebook se hata diya");
  };
  const toggleDone = () => {
    const now = notebook.toggleDone(ref);
    if (now) toast.success("Shabash! Chapter yaad ho gaya ✓");
  };

  const share = async () => {
    const url = window.location.href;
    const text = `${meta.title} — ${label} ${subject.name} ke short notes, tricks aur audio`;
    if (navigator.share) {
      try {
        await navigator.share({ title: meta.title, text, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}: ${url}`);
      toast.success("Link copy ho gaya — WhatsApp par dosto ko bhejo!");
    } catch {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`,
        "_blank",
        "noopener",
      );
    }
  };

  const hasError = !record && gen.status === "error" && gen.error;

  return (
    <div className="pb-44">
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <Crumbs
          items={[
            {
              label,
              link: (
                <Link
                  to="/learn/$board/$grade"
                  params={{ board, grade: String(grade) }}
                  className="hover:text-foreground"
                >
                  {BOARDS[board].short} · {label}
                </Link>
              ),
            },
            {
              label: subject.name,
              link: (
                <Link
                  to="/learn/$board/$grade/$subject"
                  params={{ board, grade: String(grade), subject: subject.slug }}
                  className="hover:text-foreground"
                >
                  {subject.name}
                </Link>
              ),
            },
            { label: meta.number ? `Chapter ${meta.number}` : "Topic" },
          ]}
        />

        <header className="mt-6 flow-root">
          {meta.cover && (
            <img
              src={meta.cover}
              alt={`${meta.bookName ?? "NCERT"} book cover`}
              width={96}
              height={136}
              className="no-print float-right ml-4 hidden h-36 w-auto rounded-md border border-border shadow-sticker sm:block"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-bold",
                tone.soft,
              )}
            >
              <SubjectIcon name={subject.icon} className={cn("h-4 w-4", tone.text)} />
              {subject.name} · {label}
            </span>
            {meta.bookName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-semibold text-muted-foreground">
                <BookOpen className="h-4 w-4" /> {meta.bookName}
              </span>
            )}
            {meta.textbookUrl ? (
              <a
                href={meta.textbookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="no-print inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm font-bold hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" /> NCERT textbook (PDF)
              </a>
            ) : (
              board === "icse" &&
              !meta.custom && (
                <a
                  href="https://cisce.org/regulations-and-syllabuses/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="CISCE ki official free textbook PDF nahi hoti — school ki prescribed book se milao."
                  className="no-print inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm font-bold hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4" /> CISCE syllabus
                </a>
              )
            )}
            {meta.custom && (
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold">
                Aapka topic
              </span>
            )}
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold sm:text-5xl">
            {meta.number && (
              <span className="mr-3 font-hand text-3xl font-bold text-accent sm:text-4xl">
                Ch {meta.number}.
              </span>
            )}
            {meta.title}
          </h1>

          <div className="no-print mt-6 flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Bhasha"
              className="sticker inline-flex gap-1 rounded-xl bg-card p-1"
            >
              {LANGS.map((l) => (
                <Link
                  key={l.id}
                  to="/learn/$board/$grade/$subject/$chapter"
                  params={{ board, grade: String(grade), subject: subject.slug, chapter }}
                  search={{ lang: l.id, ...(searchTitle ? { title: searchTitle } : {}) }}
                  onClick={() => notebook.setPrefs({ lang: l.id })}
                  role="tab"
                  aria-selected={lang === l.id}
                  data-active={lang === l.id}
                  title={
                    readyLangs?.includes(l.id)
                      ? "Taiyaar hai — turant khulega"
                      : "Pehli baar banega"
                  }
                  className="relative rounded-lg px-3 py-1.5 text-sm font-bold hover:bg-muted data-[active=true]:bg-ink data-[active=true]:text-paper"
                >
                  {l.native}
                  {readyLangs?.includes(l.id) && lang !== l.id && (
                    <span
                      className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-tone-leaf"
                      aria-label="ready"
                    />
                  )}
                </Link>
              ))}
            </div>
            <Button variant="paper" onClick={toggleSave} aria-pressed={isSaved}>
              {isSaved ? <BookmarkCheck className="text-accent" /> : <Bookmark />}
              {isSaved ? "Saved" : "Save"}
            </Button>
            <Button variant={isDone ? "ink" : "paper"} onClick={toggleDone} aria-pressed={isDone}>
              {isDone ? <CheckCircle2 /> : <Circle />}
              {isDone ? "Yaad ho gaya" : "Yaad ho gaya?"}
            </Button>
            <Button variant="sun" onClick={() => setCardsOpen(true)} disabled={!record}>
              <Brain /> Flashcards
            </Button>
            {(!record || mcqs.length > 0) && (
              <Button variant="marker" onClick={() => setQuizOpen(true)} disabled={!record}>
                <Target /> Quiz
              </Button>
            )}
            <Button variant="ghost" onClick={share} aria-label="Share karein">
              <Share2 /> <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.print()}
              disabled={!record}
              aria-label="Print ya PDF save karein"
            >
              <Printer /> <span className="hidden sm:inline">Print / PDF</span>
            </Button>
          </div>
        </header>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-10 px-4 lg:grid-cols-[200px_1fr]">
        <aside className="no-print hidden lg:block">
          <nav aria-label="Is chapter mein" className="sticky top-24 space-y-1">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Is chapter mein
            </p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#sec-${s.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
            {record && (
              <button
                type="button"
                onClick={() => narration.playAt(0)}
                className="mt-4 flex w-full items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-bold"
              >
                <Headphones className="h-4 w-4" /> Shuru se suno
              </button>
            )}
          </nav>
        </aside>

        <div className="min-w-0 space-y-8">
          {streaming && (
            <GeneratingBanner
              title="Aapke notes ban rahe hain"
              note="Pehli baar lagbhag 1 minute lagta hai — notes saath-saath likhe ja rahe hain, padhna shuru kar sakte ho."
            />
          )}
          {hasError ? (
            <ErrorCard message={gen.error!.message} onRetry={gen.retry} />
          ) : (
            <NoteView
              content={content}
              streaming={streaming}
              activeBlockId={narration.activeBlockId}
              playable={!!record}
              onPlayBlock={(id) => {
                const i = blockToTrack.get(id);
                if (i !== undefined) narration.playAt(i);
              }}
            />
          )}

          {record && mcqs.length > 0 && (
            <div className="no-print sticker-lg flex flex-col items-start justify-between gap-4 rounded-3xl bg-accent p-6 text-accent-foreground sm:flex-row sm:items-center sm:p-8">
              <div>
                <p className="font-display text-2xl font-extrabold">Kitna yaad hua? Quiz do!</p>
                <p className="font-hand text-xl">
                  {mcqs.length} sawaal · sirf {Math.max(1, Math.round(mcqs.length / 4))}–
                  {Math.max(2, Math.round(mcqs.length / 2))} minute
                </p>
              </div>
              <Button variant="paper" size="lg" onClick={() => setQuizOpen(true)}>
                <Target /> Quiz shuru karo
              </Button>
            </div>
          )}

          {record && (
            <div className="flex justify-end">
              <ReportDialog noteId={record.id} />
            </div>
          )}

          {(meta.prev || meta.next) && (
            <nav aria-label="Aur chapters" className="no-print grid gap-4 pt-8 sm:grid-cols-2">
              {meta.prev ? (
                <Link
                  to="/learn/$board/$grade/$subject/$chapter"
                  params={{
                    board,
                    grade: String(grade),
                    subject: subject.slug,
                    chapter: meta.prev.slug,
                  }}
                  search={{ lang }}
                  className="sticker press flex min-w-0 items-center gap-3 rounded-2xl bg-card p-4"
                >
                  <ArrowLeft className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Pichla chapter
                    </span>
                    <span className="block truncate font-display font-bold">{meta.prev.title}</span>
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {meta.next && (
                <Link
                  to="/learn/$board/$grade/$subject/$chapter"
                  params={{
                    board,
                    grade: String(grade),
                    subject: subject.slug,
                    chapter: meta.next.slug,
                  }}
                  search={{ lang }}
                  className="sticker press flex min-w-0 items-center justify-end gap-3 rounded-2xl bg-card p-4 text-right"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Agla chapter
                    </span>
                    <span className="block truncate font-display font-bold">{meta.next.title}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>

      {!hasError && (
        <NarrationBar
          narration={narration}
          total={tracks.length}
          ready={!!record}
          follow={prefs.follow}
          onFollowChange={(follow) => notebook.setPrefs({ follow })}
        />
      )}

      {record && <Flashcards note={record.content} open={cardsOpen} onOpenChange={setCardsOpen} />}
      {record && mcqs.length > 0 && <Quiz mcqs={mcqs} open={quizOpen} onOpenChange={setQuizOpen} />}
    </div>
  );
}
