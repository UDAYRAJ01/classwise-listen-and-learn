import { useCallback, useEffect, useRef, useState } from "react";

import {
  ensureAudioContext,
  forgetAudioJob,
  getAudioJob,
  PCM_RATE,
  PcmPlayer,
  subscribeAudioJob,
  type AudioJob,
} from "@/lib/audio-engine";
import type { Lang } from "@/lib/catalog";
import { chunkText } from "@/lib/chunk-text";
import { notebook, useNotebook } from "@/lib/notebook-store";
import { speechLang, type Track } from "@/lib/tracks";

export type NarrationMode = "ai" | "device";
export type NarrationStatus = "idle" | "loading" | "playing" | "paused" | "error" | "ended";
export type VoiceId = "didi" | "bhaiya";

export interface NarrationError {
  status: number;
  message: string;
}

export function useNarration(opts: {
  /** Note the tracks belong to (or a playlist key when tracks carry their own noteId). */
  noteId: string | null;
  tracks: Track[];
  lang: Lang;
  title: string;
  /** Prepare the first part in the background so play starts instantly. */
  warmUp?: boolean;
}) {
  const { noteId, tracks, lang, title } = opts;
  const { prefs } = useNotebook();

  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<NarrationStatus>("idle");
  const [mode, setModeState] = useState<NarrationMode>("ai");
  const [error, setError] = useState<NarrationError | null>(null);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcmRef = useRef<PcmPlayer | null>(null);
  const waitRef = useRef<(() => void) | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlJobRef = useRef<AudioJob | null>(null);
  const tokenRef = useRef(0);
  const switchingRef = useRef(false);

  const live = useRef({ index, status, mode, voice: prefs.voice as VoiceId, rate: prefs.rate, tracks, lang, noteId });
  live.current = { index, status, mode, voice: prefs.voice as VoiceId, rate: prefs.rate, tracks, lang, noteId };

  const playAtRef = useRef<(i: number, overrides?: { voice?: VoiceId; mode?: NarrationMode }) => void>(() => {});

  const stopAll = useCallback(() => {
    switchingRef.current = true;
    waitRef.current?.();
    waitRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    pcmRef.current?.stop();
    pcmRef.current = null;
    urlJobRef.current = null;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const advance = useCallback((from: number) => {
    const next = from + 1;
    if (next < live.current.tracks.length) playAtRef.current(next);
    else {
      setStatus("ended");
      setProgress(1);
    }
  }, []);

  /** Audio job for playlist position i (a track may point into another note). */
  const jobFor = useCallback((i: number, voice: VoiceId): AudioJob | null => {
    const t = live.current.tracks[i];
    const id = t?.noteId ?? live.current.noteId;
    if (!t || !id) return null;
    return getAudioJob(id, voice, t.sourceIndex ?? i);
  }, []);

  const prefetch = useCallback(
    (i: number, voice: VoiceId) => {
      jobFor(i, voice);
    },
    [jobFor],
  );

  const getAudio = useCallback(() => {
    let a = audioRef.current;
    if (a) return a;
    a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    a.addEventListener("ended", () => advance(live.current.index));
    a.addEventListener("timeupdate", () => {
      if (a && a.duration > 0) setProgress(a.currentTime / a.duration);
    });
    a.addEventListener("pause", () => {
      if (!switchingRef.current && a && !a.ended) setStatus("paused");
    });
    a.addEventListener("play", () => {
      if (!switchingRef.current) setStatus("playing");
    });
    a.addEventListener("error", () => {
      if (switchingRef.current || !a?.getAttribute("src")) return;
      // Likely an expired link: forget it so the next play fetches a fresh one.
      if (urlJobRef.current) forgetAudioJob(urlJobRef.current.key);
      setStatus("error");
      setError({ status: 0, message: "Audio load nahi hua. Dobara play karein." });
    });
    return a;
  }, [advance]);

  const speakDevice = useCallback(
    (i: number, token: number) => {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      const track = live.current.tracks[i];
      if (!synth || !track) {
        setStatus("error");
        setError({ status: 0, message: "Is device mein awaaz (text-to-speech) support nahi hai." });
        return;
      }
      const langTag = speechLang(live.current.lang);
      const voices = synth.getVoices();
      const voice =
        voices.find((v) => v.lang.replace("_", "-").toLowerCase() === langTag.toLowerCase()) ??
        voices.find((v) => v.lang.toLowerCase().startsWith(langTag.slice(0, 2))) ??
        null;
      const parts = chunkText(track.text, 220);
      let part = 0;
      const speakNext = () => {
        if (token !== tokenRef.current) return;
        if (part >= parts.length) {
          advance(i);
          return;
        }
        const u = new SpeechSynthesisUtterance(parts[part]);
        u.lang = langTag;
        if (voice) u.voice = voice;
        u.rate = live.current.rate;
        u.onstart = () => {
          if (token !== tokenRef.current) return;
          switchingRef.current = false;
          setStatus("playing");
          setProgress(part / parts.length);
        };
        u.onend = () => {
          part += 1;
          speakNext();
        };
        u.onerror = (e) => {
          if (token !== tokenRef.current) return;
          if (e.error === "interrupted" || e.error === "canceled") return;
          setStatus("error");
          setError({ status: 0, message: "Phone ki awaaz chal nahi payi." });
        };
        synth.speak(u);
      };
      setStatus("loading");
      speakNext();
    },
    [advance],
  );

  const playUrl = useCallback(
    async (job: AudioJob, token: number, i: number, voice: VoiceId) => {
      const a = getAudio();
      urlJobRef.current = job;
      a.src = job.url!;
      a.playbackRate = live.current.rate;
      try {
        await a.play();
        if (token !== tokenRef.current) return;
        switchingRef.current = false;
        setStatus("playing");
        prefetch(i + 1, voice);
      } catch (e) {
        if (token !== tokenRef.current) return;
        switchingRef.current = false;
        if ((e as DOMException)?.name === "NotAllowedError") setStatus("paused");
        else {
          forgetAudioJob(job.key);
          setStatus("error");
          setError({ status: 0, message: "Audio chal nahi paya. Dobara play karein." });
        }
      }
    },
    [getAudio, prefetch],
  );

  const playPcm = useCallback(
    (context: AudioContext, job: AudioJob, token: number, i: number, voice: VoiceId) => {
      const player = new PcmPlayer(
        context,
        job,
        live.current.rate,
        () => {
          if (token === tokenRef.current) advance(i);
        },
        (e) => {
          if (token !== tokenRef.current) return;
          setStatus("error");
          setError(e);
        },
      );
      pcmRef.current = player;
      player.start();
      switchingRef.current = false;
      setStatus("playing");
      tickRef.current = setInterval(() => setProgress(player.progress()), 250);
      prefetch(i + 1, voice);
    },
    [advance, prefetch],
  );

  const playAt = useCallback(
    (i: number, overrides?: { voice?: VoiceId; mode?: NarrationMode }) => {
      const t = live.current.tracks[i];
      if (!t || !(t.noteId ?? live.current.noteId)) return;
      const token = ++tokenRef.current;
      const voice = overrides?.voice ?? live.current.voice;
      const m = overrides?.mode ?? live.current.mode;
      stopAll();
      setIndex(i);
      setError(null);
      setProgress(0);

      if (m === "device") {
        speakDevice(i, token);
        return;
      }

      // Created inside the click so browsers allow sound.
      const context = ensureAudioContext();
      const job = jobFor(i, voice)!;
      setStatus("loading");

      const begin = (): boolean => {
        if (token !== tokenRef.current) return true;
        if (job.url) {
          void playUrl(job, token, i, voice);
          return true;
        }
        if (job.status === "error") {
          switchingRef.current = false;
          setStatus("error");
          setError(job.error);
          return true;
        }
        if (job.status === "streaming" && context && job.samples >= PCM_RATE * 0.35) {
          playPcm(context, job, token, i, voice);
          return true;
        }
        return false;
      };
      if (!begin()) {
        const unsub = subscribeAudioJob(job, () => {
          if (begin()) {
            unsub();
            if (waitRef.current === unsub) waitRef.current = null;
          }
        });
        waitRef.current = unsub;
      }
    },
    [jobFor, playPcm, playUrl, speakDevice, stopAll],
  );
  playAtRef.current = playAt;

  const pause = useCallback(() => {
    if (live.current.mode === "device") {
      tokenRef.current++;
      window.speechSynthesis?.cancel();
    } else if (pcmRef.current) {
      pcmRef.current.pause();
    } else {
      audioRef.current?.pause();
    }
    setStatus("paused");
  }, []);

  const toggle = useCallback(() => {
    const s = live.current.status;
    if (s === "playing" || s === "loading") {
      pause();
      return;
    }
    if (s === "paused") {
      if (live.current.mode === "ai" && pcmRef.current) {
        ensureAudioContext();
        pcmRef.current.resume();
        setStatus("playing");
        return;
      }
      const a = audioRef.current;
      if (live.current.mode === "ai" && a && a.getAttribute("src")) {
        a.play().catch(() => playAtRef.current(live.current.index));
        return;
      }
      playAtRef.current(live.current.index);
      return;
    }
    playAtRef.current(s === "ended" ? 0 : live.current.index);
  }, [pause]);

  const next = useCallback(() => {
    playAtRef.current(Math.min(live.current.index + 1, live.current.tracks.length - 1));
  }, []);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (live.current.mode === "ai" && !pcmRef.current && a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    playAtRef.current(Math.max(live.current.index - 1, 0));
  }, []);

  const setRate = useCallback((rate: number) => {
    notebook.setPrefs({ rate });
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, []);

  const setVoice = useCallback((voice: VoiceId) => {
    notebook.setPrefs({ voice });
    const s = live.current.status;
    if (live.current.mode === "ai" && (s === "playing" || s === "loading")) playAtRef.current(live.current.index, { voice });
  }, []);

  const setMode = useCallback(
    (m: NarrationMode) => {
      const s = live.current.status;
      const wasActive = s === "playing" || s === "loading";
      setModeState(m);
      if (wasActive || s === "error") playAtRef.current(live.current.index, { mode: m });
      else {
        tokenRef.current++;
        stopAll();
        setStatus("idle");
        setError(null);
      }
    },
    [stopAll],
  );

  const stop = useCallback(() => {
    tokenRef.current++;
    stopAll();
    setStatus("idle");
    setProgress(0);
  }, [stopAll]);

  // Reset when the note itself changes (e.g. language switch).
  useEffect(() => {
    tokenRef.current++;
    stopAll();
    setIndex(0);
    setStatus("idle");
    setError(null);
    setProgress(0);
  }, [noteId, stopAll]);

  // Warm up the first part so pressing play starts instantly.
  useEffect(() => {
    if (!opts.warmUp || tracks.length === 0) return undefined;
    const t = setTimeout(() => jobFor(0, live.current.voice), 1200);
    return () => clearTimeout(t);
  }, [noteId, tracks.length, opts.warmUp, jobFor]);

  // Stop everything when leaving the page.
  useEffect(
    () => () => {
      tokenRef.current++;
      stopAll();
    },
    [stopAll],
  );

  // Lock-screen / headphone controls.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const track = tracks[index];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track?.label ?? title,
        artist: title,
        album: "PadhoSuno",
      });
      navigator.mediaSession.playbackState = status === "playing" ? "playing" : status === "paused" ? "paused" : "none";
      navigator.mediaSession.setActionHandler("play", () => toggle());
      navigator.mediaSession.setActionHandler("pause", () => pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    } catch {
      // Media Session not fully supported
    }
  }, [index, status, tracks, title, toggle, pause, next, prev]);

  return {
    index,
    status,
    mode,
    error,
    progress,
    voice: prefs.voice as VoiceId,
    rate: prefs.rate,
    track: tracks[index] ?? null,
    activeBlockId: status === "idle" ? null : (tracks[index]?.blockId ?? null),
    playAt: (i: number) => playAtRef.current(i),
    toggle,
    pause,
    next,
    prev,
    stop,
    setRate,
    setVoice,
    setMode,
  };
}

export type Narration = ReturnType<typeof useNarration>;
