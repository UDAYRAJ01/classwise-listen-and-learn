import { splitEmphasis } from "@/lib/text";

/** Renders note text, turning **keywords** into highlighter marks. */
export function Emph({ text }: { text: string | undefined | null }) {
  if (!text) return null;
  return (
    <>
      {splitEmphasis(text).map((s, i) =>
        s.strong ? (
          <mark key={i} className="hl bg-transparent font-semibold text-foreground">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
