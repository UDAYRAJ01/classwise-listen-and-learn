import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { BookmarkCheck, CheckCircle2, Search, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { Crumbs } from "@/components/crumbs";
import { ErrorCard, GeneratingBanner } from "@/components/state-cards";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGeneration } from "@/hooks/use-generation";
import {
  BOARDS,
  getSubject,
  gradeLabel,
  isBoard,
  LANGS,
  parseGrade,
  TONE_CLASSES,
  type BoardId,
  type Lang,
} from "@/lib/catalog";
import { notebook, refKey, useNotebook } from "@/lib/notebook-store";
import { syllabusQuery } from "@/lib/queries";
import { customTopicSlug, normalizeTopic, TOPIC_MAX, TOPIC_MIN } from "@/lib/slugs";
import type { PartialSyllabus, SyllabusRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const SYLLABUS_STEPS = [
  "Textbook ki list nikal rahe hain…",
  "Chapters ko order mein laga rahe hain…",
  "Har chapter ka gist likh rahe hain…",
];

export const Route = createFileRoute("/learn/$board/$grade/$subject/")({
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
      <ErrorCard message="Chapters load nahi hue. Internet check karke dobara try karein." onRetry={reset} />
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
  const { done, saved, prefs } = useNotebook();
  const lang: Lang | undefined = prefs.lang ?? undefined;

  const gen = useGeneration<PartialSyllabus, SyllabusRecord>({
    key: `syllabus:${board}:${grade}:${subject.slug}`,
    url: "/api/syllabus",
    body: { board, grade, subject: subject.slug },
    enabled: !syllabus,
    onDone: (rec) => queryClient.setQueryData(syllabusQuery(board, grade, subject.slug).queryKey, rec),
  });

  const books = syllabus?.books ?? gen.result?.books ?? null;
  const [filter, setFilter] = useState("");
  const [topic, setTopic] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!books) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return books;
    return books
      .map((b) => ({ ...b, chapters: b.chapters.filter((c) => `${c.title} ${c.gist}`.toLowerCase().includes(q)) }))
      .filter((b) => b.chapters.length > 0);
  }, [books, filter]);

  const totalChapters = books?.reduce((n, b) => n + b.chapters.length, 0) ?? 0;
  const doneCount =
    books?.reduce(
      (n, b) => n + b.chapters.filter((c) => done.includes(refKey({ board, grade, subject: subject.slug, chapter: c.slug }))).length,
      0,
    ) ?? 0;

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
              <Link to="/learn/$board/$grade" params={{ board, grade: String(grade) }} className="hover:text-foreground">
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
        {books && totalChapters > 0 && (
          <div className="sticker rounded-2xl bg-card px-5 py-3 text-center">
            <p className="font-display text-3xl font-extrabold">
              {doneCount}
              <span className="text-lg text-muted-foreground">/{totalChapters}</span>
            </p>
            <p className="font-hand text-base text-muted-foreground">yaad ho gaye</p>
          </div>
        )}
      </header>

      {/* Language preference + custom topic */}
      <div className="mt-8 grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="sticker rounded-2xl bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes kis bhasha mein?</p>
          <div className="mt-2 flex gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                data-active={(lang ?? "hinglish") === l.id}
                onClick={() => notebook.setPrefs({ lang: l.id })}
                className="rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-bold data-[active=true]:bg-ink data-[active=true]:text-paper"
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>
        <form onSubmit={onTopic} className="sticker rounded-2xl bg-sticky p-4 text-sticky-foreground">
          <label htmlFor="topic" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            <WandSparkles className="h-3.5 w-3.5" /> Koi bhi topic ya chapter likho
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={TOPIC_MAX}
              placeholder={`jaise: ${subject.slug === "maths" ? "Quadratic equations ka formula" : "Photosynthesis kaise hota hai"}`}
              className="h-11 border-2 border-ink bg-card text-base text-foreground"
            />
            <Button type="submit" variant="ink" size="lg" className="shrink-0">
              <Sparkles /> Notes banao
            </Button>
          </div>
          {topicError && <p className="mt-2 text-sm font-semibold text-destructive">{topicError}</p>}
        </form>
      </div>

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
                className="h-10 border-2 border-ink/70 bg-card pl-9"
              />
            </div>
          )}
        </div>

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
          <p className="mt-6 rounded-2xl border-2 border-dashed border-ink/40 p-6 text-center text-muted-foreground">
            “{filter}” se koi chapter nahi mila. Upar wale box mein topic likh kar notes bana sakte ho.
          </p>
        )}

        {filtered?.map((book) => (
          <div key={book.name} className="mt-8">
            {books && books.length > 1 && (
              <h3 className="mb-3 inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-1 font-display text-lg font-bold text-paper">
                {book.name}
              </h3>
            )}
            {books && books.length === 1 && <p className="mb-3 font-hand text-lg text-muted-foreground">Book: {book.name}</p>}
            <ol className="grid gap-3">
              {book.chapters.map((c) => {
                const k = refKey({ board, grade, subject: subject.slug, chapter: c.slug });
                const isDone = done.includes(k);
                return (
                  <li key={c.slug}>
                    <Link
                      to="/learn/$board/$grade/$subject/$chapter"
                      params={{ board, grade: String(grade), subject: subject.slug, chapter: c.slug }}
                      search={lang ? { lang } : {}}
                      className="group flex items-center gap-4 rounded-2xl border-2 border-ink bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-sticker"
                    >
                      <span
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-ink font-display text-lg font-extrabold",
                          isDone ? "bg-tone-leaf text-paper" : tone.soft,
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-5 w-5" /> : c.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-lg font-bold leading-snug">{c.title}</span>
                        {c.gist && <span className="block text-sm text-muted-foreground">{c.gist}</span>}
                      </span>
                      {savedKeys.has(k) && <BookmarkCheck className="h-5 w-5 shrink-0 text-accent" aria-label="Saved" />}
                      <span className="hidden shrink-0 rounded-lg bg-secondary px-3 py-1.5 text-sm font-bold sm:inline-block">
                        Notes + Audio
                      </span>
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
          <li key={i} className="h-[76px] animate-pulse rounded-2xl border-2 border-ink/20 bg-muted" />
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
              <li key={ci} className="flex items-center gap-4 rounded-2xl border-2 border-ink/40 bg-card p-4 opacity-80">
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
