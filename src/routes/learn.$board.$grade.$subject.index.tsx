import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookCheck,
  BookmarkCheck,
  CheckCircle2,
  CircleDashed,
  Search,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { Crumbs } from "@/components/crumbs";
import { ExamMode } from "@/components/exam-mode";
import { StatusBadge, SubjectProgressBar } from "@/components/progress-bits";
import { ErrorCard, GeneratingBanner } from "@/components/state-cards";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGeneration } from "@/hooks/use-generation";
import {
  BOARDS,
  DEFAULT_LANG,
  getSubject,
  gradeLabel,
  isBoard,
  LANGS,
  parseGrade,
  TONE_CLASSES,
  type BoardId,
  type Lang,
} from "@/lib/catalog";
import { coverFor } from "@/lib/ncert-covers";
import { chapterStatus, notebook, refKey, useNotebook } from "@/lib/notebook-store";
import {
  isChapterFilter,
  matchesFilter,
  subjectProgress,
  type ChapterFilter,
} from "@/lib/progress";
import { syllabusQuery } from "@/lib/queries";
import { customTopicSlug, normalizeTopic, TOPIC_MAX, TOPIC_MIN } from "@/lib/slugs";
import type { PartialSyllabus, SyllabusRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const SYLLABUS_STEPS = [
  "Textbook ki list nikal rahe hain…",
  "Chapters ko order mein laga rahe hain…",
  "Har chapter ka gist likh rahe hain…",
];

type ShownFilter = Exclude<ChapterFilter, "all">;

export const Route = createFileRoute("/learn/$board/$grade/$subject/")({
  validateSearch: (s: Record<string, unknown>): { show?: ShownFilter } =>
    isChapterFilter(s["show"]) && s["show"] !== "all" ? { show: s["show"] } : {},
  loader: async ({ params, context }) => {
    const grade = parseGrade(params.grade);
    if (!isBoard(params.board) || grade === null) throw notFound();
    const subject = getSubject(params.board, grade, params.subject);
    if (!subject) throw notFound();
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
  const tone = TONE_CLASSES[subject.tone];
  const label = gradeLabel(board, grade);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: syllabus } = useSuspenseQuery(syllabusQuery(board, grade, subject.slug));
  const nb = useNotebook();
  const { saved, prefs } = nb;
  const lang: Lang | undefined = prefs.lang ?? undefined;
  const show: ChapterFilter = Route.useSearch().show ?? "all";

  const gen = useGeneration<PartialSyllabus, SyllabusRecord>({
    key: `syllabus:${board}:${grade}:${subject.slug}`,
    url: "/api/syllabus",
    body: { board, grade, subject: subject.slug },
    enabled: !syllabus,
    onDone: (rec) =>
      queryClient.setQueryData(syllabusQuery(board, grade, subject.slug).queryKey, rec),
  });

  const books = syllabus?.books ?? gen.result?.books ?? null;
  const [filter, setFilter] = useState("");
  const [topic, setTopic] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);

  const where = { board, grade, subject: subject.slug };
  const statusOf = (slug: string) => chapterStatus(nb, refKey({ ...where, chapter: slug }));

  const filtered = useMemo(() => {
    if (!books) return null;
    const q = filter.trim().toLowerCase();
    return books
      .map((b) => ({
        ...b,
        chapters: b.chapters.filter(
          (c) =>
            matchesFilter(
              chapterStatus(nb, refKey({ board, grade, subject: subject.slug, chapter: c.slug })),
              show,
            ) && (!q || `${c.title} ${c.gist}`.toLowerCase().includes(q)),
        ),
      }))
      .filter((b) => b.chapters.length > 0);
  }, [books, filter, show, nb, board, grade, subject.slug]);

  const allChapters = useMemo(() => books?.flatMap((b) => b.chapters) ?? [], [books]);
  const prog = subjectProgress(
    nb,
    where,
    allChapters.map((c) => c.slug),
  );
  const nextUp = prog.nextSlug ? allChapters.find((c) => c.slug === prog.nextSlug) : null;
  const readTotal = prog.done + prog.read;

  const setShow = (next: ChapterFilter) =>
    navigate({
      to: "/learn/$board/$grade/$subject",
      params: { board, grade: String(grade), subject: subject.slug },
      search: next === "all" ? {} : { show: next },
      replace: true,
      resetScroll: false,
    });

  const savedKeys = new Set(saved.map(refKey));

  const onTopic = (e: FormEvent) => {
    e.preventDefault();
    const t = normalizeTopic(topic);
    if (t.length < TOPIC_MIN || t.length > TOPIC_MAX) {
      setTopicError(`Topic ${TOPIC_MIN}–${TOPIC_MAX} letters ka hona chahiye.`);
      return;
    }
    setTopicError(null);
    navigate({
      to: "/learn/$board/$grade/$subject/$chapter",
      params: { board, grade: String(grade), subject: subject.slug, chapter: customTopicSlug(t) },
      search: { title: t, ...(lang ? { lang } : {}) },
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
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
          { label: subject.name },
        ]}
      />

      <header className="mt-6 flex flex-wrap items-center gap-5">
        <span className={cn("sticker grid h-20 w-20 place-items-center rounded-3xl", tone.solid)}>
          <SubjectIcon name={subject.icon} className="h-10 w-10 text-paper" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-hand text-xl text-accent">
            {BOARDS[board].name} · {label}
          </p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{subject.name}</h1>
          <p className="text-lg text-muted-foreground">{subject.hi}</p>
        </div>
      </header>

      {books && prog.total > 0 && (
        <section
          aria-label="Aapki padhai"
          className="mt-8 grid gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-2xl font-extrabold">
                {readTotal}
                <span className="text-base text-muted-foreground">/{prog.total}</span>{" "}
                <span className="text-lg">chapters padh liye</span>
              </p>
              <p className="text-sm font-bold text-muted-foreground">
                {prog.left === 0 ? "Sab padh liye! 🎉" : `${prog.left} baaki`}
              </p>
            </div>
            <SubjectProgressBar
              className="mt-3"
              total={prog.total}
              done={prog.done}
              read={prog.read}
              started={prog.started}
            />
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-tone-leaf" /> Yaad ho gaye {prog.done}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-tone-leaf/50" /> Padh liye {prog.read}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-tone-sun/60" /> Adhure {prog.started}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted ring-1 ring-border" /> Shuru
                nahi kiye {prog.left - prog.started}
              </li>
            </ul>
          </div>
          {nextUp && (
            <Button asChild variant="ink" size="lg" className="h-auto justify-between py-3">
              <Link
                to="/learn/$board/$grade/$subject/$chapter"
                params={{ board, grade: String(grade), subject: subject.slug, chapter: nextUp.slug }}
                search={lang ? { lang } : {}}
              >
                <span className="min-w-0 text-left">
                  <span className="block text-xs font-semibold uppercase tracking-wider opacity-75">
                    {statusOf(nextUp.slug) === "started" ? "Adhura chapter poora karo" : "Agla baaki chapter"}
                  </span>
                  <span className="block max-w-64 truncate font-display text-base">
                    {nextUp.number}. {nextUp.title}
                  </span>
                </span>
                <ArrowRight />
              </Link>
            </Button>
          )}
        </section>
      )}

      {/* Language preference + custom topic */}
      <div className="mt-8 grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="sticker rounded-2xl bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Notes kis bhasha mein?
          </p>
          <div className="mt-2 flex gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                data-active={(lang ?? "hinglish") === l.id}
                onClick={() => notebook.setPrefs({ lang: l.id })}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold data-[active=true]:bg-ink data-[active=true]:text-paper"
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>
        <form
          onSubmit={onTopic}
          className="sticker rounded-2xl bg-sticky p-4 text-sticky-foreground"
        >
          <label
            htmlFor="topic"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
          >
            <WandSparkles className="h-3.5 w-3.5" /> Koi bhi topic ya chapter likho
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={TOPIC_MAX}
              placeholder={`jaise: ${subject.slug === "maths" ? "Quadratic equations ka formula" : "Photosynthesis kaise hota hai"}`}
              className="h-11 border border-border bg-card text-base text-foreground"
            />
            <Button type="submit" variant="ink" size="lg" className="shrink-0">
              <Sparkles /> Notes banao
            </Button>
          </div>
          {topicError && (
            <p className="mt-2 text-sm font-semibold text-destructive">{topicError}</p>
          )}
        </form>
      </div>

      {books && books.length > 0 && (
        <ExamMode
          board={board}
          grade={grade}
          subject={subject.slug}
          subjectName={subject.name}
          lang={lang ?? DEFAULT_LANG}
          books={books}
        />
      )}

      {/* Chapters */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-extrabold">Chapters</h2>
          {books && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Chapter dhundho…"
                aria-label="Chapter dhundho"
                className="h-10 border border-border bg-card pl-9"
              />
            </div>
          )}
        </div>

        {books && prog.total > 0 && (
          <div
            role="tablist"
            aria-label="Kaun se chapters dikhayein"
            className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1"
          >
            {(
              [
                ["all", "Sab", prog.total],
                ["left", "Baaki", prog.left],
                ["read", "Padh liye", readTotal],
                ["done", "Yaad ho gaye", prog.done],
              ] as const
            ).map(([id, text, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={show === id}
                data-active={show === id}
                onClick={() => setShow(id)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold hover:bg-muted data-[active=true]:border-ink data-[active=true]:bg-ink data-[active=true]:text-paper"
              >
                {text}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            ))}
          </div>
        )}

        {!books && gen.status === "error" && gen.error && (
          <div className="mt-6">
            <ErrorCard message={gen.error.message} onRetry={gen.retry} />
          </div>
        )}

        {!books && gen.status !== "error" && (
          <div className="mt-6 space-y-6">
            <GeneratingBanner
              title={`${label} ${subject.name} ke chapters la rahe hain`}
              steps={SYLLABUS_STEPS}
              note="Pehli baar thoda time lagta hai — uske baad turant khulega."
            />
            <PartialBooks partial={gen.partial} />
          </div>
        )}

        {filtered && filtered.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
            {filter.trim() ? (
              <p>
                “{filter}” se koi chapter nahi mila. Upar wale box mein topic likh kar notes bana
                sakte ho.
              </p>
            ) : show === "left" ? (
              <p className="font-semibold text-foreground">
                Shabash! Is subject ke saare chapters padh liye. 🎉
              </p>
            ) : show === "done" ? (
              <p>Abhi koi chapter “Yaad ho gaya” mark nahi hua. Quiz ke baad mark karna.</p>
            ) : (
              <p>Abhi koi chapter padha nahi. “Baaki” mein se pehla chapter kholo.</p>
            )}
            {show !== "all" && (
              <Button variant="paper" className="mt-4" onClick={() => setShow("all")}>
                Saare chapters dikhao
              </Button>
            )}
          </div>
        )}

        {filtered?.map((book) => (
          <div key={book.name} className="mt-8">
            <div className="mb-4 flex items-center gap-4">
              {coverFor(book.code) && (
                <img
                  src={coverFor(book.code)}
                  alt={`${book.name} cover`}
                  width={64}
                  height={90}
                  loading="lazy"
                  className="h-24 w-auto rounded-md border border-border shadow-sticker"
                />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {book.code ? "NCERT textbook" : "Book"}
                </p>
                <h3 className="font-display text-xl font-bold">{book.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {show === "all"
                    ? `${book.chapters.length} chapters`
                    : `${book.chapters.length} chapters dikh rahe hain`}
                </p>
              </div>
            </div>
            <ol className="grid gap-3">
              {book.chapters.map((c) => {
                const k = refKey({ board, grade, subject: subject.slug, chapter: c.slug });
                const st = statusOf(c.slug);
                return (
                  <li key={c.slug}>
                    <Link
                      to="/learn/$board/$grade/$subject/$chapter"
                      params={{
                        board,
                        grade: String(grade),
                        subject: subject.slug,
                        chapter: c.slug,
                      }}
                      search={lang ? { lang } : {}}
                      className={cn(
                        "group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-sticker",
                        st === "new" || st === "started" ? "border-border" : "border-tone-leaf/40",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border font-display text-lg font-extrabold",
                          st === "done"
                            ? "bg-tone-leaf text-paper"
                            : st === "read"
                              ? "bg-tone-leaf/15 text-tone-leaf"
                              : st === "started"
                                ? "bg-tone-sun/20"
                                : tone.soft,
                        )}
                        aria-hidden
                      >
                        {st === "done" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : st === "read" ? (
                          <BookCheck className="h-5 w-5" />
                        ) : st === "started" ? (
                          <CircleDashed className="h-5 w-5" />
                        ) : (
                          c.number
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-lg font-bold leading-snug">
                          <span className="sr-only">Chapter {c.number}: </span>
                          {c.title}
                        </span>
                        {c.gist && (
                          <span className="block text-sm text-muted-foreground">{c.gist}</span>
                        )}
                      </span>
                      {savedKeys.has(k) && (
                        <BookmarkCheck
                          className="h-5 w-5 shrink-0 text-accent"
                          aria-label="Saved"
                        />
                      )}
                      <StatusBadge status={st} />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}

function PartialBooks({ partial }: { partial: PartialSyllabus | null }) {
  const books = partial?.books ?? [];
  if (books.length === 0) {
    return (
      <ol className="grid gap-3" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="h-[76px] animate-pulse rounded-2xl border border-border bg-muted"
          />
        ))}
      </ol>
    );
  }
  return (
    <div className="space-y-6" aria-live="polite">
      {books.map((b, bi) => (
        <div key={bi}>
          {b.name && <p className="mb-3 font-hand text-lg text-muted-foreground">Book: {b.name}</p>}
          <ol className="grid gap-3">
            {(b.chapters ?? []).map((c, ci) => (
              <li
                key={ci}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 opacity-80"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted font-display text-lg font-extrabold">
                  {ci + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-bold">{c.title}</span>
                  {c.gist && <span className="block text-sm text-muted-foreground">{c.gist}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
