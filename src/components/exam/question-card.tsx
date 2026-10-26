import { BookOpen, CheckCircle2, Eye, FileImage, Lightbulb, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { PaperFigure } from "@/components/exam/paper-figure";
import { MathMarkdown } from "@/components/math-markdown";
import { Button } from "@/components/ui/button";
import { useGeneration } from "@/hooks/use-generation";
import {
  EXAM_NAMES,
  pdfAtPage,
  placeLabel,
  SOURCE_LABELS,
  type ExamQuestionView,
  type ExamSolution,
} from "@/lib/exam";
import { cn } from "@/lib/utils";

/** NEET and JEE Main print options as (1)–(4); JEE Advanced as (A)–(D). */
const optionLabel = (exam: ExamQuestionView["exam"], i: number) =>
  exam === "jee-advanced" ? "ABCD"[i]! : String(i + 1);

function answerText(q: ExamQuestionView, answer: string | null): string {
  if (!answer) return "—";
  if (answer === "BONUS") return "Bonus (sabko marks mile)";
  if (q.options.length && /^[A-D](,[A-D])*$/.test(answer)) {
    const labels = answer.split(",").map((l) => `(${optionLabel(q.exam, "ABCD".indexOf(l))})`);
    // A single-correct question with two letters in the key: either was accepted.
    return q.kind === "single" && labels.length > 1 ? `${labels.join(" ya ")} — dono sahi maane gaye` : labels.join(", ");
  }
  return answer.replace(/^(-?[\d.]+)-(-?[\d.]+)$/, "$1 se $2 ke beech");
}

const KEY_NOTE: Record<ExamQuestionView["answerSource"], string> = {
  official: "official answer key",
  coaching: "coaching answer key",
  none: "",
};

const STAGES: Record<string, string> = {
  solving: "Hal likh rahe hain…",
  checking: "Answer key se mila rahe hain…",
};

export function QuestionCard({ q }: { q: ExamQuestionView }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPaper, setShowPaper] = useState(false);
  const [wantSolution, setWantSolution] = useState(false);
  const gen = useGeneration<{ stage?: string }, ExamSolution>({
    key: `exam-solution:${q.id}`,
    url: "/api/exam-solution",
    body: { id: q.id },
    enabled: wantSolution && !q.solution,
  });
  const solution = q.solution ?? gen.result;
  const isOption = q.options.length > 0;
  const correct = new Set(
    isOption && q.answer && /^[A-D](,[A-D])*$/.test(q.answer) ? q.answer.split(",") : [],
  );
  const answer = q.answer ?? (solution?.ok ? solution.answer : null);
  const label = `${q.paper}${q.qno ? ` · Q${q.qno}` : ""}`;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-ink px-2.5 py-1 text-paper">
          {EXAM_NAMES[q.exam]} {q.year}
        </span>
        <span className="text-muted-foreground">{label.replace(`${EXAM_NAMES[q.exam]} ${q.year} · `, "")}</span>
        {q.source && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1",
              q.source === "beyond-ncert" ? "bg-muted text-muted-foreground" : "bg-tone-leaf/15 text-tone-leaf",
            )}
          >
            {SOURCE_LABELS[q.source]}
          </span>
        )}
      </header>

      {q.passage && (
        <details className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold">Paragraph padho</summary>
          <MathMarkdown className="mt-1">{q.passage}</MathMarkdown>
        </details>
      )}

      <MathMarkdown className="mt-3 text-[0.98rem] leading-relaxed">{q.body}</MathMarkdown>

      {q.hasFigure && q.page && (
        <div className="mt-3">
          <PaperFigure paper={q.paperSlug} page={q.page} box={q.figureBox} label={label} />
        </div>
      )}

      {isOption && (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {q.options.map((o, i) => {
            const letter = "ABCD"[i]!;
            const right = showAnswer && correct.has(letter);
            return (
              <li
                key={i}
                className={cn(
                  "flex gap-2 rounded-xl border px-3 py-2 text-sm",
                  right ? "border-tone-leaf bg-tone-leaf/10" : "border-border",
                )}
              >
                <span className="font-bold text-muted-foreground">({optionLabel(q.exam, i)})</span>
                <MathMarkdown inline>{o}</MathMarkdown>
                {right && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-tone-leaf" aria-label="Sahi option" />}
              </li>
            );
          })}
        </ol>
      )}

      <div className="no-print mt-4 flex flex-wrap items-center gap-2">
        <Button variant="chip" size="sm" onClick={() => setShowAnswer((v) => !v)} data-active={showAnswer}>
          <Eye /> {showAnswer ? "Answer chhupao" : "Answer dekho"}
        </Button>
        <Button
          variant="sun"
          size="sm"
          onClick={() => setWantSolution(true)}
          disabled={wantSolution && gen.status === "running"}
        >
          <Sparkles /> Solution + trick
        </Button>
        {q.page && !q.hasFigure && (
          <Button variant="chip" size="sm" onClick={() => setShowPaper((v) => !v)} data-active={showPaper}>
            <FileImage /> Asli paper mein
          </Button>
        )}
        {q.ncert && (
          <a
            href={pdfAtPage(q.ncert)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" />
            NCERT {placeLabel(q.ncert)}
            {q.ncert.printedPage ? ` · page ${q.ncert.printedPage}` : ""}
          </a>
        )}
      </div>

      {showAnswer && (
        <p className="mt-3 rounded-xl bg-highlight/50 px-3 py-2 text-sm">
          <span className="font-bold">Answer: </span>
          {answer ? answerText(q, answer) : "Is paper ki answer key nahi mili — “Solution + trick” se hal dekho."}
          {q.answer && KEY_NOTE[q.answerSource] && (
            <span className="text-muted-foreground"> · {KEY_NOTE[q.answerSource]} se</span>
          )}
          {!q.answer && solution?.ok && (
            <span className="text-muted-foreground"> · key nahi mili, 2 baar alag-alag solve karke mila</span>
          )}
        </p>
      )}

      {showPaper && q.page && (
        <div className="mt-3">
          <PaperFigure paper={q.paperSlug} page={q.page} box={q.figureBox} label={label} />
        </div>
      )}

      {wantSolution && !solution && gen.status === "running" && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-sticky px-3 py-2 text-sm text-sticky-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          {STAGES[gen.partial?.stage ?? "solving"]} (pehli baar 20–40 second)
        </p>
      )}
      {wantSolution && gen.status === "error" && !solution && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <TriangleAlert className="h-4 w-4" /> {gen.error?.message}
          <Button variant="chip" size="sm" onClick={gen.retry}>
            Dobara try karo
          </Button>
        </p>
      )}
      {solution && <SolutionView solution={solution} q={q} />}
    </article>
  );
}

function SolutionView({ solution, q }: { solution: ExamSolution; q: ExamQuestionView }) {
  if (!solution.ok)
    return (
      <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
        Is sawal ka hal hum pakka verify nahi kar paaye, isliye nahi dikha rahe.
        {q.answer ? ` Answer key ke hisaab se sahi answer ${answerText(q, q.answer)} hai.` : ""}
      </p>
    );
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <section>
        <h4 className="text-sm font-bold">Hal (step by step)</h4>
        <MathMarkdown className="text-sm">{solution.steps}</MathMarkdown>
      </section>
      <section className="rounded-xl bg-sticky px-3 py-2 text-sticky-foreground">
        <h4 className="flex items-center gap-1.5 text-sm font-bold">
          <Lightbulb className="h-4 w-4" /> Tez tarika / trick
        </h4>
        <MathMarkdown className="text-sm">{solution.trick}</MathMarkdown>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl bg-muted/70 px-3 py-2">
          <h4 className="text-sm font-bold">Is sawal mein kya tha</h4>
          <MathMarkdown className="text-sm">{solution.analysis}</MathMarkdown>
        </section>
        <section className="rounded-xl bg-destructive/8 px-3 py-2">
          <h4 className="text-sm font-bold">Yahan galti hoti hai</h4>
          <MathMarkdown className="text-sm">{solution.trap}</MathMarkdown>
        </section>
      </div>
      <p className="text-xs text-muted-foreground">
        Final answer: <span className="font-semibold text-foreground">{answerText(q, solution.answer)}</span>
        {solution.checkedBy === "key" ? " · answer key se match kiya gaya" : " · 2 alag hal se match kiya gaya"}
      </p>
    </div>
  );
}
