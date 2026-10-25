import { BookCheck, BookOpen, CheckCircle2, CircleDashed } from "lucide-react";

import type { ChapterStatus } from "@/lib/notebook-store";
import { cn } from "@/lib/utils";

/** "x/y hisse padhe" meter for one chapter. */
export function ReadMeter({
  read,
  total,
  done,
  compact,
  className,
}: {
  read: number;
  total: number;
  done: boolean;
  compact?: boolean;
  className?: string;
}) {
  const share = done ? 1 : total > 0 ? read / total : 0;
  return (
    <div
      className={cn(
        "rounded-xl border border-border p-3",
        done ? "bg-tone-leaf/10" : "bg-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 text-sm font-bold">
        <span className="flex items-center gap-1.5">
          {done ? (
            <BookCheck className="h-4 w-4 text-tone-leaf" />
          ) : (
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          )}
          {done ? "Padh liya" : compact ? "Padhai" : "Is chapter ki padhai"}
        </span>
        <span className={cn("tabular-nums", done ? "text-tone-leaf" : "text-muted-foreground")}>
          {done ? total : read}/{total}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done ? total : read}
        aria-label="Kitne hisse padhe"
      >
        <div
          className="h-full rounded-full bg-tone-leaf transition-[width] duration-500"
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
      {!compact && !done && (
        <p className="mt-2 text-xs text-muted-foreground">
          Har hissa padhne ya sunne par tick lagega. Saare hisse = chapter “padh liya”.
        </p>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<ChapterStatus, { label: string; className: string }> = {
  done: { label: "Yaad ho gaya", className: "bg-tone-leaf text-paper" },
  read: { label: "Padh liya", className: "bg-tone-leaf/15 text-tone-leaf" },
  started: { label: "Adhura", className: "bg-tone-sun/20 text-foreground" },
  new: { label: "Baaki", className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({
  status,
  share,
  className,
}: {
  status: ChapterStatus;
  /** For "started": share already read (0–1). */
  share?: number;
  className?: string;
}) {
  const s = STATUS_STYLE[status];
  const Icon =
    status === "done"
      ? CheckCircle2
      : status === "read"
        ? BookCheck
        : status === "started"
          ? CircleDashed
          : null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        s.className,
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {s.label}
      {status === "started" && share !== undefined && share > 0 && (
        <span className="tabular-nums opacity-70">{Math.round(share * 100)}%</span>
      )}
    </span>
  );
}

/** Stacked bar: memorised / read / started out of total chapters. */
export function SubjectProgressBar({
  total,
  done,
  read,
  started,
  className,
}: {
  total: number;
  done: number;
  read: number;
  started: number;
  className?: string;
}) {
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
  return (
    <div
      className={cn("flex h-2.5 overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={`${done + read} of ${total} chapters padhe`}
    >
      <span className="h-full bg-tone-leaf" style={{ width: pct(done) }} />
      <span className="h-full bg-tone-leaf/50" style={{ width: pct(read) }} />
      <span className="h-full bg-tone-sun/60" style={{ width: pct(started) }} />
    </div>
  );
}
