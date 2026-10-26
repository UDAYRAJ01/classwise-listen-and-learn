import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { ScreenHeader } from "@/components/app/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

const NEXT_KEY = "padhosuno:auth-next";

function safeNext(v: unknown): string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/notebook";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Sign in | PadhoSuno" },
      { name: "description", content: "PadhoSuno mein sign in karo — notebook, progress aur streak har device par." },
      { property: "og:title", content: "Sign in | PadhoSuno" },
      { property: "og:description", content: "Notebook, progress aur streak har device par save." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Already signed in (or just came back from Google) → continue.
  useEffect(() => {
    const go = () => {
      const stored = sessionStorage.getItem(NEXT_KEY);
      sessionStorage.removeItem(NEXT_KEY);
      void navigate({ to: safeNext(stored ?? next), replace: true });
    };
    void supabase.auth.getSession().then(({ data }) => data.session && go());
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) go();
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (!data.session)
          setInfo("Email check karo — confirm link par click karte hi sign in ho jaoge.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in nahi ho paya.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    sessionStorage.setItem(NEXT_KEY, next);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) setError("Google se sign in nahi ho paya. Dobara try karo.");
  };

  return (
    <div>
      <ScreenHeader back={<Link to="/me" />} title={mode === "in" ? "Sign in" : "Account banao"} className="md:hidden" />
      <div className="mx-auto max-w-md px-4 py-6 md:py-14">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sticker sm:p-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="mt-4 hidden font-display text-3xl font-extrabold md:block">
            {mode === "in" ? "Sign in karo" : "Account banao"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground md:mt-1">
            Notebook, progress aur streak har phone/laptop par saath. Bina login bhi padh sakte ho.
          </p>

          <Button variant="paper" className="mt-6 h-11 w-full" onClick={google}>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ya email se{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              aria-label="Email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 border border-border bg-background text-base"
            />
            <Input
              type="password"
              aria-label="Password"
              required
              minLength={6}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border border-border bg-background text-base"
            />
            {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
            {info && <p className="text-sm font-semibold text-tone-leaf">{info}</p>}
            <Button variant="ink" type="submit" disabled={busy} className="h-11 w-full">
              {busy ? <LoaderCircle className="animate-spin" /> : <LogIn />}
              {mode === "in" ? "Sign in" : "Account banao"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="mt-4 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "in" ? "Naya account banana hai?" : "Pehle se account hai? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
