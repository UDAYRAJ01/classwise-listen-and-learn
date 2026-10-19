import { useCallback, useEffect, useSyncExternalStore } from "react";

import { getJob, startJob, subscribeJob, type JobState } from "@/lib/generation-store";

/**
 * Attaches to (and when `enabled`, starts) a streamed AI generation.
 * `onDone` fires once with the final record.
 */
export function useGeneration<P, F>(opts: {
  key: string;
  url: string;
  body: unknown;
  enabled: boolean;
  onDone?: (result: F) => void;
}) {
  const { key, url, body, enabled, onDone } = opts;

  const state = useSyncExternalStore(
    useCallback((l) => subscribeJob(key, l), [key]),
    () => getJob(key),
    () => null,
  ) as JobState | null;

  useEffect(() => {
    if (enabled) startJob(key, url, body);
    // body is derived from key; restarting on identity changes would duplicate work
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, url]);

  useEffect(() => {
    if (state?.status === "done" && state.result && onDone) onDone(state.result as F);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status, state?.result]);

  const retry = useCallback(() => startJob(key, url, body, { retry: true }), [key, url, body]);

  return {
    status: state?.status ?? (enabled ? "running" : "idle"),
    partial: (state?.partial ?? null) as P | null,
    result: (state?.result ?? null) as F | null,
    error: state?.error ?? null,
    retry,
  };
}
