/**
 * One-time tidy-up: chapter titles stored in ALL CAPS / all lower case (copied from book
 * PDFs) become Title Case. Slugs are kept, so every saved link keeps working.
 *
 *   bun scripts/fix-title-case.ts [--dry]
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { tidyTitle } from "@/lib/text";
import type { SyllabusBook } from "@/lib/types";

const DRY = process.argv.includes("--dry");

async function main() {
  const { data, error } = await admin.from("syllabi").select("board, grade, subject, books");
  if (error) throw error;
  let rows = 0;
  let titles = 0;
  for (const row of data) {
    const books = (row.books ?? []) as unknown as SyllabusBook[];
    let changed = 0;
    const next = books.map((b) => ({
      ...b,
      chapters: b.chapters.map((c) => {
        const t = tidyTitle(c.title);
        if (t !== c.title) changed++;
        return { ...c, title: t };
      }),
    }));
    if (!changed) continue;
    rows++;
    titles += changed;
    console.log(`${row.board}/${row.grade}/${row.subject}: ${changed} titles`);
    if (DRY) continue;
    const up = await admin
      .from("syllabi")
      .update({ books: next as unknown as Json })
      .eq("board", row.board)
      .eq("grade", row.grade)
      .eq("subject", row.subject);
    if (up.error) throw up.error;
  }
  console.log(`${DRY ? "would fix" : "fixed"} ${titles} titles in ${rows} subjects`);
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
