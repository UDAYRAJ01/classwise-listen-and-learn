import { Flag, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SECTIONS } from "@/components/note/note-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reportMistake } from "@/lib/report.functions";

export function ReportDialog({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string>("notes");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const text = message.trim();
    if (text.length < 3) {
      setError("Thoda sa likh do ki kya galat hai.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await reportMistake({ data: { noteId, section, message: text } });
      toast.success("Shukriya! Aapki report mil gayi.");
      setMessage("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report nahi bhej paaye. Dobara try karein.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="no-print inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Flag className="h-4 w-4" /> Galti dikhi? Batao
        </button>
      </DialogTrigger>
      <DialogContent className="sticker-lg max-w-md rounded-3xl border-0 bg-background p-6 sm:rounded-3xl">
        <div className="space-y-4">
          <div>
            <DialogTitle className="font-display text-2xl font-extrabold">
              Galti report karo
            </DialogTitle>
            <DialogDescription>Aapki madad se notes aur bhi sahi bante hain.</DialogDescription>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Kahan?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-active={section === s.id}
                  onClick={() => setSection(s.id)}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs font-bold data-[active=true]:bg-ink data-[active=true]:text-paper"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="report-msg"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Kya galat hai?
            </label>
            <Textarea
              id="report-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={600}
              rows={4}
              placeholder="jaise: Question 3 ka answer textbook se alag hai…"
              className="border border-border bg-card text-base"
            />
            {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
          </div>
          <Button variant="ink" onClick={submit} disabled={sending} className="w-full">
            {sending ? <LoaderCircle className="animate-spin" /> : <Flag />} Report bhejo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
