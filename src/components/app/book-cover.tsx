import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { SubjectIcon } from "@/components/subject-icon";
import { BOARDS, TONE_CLASSES, type BoardId, type SubjectMeta } from "@/lib/catalog";
import type { ShelfBook } from "@/lib/content.functions";
import { coverFor } from "@/lib/ncert-covers";
import { useNotebook } from "@/lib/notebook-store";
import { subjectProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";

/**
 * A book cover: the official NCERT cover when we have it, otherwise a clean printed-style
 * cover in the subject's colour (ICSE books, typed topics, books without a stored cover).
 */
export function BookCover({
  code,
  title,
  subject,
  board,
  grade,
  className,
  eager,
}: {
  code?: string | null;
  title: string;
  subject: SubjectMeta;
  board: BoardId;
  grade: number;
  className?: string;
  eager?: boolean;
}) {
  const src = coverFor(code);
  const tone = TONE_CLASSES[subject.tone];
  const onLight = subject.tone === "sun";
  return (
    <span
      className={cn(
        "relative block aspect-[5/7] w-full overflow-hidden rounded-md bg-muted shadow-book",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={`${title} — cover`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          width={250}
          height={350}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          className={cn(
            "absolute inset-0 flex flex-col justify-between p-[9%] pl-[14%]",
            tone.solid,
            onLight ? "text-ink" : "text-paper",
          )}
          aria-label={`${title} — cover`}
          role="img"
        >
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] opacity-80">
            {board === "icse" && grade >= 11 ? "ISC" : BOARDS[board].short} · {grade}
          </span>
          <SubjectIcon
            name={subject.icon}
            className="absolute -bottom-[6%] -right-[10%] h-[62%] w-[62%] opacity-15"
          />
          <span className="relative line-clamp-4 font-display text-[0.95rem] font-extrabold leading-[1.15] tracking-tight [overflow-wrap:anywhere]">
            {title}
          </span>
        </span>
      )}
      {/* spine + page edge */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-[5%] bg-ink/15" aria-hidden />
      <span
        className="pointer-events-none absolute inset-y-0 left-[5%] w-px bg-paper/30"
        aria-hidden
      />
    </span>
  );
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** One book on a shelf: cover, name and how much of it is read. */
export function BookTile({
  board,
  grade,
  subject,
  book,
  bookIndex,
  multi,
  eager,
}: {
  board: BoardId;
  grade: number;
  subject: SubjectMeta;
  /** null while the chapter list is not made yet: the tile stands for the subject. */
  book: ShelfBook | null;
  bookIndex: number;
  /** The subject has more than one book: open this one. */
  multi: boolean;
  eager?: boolean;
}) {
  const nb = useNotebook();
  const title = book?.name || subject.name;
  const prog = book ? subjectProgress(nb, { board, grade, subject: subject.slug }, book.slugs) : null;
  const readN = prog ? prog.done + prog.read : 0;
  const finished = !!prog && prog.total > 0 && prog.left === 0;
  const caption = book && !sameName(book.name, subject.name) ? subject.name : null;

  return (
    <Link
      to="/learn/$board/$grade/$subject"
      params={{ board, grade: String(grade), subject: subject.slug }}
      search={multi ? { book: bookIndex } : {}}
      className="group block rounded-lg outline-offset-4"
    >
      <span className="relative block transition-transform duration-200 group-hover:-translate-y-1 group-active:scale-[0.97]">
        <BookCover
          code={book?.code}
          title={title}
          subject={subject}
          board={board}
          grade={grade}
          eager={eager}
        />
        {finished && (
          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-tone-leaf text-paper shadow-sm">
            <CheckCircle2 className="h-4 w-4" aria-label="Poori padh li" />
          </span>
        )}
      </span>
      {prog && readN > 0 && !finished && (
        <span
          className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${readN} of ${prog.total} chapters padhe`}
        >
          <span
            className="block h-full rounded-full bg-tone-leaf"
            style={{ width: `${(readN / prog.total) * 100}%` }}
          />
        </span>
      )}
      <span className="mt-2 line-clamp-2 block font-display text-[0.8rem] font-bold leading-snug sm:text-sm">
        {title}
      </span>
      <span className="block truncate text-[0.7rem] font-semibold text-muted-foreground sm:text-xs">
        {caption ?? (prog ? `${prog.total} chapters` : subject.hi)}
        {prog && readN > 0 && ` · ${readN}/${prog.total}`}
      </span>
    </Link>
  );
}

/** Every book of a class in subject order; subjects without a list yet get one tile. */
export function shelfItems(
  subjects: SubjectMeta[],
  books: Record<string, ShelfBook[]> | undefined,
): { subject: SubjectMeta; book: ShelfBook | null; index: number; multi: boolean }[] {
  return subjects.flatMap((s) => {
    const list = books?.[s.slug];
    if (!list?.length) return [{ subject: s, book: null, index: 0, multi: false }];
    return list.map((b, i) => ({ subject: s, book: b, index: i, multi: list.length > 1 }));
  });
}

export const shelfGridClass =
  "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-5 md:grid-cols-5 lg:grid-cols-6";
