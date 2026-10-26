import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { useState } from "react";

import { paperPageQuery } from "@/lib/exam-queries";

/**
 * The real question as printed in the paper, cut out of the scanned page.
 * `box` is [left, top, right, bottom] on a 0–1000 scale of the page.
 */
export function PaperFigure({
  paper,
  page,
  box,
  label,
}: {
  paper: string;
  page: number;
  box: [number, number, number, number] | null;
  label: string;
}) {
  const { data, isLoading, isError } = useQuery(paperPageQuery(paper, page));
  const [ratio, setRatio] = useState<number | null>(null);
  const [l, t, r, b] = box ?? [0, 0, 1000, 1000];
  const w = Math.max(40, r - l);
  const h = Math.max(30, b - t);

  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" aria-label="Paper ka page aa raha hai" />;
  if (isError || !data?.url)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
        <ImageOff className="h-4 w-4" /> Paper ka page abhi nahi khul paaya.
      </p>
    );

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card">
      <div
        className="relative w-full overflow-hidden"
        // Width : height of the cut-out, using the page's real proportions once loaded.
        style={{ aspectRatio: ratio ? `${(w / h) * ratio}` : "3 / 1" }}
      >
        <img
          src={data.url}
          alt={label}
          loading="lazy"
          onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
          className="absolute max-w-none"
          style={{
            width: `${(1000 / w) * 100}%`,
            left: `${(-l / w) * 100}%`,
            top: `${(-t / h) * 100}%`,
          }}
        />
      </div>
      <figcaption className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        Asli paper se · {label}
      </figcaption>
    </figure>
  );
}
