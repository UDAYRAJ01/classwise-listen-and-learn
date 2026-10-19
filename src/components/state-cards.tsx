import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const NOTE_STEPS = [
  "Chapter khol rahe hain…",
  "Important points chun rahe hain…",
  "Yaad karne ki tricks bana rahe hain…",
  "Exam wale sawaal likh rahe hain…",
  "Quick revision taiyaar kar rahe hain…",
];

export function GeneratingBanner({
  title,
  steps = NOTE_STEPS,
  note,
}: {
  title: string;
  steps?: string[];
  note?: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % steps.length), 3200);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticker flex items-center gap-4 rounded-2xl bg-sticky px-5 py-4 text-sticky-foreground"
    >
      <div className="flex h-8 items-end gap-1" aria-hidden>
        {[0, 1, 2, 3].map((b) => (
          <span
            key={b}
            className="block w-1.5 origin-bottom animate-eq rounded-full bg-ink"
            style={{ height: "100%", animationDelay: `${b * 0.15}s` }}
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="font-display text-base font-bold leading-tight">{title}</p>
        <p className="font-hand text-lg leading-tight">{steps[i]}</p>
        {note && <p className="mt-1 text-xs opacity-80">{note}</p>}
      </div>
    </div>
  );
}

export function ErrorCard({
  title = "Oops! Kuch gadbad ho gayi",
  message,
  onRetry,
  retryLabel = "Dobara try karein",
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="sticker rounded-2xl bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/12 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="space-y-3">
          <div>
            <p className="font-display text-lg font-bold">{title}</p>
            <p className="text-muted-foreground">{message}</p>
          </div>
          {onRetry && (
            <Button variant="paper" onClick={onRetry}>
              <RotateCcw /> {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
