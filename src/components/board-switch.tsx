import { Link } from "@tanstack/react-router";

import { BOARD_IDS, BOARDS, type BoardId } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Segmented control. When `grade` is given it links to that grade on each board.
 * `compact` shows short names (CBSE / ICSE) for phone title bars.
 */
export function BoardSwitch({
  value,
  grade,
  onChange,
  compact = false,
  className,
}: {
  value: BoardId;
  grade?: number;
  onChange?: (b: BoardId) => void;
  compact?: boolean;
  className?: string;
}) {
  const base = cn(
    "relative rounded-md font-bold text-muted-foreground transition-colors data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-sm",
    compact ? "px-2.5 py-1 text-xs" : "px-4 py-1.5 text-sm",
  );
  return (
    <div
      role="tablist"
      aria-label="Board"
      className={cn("inline-flex gap-0.5 rounded-lg bg-muted p-0.5", className)}
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
            {compact ? BOARDS[b].short : BOARDS[b].name}
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
            {compact ? BOARDS[b].short : BOARDS[b].name}
          </button>
        ),
      )}
    </div>
  );
}
