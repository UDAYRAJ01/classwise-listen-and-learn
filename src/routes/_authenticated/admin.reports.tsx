import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookCheck,
  Check,
  ExternalLink,
  Flag,
  LoaderCircle,
  LogOut,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  checkAdmin,
  checkSummary,
  listReports,
  rebuildChapter,
  reportCounts,
  resolveReport,
  type AdminReport,
  type CheckLeftover,
  type ReportStatus,
} from "@/lib/admin.functions";
import { BOARDS, getSubject, isBoard } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [
      { title: "Galti reports | PadhoSuno owner" },
      { name: "description", content: "Students ki bheji galtiyan padho aur corrections bhejo." },
      { property: "og:title", content: "Galti reports | PadhoSuno" },
      { property: "og:description", content: "Owner page for student mistake reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const TABS: { id: ReportStatus; label: string }[] = [
  { id: "open", label: "Nayi" },
  { id: "resolved", label: "Theek ki gayi" },
  { id: "dismissed", label: "Chhod di" },
];

function ReportsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ReportStatus>("open");
  const check = useServerFn(checkAdmin);
  const list = useServerFn(listReports);
  const counts = useServerFn(reportCounts);

  const admin = useQuery({ queryKey: ["admin", "me"], queryFn: () => check() });
  const isAdmin = admin.data?.isAdmin === true;
  const reports = useQuery({
    queryKey: ["admin", "reports", tab],
    queryFn: () => list({ data: { status: tab } }),
    enabled: isAdmin,
  });
  const totals = useQuery({
    queryKey: ["admin", "counts"],
    queryFn: () => counts(),
    enabled: isAdmin,
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  };

  return (
    <div>
      <ScreenHeader
        back={<Link to="/me" />}
        title="Galti reports"
        subtitle="Sirf owner ke liye"
        actions={
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut /> Sign out
          </Button>
        }
      />
      <main className="mx-auto max-w-4xl px-4 pb-10 pt-4 sm:px-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Flag className="h-4 w-4 shrink-0" /> Students ki galtiyan padho, sahi jaankari likho, phir notes dobara
          banwao.
        </p>

        {admin.isLoading ? (
          <Loading />
        ) : admin.isError ? (
          <Notice text="Page load nahi hua. Refresh karke dekho." />
        ) : !isAdmin ? (
          <Notice text="Ye account owner nahi hai. Owner wale account se sign in karo." />
        ) : (
          <>
            <TextbookCheckPanel />
            <h2 className="mt-12 text-2xl font-extrabold">Students ki reports</h2>
            <div className="sticker mt-4 inline-flex rounded-xl bg-card p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-active={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className="rounded-lg px-3 py-1.5 text-sm font-bold data-[active=true]:bg-ink data-[active=true]:text-paper"
                >
                  {t.label} <span className="opacity-60">{totals.data?.[t.id] ?? ""}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {reports.isLoading ? (
                <Loading />
              ) : reports.isError ? (
                <Notice text="Reports load nahi hui. Dobara try karo." />
              ) : reports.data?.length === 0 ? (
                <Notice
                  text={
                    tab === "open"
                      ? "Koi nayi report nahi. Sab badhiya hai!"
                      : "Yahan abhi kuch nahi hai."
                  }
                />
              ) : (
                reports.data?.map((r) => <ReportCard key={r.id} report={r} />)
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ReportCard({ report: r }: { report: AdminReport }) {
  const queryClient = useQueryClient();
  const resolve = useServerFn(resolveReport);
  const rebuild = useServerFn(rebuildChapter);
  const [correction, setCorrection] = useState(r.correction ?? "");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const save = useMutation({
    mutationFn: (status: ReportStatus) => resolve({ data: { id: r.id, status, correction } }),
    onSuccess: (_d, status) => {
      toast.success(
        status === "resolved"
          ? "Correction save ho gayi."
          : status === "dismissed"
            ? "Report chhod di."
            : "Report wapas khuli.",
      );
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save nahi hua."),
  });

  const redo = useMutation({
    mutationFn: () =>
      rebuild({
        data: { board: r.board!, grade: r.grade!, subject: r.subject!, chapter: r.chapterSlug! },
      }),
    onSuccess: () => {
      toast.success(
        "Purane notes hata diye. Agli baar chapter khulte hi naye notes correction ke saath banenge.",
      );
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nahi ho paya."),
  });

  const board = r.board && isBoard(r.board) ? r.board : null;
  const subject = board && r.grade ? getSubject(board, r.grade, r.subject ?? "") : null;
  const canLink = board && r.grade && subject && r.chapterSlug;

  return (
    <article className="sticker rounded-2xl bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {board ? BOARDS[board].short : r.board} · Class {r.grade} · {subject?.name ?? r.subject}
            {r.language ? ` · ${r.language}` : ""}
            {r.section ? ` · ${r.section}` : ""}
          </p>
          <h2 className="mt-1 font-display text-xl font-bold">{r.chapterTitle ?? "Chapter"}</h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <time>
            {new Date(r.createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
          {canLink && (
            <Link
              to="/learn/$board/$grade/$subject/$chapter"
              params={{
                board: board!,
                grade: String(r.grade),
                subject: subject!.slug,
                chapter: r.chapterSlug!,
              }}
              search={r.language ? { lang: r.language as never } : {}}
              target="_blank"
              className="inline-flex items-center gap-1 font-bold hover:text-foreground"
            >
              Chapter <ExternalLink className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <blockquote className="mt-3 rounded-xl bg-sticky p-3 text-sticky-foreground">
        “{r.message}”
      </blockquote>

      {r.status === "open" ? (
        <div className="mt-4 space-y-3">
          <label
            htmlFor={`fix-${r.id}`}
            className="block text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Sahi jaankari (correction)
          </label>
          <Textarea
            id={`fix-${r.id}`}
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="jaise: Ohm ka niyam V = IR hai, V = I/R nahi."
            className="border border-border bg-background text-base"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="ink" disabled={save.isPending} onClick={() => save.mutate("resolved")}>
              {save.isPending ? <LoaderCircle className="animate-spin" /> : <Check />} Correction
              save karo
            </Button>
            <Button
              variant="ghost"
              disabled={save.isPending}
              onClick={() => save.mutate("dismissed")}
            >
              <X /> Galti nahi hai, chhod do
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {r.correction && (
            <p className="rounded-xl border border-tone-leaf/50 bg-tone-leaf/10 p-3">
              <span className="font-bold">Correction: </span>
              {r.correction}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {r.status === "resolved" && canLink && (
              <Button
                variant="marker"
                disabled={redo.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Is chapter ke purane notes aur audio (sab bhashaon mein) hata kar correction ke saath naye banwane hain?",
                    )
                  )
                    redo.mutate();
                }}
              >
                {redo.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Notes
                dobara banao
              </Button>
            )}
            <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate("open")}>
              <RotateCcw /> Wapas kholo
            </Button>
            {r.appliedAt && (
              <span className="text-sm font-semibold text-tone-leaf">
                ✓ Naye notes me lag chuka ({new Date(r.appliedAt).toLocaleDateString("en-IN")})
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function TextbookCheckPanel() {
  const summary = useServerFn(checkSummary);
  const q = useQuery({
    queryKey: ["admin", "checks"],
    queryFn: () => summary(),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <Notice text="Textbook check ki jaankari load nahi hui." />;
  const s = q.data;
  const pct = s.notes > 0 ? Math.round((s.checked / s.notes) * 100) : 0;
  return (
    <section
      aria-label="Textbook check"
      className="mt-8 rounded-2xl border border-border bg-card p-5"
    >
      <h2 className="flex items-center gap-2 text-2xl font-extrabold">
        <BookCheck className="h-6 w-6 text-tone-leaf" /> Textbook se check
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Har chapter ke notes official textbook se milaye jaate hain. Galti mili to sahi jaankari ke
        saath notes dobara likhe jaate hain.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { n: s.checked, l: "notes check ho gaye" },
          { n: s.notes, l: "notes bane hue" },
          { n: s.textbookFixes, l: "galtiyan theek ki" },
          { n: s.leftovers.length, l: "abhi bhi doubt" },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-muted/50 p-3">
            <dt className="font-display text-2xl font-extrabold">{x.n}</dt>
            <dd className="text-xs font-semibold text-muted-foreground">{x.l}</dd>
          </div>
        ))}
      </dl>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Kitne notes check ho gaye"
      >
        <div className="h-full rounded-full bg-tone-leaf" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {pct}% check · {s.withTextbook} chapters ki textbook text maujood hai
      </p>
      {s.leftovers.length > 0 && (
        <div className="mt-5">
          <h3 className="font-display text-lg font-bold">Check mein bache hue doubt (inhe khud dekh lo)</h3>
          <ul className="mt-2 space-y-3">
            {s.leftovers.slice(0, 20).map((l) => (
              <LeftoverItem key={l.noteId} l={l} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LeftoverItem({ l }: { l: CheckLeftover }) {
  const board = isBoard(l.board) ? l.board : null;
  const subject = board ? getSubject(board, l.grade, l.subject) : null;
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">
          {board ? BOARDS[board].short : l.board} · Class {l.grade} · {subject?.name ?? l.subject} ·{" "}
          {l.chapterTitle} <span className="font-normal text-muted-foreground">({l.language})</span>
        </p>
        {board && subject && (
          <Link
            to="/learn/$board/$grade/$subject/$chapter"
            params={{
              board,
              grade: String(l.grade),
              subject: subject.slug,
              chapter: l.chapterSlug,
            }}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm font-bold hover:underline"
          >
            Chapter <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {l.issues.slice(0, 4).map((i, k) => (
          <li key={k}>
            <span className="font-semibold text-tone-leaf">Sahi:</span> {i.correct}
          </li>
        ))}
      </ul>
    </li>
  );
}

function Loading() {
  return (
    <div className="mt-10 flex items-center gap-2 text-muted-foreground">
      <LoaderCircle className="h-5 w-5 animate-spin" /> Load ho raha hai…
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="sticker mt-8 rounded-2xl bg-card p-8 text-center text-muted-foreground">
      {text}
    </div>
  );
}
