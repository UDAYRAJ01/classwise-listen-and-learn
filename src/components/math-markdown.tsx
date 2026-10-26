import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

// Inline text may sit inside a <p> or <button>, where a <div> or nested <p> is invalid HTML
// (and breaks hydration), so inline mode renders paragraphs as spans.
const INLINE_COMPONENTS = {
  p: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
};

/**
 * Markdown with formulas: $…$ / $$…$$ in LaTeX, chemistry with \ce{…}, tables for
 * match-the-column questions. Used for past-paper questions, solutions and the exam index.
 */
export function MathMarkdown({
  children,
  className,
  inline = false,
}: {
  children: string;
  className?: string;
  /** Render a single paragraph without block margins (for list items and option text). */
  inline?: boolean;
}) {
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper
      className={cn(
        "math-md min-w-0 break-words [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex]:text-[1.02em]",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold",
        inline ? "[&_p]:my-0" : "[&_p]:my-1.5 block",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        components={inline ? INLINE_COMPONENTS : undefined}
      >
        {children}
      </ReactMarkdown>
    </Wrapper>
  );
}
