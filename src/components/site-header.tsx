import { Link } from "@tanstack/react-router";
import { GraduationCap, Headphones, LogIn, LogOut, NotebookPen } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

import { SearchButton } from "@/components/search-dialog";
import { useNotebook } from "@/lib/notebook-store";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`group inline-flex items-center gap-2 ${className}`}
      aria-label="PadhoSuno home"
    >
      <span className="sticker grid h-9 w-9 place-items-center rounded-xl bg-secondary transition-transform group-hover:-rotate-6">
        <Headphones className="h-5 w-5 text-ink" strokeWidth={2.5} />
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">
        Padho<span className="text-accent">Suno</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { saved } = useNotebook();
  return (
    <header className="no-print sticky top-0 z-40 border-b-2 border-ink/90 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
          <SearchButton />
          <Link
            to="/"
            hash="classes"
            className="hidden rounded-lg px-3 py-2 hover:bg-muted sm:inline-flex"
          >
            Classes
          </Link>
          <Link
            to="/ask"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted"
            activeProps={{ className: "bg-muted" }}
          >
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Guru se poochho</span>
          </Link>
          <Link
            to="/notebook"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted"
            activeProps={{ className: "bg-muted" }}
          >
            <NotebookPen className="h-4 w-4" />
            <span className="hidden sm:inline">Meri Notebook</span>
            {saved.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                {saved.length}
              </span>
            )}
          </Link>
          <AccountButton />
        </nav>
      </div>
    </header>
  );
}

function AccountButton() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  if (email === undefined) return <span className="w-9" aria-hidden />;
  if (!email)
    return (
      <Link
        to="/auth"
        search={{ next: "/notebook" }}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  return (
    <button
      type="button"
      title={`${email} — sign out`}
      onClick={() => void supabase.auth.signOut()}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-bold uppercase text-accent-foreground">
        {email[0]}
      </span>
      <LogOut className="hidden h-4 w-4 sm:inline" />
    </button>
  );
}
