import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  Brain,
  CheckCheck,
  FlaskRound,
  Languages,
  Lightbulb,
  ListChecks,
  NotebookPen,
  Target,
} from "lucide-react";
import { useState } from "react";

import heroImg from "@/assets/hero-books.png";
import { BoardSwitch } from "@/components/board-switch";
import { RecentStrip } from "@/components/recent-strip";
import { Button } from "@/components/ui/button";
import {
  BOARDS,
  GRADES,
  getSubjects,
  gradeLabel,
  TONE_CLASSES,
  type BoardId,
  type Tone,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PadhoSuno — Class 1–12 Short Notes, Tricks & Audio (NCERT, CBSE, ICSE)" },
      {
        name: "description",
        content:
          "Class 1 se 12 tak NCERT, CBSE aur ICSE ke har chapter ke short notes, yaad karne ki tricks, important questions aur audio — padho bhi, suno bhi.",
      },
      { property: "og:title", content: "PadhoSuno — Padho bhi, suno bhi, turant yaad" },
      {
        property: "og:description",
        content:
          "Har chapter ke short notes + memory tricks + audio. Class 1–12, NCERT, CBSE & ICSE. Hindi, English, Hinglish.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const GRADE_TONES: Tone[] = [
  "coral",
  "sun",
  "leaf",
  "sky",
  "rose",
  "teal",
  "brick",
  "ink",
  "coral",
  "sky",
  "leaf",
  "ink",
];

const FEATURES = [
  {
    icon: ListChecks,
    title: "Short Notes",
    text: "Poora chapter chhote, saaf points mein. Zaroori words highlighted.",
    tone: "leaf" as Tone,
  },
  {
    icon: Lightbulb,
    title: "Yaad karne ki Tricks",
    text: "Mnemonics, kahaniyan, rhymes — ek baar padho, hamesha yaad.",
    tone: "coral" as Tone,
  },
  {
    icon: AudioLines,
    title: "Audio Notes",
    text: "Didi ya Bhaiya ki awaaz mein suno, saath-saath highlight dekho.",
    tone: "sky" as Tone,
  },
  {
    icon: Target,
    title: "Important Q&A",
    text: "Exam pattern ke sawaal, marks ke hisaab se model answers.",
    tone: "rose" as Tone,
  },
  {
    icon: FlaskRound,
    title: "Formulas & Rules",
    text: "Saare formulas ek jagah, bolkar samjhaye hue.",
    tone: "teal" as Tone,
  },
  {
    icon: Brain,
    title: "Flashcards",
    text: "Card palto, khud ko test karo. Jo bhool gaye, wo dobara.",
    tone: "sun" as Tone,
  },
  {
    icon: CheckCheck,
    title: "1-Minute Revision",
    text: "Exam se theek pehle — bas ye list padh lo.",
    tone: "brick" as Tone,
  },
  {
    icon: Languages,
    title: "3 Bhashayein",
    text: "Hinglish, हिंदी ya English — jaise aap samjho.",
    tone: "ink" as Tone,
  },
];

function Home() {
  const [board, setBoard] = useState<BoardId>("cbse");

  return (
    <div>
      {/* Hero */}
      <section className="paper-dots border-b-2 border-ink/90">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.15fr_1fr] md:py-20">
          <div>
            <span className="sticker inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-bold">
              <span className="h-2 w-2 rounded-full bg-accent" /> Class 1–12 · NCERT · CBSE · ICSE
            </span>
            <h1 className="mt-6 text-5xl font-extrabold sm:text-6xl lg:text-7xl">
              Padho bhi.
              <br />
              Suno bhi.
              <br />
              Turant <span className="scribble-underline">yaad</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-foreground/85 sm:text-xl">
              Har book ke har chapter ke{" "}
              <mark className="hl bg-transparent font-semibold text-foreground">short notes</mark>,
              yaad karne ki{" "}
              <mark className="hl bg-transparent font-semibold text-foreground">tricks</mark>,
              important sawaal aur{" "}
              <mark className="hl bg-transparent font-semibold text-foreground">audio</mark> — ek hi
              jagah, ek hi baar mein.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="ink" size="xl">
                <a href="#classes">
                  Apni class chuno <ArrowDown />
                </a>
              </Button>
              <Button asChild variant="paper" size="xl">
                <Link to="/notebook">
                  <NotebookPen /> Meri Notebook
                </Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                ["12", "classes"],
                ["2", "boards"],
                ["3", "bhashayein"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-4xl font-extrabold">{n}</dt>
                  <dd className="font-hand text-lg text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <img
              src={heroImg}
              alt="Notebooks ka dher jiske upar headphones rakhe hain"
              width={1024}
              height={1024}
              className="relative z-10 w-full animate-float drop-shadow-xl"
            />
            <span className="sticker absolute -left-2 top-10 z-20 -rotate-6 rounded-lg bg-sticky px-3 py-1.5 font-hand text-lg text-sticky-foreground">
              VIBGYOR = rainbow!
            </span>
            <span className="sticker absolute -right-1 bottom-16 z-20 rotate-3 rounded-lg bg-card px-3 py-1.5 text-sm font-bold">
              ▶ Audio: Part 3/12
            </span>
          </div>
        </div>
      </section>

      <RecentStrip />

      {/* Classes */}
      <section id="classes" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-hand text-xl text-accent">Step 1</p>
            <h2 className="text-4xl font-extrabold sm:text-5xl">Apni class chuno</h2>
            <p className="mt-2 text-muted-foreground">{BOARDS[board].tagline}</p>
          </div>
          <BoardSwitch value={board} onChange={setBoard} />
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {GRADES.map((g, i) => {
            const toneId = GRADE_TONES[i] ?? "ink";
            const tone = TONE_CLASSES[toneId];
            const onLight = toneId === "sun";
            return (
              <li key={g}>
                <Link
                  to="/learn/$board/$grade"
                  params={{ board, grade: String(g) }}
                  className={cn(
                    "sticker press group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-2xl p-4 lg:aspect-[6/5]",
                    tone.solid,
                    onLight ? "text-ink" : "text-paper",
                  )}
                >
                  {/* notebook binding */}
                  <span className="absolute inset-y-0 left-0 w-3 bg-ink/25" aria-hidden />
                  <span className="ml-2 inline-flex w-fit rounded-md bg-card px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">
                    {board === "icse" && g >= 11 ? "ISC" : BOARDS[board].short}
                  </span>
                  <span className="ml-2">
                    <span className="block font-hand text-xl leading-none opacity-90">
                      {gradeLabel(board, g).replace(/\s*\d+$/, "")}
                    </span>
                    <span className="block font-display text-7xl font-extrabold leading-none tracking-tighter">
                      {g}
                    </span>
                  </span>
                  <span className="ml-2 flex items-center justify-between text-sm font-semibold">
                    {getSubjects(board, g).length} subjects
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Features */}
      <section className="border-y-2 border-ink/90 bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="font-hand text-xl text-accent">Har chapter mein</p>
          <h2 className="text-4xl font-extrabold sm:text-5xl">Ek chapter, aath tarike se yaad</h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="sticker rounded-2xl bg-background p-5">
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-xl",
                    TONE_CLASSES[f.tone].soft,
                  )}
                >
                  <f.icon className={cn("h-5 w-5", TONE_CLASSES[f.tone].text)} />
                </span>
                <h3 className="mt-4 text-xl font-bold">{f.title}</h3>
                <p className="mt-1 text-muted-foreground">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-4xl font-extrabold sm:text-5xl">Kaise padhna hai?</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ["Class aur subject chuno", "CBSE/NCERT ya ICSE — apni book ka chapter kholo."],
            ["Play dabao, saath padho", "Audio chalega aur jo bola ja raha hai wo highlight hoga."],
            ["Flashcards se test karo", "Tricks aur sawaal palto — jo yaad nahi, wo dobara."],
          ].map(([t, d], i) => (
            <li key={t} className="paper-ruled sticker rounded-2xl p-6 pl-14">
              <span className="font-hand text-4xl font-bold text-accent">{i + 1}.</span>
              <h3 className="mt-1 text-xl font-bold leading-[1.9rem]">{t}</h3>
              <p className="leading-[1.9rem] text-foreground/80">{d}</p>
            </li>
          ))}
        </ol>

        <div className="sticker-lg mt-14 flex flex-col items-start justify-between gap-6 rounded-3xl bg-secondary p-8 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h3 className="text-3xl font-extrabold">Board exam aa raha hai?</h3>
            <p className="mt-1 font-hand text-xl">Class 10 aur 12 ke saare subjects tayyar hain.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="ink" size="lg">
              <Link to="/learn/$board/$grade" params={{ board: "cbse", grade: "10" }}>
                Class 10 <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="paper" size="lg">
              <Link to="/learn/$board/$grade" params={{ board: "cbse", grade: "12" }}>
                Class 12 <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
