import { Link } from "@tanstack/react-router";
import { GraduationCap, Headphones, LibraryBig, NotebookPen, Target } from "lucide-react";

import { AccountLink } from "@/components/app/account-link";
import { SearchButton } from "@/components/search-dialog";
import { DEFAULT_CLASS, myClass } from "@/lib/my-class";
import { useNotebook } from "@/lib/notebook-store";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`group inline-flex items-center gap-2 ${className}`}
      aria-label="PadhoSuno home"
    >
      <img src="/favicon.svg" alt="" width={36} height={36} className="h-9 w-9" />
      <span className="font-display text-xl font-extrabold tracking-tight">
        Padho<span className="text-accent">Suno</span>
      </span>
    </Link>
  );
}

const navLink =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const navActive = { className: "bg-muted !text-foreground" };

/** Laptop / tablet header. Phones use the bottom tab bar and per-screen title bars instead. */
export function SiteHeader() {
  const { saved, prefs, recent } = useNotebook();
  const cls = myClass(prefs, recent) ?? DEFAULT_CLASS;
  return (
    <header className="no-print sticky top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex items-center gap-1" aria-label="Main">
          <Link
            to="/learn/$board/$grade"
            params={{ board: cls.board, grade: String(cls.grade) }}
            className={navLink}
            activeProps={navActive}
            activeOptions={{ includeSearch: false }}
          >
            <LibraryBig className="h-4 w-4" /> Books
          </Link>
          <Link to="/exam" className={navLink} activeProps={navActive}>
            <Target className="h-4 w-4" /> JEE / NEET
          </Link>
          <Link to="/ask" className={navLink} activeProps={navActive}>
            <GraduationCap className="h-4 w-4" /> Guru
          </Link>
          <Link to="/notebook" className={navLink} activeProps={navActive}>
            <NotebookPen className="h-4 w-4" /> Notebook
            {saved.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                {saved.length}
              </span>
            )}
          </Link>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <SearchButton />
          <AccountLink />
        </nav>
      </div>
    </header>
  );
}
