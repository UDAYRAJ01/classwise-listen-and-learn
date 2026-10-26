import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookCheck,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { barIconClass, ScreenHeader } from "@/components/app/screen-header";
import { Flashcards } from "@/components/note/flashcards";
import { NarrationBar } from "@/components/note/narration-bar";
import { NoteView } from "@/components/note/note-view";
import { Quiz } from "@/components/note/quiz";
import { ReportDialog } from "@/components/note/report-dialog";
import { ReadMeter } from "@/components/progress-bits";
import { ErrorCard, GeneratingBanner } from "@/components/state-cards";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { useGeneration } from "@/hooks/use-generation";
import { useNarration } from "@/hooks/use-narration";
import { useReadTracker } from "@/hooks/use-read-tracker";
import {
  type BoardId,
  BOARDS,
  DEFAULT_LANG,
  getSubject,
  gradeLabel,
  isBoard,
  isLang,
  type Lang,
  LANGS,
  parseGrade,
  renamedSubject,
  type SubjectMeta,
  TONE_CLASSES,
} from "@/lib/catalog";
import { coverFor } from "@/lib/ncert-covers";
import { chapterParam, EXAM_GROUPS, isExamSubject, parseChapterParam } from "@/lib/exam";
import { sectionForBlock, visibleSections } from "@/lib/note-sections";
import { chapterStatus, notebook, refKey, useNotebook } from "@/lib/notebook-store";
import { noteLanguagesQuery, noteQuery, syllabusQuery } from "@/lib/queries";
import { customTopicSlug, isCustomSlug, normalizeTopic, TOPIC_MAX } from "@/lib/slugs";
import { buildTracks } from "@/lib/tracks";
import type { NoteRecord, PartialNote, SyllabusChapter, SyllabusRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const actionChip =
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 text-sm font-bold transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 data-[on=true]:border-tone-leaf/50 data-[on=true]:bg-tone-leaf/12 data-[on=true]:text-tone-leaf";

interface ChapterSearch {
  lang?: Lang;
  title?: string;
}

interface ChapterMeta {
  title: string;
  bookName: string | null;
  /** Official textbook chapter PDF (NCERT) when known. */
  textbookUrl: string | null;
  /** The link opens the whole book (chapter files not confirmed). */
  textbookIsBook?: boolean;
  cover?: string | undefined;
  /** Which of the subject's books holds the chapter (for "back" to that book). */
  bookIndex?: number;
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
      ? {
          title: t,
          bookName: null,
          textbookUrl: null,
          number: null,
          custom: true,
          prev: null,
          next: null,
        }
      : null;
  }
  const all = (syllabus?.books ?? []).flatMap((b, bookIndex) =>
    b.chapters.map((c) => ({
      c,
      bookIndex,
      book: b.name,
      code: b.code,
      bookPage: b.chapterPdfs === false ? b.chapters.length : 0,
    })),
  );
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
    bookIndex: cur.bookIndex,
    cover: coverFor(cur.code),
    textbookUrl: !cur.code
      ? null
      : cur.bookPage
        ? `https://ncert.nic.in/textbook.php?${cur.code}=0-${cur.bookPage}`
        : `https://ncert.nic.in/textbook/pdf/${cur.code}${String(cur.c.pdf ?? cur.c.number).padStart(2, "0")}.pdf`,
    textbookIsBook: !!cur.code && cur.bookPage > 0,
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
    if (!subject) {
      const moved = renamedSubject(params.board, grade, params.subject);
      if (moved)
        throw redirect({
          to: "/learn/$board/$grade/$subject",
          params: { board: params.board, grade: String(grade), subject: moved },
        });
      throw notFound();
    }
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
  const nb = useNotebook();
  const { saved, done, prefs } = nb;
  const [cardsOpen, setCardsOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const label = gradeLabel(board, grade);
  const tone = TONE_CLASSES[subject.tone];
  const ref = useMemo(
    () => ({ board, grade, subject: subject.slug, chapter }),
    [board, grade, subject.slug, chapter],
  );
  const key = refKey(ref);
  const isSaved = saved.some((s) => refKey(s) === key);
  const isDone = done.includes(key);
  const status = chapterStatus(nb, key);
  const isRead = status === "read" || status === "done";

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

  const sections = visibleSections(content);

  // ---- "Padh liya" tracking: parts read on screen or heard to the end ----
  const requiredParts = useMemo(
    () => (record ? visibleSections(record.content).map((s) => s.id as string) : []),
    [record],
  );
  const seenParts = useMemo(
    () => (isRead ? requiredParts : (nb.progress[key] ?? [])),
    [isRead, requiredParts, nb.progress, key],
  );
  const seenSet = useMemo(() => new Set(seenParts), [seenParts]);

  const markParts = useCallback(
    (ids: string[]) => {
      if (!notebook.markParts(ref, ids, requiredParts)) return;
      toast.success("Chapter padh liya ✓", {
        description: "Ab Quiz do ya Flashcards se dohrao — phir “Yaad ho gaya” mark karna.",
        ...(mcqs.length > 0
          ? { action: { label: "Quiz do", onClick: () => setQuizOpen(true) } }
          : {}),
      });
    },
    [ref, requiredParts, mcqs.length],
  );

  useReadTracker({
    enabled: !!record && !isRead,
    parts: requiredParts,
    alreadyRead: seenParts,
    onRead: markParts,
  });

  // Audio counts too: a part is heard once every one of its tracks has played through.
  const played = useRef(new Set<number>());
  const prevNarration = useRef({ index: 0, playing: false });
  useEffect(() => {
    const prev = prevNarration.current;
    const playing = narration.status === "playing" || narration.status === "loading";
    if (prev.playing && narration.index === prev.index + 1) played.current.add(prev.index);
    if (narration.status === "ended") played.current.add(narration.index);
    prevNarration.current = { index: narration.index, playing };
    if (isRead || tracks.length === 0 || played.current.size === 0) return;
    const bySection = new Map<string, number[]>();
    for (const t of tracks) {
      const s = sectionForBlock(t.blockId);
      if (s) bySection.set(s, [...(bySection.get(s) ?? []), t.index]);
    }
    const heard = [...bySection.entries()]
      .filter(([s, idx]) => !seenSet.has(s) && idx.every((i) => played.current.has(i)))
      .map(([s]) => s);
    if (heard.length) markParts(heard);
  }, [narration.index, narration.status, tracks, isRead, seenSet, markParts]);

  const readCount = requiredParts.filter((p) => seenSet.has(p)).length;

  const toggleSave = () => {
    const now = notebook.toggleSaved({ ...ref, title: meta.title, custom: meta.custom });
    toast.success(now ? "Notebook mein save ho gaya" : "Notebook se hata diya");
  };
  const toggleDone = () => {
    const now = notebook.toggleDone(ref);
    if (now) toast.success("Shabash! Chapter yaad ho gaya ✓");
  };
  const toggleRead = () => {
    notebook.setRead(ref, !isRead);
    if (!isRead) toast.success("Chapter “padh liya” mark ho gaya ✓");
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
  const bookIndex = meta.bookIndex ?? 0;

  return (
    <div className="pb-40">
      <ScreenHeader
        titleAs="p"
        back={
          meta.custom ? (
            <Link
              to="/learn/$board/$grade/$subject"
              params={{ board, grade: String(grade), subject: subject.slug }}
            />
          ) : (
            <Link
              to="/learn/$board/$grade/$subject"
              params={{ board, grade: String(grade), subject: subject.slug }}
              search={bookIndex > 0 ? { book: bookIndex } : {}}
            />
          )
        }
        title={meta.number ? `Chapter ${meta.number}` : meta.custom ? "Aapka topic" : "Chapter"}
        subtitle={`${subject.name} · ${label}`}
        actions={
          <>
            <button
              type="button"
              className={barIconClass}
              onClick={toggleSave}
              aria-pressed={isSaved}
              aria-label={isSaved ? "Saved — hatao" : "Save karo"}
            >
              {isSaved ? <BookmarkCheck className="text-accent" /> : <Bookmark />}
            </button>
            <button type="button" className={barIconClass} onClick={share} aria-label="Share karein">
              <Share2 />
            </button>
          </>
        }
      />

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <header className="flex items-start gap-4">
          {meta.cover && (
            <img
              src={meta.cover}
              alt={`${meta.bookName ?? "NCERT"} book cover`}
              width={80}
              height={112}
              className="no-print w-14 shrink-0 rounded-md shadow-book sm:w-20"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <SubjectIcon name={subject.icon} className={cn("h-3.5 w-3.5 shrink-0", tone.text)} />
              <span className="truncate">{meta.bookName ?? subject.name}</span>
            </p>
            <h1 className="mt-1 font-display text-[1.6rem] font-extrabold leading-tight sm:text-4xl">
              {meta.title}
            </h1>
          </div>
        </header>

        <div className="no-print mt-4 flex items-center justify-between gap-3">
          <div role="tablist" aria-label="Bhasha" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
            {LANGS.map((l) => (
              <Link
                key={l.id}
                to="/learn/$board/$grade/$subject/$chapter"
                params={{ board, grade: String(grade), subject: subject.slug, chapter }}
                search={{ lang: l.id, ...(searchTitle ? { title: searchTitle } : {}) }}
                onClick={() => notebook.setPrefs({ lang: l.id })}
                role="tab"
                replace
                aria-selected={lang === l.id}
                data-active={lang === l.id}
                title={readyLangs?.includes(l.id) ? "Taiyaar hai — turant khulega" : "Pehli baar banega"}
                className="relative rounded-md px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-sm"
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
          {record && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-bold tabular-nums lg:hidden",
                isRead ? "text-tone-leaf" : "text-muted-foreground",
              )}
              title="Kitne hisse padhe"
            >
              {isRead ? <BookCheck className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
              {isRead ? requiredParts.length : readCount}/{requiredParts.length}
            </span>
          )}
        </div>

        <div className="no-print no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          <button
            type="button"
            className={actionChip}
            data-on={isRead}
            onClick={toggleRead}
            aria-pressed={isRead}
            disabled={!record && !isRead}
            title="Poora chapter padh ya sun liya? Ye apne aap bhi mark hota hai."
          >
            {isRead ? <BookCheck /> : <BookOpen />}
            {isRead ? "Padh liya" : "Padh liya?"}
          </button>
          <button
            type="button"
            className={actionChip}
            data-on={isDone}
            onClick={toggleDone}
            aria-pressed={isDone}
            title="Quiz ke baad, jab chapter achhe se yaad ho jaye"
          >
            {isDone ? <CheckCircle2 /> : <Circle />}
            {isDone ? "Yaad ho gaya" : "Yaad ho gaya?"}
          </button>
          <button type="button" className={actionChip} onClick={() => setCardsOpen(true)} disabled={!record}>
            <Brain className="text-tone-sun" /> Flashcards
          </button>
          {(!record || mcqs.length > 0) && (
            <button type="button" className={actionChip} onClick={() => setQuizOpen(true)} disabled={!record}>
              <Target className="text-accent" /> Quiz
            </button>
          )}
          {meta.textbookUrl ? (
            <a href={meta.textbookUrl} target="_blank" rel="noopener noreferrer" className={actionChip}>
              <ExternalLink /> {meta.textbookIsBook ? "NCERT book" : "NCERT PDF"}
            </a>
          ) : (
            board === "icse" &&
            !meta.custom && (
              <a
                href="https://cisce.org/regulations-and-syllabuses/"
                target="_blank"
                rel="noopener noreferrer"
                title="CISCE ki official free textbook PDF nahi hoti — school ki prescribed book se milao."
                className={actionChip}
              >
                <ExternalLink /> CISCE syllabus
              </a>
            )
          )}
          {board === "cbse" && !meta.custom && (
            <ExamLinks grade={grade} subject={subject.slug} chapter={chapter} />
          )}
          <button
            type="button"
            className={cn(actionChip, "hidden md:inline-flex")}
            onClick={() => window.print()}
            disabled={!record}
          >
            <Printer /> Print / PDF
          </button>
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-6xl gap-10 px-4 lg:mt-8 lg:grid-cols-[200px_1fr]">
        <aside className="no-print hidden lg:block">
          <nav aria-label="Is chapter mein" className="sticky top-24 space-y-1">
            {record && (
              <ReadMeter
                className="mb-4"
                read={readCount}
                total={requiredParts.length}
                done={isRead}
                compact
              />
            )}
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Is chapter mein
            </p>
            {sections.map((s) => {
              const seen = seenSet.has(s.id);
              return (
                <a
                  key={s.id}
                  href={`#sec-${s.id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {record &&
                    (seen ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0 text-tone-leaf"
                        aria-label="padh liya"
                      />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                    ))}
                  <span className={cn(seen && "text-foreground")}>{s.label}</span>
                </a>
              );
            })}
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
              seen={record ? seenSet : undefined}
              onPlayBlock={(id) => {
                const i = blockToTrack.get(id);
                if (i !== undefined) narration.playAt(i);
              }}
            />
          )}

          {record && (
            <div
              className={cn(
                "no-print flex flex-col items-start justify-between gap-4 rounded-3xl border border-border p-6 sm:flex-row sm:items-center sm:p-8",
                isRead ? "bg-tone-leaf/10" : "bg-card",
              )}
            >
              <div>
                <p className="flex items-center gap-2 font-display text-2xl font-extrabold">
                  {isRead ? (
                    <>
                      <BookCheck className="h-6 w-6 text-tone-leaf" /> Chapter padh liya!
                    </>
                  ) : (
                    "Poora chapter padh liya?"
                  )}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {isRead
                    ? isDone
                      ? "Ye chapter yaad bhi ho gaya hai. Agle chapter par chalo."
                      : "Ab quiz do. Achhe number aayein to “Yaad ho gaya” mark karo."
                    : `${readCount}/${requiredParts.length} hisse padhe. Har hissa padhne ya sunne par ye apne aap mark ho jayega.`}
                </p>
              </div>
              {isRead ? (
                !isDone && (
                  <Button variant="ink" size="lg" onClick={toggleDone}>
                    <CheckCircle2 /> Yaad ho gaya
                  </Button>
                )
              ) : (
                <Button variant="ink" size="lg" onClick={toggleRead}>
                  <BookCheck /> Haan, padh liya
                </Button>
              )}
            </div>
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
          download={record ? { noteId: record.id, tracks, title: meta.title } : null}
          follow={prefs.follow}
          onFollowChange={(follow) => notebook.setPrefs({ follow })}
        />
      )}

      {record && <Flashcards note={record.content} open={cardsOpen} onOpenChange={setCardsOpen} />}
      {record && mcqs.length > 0 && <Quiz mcqs={mcqs} open={quizOpen} onOpenChange={setQuizOpen} />}
    </div>
  );
}

/** "JEE / NEET mein kya aata hai" for CBSE Class 11–12 Physics, Chemistry, Maths and Biology chapters. */
function ExamLinks({ grade, subject, chapter }: { grade: number; subject: string; chapter: string }) {
  const param = chapterParam(grade, chapter);
  if (!isExamSubject(subject) || !parseChapterParam(param)) return null;
  return (["jee", "neet"] as const)
    .filter((g) => EXAM_GROUPS[g].subjects.includes(subject))
    .map((g) => (
      <Link
        key={g}
        to="/exam/$group/$subject/$chapter"
        params={{ group: g, subject, chapter: param }}
        className={cn(actionChip, "border-ink bg-ink text-paper hover:bg-ink/90")}
      >
        <Target /> {EXAM_GROUPS[g].short} PYQ
      </Link>
    ));
}
