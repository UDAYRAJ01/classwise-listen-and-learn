import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { ScreenHeader } from "@/components/app/screen-header";
import { Button } from "@/components/ui/button";
import { MathMarkdown } from "@/components/math-markdown";
import { GOVERNMENT_CATEGORIES, PAPER_YEARS, isGovernmentCategory, paperSelection, topicKey, usablePaper, type GovernmentQuestion } from "@/lib/government-exams";
import { governmentExamQuery } from "@/lib/government-exams.queries";
export const Route = createFileRoute("/competitive/$category")({
  loader: ({ params, context }) => {
    if (!isGovernmentCategory(params.category)) throw notFound();
    return context.queryClient.ensureQueryData(governmentExamQuery(params.category));
  },
  head: ({ params }) => {
    const name = GOVERNMENT_CATEGORIES.find((c) => c.id === params.category)?.name ?? "Government Exam";
    const title = `${name} · Real Papers aur Topic Index | PadhoSuno`;
    const description = `${name} ke 2017–2026 papers ki actual coverage, baar-baar aaye topics aur compact revision.`;
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: CategoryScreen,
});
function CategoryScreen() {
  const { category } = Route.useParams();
  if (!isGovernmentCategory(category)) return null;
  return <CategoryContent category={category} />;
}
function CategoryContent({ category }: { category: (typeof GOVERNMENT_CATEGORIES)[number]["id"] }) {
  const { data } = useSuspenseQuery(governmentExamQuery(category));
  const meta = GOVERNMENT_CATEGORIES.find((c) => c.id === category);
  const [selection, setSelection] = useState({exam:"",stage:"prelims",section:"gs"});
  const {exam,stage,section} = paperSelection(data.papers,selection.exam,selection.stage,selection.section);
  const examPapers = data.papers.filter(p=>p.exam===exam);
  const papers = examPapers.filter((p) => p.stage === stage && p.section === section);
  const byId = new Map(papers.map((p) => [p.id, p]));
  const questions = data.questions.filter((q) => byId.has(q.paper_id));
  const groups = new Map<string, { topic: string; questions: GovernmentQuestion[]; years: Set<number>; exam: string; jurisdiction: string }>();
  for (const q of questions) {
    const p = byId.get(q.paper_id); if (!p) continue;
    const key = topicKey(p, q.topic), current = groups.get(key) ?? { topic: q.topic, questions: [], years: new Set<number>(), exam: p.exam, jurisdiction: p.jurisdiction };
    current.questions.push(q); current.years.add(p.year); groups.set(key, current);
  }
  const ready = papers.filter(usablePaper);
  return <><ScreenHeader title={meta?.name} subtitle={meta?.exams} back={<Link to="/competitive" />} />
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-5">
      {data.papers.length > 0 && <div className="flex flex-wrap gap-2">
        {[...new Set(data.papers.map(p=>p.exam))].map(e=><Button key={e} size="sm" variant={exam===e?"default":"outline"} onClick={()=>setSelection({exam:e,stage:"",section:""})}>{e.replaceAll("-"," ").toUpperCase()}</Button>)}
        {[...new Set(examPapers.map((p) => p.stage))].map((s) => <Button key={s} size="sm" variant={stage === s ? "default" : "outline"} onClick={() => setSelection({exam,stage:s,section:""})}>{s.toUpperCase()}</Button>)}
        {[...new Set(examPapers.filter((p) => p.stage === stage).map((p) => p.section))].map((s) => <Button key={s} size="sm" variant={section === s ? "default" : "outline"} onClick={() => setSelection({exam,stage,section:s})}>{s === "gs" ? "GS I" : s.replaceAll("-"," ").toUpperCase()}</Button>)}
      </div>}
      <section>
        <h2 className="font-display text-lg font-bold">Paper coverage</h2>
        <p className="mt-1 text-sm text-muted-foreground">{ready.length} paper checked · {questions.length} sawal · {papers.length} PDF mile</p>
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">{PAPER_YEARS.map((y) => {
          const rows = papers.filter((p) => p.year === y), ok = rows.some(usablePaper);
          return <div key={y} className="rounded-md border border-border px-1 py-2 text-center"><strong className="text-sm">{y}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{ok ? "Checked" : rows.length ? "PDF mila" : "Baaki"}</span></div>;
        })}</div>
        <p className="mt-2 text-xs text-muted-foreground">Sirf checked papers ke sawal gine hain; poore 10 saal ka analysis abhi nahi hai.</p>
      </section>
      {questions.length > 0 ? <section><h2 className="mb-3 font-display text-lg font-bold">Topic index · Is checked sample mein</h2>
        {[...groups.entries()].sort((a, b) => b[1].questions.length - a[1].questions.length).map(([key, g]) => {
          const guide = data.guides.find((n) => n.exam === g.exam && n.jurisdiction === g.jurisdiction && n.stage === stage && n.section === section && n.topic === g.topic);
          return <details key={key} className="border-b border-border py-3"><summary className="cursor-pointer font-bold">{g.topic}<span className="ml-2 text-xs font-normal text-muted-foreground">{g.questions.length} sawal · {g.years.size} saal</span></summary>
            {guide && <div className="space-y-2 py-3 text-sm"><MathMarkdown>{guide.content.easy}</MathMarkdown><p><strong>Trick:</strong> {guide.content.trick}</p><p><strong>Trap:</strong> {guide.content.trap}</p><p><strong>Revision:</strong> {guide.content.revision}</p><p className="text-xs text-muted-foreground">Possible pattern — prediction nahi: {guide.content.patterns.join(" · ")}</p></div>}
            <div className="space-y-3 py-3">{g.questions.map((q) => { const p = byId.get(q.paper_id), solution=data.solutions.find(s=>s.question_id===q.id); return <article key={q.id} className="rounded-lg border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{p?.label} · Q{q.number} · {q.concept}</p><MathMarkdown>{q.body}</MathMarkdown>
              {Array.isArray(q.options) && <ol className="mt-2 space-y-1 text-sm">{q.options.map((o, i) => <li key={i}><MathMarkdown>{`(${String.fromCharCode(97 + i)}) ${String(o)}`}</MathMarkdown></li>)}</ol>}
              <a href={`${p?.source_url}#page=${q.page}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary"><FileText className="h-3 w-3" /> Asli paper · PDF page {q.page}</a>
              {solution ? <details className="mt-3 border-t border-border pt-2"><summary className="cursor-pointer text-sm font-semibold text-primary">Answer aur solution</summary><div className="space-y-2 pt-3 text-sm"><strong>Answer: ({String.fromCharCode(97+Number(solution.answer))})</strong><p className="text-xs text-muted-foreground">Alag-alag solve karke check kiya · official key nahi</p><MathMarkdown>{solution.content.explanation}</MathMarkdown>{solution.content.methods.map((m,i)=><MathMarkdown key={i}>{`${i+1}. ${m}`}</MathMarkdown>)}<MathMarkdown>{`Trick: ${solution.content.trick}`}</MathMarkdown><MathMarkdown>{`Trap: ${solution.content.trap}`}</MathMarkdown></div></details> : <p className="mt-2 text-xs text-muted-foreground">Solution checking baaki.</p>}
            </article>; })}</div>
          </details>;
        })}</section> : <p className="text-sm text-muted-foreground">{category === "upsc" ? "Papers ki checking baaki hai." : `Batch ${meta?.order} · UPSC ke baad ek-ek karke.`}</p>}
      <section><h2 className="mb-2 font-display text-lg font-bold">Asli paper PDFs</h2>
        <ul className="divide-y divide-border">{papers.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{p.label}<span className="block text-xs text-muted-foreground">{p.source_kind === "official" ? "Official paper" : p.source_kind} · {p.key_source === "none" ? "Key abhi nahi" : p.key_source}</span></span><a href={p.source_url} target="_blank" rel="noreferrer" aria-label={`${p.label} PDF`} className="p-2 text-primary"><ExternalLink className="h-4 w-4" /></a></li>)}</ul>
        {meta?.archive && <a href={meta.archive} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-primary">Official archive <ExternalLink className="h-4 w-4" /></a>}
      </section>
    </div></>;
}