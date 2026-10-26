import { CalendarCheck, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { REVISION_GAPS, revisionState, type Revision } from "@/lib/exam";
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

/** "Revise kiya" — spaced repetition: next revision after 1, 3, 7, 15, 30, 60 days. */
export function RevisionButton({ revKey, className }: { revKey: string; className?: string }) {
  const { revisions } = useNotebook();
  const r = revisions[revKey];
  const today = localDay();
  const state = revisionState(r, today);
  const doneToday = r?.last === today;
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button
        variant={state === "due" ? "marker" : "ink"}
        onClick={() => notebook.revise(revKey)}
        disabled={doneToday}
      >
        <CalendarCheck /> {doneToday ? "Aaj revise ho gaya" : "Revise kiya"}
      </Button>
      <p className="text-sm text-muted-foreground">
        {revisionLine(r, today)}
        {!r && ` · phir ${REVISION_GAPS.slice(0, 4).join(", ")}… din baad yaad dilayenge`}
      </p>
      {r && (
        <Button variant="ghost" size="sm" onClick={() => notebook.resetRevision(revKey)} title="Revision schedule hatao">
          <RotateCcw /> Reset
        </Button>
      )}
    </div>
  );
}
