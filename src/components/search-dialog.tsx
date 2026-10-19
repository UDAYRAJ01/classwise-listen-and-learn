import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, GraduationCap, LoaderCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SubjectIcon } from "@/components/subject-icon";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  BOARD_IDS,
  BOARDS,
  GRADES,
  getSubjects,
  gradeLabel,
  SUBJECTS,
  type BoardId,
} from "@/lib/catalog";
import { searchChapters } from "@/lib/content.functions";
import { useNotebook } from "@/lib/notebook-store";

interface CatalogHit {
  key: string;
  board: BoardId;
  grade: number;
  subject?: string;
  label: string;
  sub: string;
  hay: string;
}

const CATALOG: CatalogHit[] = BOARD_IDS.flatMap((board) =>
  GRADES.flatMap((grade) => [
    {
      key: `${board}-${grade}`,
      board,
      grade,
      label: gradeLabel(board, grade),
      sub: BOARDS[board].name,
      hay: `class ${grade} ${board} ${BOARDS[board].name} ${board === "icse" && grade >= 11 ? "isc" : ""}`.toLowerCase(),
    },
    ...getSubjects(board, grade).map((s) => ({
      key: `${board}-${grade}-${s.slug}`,
      board,
      grade,
      subject: s.slug,
      label: `${s.name} · Class ${grade}`,
      sub: `${BOARDS[board].name} · ${s.hi}`,
      hay: `class ${grade} ${s.name} ${s.hi} ${s.slug.replace(/-/g, " ")} ${board} ${BOARDS[board].name} ${
        board === "icse" && grade >= 11 ? "isc" : ""
      }`.toLowerCase(),
    })),
  ]),
);

function matchCatalog(q: string): CatalogHit[] {
  const tokens = q
    .toLowerCase()
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];
  return CATALOG.filter((c) =>
    tokens.every((t) =>
      /^\d+$/.test(t) ? Number(t) === c.grade : c.hay.includes(t.replace(/^class$/, "class")),
    ),
  ).slice(0, 8);
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chapter ya subject dhundho"
        className="inline-flex items-center gap-2 rounded-lg border-2 border-ink/80 bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Dhundho…</span>
        <kbd className="hidden rounded bg-muted px-1.5 text-[11px] font-bold md:inline">/</kbd>
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { prefs } = useNotebook();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 250);
  const catalogHits = useMemo(() => matchCatalog(q), [q]);
  const { data: chapterHits, isFetching } = useQuery({
    queryKey: ["search", dq],
    queryFn: () => searchChapters({ data: { q: dq } }),
    enabled: open && dq.length >= 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const chapters = dq.length >= 2 ? (chapterHits ?? []) : [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="[&_[cmdk-root]]:bg-background">
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="jaise: class 10 science, photosynthesis, गणित…"
          className="text-base"
        />
      </div>
      <CommandList className="max-h-[60vh]">
        {q.trim().length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Class, subject ya chapter ka naam likho.{" "}
            <span className="font-hand text-base">Tip: “/” dabao kahin se bhi.</span>
          </div>
        )}
        {q.trim().length > 0 &&
          catalogHits.length === 0 &&
          chapters.length === 0 &&
          !isFetching && (
            <CommandEmpty>
              Kuch nahi mila. Spelling check karo ya subject kholo aur topic likho.
            </CommandEmpty>
          )}
        {catalogHits.length > 0 && (
          <CommandGroup heading="Classes & subjects">
            {catalogHits.map((c) => (
              <CommandItem
                key={c.key}
                value={c.key}
                onSelect={() =>
                  go(() =>
                    c.subject
                      ? navigate({
                          to: "/learn/$board/$grade/$subject",
                          params: { board: c.board, grade: String(c.grade), subject: c.subject },
                        })
                      : navigate({
                          to: "/learn/$board/$grade",
                          params: { board: c.board, grade: String(c.grade) },
                        }),
                  )
                }
                className="gap-3"
              >
                {c.subject ? (
                  <SubjectIcon
                    name={SUBJECTS[c.subject]?.icon ?? "BookOpen"}
                    className="text-muted-foreground"
                  />
                ) : (
                  <GraduationCap className="text-muted-foreground" />
                )}
                <span className="min-w-0">
                  <span className="block font-semibold">{c.label}</span>
                  <span className="block text-xs text-muted-foreground">{c.sub}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(chapters.length > 0 || (isFetching && dq.length >= 2)) && (
          <CommandGroup heading="Chapters">
            {isFetching && chapters.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Chapters dhundh rahe hain…
              </div>
            )}
            {chapters.map((h) => (
              <CommandItem
                key={`${h.board}-${h.grade}-${h.subject}-${h.slug}`}
                value={`${h.board}-${h.grade}-${h.subject}-${h.slug}`}
                onSelect={() =>
                  go(() =>
                    navigate({
                      to: "/learn/$board/$grade/$subject/$chapter",
                      params: {
                        board: h.board,
                        grade: String(h.grade),
                        subject: h.subject,
                        chapter: h.slug,
                      },
                      search: prefs.lang ? { lang: prefs.lang } : {},
                    }),
                  )
                }
                className="gap-3"
              >
                <BookOpen className="text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{h.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {BOARDS[h.board].short} · Class {h.grade} · {SUBJECTS[h.subject]?.name} ·{" "}
                    {h.book}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
