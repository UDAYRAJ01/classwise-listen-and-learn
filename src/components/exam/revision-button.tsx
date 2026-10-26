import { CalendarCheck, Repeat, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { revisionState, type Revision } from "@/lib/exam";
import { localDay, notebook, useNotebook } from "@/lib/notebook-store";
import { cn } from "@/lib/utils";

const fmt = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export function revisionLine(r: Revision | undefined, today: string): string {
  if (!r) return "Abhi revise nahi kiya";
  if (r.next <= today) return `Aaj revise karo (${r.n} baar ho chuka)`;
  return `Agla revision ${fmt(r.next)} ko · ${r.n} baar ho chuka`;
}

/** "Revise kiya" box — spaced repetition: next revision after 1, 3, 7, 15, 30, 60 days. */
export function RevisionButton({ revKey, className }: { revKey: string; className?: string }) {
  const { revisions } = useNotebook();
  const r = revisions[revKey];
  const today = localDay();
  const state = revisionState(r, today);
  const doneToday = r?.last === today;
  return (
    <section
      aria-label="Revision"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4",
        state === "due" && "border-accent/50 bg-accent/5",
        className,
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Repeat className="h-5 w-5" />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="block font-display font-bold">Revision</span>
        <span className="block text-xs text-muted-foreground">
          {r ? revisionLine(r, today) : "Revise karo — 1, 3, 7, 15, 30 din baad yaad dilayenge"}
        </span>
      </p>
      <span className="flex items-center gap-1">
        {r && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => notebook.resetRevision(revKey)}
            title="Revision schedule hatao"
            aria-label="Revision reset karo"
          >
            <RotateCcw />
          </Button>
        )}
        <Button
          variant={state === "due" ? "marker" : "ink"}
          size="sm"
          className="h-9 rounded-full px-3.5"
          onClick={() => notebook.revise(revKey)}
          disabled={doneToday}
        >
          <CalendarCheck /> {doneToday ? "Aaj ho gaya" : "Revise kiya"}
        </Button>
      </span>
    </section>
  );
}
