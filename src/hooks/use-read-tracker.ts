import { useEffect, useRef } from "react";

/** How long a part must stay on screen before it counts as read, by its height. */
export function dwellNeeded(partHeight: number, viewportHeight: number): number {
  const screens = viewportHeight > 0 ? partHeight / viewportHeight : 1;
  return Math.min(12_000, Math.max(2_000, Math.round(screens * 2_500)));
}

/**
 * Watches the note's parts (`[data-section="…"]`) and reports each one once the
 * student has scrolled to its end and kept it on screen long enough to read.
 */
export function useReadTracker(opts: {
  enabled: boolean;
  parts: readonly string[];
  alreadyRead: readonly string[];
  onRead: (parts: string[]) => void;
}) {
  const { enabled, parts } = opts;
  const onRead = useRef(opts.onRead);
  onRead.current = opts.onRead;
  const already = useRef(opts.alreadyRead);
  already.current = opts.alreadyRead;
  const key = parts.join("|");

  useEffect(() => {
    if (!enabled || parts.length === 0) return undefined;
    const reported = new Set(already.current);
    const dwell = new Map<string, number>();
    const reachedEnd = new Set<string>();
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(now - last, 1_000);
      last = now;
      if (document.visibilityState !== "visible") return;
      const vh = window.innerHeight;
      const fresh: string[] = [];
      for (const id of parts) {
        if (reported.has(id) || already.current.includes(id)) {
          reported.add(id);
          continue;
        }
        const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.85 && r.bottom > vh * 0.15) dwell.set(id, (dwell.get(id) ?? 0) + dt);
        if (r.bottom <= vh) reachedEnd.add(id);
        if (reachedEnd.has(id) && (dwell.get(id) ?? 0) >= dwellNeeded(r.height, vh)) {
          reported.add(id);
          fresh.push(id);
        }
      }
      if (fresh.length) onRead.current(fresh);
    };

    const timer = window.setInterval(tick, 400);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
}
