import { Link } from "@tanstack/react-router";

import { BOARD_IDS, BOARDS, type BoardId } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Segmented control. When `grade` is given it links to that grade on each board. */
export function BoardSwitch({
  value,
  grade,
  onChange,
  className,
}: {
  value: BoardId;
  grade?: number;
  onChange?: (b: BoardId) => void;
  className?: string;
}) {
  const base =
    "relative rounded-lg px-4 py-2 text-sm font-bold transition-colors data-[active=true]:bg-ink data-[active=true]:text-paper hover:bg-muted data-[active=true]:hover:bg-ink";
  return (
    <div
      role="tablist"
      aria-label="Board"
      className={cn("sticker inline-flex gap-1 rounded-xl bg-card p-1", className)}
    >
      {BOARD_IDS.map((b) =>
        grade && !onChange ? (
          <Link
            key={b}
            to="/learn/$board/$grade"
            params={{ board: b, grade: String(grade) }}
            role="tab"
            aria-selected={value === b}
            data-active={value === b}
            className={base}
          >
            {BOARDS[b].name}
          </Link>
        ) : (
          <button
            key={b}
            type="button"
            role="tab"
            aria-selected={value === b}
            data-active={value === b}
            onClick={() => onChange?.(b)}
            className={base}
          >
            {BOARDS[b].name}
          </button>
        ),
      )}
    </div>
  );
}
