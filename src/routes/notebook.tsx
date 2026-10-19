import { createFileRoute, Link } from "@tanstack/react-router";
import { BookmarkCheck, CheckCircle2, History, NotebookPen, Trash2 } from "lucide-react";
import { useState } from "react";

import { ChapterRefCard } from "@/components/recent-strip";
import { Button } from "@/components/ui/button";
import { notebook, refKey, useNotebook, type ChapterRef } from "@/lib/notebook-store";

export const Route = createFileRoute("/notebook")({
  head: () => ({
    meta: [
      { title: "Meri Notebook — Saved Chapters & Progress | PadhoSuno" },
      {
        name: "description",
        content: "Aapke save kiye hue chapters, haal hi mein padhe gaye notes aur yaad ho chuke chapters — sab ek jagah.",
      },
      { property: "og:title", content: "Meri Notebook — PadhoSuno" },
      { property: "og:description", content: "Saved chapters, recently read notes aur aapki progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotebookPage,
});

type Tab = "saved" | "recent";

function NotebookPage() {
  const { saved, recent, done } = useNotebook();
  const [tab, setTab] = useState<Tab>("saved");
  const list: ChapterRef[] = tab === "saved" ? saved : recent;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-hand text-xl text-accent">Sirf aapke liye</p>
          <h1 className="flex items-center gap-3 text-5xl font-extrabold">
            <NotebookPen className="h-10 w-10" /> Meri Notebook
          </h1>
          <p className="mt-2 text-muted-foreground">Ye sab isi device par save rehta hai — login ki zaroorat nahi.</p>
        </div>
        <dl className="flex gap-4">
          {[
            { n: saved.length, l: "saved", icon: BookmarkCheck },
            { n: done.length, l: "yaad ho gaye", icon: CheckCircle2 },
          ].map((s) => (
            <div key={s.l} className="sticker rounded-2xl bg-card px-5 py-3 text-center">
              <dt className="flex items-center justify-center gap-1.5 font-display text-3xl font-extrabold">
                <s.icon className="h-5 w-5 text-accent" /> {s.n}
              </dt>
              <dd className="font-hand text-base text-muted-foreground">{s.l}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" className="sticker inline-flex gap-1 rounded-xl bg-card p-1">
          {(
            [
              ["saved", "Saved", BookmarkCheck, saved.length],
              ["recent", "Haal hi mein padhe", History, recent.length],
            ] as const
          ).map(([id, label, Icon, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-active={tab === id}
              onClick={() => setTab(id)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold hover:bg-muted data-[active=true]:bg-ink data-[active=true]:text-paper"
            >
              <Icon className="h-4 w-4" /> {label} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
        {tab === "recent" && recent.length > 0 && (
          <Button variant="ghost" onClick={() => notebook.clearRecent()}>
            <Trash2 /> History saaf karo
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="paper-ruled sticker mt-8 rounded-3xl p-10 pl-16 text-center">
          <p className="font-hand text-3xl leading-[1.9rem]">
            {tab === "saved" ? "Abhi koi chapter save nahi kiya." : "Abhi tak koi chapter nahi padha."}
          </p>
          <p className="mt-2 leading-[1.9rem] text-muted-foreground">
            {tab === "saved"
              ? "Kisi bhi chapter par “Save” dabao, wo yahan aa jayega."
              : "Koi chapter kholo — wo yahan dikhega taaki baad mein wahin se shuru kar sako."}
          </p>
          <Button asChild variant="ink" size="lg" className="mt-6">
            <Link to="/" hash="classes">
              Class chuno
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {list.map((r) => (
            <li key={refKey(r)} className="relative">
              <ChapterRefCard r={r} done={done.includes(refKey(r))} />
              {tab === "saved" && (
                <button
                  type="button"
                  onClick={() => notebook.toggleSaved(r)}
                  aria-label={`${r.title} ko hatao`}
                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-card text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
