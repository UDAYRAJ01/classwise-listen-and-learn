import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenCheck, FileText, ListOrdered, Repeat, Target } from "lucide-react";

import { ScreenHeader } from "@/components/app/screen-header";
import { ErrorCard } from "@/components/state-cards";
import { EXAM_GROUPS, EXAM_NAMES, type ExamGroup, type ExamOverview } from "@/lib/exam";
import { examOverviewQuery } from "@/lib/exam-queries";

const TITLE = "JEE & NEET Chapter Index — pichhle 10 saal ke asli paper se | PadhoSuno";
const DESCRIPTION =
  "Class 11–12 ke har chapter mein JEE Main, JEE Advanced aur NEET mein kya baar-baar aata hai — asli past papers ke sawal, easy concept, memory trick aur NCERT page ke saath.";

export const Route = createFileRoute("/exam/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(examOverviewQuery("jee")),
      context.queryClient.ensureQueryData(examOverviewQuery("neet")),
    ]);
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamHome,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorCard message="JEE / NEET index load nahi hua. Internet check karke dobara try karein." onRetry={reset} />
    </div>
  ),
});

function span(o: ExamOverview) {
  const years = o.papers.map((p) => p.year);
  return years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—";
}

function ExamHome() {
  const { data: jee } = useSuspenseQuery(examOverviewQuery("jee"));
  const { data: neet } = useSuspenseQuery(examOverviewQuery("neet"));
  const overviews: [ExamGroup, ExamOverview][] = [
    ["jee", jee],
    ["neet", neet],
  ];

  return (
    <>
      <ScreenHeader title="JEE / NEET" subtitle="Class 11–12 · pichhle 10 saal ke asli paper" />
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 md:pt-6">
      <div className="grid gap-3 md:grid-cols-2 md:gap-5">
        {overviews.map(([group, o]) => {
          const meta = EXAM_GROUPS[group];
          return (
            <Link
              key={group}
              to="/exam/$group"
              params={{ group }}
              className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sticker-sm transition-colors hover:border-primary md:p-6"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-paper">
                  <Target className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-extrabold leading-tight">{meta.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{meta.blurb}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </span>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted px-2 py-2">
                  <dd className="font-display text-xl font-extrabold">
                    {o.papers.reduce((n, p) => n + p.questions, 0)}
                  </dd>
                  <dt className="text-[0.7rem] font-semibold text-muted-foreground">Sawal</dt>
                </div>
                <div className="rounded-xl bg-muted px-2 py-2">
                  <dd className="font-display text-xl font-extrabold">{o.papers.length}</dd>
                  <dt className="text-[0.7rem] font-semibold text-muted-foreground">Paper</dt>
                </div>
                <div className="rounded-xl bg-muted px-2 py-2">
                  <dd className="font-display text-base font-extrabold leading-7">{span(o)}</dd>
                  <dt className="text-[0.7rem] font-semibold text-muted-foreground">Saal</dt>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>

      <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
        {[
          { icon: ListOrdered, text: "Chapter aur concept us order mein jitni baar aaye" },
          { icon: BookOpenCheck, text: "Har concept ke saath NCERT ka page" },
          { icon: Repeat, text: "“Revise kiya” — 1, 3, 7, 15, 30 din baad yaad" },
        ].map((f) => (
          <li key={f.text} className="flex items-center gap-2.5 rounded-xl px-1 py-1 text-muted-foreground">
            <f.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {f.text}
          </li>
        ))}
      </ul>

      <section className="mt-8">
        <h2 className="font-display text-lg font-extrabold">Kaunse paper use hue</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          “official” = exam body ki key · “coaching” = coaching ki key · key nahi = hal 2 baar solve karke match hone par
          hi dikhta hai.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {overviews.map(([group, o]) => (
            <details key={group} className="rounded-2xl border border-border bg-card p-4" open={false}>
              <summary className="cursor-pointer font-bold">
                {EXAM_GROUPS[group].short}: {o.papers.length} paper
              </summary>
              <ul className="mt-3 divide-y divide-border text-sm">
                {o.papers.map((p) => (
                  <li key={p.slug} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="font-semibold">{p.label}</span>
                      <span className="text-muted-foreground"> · {p.questions} sawal · {EXAM_NAMES[p.exam]}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={
                          p.answerSource === "official"
                            ? "rounded-full bg-tone-leaf/15 px-2 py-0.5 text-xs font-semibold text-tone-leaf"
                            : p.answerSource === "coaching"
                              ? "rounded-full bg-tone-sun/20 px-2 py-0.5 text-xs font-semibold text-sticky-foreground"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                        }
                      >
                        {p.answerSource === "official" ? "official" : p.answerSource === "coaching" ? "coaching" : "key nahi"}
                      </span>
                      {p.sourceUrl && (
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                          aria-label={`${p.label} ka asli PDF`}
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
    </>
  );
}
