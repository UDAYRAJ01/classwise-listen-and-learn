import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface Crumb {
  label: ReactNode;
  link?: ReactNode;
}

/** Breadcrumb row. Pass pre-built <Link> elements so typed routes stay checked. */
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="no-print">
      <ol className="flex flex-wrap items-center gap-1 text-sm font-semibold text-muted-foreground">
        <li>
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            {c.link ?? <span className="text-foreground">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
