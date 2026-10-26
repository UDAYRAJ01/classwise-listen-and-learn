import {
  BookMarked,
  CheckCheck,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  FlaskRound,
  Lightbulb,
  ListChecks,
  Play,
  Quote,
  Sparkles,
  Target,
  Volume2,
} from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";

import { Emph } from "@/components/emph";
import { cn } from "@/lib/utils";
import { TERMS_PER_TRACK } from "@/lib/tracks";
import type { PartialNote, TrickKind } from "@/lib/types";

export { SECTIONS } from "@/lib/note-sections";

const TRICK_LABEL: Record<TrickKind, string> = {
  acronym: "Short-form",
  rhyme: "Kavita",
  story: "Kahani",
  visual: "Picture socho",
  pattern: "Pattern",
  shortcut: "Shortcut",
};

const STICKY_TONES = ["bg-sticky", "bg-tone-sky/25", "bg-tone-rose/20", "bg-tone-leaf/20"];

const SeenContext = createContext<ReadonlySet<string>>(new Set());

interface Props {
  content: PartialNote;
  streaming: boolean;
  activeBlockId: string | null;
  playable: boolean;
  onPlayBlock: (blockId: string) => void;
  /** Parts the student has already read (shows a small tick next to the title). */
  seen?: ReadonlySet<string> | undefined;
}

function Block({
  id,
  active,
  playable,
  onPlay,
  className,
  children,
  label,
}: {
  id: string;
  active: boolean;
  playable: boolean;
  onPlay: (id: string) => void;
  className?: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      id={`blk-${id}`}
      data-block={id}
      className={cn(
        "print-plain relative scroll-mt-32 transition-[outline,box-shadow] duration-300",
        active && "reading-now",
        className,
      )}
    >
      {playable && (
        <button
          type="button"
          onClick={() => onPlay(id)}
          aria-label={`${label} — suno`}
          title="Yahan se suno"
          className={cn(
            "no-print absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-ink transition-transform hover:scale-110",
            active && "bg-accent text-accent-foreground",
          )}
        >
          {active ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-px" />
          )}
        </button>
      )}
      {children}
    </div>
  );
}

function SectionTitle({
  id,
  icon,
  title,
  sub,
  right,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  sub?: string | undefined;
  right?: ReactNode;
}) {
  const seen = useContext(SeenContext).has(id);
  return (
    <div
      id={`sec-${id}`}
      className="mb-4 flex scroll-mt-28 flex-wrap items-end justify-between gap-3 sm:mb-5"
    >
      <div className="flex items-center gap-3">
        <span className="sticker grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card sm:h-11 sm:w-11">
          {icon}
        </span>
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold sm:text-3xl">
            {title}
            {seen && (
              <span className="no-print inline-flex items-center gap-1 rounded-full bg-tone-leaf/15 px-2 py-0.5 font-sans text-xs font-bold text-tone-leaf">
                <CheckCircle2 className="h-3.5 w-3.5" /> padh liya
              </span>
            )}
          </h2>
          {sub && (
            <p className="font-hand text-sm leading-tight text-muted-foreground sm:text-lg">
              {sub}
            </p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-muted"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

const EMPTY_SEEN: ReadonlySet<string> = new Set();

export function NoteView({
  content,
  streaming,
  activeBlockId,
  playable,
  onPlayBlock,
  seen = EMPTY_SEEN,
}: Props) {
  const [hideAnswers, setHideAnswers] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const keyPoints = content.keyPoints ?? [];
  const terms = content.keyTerms ?? [];
  const formulas = content.formulas ?? [];
  const tricks = content.tricks ?? [];
  const mistakes = content.mistakes ?? [];
  const questions = content.questions ?? [];
  const revision = content.quickRevision ?? [];
  const tips = content.examTips ?? [];

  const termChunks: (typeof terms)[] = [];
  for (let i = 0; i < terms.length; i += TERMS_PER_TRACK)
    termChunks.push(terms.slice(i, i + TERMS_PER_TRACK));

  const blockProps = (id: string, label: string) => ({
    id,
    label,
    active: activeBlockId === id,
    playable,
    onPlay: onPlayBlock,
  });

  // Sections appear in order as they stream in; later sections show only once started.
  const showFormulas = formulas.length > 0;
  const started = (arr: unknown[] | undefined) => (arr?.length ?? 0) > 0;

  return (
    <SeenContext.Provider value={seen}>
      <div className="space-y-10 sm:space-y-16">
        {/* Summary */}
        <section aria-labelledby="sec-summary" data-section="summary">
          <SectionTitle
            id="summary"
            icon={<BookMarked className="h-5 w-5 text-tone-ink" />}
            title="Chapter ek nazar mein"
          />
          <Block
            {...blockProps("intro", "Summary")}
            className="sticker-lg rounded-2xl bg-card p-4 sm:p-8"
          >
            {content.oneLiner ? (
              <div className="mb-4 flex gap-2.5 pr-9 sm:mb-5 sm:gap-3 sm:pr-10">
                <Quote className="mt-1 h-5 w-5 shrink-0 text-accent sm:h-6 sm:w-6" />
                <p className="font-hand text-xl leading-snug text-foreground sm:text-[1.7rem]">
                  <Emph text={content.oneLiner} />
                </p>
              </div>
            ) : (
              <Skeleton lines={1} />
            )}
            {content.summary ? (
              <p className="text-[1.0625rem] leading-relaxed text-foreground/90 sm:text-lg">
                <Emph text={content.summary} />
              </p>
            ) : (
              streaming && <Skeleton lines={3} />
            )}
          </Block>
        </section>

        {/* Short notes */}
        {(started(keyPoints) || streaming) && (
          <section data-section="notes">
            <SectionTitle
              id="notes"
              icon={<ListChecks className="h-5 w-5 text-tone-leaf" />}
              title="Short Notes"
              sub="highlight wale words = sabse zaroori"
            />
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {keyPoints.map((g, i) => (
                <Block
                  key={i}
                  {...blockProps(`kp-${i}`, g.heading ?? "Notes")}
                  className="paper-ruled sticker rounded-2xl py-4 pl-10 pr-4 sm:pb-5 sm:pl-14 sm:pr-12 sm:pt-5"
                >
                  <h3 className="mb-2 pr-7 font-display text-lg font-bold leading-7 text-tone-ink sm:pr-0 sm:text-xl sm:leading-[1.9rem]">
                    <Emph text={g.heading} />
                  </h3>
                  <ul className="space-y-0">
                    {(g.points ?? []).map((p, j) => (
                      <li key={j} className="relative leading-7 sm:leading-[1.9rem]">
                        <span
                          className="absolute -left-5 top-0 font-hand text-lg text-accent sm:-left-6"
                          aria-hidden
                        >
                          ✱
                        </span>
                        <Emph text={p} />
                      </li>
                    ))}
                  </ul>
                </Block>
              ))}
              {streaming && keyPoints.length === 0 && (
                <div className="paper-ruled sticker rounded-2xl p-4 pl-10 sm:p-6 sm:pl-14">
                  <Skeleton lines={4} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Key terms */}
        {started(terms) && (
          <section data-section="terms">
            <SectionTitle
              id="terms"
              icon={<Sparkles className="h-5 w-5 text-tone-sun" />}
              title="Important Words"
              sub="definition yaad = aadha kaam ho gaya"
            />
            <div className="space-y-6">
              {termChunks.map((chunk, k) => (
                <Block
                  key={k}
                  {...blockProps(`terms-${k}`, "Important words")}
                  className="sticker rounded-2xl bg-card p-4 pr-11 sm:p-5 sm:pr-12"
                >
                  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    {chunk.map((t, i) => (
                      <div key={i} className="border-l-4 border-tone-sun pl-3">
                        <dt className="font-display text-lg font-bold">
                          <Emph text={t.term} />
                        </dt>
                        <dd className="text-foreground/85">
                          <Emph text={t.meaning} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Block>
              ))}
            </div>
          </section>
        )}

        {/* Formulas */}
        {showFormulas && (
          <section data-section="formulas">
            <SectionTitle
              id="formulas"
              icon={<FlaskRound className="h-5 w-5 text-tone-teal" />}
              title="Formulas & Rules"
            />
            <Block
              {...blockProps("formulas", "Formulas")}
              className="paper-grid sticker rounded-2xl p-4 pr-11 sm:p-6 sm:pr-12"
            >
              <ul className="grid gap-4 sm:grid-cols-2">
                {formulas.map((f, i) => (
                  <li key={i} className="rounded-xl border border-border bg-card/95 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Emph text={f.name} />
                    </p>
                    <p className="mt-1 break-words font-display text-xl font-bold text-tone-ink">
                      <Emph text={f.formula} />
                    </p>
                    {f.note && (
                      <p className="mt-1 text-sm text-foreground/80">
                        <Emph text={f.note} />
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Block>
          </section>
        )}

        {/* Tricks */}
        {started(tricks) && (
          <section data-section="tricks">
            <SectionTitle
              id="tricks"
              icon={<Lightbulb className="h-5 w-5 text-tone-coral" />}
              title="Yaad Karne Ki Tricks"
              sub={`${tricks.length} tricks · ek baar padho, hamesha yaad`}
            />
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-7">
              {tricks.map((t, i) => (
                <Block
                  key={i}
                  {...blockProps(`trick-${i}`, t.title ?? "Trick")}
                  className={cn(
                    "tape sticker rounded-md p-4 pr-11 pt-6 sm:p-5 sm:pr-12 sm:pt-7",
                    STICKY_TONES[i % 4],
                  )}
                >
                  <span className="mb-2 inline-block rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                    {TRICK_LABEL[(t.kind as TrickKind) ?? "shortcut"] ?? "Trick"}
                  </span>
                  <h3 className="font-display text-lg font-bold">
                    <Emph text={t.title} />
                  </h3>
                  <p className="mt-2 font-hand text-xl leading-snug text-ink sm:text-2xl [&_mark]:font-bold">
                    <Emph text={t.trick} />
                  </p>
                  {t.explanation && (
                    <p className="mt-3 text-[0.95rem] text-foreground/85">
                      <Emph text={t.explanation} />
                    </p>
                  )}
                </Block>
              ))}
            </div>
          </section>
        )}

        {/* Common mistakes */}
        {started(mistakes) && (
          <section data-section="mistakes">
            <SectionTitle
              id="mistakes"
              icon={<CircleAlert className="h-5 w-5 text-destructive" />}
              title="Ye Galtiyan Mat Karna"
              sub="jahan zyada bacche number katwa dete hain"
            />
            <Block
              {...blockProps("mistakes", "Common mistakes")}
              className="sticker rounded-2xl bg-card p-4 pr-11 sm:p-6 sm:pr-12"
            >
              <ul className="grid gap-4">
                {mistakes.map((m, i) => (
                  <li key={i} className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                    <p className="flex gap-2 rounded-xl bg-destructive/8 p-3 text-foreground/90">
                      <span className="font-display font-extrabold text-destructive" aria-hidden>
                        ✗
                      </span>
                      <span>
                        <span className="sr-only">Galti: </span>
                        <Emph text={m.mistake} />
                      </span>
                    </p>
                    <p className="flex gap-2 rounded-xl bg-tone-leaf/12 p-3">
                      <span className="font-display font-extrabold text-tone-leaf" aria-hidden>
                        ✓
                      </span>
                      <span>
                        <span className="sr-only">Sahi: </span>
                        <Emph text={m.correct} />
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </Block>
          </section>
        )}

        {/* Questions */}
        {started(questions) && (
          <section data-section="questions">
            <SectionTitle
              id="questions"
              icon={<Target className="h-5 w-5 text-tone-rose" />}
              title="Important Questions"
              sub="exam mein aane wale sawaal"
              right={
                <button
                  type="button"
                  onClick={() => {
                    setHideAnswers((h) => !h);
                    setRevealed(new Set());
                  }}
                  className="no-print inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-bold hover:bg-muted"
                >
                  {hideAnswers ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {hideAnswers ? "Sab answers dikhao" : "Self-test: answers chhupao"}
                </button>
              }
            />
            <ol className="space-y-4">
              {questions.map((q, i) => {
                const show = !hideAnswers || revealed.has(i) || activeBlockId === `q-${i}`;
                return (
                  <li key={i}>
                    <Block
                      {...blockProps(`q-${i}`, `Question ${i + 1}`)}
                      className="sticker rounded-2xl bg-card p-4 pr-11 sm:p-5 sm:pr-12"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink font-display text-sm font-bold text-paper">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <p className="font-display text-lg font-bold leading-snug">
                              <Emph text={q.question} />
                            </p>
                            {typeof q.marks === "number" && (
                              <span className="rounded-full bg-tone-rose/15 px-2 py-0.5 text-xs font-bold text-tone-rose">
                                {q.marks} {q.marks === 1 ? "mark" : "marks"}
                              </span>
                            )}
                          </div>
                          {show ? (
                            <p className="mt-2 border-l-4 border-tone-leaf pl-3 text-foreground/90">
                              <Emph text={q.answer} />
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRevealed((s) => new Set(s).add(i))}
                              className="mt-2 rounded-lg border border-dashed border-border px-3 py-1.5 font-hand text-lg hover:bg-muted"
                            >
                              Pehle khud socho… phir answer dekho
                            </button>
                          )}
                        </div>
                      </div>
                    </Block>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Revision */}
        {started(revision) && (
          <section data-section="revision">
            <SectionTitle
              id="revision"
              icon={<CheckCheck className="h-5 w-5 text-tone-leaf" />}
              title="1-Minute Revision"
              sub="exam se pehle bas ye padh lo"
            />
            <Block
              {...blockProps("revision", "Quick revision")}
              className="sticker-lg rounded-2xl bg-ink p-4 pr-11 text-paper sm:p-8 sm:pr-12"
            >
              <ul className="grid gap-3 sm:grid-cols-2">
                {revision.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border border-secondary text-[11px] font-bold text-secondary">
                      ✓
                    </span>
                    <span className="[&_mark]:text-ink">
                      <Emph text={r} />
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          </section>
        )}

        {/* Tips + fun fact */}
        {(started(tips) || content.funFact) && (
          <section data-section="tips">
            <SectionTitle
              id="tips"
              icon={<Target className="h-5 w-5 text-tone-brick" />}
              title="Exam Tips"
              sub={tips.length > 0 ? `${tips.length} tips · poore number ke liye` : undefined}
            />
            <Block
              {...blockProps("tips", "Exam tips")}
              className="grid gap-5 md:grid-cols-[1.4fr_1fr]"
            >
              {tips.length > 0 && (
                <ul className="sticker space-y-3 rounded-2xl bg-card p-4 pr-11 sm:p-5 sm:pr-12">
                  {tips.map((t, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="font-display text-lg font-extrabold text-accent">
                        {i + 1}.
                      </span>
                      <span>
                        <Emph text={t} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {content.funFact && (
                <div className="sticker self-start rounded-2xl bg-secondary p-4 sm:p-5 sm:pr-12">
                  <p className="font-display text-sm font-bold uppercase tracking-wider">
                    Mazedaar fact
                  </p>
                  <p className="mt-2 font-hand text-xl leading-snug">
                    <Emph text={content.funFact} />
                  </p>
                </div>
              )}
            </Block>
          </section>
        )}
      </div>
    </SeenContext.Provider>
  );
}
