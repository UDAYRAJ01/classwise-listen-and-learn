import { useState } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { BOARD_IDS, BOARDS, GRADES, type BoardId } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Board switch + 1–12 grid. */
export function ClassPicker({
  board,
  grade,
  onPick,
  className,
}: {
  board: BoardId;
  grade: number | null;
  onPick: (board: BoardId, grade: number) => void;
  className?: string;
}) {
  const [b, setB] = useState<BoardId>(board);
  return (
    <div className={className}>
      <div role="tablist" aria-label="Board" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {BOARD_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={b === id}
            data-active={b === id}
            onClick={() => setB(id)}
            className="rounded-lg px-3 py-2 text-sm font-bold text-muted-foreground transition-colors data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-sm"
          >
            {BOARDS[id].name}
          </button>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {GRADES.map((g) => {
          const active = b === board && g === grade;
          return (
            <li key={g}>
              <button
                type="button"
                onClick={() => onPick(b, g)}
                aria-pressed={active}
                data-active={active}
                className={cn(
                  "flex aspect-square w-full flex-col items-center justify-center rounded-2xl border border-border bg-card transition-colors hover:border-primary active:scale-95",
                  "data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground",
                )}
              >
                <span className="font-display text-2xl font-extrabold leading-none">{g}</span>
                <span className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider opacity-70">
                  {b === "icse" && g >= 11 ? "ISC" : "Class"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bottom sheet with the class picker. */
export function ClassSheet({
  open,
  onOpenChange,
  board,
  grade,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: BoardId;
  grade: number | null;
  onPick: (board: BoardId, grade: number) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-xl font-extrabold">Apni class chuno</DrawerTitle>
          <DrawerDescription className="sr-only">Board aur class chuno</DrawerDescription>
        </DrawerHeader>
        <ClassPicker
          key={`${board}-${grade}`}
          className="px-4"
          board={board}
          grade={grade}
          onPick={(b, g) => {
            onPick(b, g);
            onOpenChange(false);
          }}
        />
      </DrawerContent>
    </Drawer>
  );
}
