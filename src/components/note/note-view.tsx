import {
  BookMarked,
  CheckCheck,
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
import { useState, type ReactNode } from "react";

import { Emph } from "@/components/emph";
import { cn } from "@/lib/utils";
import { TERMS_PER_TRACK } from "@/lib/tracks";
import type { PartialNote, TrickKind } from "@/lib/types";

export const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "notes", label: "Short Notes" },
  { id: "terms", label: "Important Words" },
  { id: "formulas", label: "Formulas" },
  { id: "tricks", label: "Tricks" },
  { id: "questions", label: "Important Q&A" },
  { id: "revision", label: "1-Min Revision" },
  { id: "tips", label: "Exam Tips" },
] as const;

const TRICK_LABEL: Record<TrickKind, string> = {
  acronym: "Short-form",
  rhyme: "Kavita",
  story: "Kahani",
  visual: "Picture socho",
  pattern: "Pattern",
  shortcut: "Shortcut",
};

const STICKY_TONES = ["bg-sticky", "bg-tone-sky/25", "bg-tone-rose/20", "bg-tone-leaf/20"];
const TILTS = ["-rotate-1", "rotate-1", "rotate-[0.6deg]", "-rotate-[0.8deg]"];

interface Props {
  content: PartialNote;
  streaming: boolean;
  activeBlockId: string | null;
  playable: boolean;
  onPlayBlock: (blockId: string) => void;
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
      className={cn("print-plain relative scroll-mt-32 transition-[outline,box-shadow] duration-300", active && "reading-now", className)}
    >
      {playable && (
        <button
          type="button"
          onClick={() => onPlay(id)}
          aria-label={`${label} — suno`}
          title="Yahan se suno"
          className={cn(
            "no-print absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-card text-ink transition-transform hover:scale-110",
            active && "bg-accent text-accent-foreground",
          )}
        >
          {active ? <Volume2 className="h-4 w-4" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
        </button>
      )}
      {children}
    </div>
  );
}

function SectionTitle({ id, icon, title, sub, right }: { id: string; icon: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div id={`sec-${id}`} className="mb-5 flex scroll-mt-28 flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="sticker grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card">{icon}</span>
        <div>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
          {sub && <p className="font-hand text-lg leading-tight text-muted-foreground">{sub}</p>}
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
        <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function NoteView({ content, streaming, activeBlockId, playable, onPlayBlock }: Props) {
  const [hideAnswers, setHideAnswers] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const keyPoints = content.keyPoints ?? [];
  const terms = content.keyTerms ?? [];
  const formulas = content.formulas ?? [];
  const tricks = content.tricks ?? [];
  const questions = content.questions ?? [];
  const revision = content.quickRevision ?? [];
  const tips = content.examTips ?? [];

  const termChunks: (typeof terms)[] = [];
  for (let i = 0; i < terms.length; i += TERMS_PER_TRACK) termChunks.push(terms.slice(i, i + TERMS_PER_TRACK));

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
    <div className="space-y-16">
      {/* Summary */}
      <section aria-labelledby="sec-summary">
        <SectionTitle id="summary" icon={<BookMarked className="h-5 w-5 text-tone-ink" />} title="Chapter ek nazar mein" />
        <Block {...blockProps("intro", "Summary")} className="sticker-lg rounded-2xl bg-card p-6 sm:p-8">
          {content.oneLiner ? (
            <div className="mb-5 flex gap-3 pr-10">
              <Quote className="mt-1 h-6 w-6 shrink-0 text-accent" />
              <p className="font-hand text-2xl leading-snug text-foreground sm:text-[1.7rem]">
                <Emph text={content.oneLiner} />
              </p>
            </div>
          ) : (
            <Skeleton lines={1} />
          )}
          {content.summary ? (
            <p className="text-lg leading-relaxed text-foreground/90">
              <Emph text={content.summary} />
            </p>
          ) : (
            streaming && <Skeleton lines={3} />
          )}
        </Block>
      </section>

      {/* Short notes */}
      {(started(keyPoints) || streaming) && (
        <section>
          <SectionTitle
            id="notes"
            icon={<ListChecks className="h-5 w-5 text-tone-leaf" />}
            title="Short Notes"
            sub="highlight wale words = sabse zaroori"
          />
          <div className="grid gap-6 md:grid-cols-2">
            {keyPoints.map((g, i) => (
              <Block
                key={i}
                {...blockProps(`kp-${i}`, g.heading ?? "Notes")}
                className="paper-ruled sticker rounded-2xl pb-5 pl-14 pr-12 pt-5"
              >
                <h3 className="mb-2 font-display text-xl font-bold leading-[1.9rem] text-tone-ink">
                  <Emph text={g.heading} />
                </h3>
                <ul className="space-y-0">
                  {(g.points ?? []).map((p, j) => (
                    <li key={j} className="relative leading-[1.9rem]">
                      <span className="absolute -left-6 top-0 font-hand text-lg text-accent" aria-hidden>
                        ✱
                      </span>
                      <Emph text={p} />
                    </li>
                  ))}
                </ul>
              </Block>
            ))}
            {streaming && keyPoints.length === 0 && (
              <div className="paper-ruled sticker rounded-2xl p-6 pl-14">
                <Skeleton lines={4} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Key terms */}
      {started(terms) && (
        <section>
          <SectionTitle id="terms" icon={<Sparkles className="h-5 w-5 text-tone-sun" />} title="Important Words" sub="definition yaad = aadha kaam ho gaya" />
          <div className="space-y-6">
            {termChunks.map((chunk, k) => (
              <Block key={k} {...blockProps(`terms-${k}`, "Important words")} className="sticker rounded-2xl bg-card p-5 pr-12">
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
        <section>
          <SectionTitle id="formulas" icon={<FlaskRound className="h-5 w-5 text-tone-teal" />} title="Formulas & Rules" />
          <Block {...blockProps("formulas", "Formulas")} className="paper-grid sticker rounded-2xl p-5 pr-12 sm:p-6">
            <ul className="grid gap-4 sm:grid-cols-2">
              {formulas.map((f, i) => (
                <li key={i} className="rounded-xl border-2 border-ink/80 bg-card/95 p-4">
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
        <section>
          <SectionTitle
            id="tricks"
            icon={<Lightbulb className="h-5 w-5 text-tone-coral" />}
            title="Yaad Karne Ki Tricks"
            sub="ek baar padho, hamesha yaad"
          />
          <div className="grid gap-7 sm:grid-cols-2">
            {tricks.map((t, i) => (
              <Block
                key={i}
                {...blockProps(`trick-${i}`, t.title ?? "Trick")}
                className={cn("tape sticker rounded-md p-5 pr-12 pt-7", STICKY_TONES[i % 4], TILTS[i % 4])}
              >
                <span className="mb-2 inline-block rounded-full border-2 border-ink bg-card px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                  {TRICK_LABEL[(t.kind as TrickKind) ?? "shortcut"] ?? "Trick"}
                </span>
                <h3 className="font-display text-lg font-bold">
                  <Emph text={t.title} />
                </h3>
                <p className="mt-2 font-hand text-2xl leading-snug text-ink [&_mark]:font-bold">
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

      {/* Questions */}
      {started(questions) && (
        <section>
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
                className="no-print inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-card px-3 py-1.5 text-sm font-bold hover:bg-muted"
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
                  <Block {...blockProps(`q-${i}`, `Question ${i + 1}`)} className="sticker rounded-2xl bg-card p-5 pr-12">
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
                            className="mt-2 rounded-lg border-2 border-dashed border-ink/50 px-3 py-1.5 font-hand text-lg hover:bg-muted"
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
        <section>
          <SectionTitle id="revision" icon={<CheckCheck className="h-5 w-5 text-tone-leaf" />} title="1-Minute Revision" sub="exam se pehle bas ye padh lo" />
          <Block {...blockProps("revision", "Quick revision")} className="sticker-lg rounded-2xl bg-ink p-6 pr-12 text-paper sm:p-8">
            <ul className="grid gap-3 sm:grid-cols-2">
              {revision.map((r, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border-2 border-secondary text-[11px] font-bold text-secondary">
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
        <section>
          <SectionTitle id="tips" icon={<Target className="h-5 w-5 text-tone-brick" />} title="Exam Tips" />
          <Block {...blockProps("tips", "Exam tips")} className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            {tips.length > 0 && (
              <ul className="sticker space-y-3 rounded-2xl bg-card p-5 pr-12">
                {tips.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-display text-lg font-extrabold text-accent">{i + 1}.</span>
                    <span>
                      <Emph text={t} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {content.funFact && (
              <div className="sticker rounded-2xl bg-secondary p-5 pr-12">
                <p className="font-display text-sm font-bold uppercase tracking-wider">Mazedaar fact</p>
                <p className="mt-2 font-hand text-xl leading-snug">
                  <Emph text={content.funFact} />
                </p>
              </div>
            )}
          </Block>
        </section>
      )}
    </div>
  );
}
