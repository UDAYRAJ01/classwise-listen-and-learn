import { Brain, Check, ChevronLeft, PartyPopper, RotateCcw, Shuffle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Emph } from "@/components/emph";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { NoteContent } from "@/lib/types";

type Deck = "all" | "terms" | "tricks" | "questions";
interface Card {
  id: string;
  kind: Exclude<Deck, "all">;
  front: string;
  back: string;
}

const DECKS: { id: Deck; label: string }[] = [
  { id: "all", label: "Sab" },
  { id: "terms", label: "Words" },
  { id: "tricks", label: "Tricks" },
  { id: "questions", label: "Sawaal" },
];

const KIND_LABEL: Record<Card["kind"], string> = { terms: "Word", tricks: "Trick", questions: "Sawaal" };

function buildCards(note: NoteContent): Card[] {
  return [
    ...note.keyTerms.map((t, i) => ({ id: `t${i}`, kind: "terms" as const, front: t.term, back: t.meaning })),
    ...note.tricks.map((t, i) => ({
      id: `k${i}`,
      kind: "tricks" as const,
      front: t.title,
      back: `${t.trick}${t.explanation ? ` — ${t.explanation}` : ""}`,
    })),
    ...note.questions.map((q, i) => ({ id: `q${i}`, kind: "questions" as const, front: q.question, back: q.answer })),
  ];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function Flashcards({ note, open, onOpenChange }: { note: NoteContent; open: boolean; onOpenChange: (v: boolean) => void }) {
  const all = useMemo(() => buildCards(note), [note]);
  const [deck, setDeck] = useState<Deck>("all");
  const [queue, setQueue] = useState<Card[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [again, setAgain] = useState(0);

  const reset = useCallback(
    (d: Deck, mix = false) => {
      const cards = all.filter((c) => d === "all" || c.kind === d);
      setQueue(mix ? shuffle(cards) : cards);
      setPos(0);
      setFlipped(false);
      setKnown(0);
      setAgain(0);
    },
    [all],
  );

  useEffect(() => {
    if (open) reset(deck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, all]);

  const card = queue[pos];
  const finished = queue.length > 0 && pos >= queue.length;

  const answer = useCallback(
    (remembered: boolean) => {
      if (!card) return;
      if (remembered) setKnown((k) => k + 1);
      else {
        setAgain((a) => a + 1);
        setQueue((q) => [...q, card]);
      }
      setFlipped(false);
      setPos((p) => p + 1);
    },
    [card],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") answer(true);
      else if (e.key === "ArrowLeft") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, answer]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sticker-lg max-w-xl rounded-3xl border-0 bg-background p-0 sm:rounded-3xl">
        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="sticker grid h-10 w-10 place-items-center rounded-xl bg-secondary">
              <Brain className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="font-display text-2xl font-extrabold">Flashcards</DialogTitle>
              <DialogDescription className="font-hand text-base">Card palto, socho, yaad karo</DialogDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {DECKS.map((d) => {
              const count = all.filter((c) => d.id === "all" || c.kind === d.id).length;
              return (
                <button
                  key={d.id}
                  type="button"
                  data-active={deck === d.id}
                  disabled={count === 0}
                  onClick={() => {
                    setDeck(d.id);
                    reset(d.id);
                  }}
                  className="rounded-full border-2 border-ink px-3 py-1 text-sm font-bold disabled:opacity-40 data-[active=true]:bg-ink data-[active=true]:text-paper"
                >
                  {d.label} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => reset(deck, true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold hover:bg-muted"
            >
              <Shuffle className="h-4 w-4" /> Shuffle
            </button>
          </div>

          {finished ? (
            <div className="sticker rounded-2xl bg-card p-8 text-center">
              <span className="sticker mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary">
                <PartyPopper className="h-8 w-8" />
              </span>
              <p className="mt-3 font-display text-2xl font-extrabold">Shabash! Deck poora hua</p>
              <p className="mt-1 text-muted-foreground">
                {known} cards yaad the{again > 0 ? `, ${again} baar dobara dekhe` : ""}.
              </p>
              <Button variant="ink" className="mt-5" onClick={() => reset(deck, true)}>
                <RotateCcw /> Phir se karo
              </Button>
            </div>
          ) : card ? (
            <>
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="group block w-full perspective-[1400px]"
                aria-label={flipped ? "Sawaal dikhao" : "Answer dikhao"}
              >
                <div
                  className={cn(
                    "relative min-h-64 w-full transition-transform duration-500 transform-3d",
                    flipped && "rotate-y-180",
                  )}
                >
                  <div className="paper-ruled sticker absolute inset-0 flex flex-col rounded-2xl p-6 pl-14 text-left backface-hidden">
                    <span className="text-xs font-bold uppercase tracking-wider text-accent">{KIND_LABEL[card.kind]}</span>
                    <p className="mt-3 flex-1 font-display text-2xl font-bold leading-snug">
                      <Emph text={card.front} />
                    </p>
                    <p className="font-hand text-base text-muted-foreground">tap karke palto ↻</p>
                  </div>
                  <div className="sticker absolute inset-0 flex rotate-y-180 flex-col overflow-y-auto rounded-2xl bg-sticky p-6 text-left text-sticky-foreground backface-hidden">
                    <span className="text-xs font-bold uppercase tracking-wider">Answer</span>
                    <p className="mt-3 text-lg leading-relaxed">
                      <Emph text={card.back} />
                    </p>
                  </div>
                </div>
              </button>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-muted-foreground">
                  {Math.min(pos + 1, queue.length)} / {queue.length}
                </span>
                <div className="flex gap-2">
                  <Button variant="paper" onClick={() => answer(false)}>
                    <X /> Phir se
                  </Button>
                  <Button variant="ink" onClick={() => answer(true)}>
                    <Check /> Yaad hai
                  </Button>
                </div>
              </div>
              {pos > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPos((p) => Math.max(0, p - 1));
                    setFlipped(false);
                  }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" /> Pichla card
                </button>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Is deck mein abhi cards nahi hain.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
