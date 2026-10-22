import {
  BookOpen,
  Check,
  Dumbbell,
  PartyPopper,
  RotateCcw,
  Target,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Emph } from "@/components/emph";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { NoteContent } from "@/lib/types";

type Mcq = NonNullable<NoteContent["mcqs"]>[number];

const LETTERS = ["A", "B", "C", "D"];

function verdict(score: number, total: number): { icon: LucideIcon; line: string } {
  const pct = total ? score / total : 0;
  if (pct === 1) return { icon: Trophy, line: "Full marks! Topper wali tayyari." };
  if (pct >= 0.7)
    return { icon: PartyPopper, line: "Bahut badhiya! Bas galat wale ek baar aur dekh lo." };
  if (pct >= 0.4)
    return { icon: Dumbbell, line: "Achha start hai. Notes ek baar suno, phir dobara try karo." };
  return {
    icon: BookOpen,
    line: "Koi baat nahi! Pehle short notes aur tricks padho, phir quiz do.",
  };
}

export function Quiz({
  mcqs,
  open,
  onOpenChange,
}: {
  mcqs: Mcq[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const all = useMemo(() => mcqs.map((q, i) => ({ ...q, id: i })), [mcqs]);
  const [queue, setQueue] = useState(all);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<typeof all>([]);
  const [score, setScore] = useState(0);

  const start = useCallback((items: typeof all) => {
    // Shuffle option order each round so answers can't be memorised by position.
    setQueue(
      items.map((q) => {
        const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
        return { ...q, options: order.map((i) => q.options[i]!), answer: order.indexOf(q.answer) };
      }),
    );
    setPos(0);
    setPicked(null);
    setWrong([]);
    setScore(0);
  }, []);

  useEffect(() => {
    if (open) start(all);
  }, [open, all, start]);

  const q = queue[pos];
  const finished = queue.length > 0 && pos >= queue.length;

  const choose = useCallback(
    (i: number) => {
      if (!q || picked !== null) return;
      setPicked(i);
      if (i === q.answer) setScore((s) => s + 1);
      else setWrong((w) => [...w, q]);
    },
    [q, picked],
  );

  const next = useCallback(() => {
    setPicked(null);
    setPos((p) => p + 1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= 4) choose(n - 1);
      else if ((e.key === "Enter" || e.key === "ArrowRight") && picked !== null) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, choose, next, picked]);

  const v = verdict(score, queue.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sticker-lg max-h-[92vh] max-w-xl overflow-y-auto rounded-3xl border-0 bg-background p-0 sm:rounded-3xl">
        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="sticker grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="font-display text-2xl font-extrabold">Quick Quiz</DialogTitle>
              <DialogDescription className="font-hand text-base">
                Sahi option chuno — turant pata chalega
              </DialogDescription>
            </div>
          </div>

          {finished ? (
            <div className="sticker rounded-2xl bg-card p-8 text-center">
              <span className="sticker mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary">
                <v.icon className="h-8 w-8" />
              </span>
              <p className="mt-3 font-display text-4xl font-extrabold">
                {score}
                <span className="text-2xl text-muted-foreground">/{queue.length}</span>
              </p>
              <p className="mt-2 text-muted-foreground">{v.line}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {wrong.length > 0 && (
                  <Button variant="marker" onClick={() => start(wrong)}>
                    <RotateCcw /> Galat wale dobara ({wrong.length})
                  </Button>
                )}
                <Button variant="paper" onClick={() => start(all)}>
                  Poora quiz phir se
                </Button>
              </div>
            </div>
          ) : q ? (
            <>
              <div className="flex items-center gap-2" aria-hidden>
                {queue.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      i < pos ? "bg-ink" : i === pos ? "bg-accent" : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <p className="text-sm font-bold text-muted-foreground">
                Sawaal {pos + 1} / {queue.length}
              </p>
              <p className="font-display text-xl font-bold leading-snug">
                <Emph text={q.question} />
              </p>
              <ul className="grid gap-2.5">
                {q.options.map((o, i) => {
                  const isAnswer = i === q.answer;
                  const isPicked = i === picked;
                  const state =
                    picked === null ? "idle" : isAnswer ? "right" : isPicked ? "wrong" : "dim";
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => choose(i)}
                        disabled={picked !== null}
                        data-state={state}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left font-semibold transition-colors",
                          "hover:bg-muted disabled:cursor-default disabled:hover:bg-card",
                          "data-[state=right]:bg-tone-leaf/20 data-[state=wrong]:bg-destructive/15 data-[state=dim]:opacity-55",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border font-display text-sm font-bold",
                            state === "right" && "bg-tone-leaf text-paper",
                            state === "wrong" && "bg-destructive text-destructive-foreground",
                          )}
                        >
                          {state === "right" ? (
                            <Check className="h-4 w-4" />
                          ) : state === "wrong" ? (
                            <X className="h-4 w-4" />
                          ) : (
                            LETTERS[i]
                          )}
                        </span>
                        <span>{o}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {picked !== null && (
                <div className="sticker rounded-2xl bg-sticky p-4 text-sticky-foreground">
                  <p className="font-display font-bold">
                    {picked === q.answer ? "Sahi jawaab! ✓" : `Sahi jawaab: ${LETTERS[q.answer]}`}
                  </p>
                  {q.explanation && (
                    <p className="mt-1">
                      <Emph text={q.explanation} />
                    </p>
                  )}
                  <Button variant="ink" className="mt-3" onClick={next}>
                    {pos + 1 < queue.length ? "Agla sawaal" : "Result dekho"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Is chapter ka quiz abhi taiyaar nahi hai.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
