import { Link } from "@tanstack/react-router";

import { Logo } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t-2 border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Class 1 se 12 tak — NCERT, CBSE aur ICSE ke har chapter ke short notes, yaad karne ki
            tricks aur audio. Padho bhi, suno bhi.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-display font-bold">Boards</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              <Link
                to="/learn/$board/$grade"
                params={{ board: "cbse", grade: "10" }}
                className="hover:text-foreground"
              >
                CBSE · NCERT
              </Link>
            </li>
            <li>
              <Link
                to="/learn/$board/$grade"
                params={{ board: "icse", grade: "10" }}
                className="hover:text-foreground"
              >
                ICSE · ISC
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-display font-bold">Aapke liye</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              <Link to="/notebook" className="hover:text-foreground">
                Meri Notebook
              </Link>
            </li>
            <li>
              <Link to="/" hash="classes" className="hover:text-foreground">
                Sab classes
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <p>
            Notes AI ki madad se textbook ke hisaab se banaye jaate hain. Exam se pehle apni
            textbook se ek baar zaroor milayein.
          </p>
          <Link to="/admin/reports" className="hover:text-foreground">
            Owner
          </Link>
        </div>
      </div>
    </footer>
  );
}
