import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { BookTile, shelfGridClass, shelfItems } from "@/components/app/book-cover";
import { ChipRow, chipClass, ScreenHeader } from "@/components/app/screen-header";
import { BoardSwitch } from "@/components/board-switch";
import { SearchButton } from "@/components/search-dialog";
import {
  BOARDS,
  GRADES,
  getSubjects,
  gradeLabel,
  isBoard,
  parseGrade,
  type BoardId,
} from "@/lib/catalog";
import { notebook, useNotebook } from "@/lib/notebook-store";
import { classBooksQuery } from "@/lib/queries";

export const Route = createFileRoute("/learn/$board/$grade/")({
  loader: async ({ params, context }) => {
    const grade = parseGrade(params.grade);
    if (!isBoard(params.board) || grade === null) throw notFound();
    // Covers are a bonus: the shelf still works (subject tiles) if this fails.
    await context.queryClient
      .ensureQueryData(classBooksQuery(params.board, grade))
      .catch(() => null);
    return { board: params.board as BoardId, grade };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Class not found — PadhoSuno" }] };
    const b = BOARDS[loaderData.board];
    const label = gradeLabel(loaderData.board, loaderData.grade);
    const title = `${label} ${b.short} Books & Notes — Sab Subjects | PadhoSuno`;
    const description = `${b.name} ${label} ki saari books: har chapter ke short notes, memory tricks, important questions aur audio. Hindi, English aur Hinglish mein.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ClassShelfPage,
});

function ClassShelfPage() {
  const { board, grade } = Route.useLoaderData();
  const { data: books, isPending } = useQuery(classBooksQuery(board, grade));
  const { prefs } = useNotebook();
  const items = shelfItems(getSubjects(board, grade), books);
  const label = gradeLabel(board, grade);
  const mine = prefs.board === board && prefs.grade === grade;
  const chips = useRef<HTMLDivElement>(null);

  // Keep the chosen class chip in view when the row is scrolled sideways.
  useEffect(() => {
    chips.current
      ?.querySelector<HTMLElement>("[data-active=true]")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [grade]);

  return (
    <>
      <ScreenHeader
        title="Books"
        subtitle={BOARDS[board].name}
        actions={
          <>
            <BoardSwitch value={board} grade={grade} compact />
            <span className="md:hidden">
              <SearchButton compact />
            </span>
          </>
        }
      >
        <div ref={chips}>
          <ChipRow label="Class">
            {GRADES.map((g) => (
              <li key={g}>
                <Link
                  to="/learn/$board/$grade"
                  params={{ board, grade: String(g) }}
                  data-active={g === grade}
                  aria-current={g === grade ? "page" : undefined}
                  className={chipClass}
                  replace
                >
                  {board === "icse" && g >= 11 ? `ISC ${g}` : `Class ${g}`}
                </Link>
              </li>
            ))}
          </ChipRow>
        </div>
      </ScreenHeader>

      <div className="mx-auto max-w-6xl px-4 pt-4 md:pt-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-extrabold md:text-xl">
            {label}
            <span className="font-semibold text-muted-foreground">
              {" "}
              · {items.length} {items.length === 1 ? "book" : "books"}
            </span>
          </h2>
          {mine ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-tone-leaf">
              <CheckCircle2 className="h-4 w-4" /> Meri class
            </span>
          ) : (
            <button
              type="button"
              onClick={() => notebook.setPrefs({ board, grade })}
              className="rounded-full px-2 py-1 text-xs font-bold text-primary hover:bg-muted"
            >
              Meri class banao
            </button>
          )}
        </div>

        <ul className={shelfGridClass}>
          {isPending && !books
            ? Array.from({ length: 9 }, (_, i) => (
                <li key={i} aria-hidden>
                  <span className="block aspect-[5/7] animate-pulse rounded-md bg-muted" />
                  <span className="mt-2 block h-3 w-3/4 animate-pulse rounded bg-muted" />
                </li>
              ))
            : items.map((it, i) => (
                <li key={`${it.subject.slug}-${it.index}`}>
                  <BookTile
                    board={board}
                    grade={grade}
                    subject={it.subject}
                    book={it.book}
                    bookIndex={it.index}
                    multi={it.multi}
                    eager={i < 6}
                  />
                </li>
              ))}
        </ul>
      </div>
    </>
  );
}
