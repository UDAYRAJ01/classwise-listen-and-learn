import { createFileRoute } from "@tanstack/react-router";
import { Send, Sparkles, Square, SquarePen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { barIconClass, ScreenHeader } from "@/components/app/screen-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoardId } from "@/lib/catalog";
import { getNotebookState } from "@/lib/notebook-store";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Guru se poochho — AI Teacher for Class 1–12 | PadhoSuno" },
      {
        name: "description",
        content:
          "NCERT/CBSE aur ICSE books ka koi bhi sawal poochho. Turant jawab, step-by-step hal, 2–3 aasaan tarike aur yaad rakhne ki trick.",
      },
      { property: "og:title", content: "Guru se poochho — PadhoSuno AI Teacher" },
      {
        property: "og:description",
        content: "Koi bhi sawal, turant hal, aasaan tarike aur memory tricks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AskPage,
});

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "padhosuno:tutor-chat";
const CLASS_KEY = "padhosuno:tutor-class";
type MyClass = { board: BoardId; grade: number | null };
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const EXAMPLES = [
  "Photosynthesis kya hai? Ek trick se samjhao",
  "x² − 5x + 6 = 0 solve karo, 3 tarike se",
  "Class 10 Light chapter ke important formulas",
  "French Revolution ke causes yaad karne ki trick",
];

function AskPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cls, setCls] = useState<MyClass>({ board: "cbse", grade: null });
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setMsgs(JSON.parse(s));
      const c = localStorage.getItem(CLASS_KEY);
      const last = getNotebookState().recent[0];
      const prefs = getNotebookState().prefs;
      if (c) setCls(JSON.parse(c) as MyClass);
      else if (prefs.board && prefs.grade) setCls({ board: prefs.board, grade: prefs.grade });
      else if (last) setCls({ board: last.board, grade: last.grade });
    } catch {
      /* ignore */
    }
  }, []);

  const chooseClass = (next: MyClass) => {
    setCls(next);
    try {
      localStorage.setItem(CLASS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (!busy) localStorage.setItem(KEY, JSON.stringify(msgs.slice(-30)));
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const put = (content: string) =>
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content }]);
    try {
      const r = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, board: cls.board, grade: cls.grade }),
        signal: ctrl.signal,
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        put(`⚠️ ${j.error ?? "Jawab nahi aa paya. Dobara try karein."}`);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        put(acc);
      }
      if (!acc) put("⚠️ Jawab khali aaya. Sawal thoda badal ke poochho.");
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        put("⚠️ Internet ya server mein dikkat. Dobara try karein.");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <>
    <ScreenHeader
      title="Guru se poochho"
      subtitle="Koi bhi sawal · step-by-step hal · trick"
      actions={
        msgs.length > 0 && !busy ? (
          <button type="button" className={barIconClass} onClick={() => setMsgs([])} aria-label="Naya chat" title="Naya chat">
            <SquarePen />
          </button>
        ) : null
      }
    />
    <div className="mx-auto flex min-h-[calc(100dvh-var(--nav-h)-4.5rem)] max-w-3xl flex-col px-4 pb-4 pt-3 md:min-h-0 md:pt-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Board">
          {(["cbse", "icse"] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={cls.board === b}
              data-active={cls.board === b}
              onClick={() => chooseClass({ ...cls, board: b })}
              className="rounded-md px-2.5 py-1 text-xs font-bold text-muted-foreground data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-sm"
            >
              {b === "cbse" ? "CBSE" : "ICSE"}
            </button>
          ))}
        </div>
        <Select
          value={cls.grade ? String(cls.grade) : "all"}
          onValueChange={(v) => chooseClass({ ...cls, grade: v === "all" ? null : Number(v) })}
        >
          <SelectTrigger className="h-8 w-32 rounded-lg text-xs font-bold" aria-label="Class">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Koi bhi class</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={String(g)}>
                Class {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden text-xs text-muted-foreground sm:inline">Isi class ki books pehle</span>
      </div>

      {msgs.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => ask(e)}
              className="flex items-start gap-2 rounded-2xl border border-border bg-card p-3 text-left text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground"
            >
              {m.content}
            </div>
          ) : (
            <div key={i} className="rounded-2xl border border-border bg-card px-4 py-3">
              {m.content ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="animate-pulse text-sm text-muted-foreground">
                  Guru soch rahe hain…
                </span>
              )}
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      <div className="h-6 shrink-0" aria-hidden />
      <form
        className="sticky bottom-[calc(var(--nav-h)+0.75rem)] mt-auto flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sticker-lg"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(input);
            }
          }}
          rows={1}
          placeholder="Apna sawal likho…"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base outline-none [field-sizing:content]"
          aria-label="Sawal"
        />
        {busy ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => abort.current?.abort()}
            aria-label="Roko"
            className="h-11 w-11 rounded-xl p-0"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()} aria-label="Bhejo" className="h-11 w-11 rounded-xl p-0">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
    </>
  );
}
