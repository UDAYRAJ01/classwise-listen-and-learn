import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { BookCover } from "@/components/app/book-cover";
import { barIconClass, ChipRow, chipClass, ScreenHeader } from "@/components/app/screen-header";
import { ExamMode } from "@/components/exam-mode";
import { SubjectProgressBar } from "@/components/progress-bits";
import { ErrorCard, GeneratingBanner } from "@/components/state-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGeneration } from "@/hooks/use-generation";
import {
  type BoardId,
  BOARDS,
  DEFAULT_LANG,
  getSubject,
  gradeLabel,
  isBoard,
  type Lang,
  parseGrade,
  renamedSubject,
} from "@/lib/catalog";
import { chapterStatus, refKey, useNotebook, type ChapterStatus } from "@/lib/notebook-store";
import { isChapterFilter, matchesFilter, subjectProgress, type ChapterFilter } from "@/lib/progress";
import { syllabusQuery } from "@/lib/queries";
import { customTopicSlug, normalizeTopic, TOPIC_MAX, TOPIC_MIN } from "@/lib/slugs";
import type { PartialSyllabus, SyllabusChapter, SyllabusRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const SYLLABUS_STEPS = [
  "Textbook ki list nikal rahe hain…",
  "Chapters ko order mein laga rahe hain…",
  "Har chapter ka gist likh rahe hain…",
];

type ShownFilter = Exclude<ChapterFilter, "all">;
interface SubjectSearch {
  show?: ShownFilter;
  /** Which of the subject's books is open (0 = first, left out of the URL). */
  book?: number;
}

export const Route = createFileRoute("/learn/$board/$grade/$subject/")({
  validateSearch: (s: Record<string, unknown>): SubjectSearch => {
    const out: SubjectSearch = {};
    if (isChapterFilter(s["show"]) && s["show"] !== "all") out.show = s["show"];
    const book = Number(s["book"]);
    if (Number.isInteger(book) && book > 0 && book < 20) out.book = book;
    return out;
  },
  loader: async ({ params, context }) => {
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
    await context.queryClient.ensureQueryData(syllabusQuery(params.board, grade, subject.slug));
    return { board: params.board as BoardId, grade, subjectSlug: subject.slug };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Subject not found — PadhoSuno" }] };
    const s = getSubject(loaderData.board, loaderData.grade, loaderData.subjectSlug);
    const b = BOARDS[loaderData.board];
    const label = gradeLabel(loaderData.board, loaderData.grade);
    const title = `${label} ${s?.name} Notes — ${b.short} Chapter-wise | PadhoSuno`;
    const description = `${b.name} ${label} ${s?.name} ke har chapter ke short notes, yaad karne ki tricks, formulas, important questions aur audio.`;
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
  component: ChaptersPage,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorCard
        message="Chapters load nahi hue. Internet check karke dobara try karein."
        onRetry={reset}
      />
    </div>
  ),
});

function ChaptersPage() {
  const { board, grade, subjectSlug } = Route.useLoaderData();
  const subject = getSubject(board, grade, subjectSlug)!;
  const label = gradeLabel(board, grade);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: syllabus } = useSuspenseQuery(syllabusQuery(board, grade, subject.slug));
  const nb = useNotebook();
  const { saved, prefs } = nb;
  const lang: Lang | undefined = prefs.lang ?? undefined;
  const search = Route.useSearch();
  const show: ChapterFilter = search.show ?? "all";

  const gen = useGeneration<PartialSyllabus, SyllabusRecord>({
    key: `syllabus:${board}:${grade}:${subject.slug}`,
    url: "/api/syllabus",
    body: { board, grade, subject: subject.slug },
    enabled: !syllabus,
    onDone: (rec) =>
      queryClient.setQueryData(syllabusQuery(board, grade, subject.slug).queryKey, rec),
  });

  const books = syllabus?.books ?? gen.result?.books ?? null;
  const bookIdx = books?.length ? Math.min(search.book ?? 0, books.length - 1) : 0;
  const book = books?.[bookIdx] ?? null;
  const multi = (books?.length ?? 0) > 1;
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const query = searching ? q.trim().toLowerCase() : "";

  const where = { board, grade, subject: subject.slug };
  const statusOf = (slug: string) => chapterStatus(nb, refKey({ ...where, chapter: slug }));
  const savedKeys = new Set(saved.map(refKey));

  const slugs = useMemo(() => book?.chapters.map((c) => c.slug) ?? [], [book]);
  const prog = subjectProgress(nb, where, slugs);
  const nextUp = prog.nextSlug ? (book?.chapters.find((c) => c.slug === prog.nextSlug) ?? null) : null;
  const readTotal = prog.done + prog.read;
  const anyActivity = readTotal + prog.started > 0;

  const rows = useMemo(() => {
    if (!books) return null;
    if (query)
      return books.flatMap((b) =>
        b.chapters
          .filter((c) => `${c.title} ${c.gist}`.toLowerCase().includes(query))
          .map((c) => ({ c, bookName: multi ? b.name : null })),
      );
    return (book?.chapters ?? [])
      .filter((c) =>
        matchesFilter(chapterStatus(nb, refKey({ board, grade, subject: subject.slug, chapter: c.slug })), show),
      )
      .map((c) => ({ c, bookName: null }));
  }, [books, book, query, multi, show, nb, board, grade, subject.slug]);

  const setSearch = (patch: SubjectSearch) =>
    navigate({
      to: "/learn/$board/$grade/$subject",
      params: { board, grade: String(grade), subject: subject.slug },
      search: (prev: SubjectSearch) => {
        const next = { ...prev, ...patch };
        return {
          ...(next.show ? { show: next.show } : {}),
          ...(next.book ? { book: next.book } : {}),
        };
      },
      replace: true,
      resetScroll: false,
    });

  return (
    <>
      <ScreenHeader
        back={<Link to="/learn/$board/$grade" params={{ board, grade: String(grade) }} />}
        title={subject.name}
        subtitle={`${label} · ${BOARDS[board].short}`}
        actions={
          books && (
            <button
              type="button"
              className={barIconClass}
              aria-label={searching ? "Search band karo" : "Chapter dhundho"}
              aria-pressed={searching}
              onClick={() => {
                setSearching((v) => !v);
                setQ("");
              }}
            >
              {searching ? <X /> : <Search />}
            </button>
          )
        }
      >
        {searching && (
          <div className="mx-auto max-w-6xl px-4 pb-3 md:pt-4">
            <div className="relative md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Chapter ka naam likho…"
                aria-label="Chapter dhundho"
                className="h-11 rounded-xl border border-border bg-card pl-9 text-base"
              />
            </div>
          </div>
        )}
        {multi && !query && books && (
          <ChipRow label="Books">
            {books.map((b, i) => (
              <li key={b.name}>
                <button
                  type="button"
                  data-active={i === bookIdx}
                  aria-pressed={i === bookIdx}
                  onClick={() => setSearch({ book: i, show: undefined })}
                  className={chipClass}
                >
                  {b.name}
                </button>
              </li>
            ))}
          </ChipRow>
        )}
      </ScreenHeader>

      <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 md:pt-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Book */}
        <aside className="md:sticky md:top-24 md:self-start">
          <div className="flex gap-4 md:block">
            <div className="w-24 shrink-0 sm:w-28 md:w-40">
              <BookCover
                code={book?.code}
                title={book?.name ?? subject.name}
                subject={subject}
                board={board}
                grade={grade}
                eager
              />
            </div>
            <div className="min-w-0 flex-1 md:mt-4">
              <p className="font-display text-lg font-extrabold leading-tight md:text-xl">
                {book?.name ?? subject.name}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                {book?.code ? "NCERT" : BOARDS[board].short} · {subject.hi}
                {prog.total > 0 && ` · ${prog.total} chapters`}
              </p>
              {prog.total > 0 && (
                <>
                  <SubjectProgressBar
                    className="mt-3 h-1.5"
                    total={prog.total}
                    done={prog.done}
                    read={prog.read}
                    started={prog.started}
                  />
                  <p className="mt-1.5 text-xs font-bold text-muted-foreground">
                    {prog.left === 0 ? (
                      <span className="text-tone-leaf">Poori book padh li ✓</span>
                    ) : (
                      <>
                        <span className="text-foreground">{readTotal}</span>/{prog.total} padhe
                        {prog.done > 0 && ` · ${prog.done} yaad`}
                      </>
                    )}
                  </p>
                </>
              )}
              {nextUp && (
                <Button asChild variant="ink" className="mt-3 h-11 w-full justify-between rounded-xl md:mt-4">
                  <Link
                    to="/learn/$board/$grade/$subject/$chapter"
                    params={{ board, grade: String(grade), subject: subject.slug, chapter: nextUp.slug }}
                    search={lang ? { lang } : {}}
                  >
                    <span className="min-w-0 truncate">
                      {statusOf(nextUp.slug) === "started"
                        ? "Jaari rakho"
                        : readTotal > 0
                          ? "Agla padho"
                          : "Shuru karo"}{" "}
                      · Ch {nextUp.number}
                    </span>
                    <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {books && books.length > 0 && (
            <ExamMode
              className="mt-4"
              board={board}
              grade={grade}
              subject={subject.slug}
              subjectName={subject.name}
              lang={lang ?? DEFAULT_LANG}
              books={books}
            />
          )}
        </aside>

        {/* Chapters */}
        <section className="mt-6 min-w-0 md:mt-0" aria-label="Chapters">
          {books && !query && anyActivity && (
            <div
              role="tablist"
              aria-label="Kaun se chapters dikhayein"
              className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
            >
              {(
                [
                  ["all", "Sab", prog.total],
                  ["left", "Baaki", prog.left],
                  ["read", "Padh liye", readTotal],
                  ["done", "Yaad", prog.done],
                ] as const
              ).map(([id, text, count]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={show === id}
                  data-active={show === id}
                  onClick={() => setSearch({ show: id === "all" ? undefined : id })}
                  className={cn(chipClass, "h-8 px-3 text-xs")}
                >
                  {text}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              ))}
            </div>
          )}

          {!books && gen.status === "error" && gen.error && (
            <ErrorCard message={gen.error.message} onRetry={gen.retry} />
          )}

          {!books && gen.status !== "error" && (
            <div className="space-y-6">
              <GeneratingBanner
                title={`${label} ${subject.name} ke chapters la rahe hain`}
                steps={SYLLABUS_STEPS}
                note="Pehli baar thoda time lagta hai — uske baad turant khulega."
              />
              <PartialBooks partial={gen.partial} />
            </div>
          )}

          {rows && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {query ? (
                <p>“{q.trim()}” naam ka chapter nahi mila. Neeche apna topic likh kar notes bana lo.</p>
              ) : show === "left" ? (
                <p className="font-semibold text-foreground">Shabash! Saare chapters padh liye. 🎉</p>
              ) : show === "done" ? (
                <p>Abhi koi chapter “Yaad ho gaya” nahi hai. Quiz ke baad mark karna.</p>
              ) : (
                <p>Abhi koi chapter padha nahi.</p>
              )}
              {show !== "all" && !query && (
                <Button variant="paper" size="sm" className="mt-4" onClick={() => setSearch({ show: undefined })}>
                  Saare chapters
                </Button>
              )}
            </div>
          )}

          {rows && rows.length > 0 && (
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {rows.map(({ c, bookName }) => (
                <li key={c.slug}>
                  <ChapterRow
                    board={board}
                    grade={grade}
                    subject={subject.slug}
                    c={c}
                    bookName={bookName}
                    status={statusOf(c.slug)}
                    saved={savedKeys.has(refKey({ ...where, chapter: c.slug }))}
                    lang={lang}
                  />
                </li>
              ))}
            </ol>
          )}

          {books && <TopicBox board={board} grade={grade} subject={subject.slug} lang={lang} />}
        </section>
      </div>
    </>
  );
}

const NUMBER_STYLE: Record<ChapterStatus, string> = {
  done: "bg-tone-leaf text-paper",
  read: "bg-tone-leaf/15 text-tone-leaf",
  started: "bg-tone-sun/25 text-foreground",
  new: "bg-muted text-muted-foreground",
};
const STATUS_TEXT: Record<ChapterStatus, string> = {
  done: "Yaad ho gaya",
  read: "Padh liya",
  started: "Adhura",
  new: "",
};

function ChapterRow({
  board,
  grade,
  subject,
  c,
  bookName,
  status,
  saved,
  lang,
}: {
  board: BoardId;
  grade: number;
  subject: string;
  c: SyllabusChapter;
  bookName: string | null;
  status: ChapterStatus;
  saved: boolean;
  lang: Lang | undefined;
}) {
  return (
    <Link
      to="/learn/$board/$grade/$subject/$chapter"
      params={{ board, grade: String(grade), subject, chapter: c.slug }}
      search={lang ? { lang } : {}}
      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted active:bg-muted sm:px-4"
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold",
          NUMBER_STYLE[status],
        )}
        aria-hidden
      >
        {status === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : c.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">
          <span className="sr-only">Chapter {c.number}: </span>
          {c.title}
        </span>
        {(bookName || status !== "new") && (
          <span
            className={cn(
              "block text-xs font-semibold",
              status === "read" || status === "done" ? "text-tone-leaf" : "text-muted-foreground",
            )}
          >
            {[bookName, STATUS_TEXT[status]].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      {saved && <BookmarkCheck className="h-4 w-4 shrink-0 text-accent" aria-label="Saved" />}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** "Apna topic likho": notes for any topic of this subject. */
function TopicBox({
  board,
  grade,
  subject,
  lang,
}: {
  board: BoardId;
  grade: number;
  subject: string;
  lang: Lang | undefined;
}) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = normalizeTopic(topic);
    if (t.length < TOPIC_MIN || t.length > TOPIC_MAX) {
      setError(`Topic ${TOPIC_MIN}–${TOPIC_MAX} letters ka hona chahiye.`);
      return;
    }
    setError(null);
    navigate({
      to: "/learn/$board/$grade/$subject/$chapter",
      params: { board, grade: String(grade), subject, chapter: customTopicSlug(t) },
      search: { title: t, ...(lang ? { lang } : {}) },
    });
  };

  return (
    <details className="group mt-4 rounded-2xl border border-dashed border-border bg-card/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
        <WandSparkles className="h-4 w-4 text-accent" />
        Apna topic likho — notes turant
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <form onSubmit={onSubmit} className="px-4 pb-4">
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={TOPIC_MAX}
            placeholder={subject === "maths" ? "jaise: Quadratic formula" : "jaise: Photosynthesis"}
            aria-label="Topic"
            className="h-11 rounded-xl border border-border bg-card text-base"
          />
          <Button type="submit" variant="ink" className="h-11 shrink-0 rounded-xl">
            <Sparkles /> Banao
          </Button>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
      </form>
    </details>
  );
}

function PartialBooks({ partial }: { partial: PartialSyllabus | null }) {
  const books = partial?.books ?? [];
  if (books.length === 0) {
    return (
      <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="h-9 w-9 animate-pulse rounded-full bg-muted" />
            <span className="h-4 flex-1 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="space-y-4" aria-live="polite">
      {books.map((b, bi) => (
        <div key={bi}>
          {b.name && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{b.name}</p>}
          <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card opacity-80">
            {(b.chapters ?? []).map((c, ci) => (
              <li key={ci} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted font-display text-sm font-extrabold">
                  {ci + 1}
                </span>
                <span className="min-w-0 font-semibold">{c.title}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
