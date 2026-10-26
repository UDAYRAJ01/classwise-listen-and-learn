import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenCheck, FileText, ListOrdered, Repeat } from "lucide-react";

import { Crumbs } from "@/components/crumbs";
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Crumbs items={[{ label: "JEE / NEET" }]} />
      <header className="mt-6 max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Class 11 + 12 · Entrance prep</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
          JEE aur NEET mein jo <span className="hl">baar-baar aata hai</span>, wahi pehle
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Pichhle 10 saal ke asli question papers ka har sawal uske NCERT chapter aur concept se joda gaya hai. Har chapter ka
          index usi hisaab se bana hai — sabse zyada poochhe gaye concept upar, unke asli sawal, aasaan samjhaav, yaad
          rakhne ki trick aur NCERT ka page.
        </p>
      </header>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {overviews.map(([group, o]) => {
          const meta = EXAM_GROUPS[group];
          return (
            <Link
              key={group}
              to="/exam/$group"
              params={{ group }}
              className="sticker press group flex flex-col rounded-3xl bg-card p-6"
            >
              <p className="font-display text-2xl font-extrabold">{meta.name}</p>
              <p className="mt-1 text-muted-foreground">{meta.blurb}</p>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-muted px-2 py-3">
                  <dt className="text-xs font-semibold text-muted-foreground">Sawal</dt>
                  <dd className="font-display text-2xl font-extrabold">{o.totalQuestions}</dd>
                </div>
                <div className="rounded-2xl bg-muted px-2 py-3">
                  <dt className="text-xs font-semibold text-muted-foreground">Paper</dt>
                  <dd className="font-display text-2xl font-extrabold">{o.papers.length}</dd>
                </div>
                <div className="rounded-2xl bg-muted px-2 py-3">
                  <dt className="text-xs font-semibold text-muted-foreground">Saal</dt>
                  <dd className="font-display text-lg font-extrabold leading-8">{span(o)}</dd>
                </div>
              </dl>
              <span className="mt-5 inline-flex items-center gap-2 font-bold text-primary">
                {meta.short} index kholo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: ListOrdered,
            title: "Weightage se order",
            text: "Chapters aur concepts us order mein jitni baar woh asli paper mein aaye. Ginti paper se hai, andaze se nahi.",
          },
          {
            icon: BookOpenCheck,
            title: "NCERT mein kahan",
            text: "Har concept aur sawal ke saath NCERT ka section, example ya exercise aur page — click karke seedha book khulti hai.",
          },
          {
            icon: Repeat,
            title: "Revision system",
            text: "“Revise kiya” dabao — app 1, 3, 7, 15, 30 din baad dobara yaad dilata hai, taaki bhoolo nahi.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
            <f.icon className="h-6 w-6 text-primary" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold">{f.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold">Kaunse paper use hue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sirf asli paper. Answer: “official” = exam body ki final key, “coaching” = coaching institute ki key. Jis paper ki
          key nahi mili, wahan hal 2 baar alag-alag solve karke match hone par hi dikhaya jata hai.
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
  );
}
