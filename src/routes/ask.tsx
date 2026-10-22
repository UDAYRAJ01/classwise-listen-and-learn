import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Send, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";

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
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setMsgs(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, []);
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
        body: JSON.stringify({ messages: next }),
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
      if ((e as Error).name !== "AbortError") put("⚠️ Internet ya server mein dikkat. Dobara try karein.");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="sticker grid h-12 w-12 place-items-center rounded-xl bg-secondary">
          <GraduationCap className="h-6 w-6 text-ink" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-extrabold">Guru se poochho</h1>
          <p className="text-sm text-muted-foreground">
            Koi bhi sawal — turant jawab, step-by-step hal, 2–3 aasaan tarike aur trick.
          </p>
        </div>
        {msgs.length > 0 && !busy && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMsgs([])}>
            Naya chat
          </Button>
        )}
      </div>

      {msgs.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => ask(e)}
              className="sticker rounded-xl bg-card p-3 text-left text-sm hover:bg-muted"
            >
              <Sparkles className="mb-1 h-4 w-4 text-accent" />
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
              {m.content}
            </div>
          ) : (
            <div key={i} className="sticker rounded-2xl bg-card px-4 py-3">
              {m.content ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="animate-pulse text-sm text-muted-foreground">Guru soch rahe hain…</span>
              )}
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      <form
        className="sticky bottom-4 mt-6 flex gap-2 rounded-2xl border border-border bg-background p-2"
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
          rows={2}
          placeholder="Apna sawal ya question yahan likho…"
          className="flex-1 resize-none bg-transparent px-2 py-1 outline-none"
          aria-label="Sawal"
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => abort.current?.abort()} aria-label="Roko">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()} aria-label="Bhejo">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
