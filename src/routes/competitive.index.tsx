import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Landmark } from "lucide-react";
import { ScreenHeader } from "@/components/app/screen-header";
import { GOVERNMENT_CATEGORIES } from "@/lib/government-exams";
const title = "Government Exams · UPSC, SSC, RRB aur Banking | PadhoSuno";
const description = "2017–2026 ke government exam papers: exam-wise verified coverage, topic index aur compact revision.";
export const Route = createFileRoute("/competitive/")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: GovernmentHome,
});
function GovernmentHome() {
  return <><ScreenHeader title="Government Exams" subtitle="2017–2026 · Ek-ek exam karke" back={<Link to="/exam" />} />
    <main className="mx-auto max-w-5xl px-4 py-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {GOVERNMENT_CATEGORIES.map((c) => <Link key={c.id} to="/competitive/$category" params={{ category: c.id }} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
          <Landmark className="h-6 w-6 shrink-0 text-primary" />
          <span className="min-w-0 flex-1"><span className="block font-display text-lg font-bold">{c.name}</span><span className="block text-xs text-muted-foreground">{c.exams}</span></span>
          <span className="text-xs text-muted-foreground">{c.order === 1 ? "Pehla batch" : `Batch ${c.order}`}</span><ArrowRight className="h-4 w-4 shrink-0" />
        </Link>)}
      </div>
    </main></>;
}