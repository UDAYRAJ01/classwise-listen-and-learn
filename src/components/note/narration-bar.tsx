import {
  AudioLines,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Settings2,
  SkipBack,
  SkipForward,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { Narration } from "@/hooks/use-narration";
import { cn } from "@/lib/utils";

const RATES = [0.75, 1, 1.25, 1.5, 2];

export function NarrationBar({
  narration,
  total,
  follow,
  onFollowChange,
  ready,
}: {
  narration: Narration;
  total: number;
  follow: boolean;
  onFollowChange: (v: boolean) => void;
  ready: boolean;
}) {
  const n = narration;
  const playing = n.status === "playing";
  const loading = n.status === "loading";
  const started = n.status !== "idle";
  const overall = total > 0 ? (n.index + (n.status === "ended" ? 1 : n.progress)) / total : 0;
  const canFallback = n.mode === "ai" && n.error;

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="sticker-lg mx-auto max-w-4xl overflow-hidden rounded-2xl bg-card">
        {/* overall progress */}
        <div className="h-1.5 w-full bg-muted" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.min(overall, 1) * 100}%` }} />
        </div>

        <div className="flex items-center gap-2 p-2.5 sm:gap-3 sm:p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={n.prev}
            disabled={!ready || !started}
            aria-label="Pichla part"
            className="hidden sm:inline-flex"
          >
            <SkipBack />
          </Button>

          <button
            type="button"
            onClick={n.toggle}
            disabled={!ready}
            aria-label={playing || loading ? "Pause" : "Play"}
            className={cn(
              "sticker press grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground disabled:opacity-50",
              playing && "animate-pulse-ring",
            )}
          >
            {loading ? (
              <LoaderCircle className="h-6 w-6 animate-spin" />
            ) : playing ? (
              <Pause className="h-6 w-6" fill="currentColor" />
            ) : (
              <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
            )}
          </button>

          <Button variant="ghost" size="icon" onClick={n.next} disabled={!ready || n.index >= total - 1} aria-label="Agla part">
            <SkipForward />
          </Button>

          <div className="min-w-0 flex-1">
            {n.error ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="line-clamp-2 text-sm font-semibold text-destructive">{n.error.message}</p>
                {canFallback && (
                  <Button size="sm" variant="sun" onClick={() => n.setMode("device")}>
                    <Smartphone /> Phone ki awaaz se suno
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {playing ? <AudioLines className="h-3.5 w-3.5 text-accent" /> : <Headphones className="h-3.5 w-3.5" />}
                  {!ready
                    ? "Notes ban rahe hain…"
                    : started
                      ? `Part ${n.index + 1} / ${total}`
                      : "Padho bhi, suno bhi"}
                  {n.mode === "device" && <span className="rounded bg-muted px-1.5 py-px normal-case">phone voice</span>}
                </p>
                <p className="truncate font-display text-base font-bold">
                  {loading && n.mode === "ai" ? "Awaaz taiyaar ho rahi hai…" : started ? n.track?.label : "Poora chapter suno — play dabao"}
                </p>
                {started && (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${n.progress * 100}%` }} />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="hidden items-center gap-1 md:flex">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => n.setRate(r)}
                data-active={n.rate === r}
                className="rounded-md px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted data-[active=true]:bg-ink data-[active=true]:text-paper"
              >
                {r}x
              </button>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="paper" size="icon" aria-label="Audio settings">
                <Settings2 />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="sticker w-72 space-y-4 rounded-2xl bg-card p-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Awaaz</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-active={n.mode === "ai"}
                    onClick={() => n.setMode("ai")}
                    className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-ink px-2 py-2 text-sm font-bold data-[active=true]:bg-ink data-[active=true]:text-paper"
                  >
                    <Sparkles className="h-4 w-4" /> AI teacher
                  </button>
                  <button
                    type="button"
                    data-active={n.mode === "device"}
                    onClick={() => n.setMode("device")}
                    className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-ink px-2 py-2 text-sm font-bold data-[active=true]:bg-ink data-[active=true]:text-paper"
                  >
                    <Smartphone className="h-4 w-4" /> Phone voice
                  </button>
                </div>
              </div>
              {n.mode === "ai" && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Kaun padhaye?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["didi", "bhaiya"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        data-active={n.voice === v}
                        onClick={() => n.setVoice(v)}
                        className="rounded-lg border-2 border-ink px-2 py-2 text-sm font-bold capitalize data-[active=true]:bg-secondary"
                      >
                        {v === "didi" ? "Didi" : "Bhaiya"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Speed</p>
                <div className="flex flex-wrap gap-1.5">
                  {RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => n.setRate(r)}
                      data-active={n.rate === r}
                      className="rounded-md border-2 border-ink px-2.5 py-1 text-sm font-bold data-[active=true]:bg-ink data-[active=true]:text-paper"
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-bold">Saath-saath padho</span>
                  <span className="block text-xs text-muted-foreground">Jo bol raha hai, wahan apne aap scroll</span>
                </span>
                <Switch checked={follow} onCheckedChange={onFollowChange} />
              </label>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
