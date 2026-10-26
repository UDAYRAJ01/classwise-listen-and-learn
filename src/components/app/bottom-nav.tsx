import { Link, useRouterState } from "@tanstack/react-router";
import { GraduationCap, House, LibraryBig, NotebookPen, Target, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { DEFAULT_CLASS, myClass } from "@/lib/my-class";
import { useNotebook } from "@/lib/notebook-store";
import { cn } from "@/lib/utils";

/** The reader and sign-in are full-screen: no tab bar there. */
export function showsBottomNav(pathname: string): boolean {
  if (/^\/learn\/[^/]+\/[^/]+\/[^/]+\/[^/]+/.test(pathname)) return false;
  if (pathname.startsWith("/auth")) return false;
  return true;
}

const tabClass =
  "group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[0.68rem] font-bold text-muted-foreground transition-colors data-[active=true]:text-primary";

function TabFace({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return (
    <>
      <span
        className={cn(
          "grid h-7 w-14 place-items-center rounded-full transition-colors",
          active ? "bg-primary/12" : "group-active:bg-muted",
        )}
      >
        <Icon className="h-[1.3rem] w-[1.3rem]" strokeWidth={active ? 2.4 : 2} />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </>
  );
}

/** Phone tab bar: Home · Books · JEE/NEET · Guru · Notebook. */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { prefs, recent, saved } = useNotebook();
  const cls = myClass(prefs, recent) ?? DEFAULT_CLASS;
  const typing = useTyping();

  if (!showsBottomNav(pathname) || typing) return null;

  const is = {
    home: pathname === "/",
    books: pathname.startsWith("/learn"),
    exam: pathname.startsWith("/exam"),
    ask: pathname.startsWith("/ask"),
    notebook: pathname.startsWith("/notebook"),
  };

  return (
    <nav
      data-bottom-nav
      aria-label="App"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-bar backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden"
    >
      <div className="mx-auto flex h-[3.75rem] max-w-lg items-stretch">
        <Link to="/" className={tabClass} data-active={is.home} aria-current={is.home ? "page" : undefined}>
          <TabFace icon={House} label="Home" active={is.home} />
        </Link>
        <Link
          to="/learn/$board/$grade"
          params={{ board: cls.board, grade: String(cls.grade) }}
          className={tabClass}
          data-active={is.books}
          aria-current={is.books ? "page" : undefined}
        >
          <TabFace icon={LibraryBig} label="Books" active={is.books} />
        </Link>
        <Link to="/exam" className={tabClass} data-active={is.exam} aria-current={is.exam ? "page" : undefined}>
          <TabFace icon={Target} label="JEE/NEET" active={is.exam} />
        </Link>
        <Link to="/ask" className={tabClass} data-active={is.ask} aria-current={is.ask ? "page" : undefined}>
          <TabFace icon={GraduationCap} label="Guru" active={is.ask} />
        </Link>
        <Link
          to="/notebook"
          className={cn(tabClass, "relative")}
          data-active={is.notebook}
          aria-current={is.notebook ? "page" : undefined}
        >
          <TabFace icon={NotebookPen} label="Notebook" active={is.notebook} />
          {saved.length > 0 && (
            <span className="absolute left-1/2 top-1 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-bold text-accent-foreground">
              {saved.length > 99 ? "99+" : saved.length}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}

/** While the phone keyboard is open the tab bar steps aside (more room to type). */
function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
      if (el.tagName !== "INPUT") return false;
      const type = (el as HTMLInputElement).type;
      return !["checkbox", "radio", "button", "submit", "range", "file", "color"].includes(type);
    };
    const small = () => window.matchMedia("(max-width: 767.98px)").matches;
    // Coming back is delayed: a tap on "send" blurs the field first, and the bar
    // jumping in at that moment would move the button away from the finger.
    let back: ReturnType<typeof setTimeout> | undefined;
    const onIn = (e: FocusEvent) => {
      if (!small() || !isField(e.target)) return;
      clearTimeout(back);
      setTyping(true);
    };
    const onOut = (e: FocusEvent) => {
      if (!isField(e.target) || isField(e.relatedTarget)) return;
      clearTimeout(back);
      back = setTimeout(() => setTyping(false), 250);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      clearTimeout(back);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}
