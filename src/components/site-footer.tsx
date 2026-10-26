import { Link } from "@tanstack/react-router";

import { Logo } from "./site-header";

/** Laptop footer only; phones have the tab bar. */
export function SiteFooter() {
  return (
    <footer className="no-print mt-20 hidden border-t border-border md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-6 text-xs text-muted-foreground">
        <Logo className="scale-90" />
        <p className="max-w-xl text-center">
          Notes AI se textbook ke hisaab se bante hain. Exam se pehle apni book se ek baar milayein.
        </p>
        <Link to="/admin/reports" className="hover:text-foreground">
          Owner
        </Link>
      </div>
    </footer>
  );
}
