import { ChevronLeft } from "lucide-react";
import { cloneElement, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Round icon button used in title bars. */
export const barIconClass =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted active:bg-muted disabled:opacity-40 [&_svg]:h-5 [&_svg]:w-5";

type BackLink = ReactElement<{ className?: string; children?: ReactNode; "aria-label"?: string }>;

/**
 * Screen title bar. On phones it is a sticky app bar (back · title · actions) with an
 * optional row under it (tabs, chips); on laptops it sits in the page under the site header.
 * Pass `back` as a children-less <Link> so typed routes stay checked.
 */
export function ScreenHeader({
  title,
  subtitle,
  back,
  actions,
  children,
  titleAs = "h1",
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: BackLink;
  actions?: ReactNode;
  children?: ReactNode;
  /** Use "p" when the page shows its own <h1> (e.g. the reader's full chapter title). */
  titleAs?: "h1" | "p";
  className?: string;
}) {
  const Title = titleAs;
  return (
    <header
      className={cn(
        "no-print sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "md:static md:border-0 md:bg-transparent md:pt-0 md:backdrop-blur-none",
        className,
      )}
    >
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-1 px-2 md:min-h-0 md:gap-2 md:px-4 md:pt-8">
        {back ? (
          cloneElement(back, {
            className: cn(barIconClass, "md:-ml-2"),
            "aria-label": "Wapas",
            children: <ChevronLeft className="!h-6 !w-6" />,
          })
        ) : (
          <span className="w-2 shrink-0 md:hidden" aria-hidden />
        )}
        <div className="min-w-0 flex-1 py-1.5">
          <Title
            className={cn(
              "truncate font-display text-lg font-extrabold leading-tight tracking-tight",
              titleAs === "h1" && "md:whitespace-normal md:text-3xl",
              titleAs === "p" && "md:text-base md:text-muted-foreground",
            )}
          >
            {title}
          </Title>
          {subtitle && (
            <p className="truncate text-xs font-semibold text-muted-foreground md:mt-0.5 md:text-sm">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-0.5 md:gap-1">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Horizontal, swipeable row of pill chips (classes, books, filters). */
export function ChipRow({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("mx-auto max-w-6xl", className)}>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5 pt-0.5 md:pt-4">
        {children}
      </ul>
    </nav>
  );
}

export const chipClass =
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 text-sm font-bold text-foreground transition-colors hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground";
