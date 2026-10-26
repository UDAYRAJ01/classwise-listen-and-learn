import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Flag,
  GraduationCap,
  Headphones,
  Languages,
  LogIn,
  LogOut,
  Share,
  Smartphone,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ClassSheet } from "@/components/app/class-picker";
import { ScreenHeader } from "@/components/app/screen-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuthEmail } from "@/hooks/use-auth-email";
import { supabase } from "@/integrations/supabase/client";
import { LANGS } from "@/lib/catalog";
import { promptInstall, useInstallState } from "@/lib/install-prompt";
import { classLabel, myClass } from "@/lib/my-class";
import { notebook, useNotebook } from "@/lib/notebook-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "Profile — Class, Bhasha, Awaaz aur App | PadhoSuno" },
      {
        name: "description",
        content: "Apni class, notes ki bhasha aur awaaz chuno, sign in karo aur PadhoSuno app phone par install karo.",
      },
      { property: "og:title", content: "Profile — PadhoSuno" },
      { property: "og:description", content: "Class, bhasha, awaaz, sign in aur app install — ek jagah." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MePage,
});

const segClass =
  "rounded-md px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-sm";

function MePage() {
  const hydrated = useHydrated();
  const { prefs, recent } = useNotebook();
  const cls = myClass(prefs, recent);
  const [sheet, setSheet] = useState(false);

  return (
    <>
      <ScreenHeader back={<Link to="/" />} title="Profile" />
      <div className="mx-auto max-w-xl space-y-4 px-4 pb-10 pt-4 md:pt-6">
        <AccountCard />

        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <li>
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted"
            >
              <RowIcon>
                <GraduationCap />
              </RowIcon>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Meri class</span>
                <span className="block text-sm text-muted-foreground">
                  {hydrated && cls ? classLabel(cls) : "Abhi chuni nahi"}
                </span>
              </span>
              <span className="text-sm font-bold text-primary">Badlo</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </li>
          <Row icon={<Languages />} title="Bhasha">
            <div role="radiogroup" aria-label="Notes ki bhasha" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={(prefs.lang ?? "hinglish") === l.id}
                  data-active={(prefs.lang ?? "hinglish") === l.id}
                  onClick={() => notebook.setPrefs({ lang: l.id })}
                  className={segClass}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </Row>
          <Row icon={<Headphones />} title="Kaun padhaye?">
            <div role="radiogroup" aria-label="Awaaz" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
              {(["didi", "bhaiya"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={prefs.voice === v}
                  data-active={prefs.voice === v}
                  onClick={() => notebook.setPrefs({ voice: v })}
                  className={segClass}
                >
                  {v === "didi" ? "Didi" : "Bhaiya"}
                </button>
              ))}
            </div>
          </Row>
          <li>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
              <RowIcon>
                <Smartphone />
              </RowIcon>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Suno aur saath padho</span>
                <span className="block text-sm text-muted-foreground">Jo bol raha hai, wahan apne aap scroll</span>
              </span>
              <Switch checked={prefs.follow} onCheckedChange={(follow) => notebook.setPrefs({ follow })} />
            </label>
          </li>
        </ul>

        <InstallCard />

        <div className="flex items-center justify-between gap-4 px-1 pt-2 text-xs text-muted-foreground">
          <p>Notes AI se textbook ke hisaab se bante hain. Exam se pehle book se ek baar milayein.</p>
          <Link to="/admin/reports" className="inline-flex shrink-0 items-center gap-1 hover:text-foreground">
            <Flag className="h-3.5 w-3.5" /> Owner
          </Link>
        </div>
      </div>

      <ClassSheet
        open={sheet}
        onOpenChange={setSheet}
        board={cls?.board ?? "cbse"}
        grade={cls?.grade ?? null}
        onPick={(board, grade) => {
          notebook.setPrefs({ board, grade });
          toast.success(`${classLabel({ board, grade })} chuni gayi`);
        }}
      />
    </>
  );
}

function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary [&_svg]:h-[1.1rem] [&_svg]:w-[1.1rem]">
      {children}
    </span>
  );
}

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <RowIcon>{icon}</RowIcon>
      <span className="flex-1 whitespace-nowrap font-bold">{title}</span>
      {children}
    </li>
  );
}

function AccountCard() {
  const email = useAuthEmail();
  if (email === undefined)
    return <div className="h-[5.5rem] animate-pulse rounded-2xl border border-border bg-muted" aria-hidden />;
  if (!email)
    return (
      <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
        <p className="font-display text-lg font-extrabold">Sign in karo</p>
        <p className="mt-0.5 text-sm opacity-85">Notebook, progress aur streak har device par saath rahenge.</p>
        <Button asChild variant="paper" className="mt-3 h-10 rounded-full">
          <Link to="/auth" search={{ next: "/me" }}>
            <LogIn /> Sign in / Account banao
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary font-display text-lg font-extrabold uppercase text-primary-foreground">
        {email[0]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{email}</span>
        <span className="flex items-center gap-1 text-xs font-semibold text-tone-leaf">
          <CheckCircle2 className="h-3.5 w-3.5" /> Har device par sync
        </span>
      </span>
      <Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>
        <LogOut /> Sign out
      </Button>
    </div>
  );
}

function InstallCard() {
  const hydrated = useHydrated();
  const state = useInstallState();
  if (!hydrated) return null;
  if (state.kind === "installed")
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold text-tone-leaf">
        <CheckCircle2 className="h-4 w-4" /> App phone par install hai
      </p>
    );
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl">
        <img src="/icon-192.png" alt="" width={48} height={48} className="h-12 w-12" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">PadhoSuno app</p>
        {state.kind === "ready" ? (
          <>
            <p className="text-sm text-muted-foreground">Home screen par icon — ek tap mein khulega.</p>
            <Button
              variant="ink"
              size="sm"
              className="mt-2 h-9 rounded-full px-4"
              onClick={() =>
                void promptInstall().then((ok) => ok && toast.success("App install ho gayi ✓"))
              }
            >
              <Download /> Install karo
            </Button>
          </>
        ) : state.kind === "ios" ? (
          <p className={cn("text-sm text-muted-foreground")}>
            Safari mein neeche <Share className="inline h-4 w-4 align-[-3px]" /> Share dabao →{" "}
            <strong className="text-foreground">Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Browser menu (⋮) kholo → <strong className="text-foreground">Install app</strong> ya{" "}
            <strong className="text-foreground">Add to Home screen</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
