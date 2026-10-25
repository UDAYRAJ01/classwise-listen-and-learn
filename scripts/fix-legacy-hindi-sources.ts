/**
 * NCERT's Class 10–12 Hindi and Sanskrit PDFs use the legacy Walkman-Chanakya font, so the
 * text pulled out of them reads "Hkkjr esa" instead of "भारत में". This converts every stored
 * textbook text that still looks like that font into Unicode Devanagari, so notes, the
 * textbook checker and the tutor can actually read the book.
 *
 *   bun scripts/fix-legacy-hindi-sources.ts [--dry]
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { chanakyaToUnicode, looksLikeChanakya } from "@/lib/walkman-chanakya";

const DRY = process.argv.includes("--dry");
const SUBJECTS = ["hindi", "sanskrit"];

const rows: { board: string; grade: number; subject: string; chapter_slug: string; body: string }[] =
  [];
for (let from = 0; ; from += 200) {
  const r = await admin
    .from("chapter_sources")
    .select("board, grade, subject, chapter_slug, body")
    .in("subject", SUBJECTS)
    .order("grade")
    .range(from, from + 199);
  if (r.error) throw r.error;
  rows.push(...(r.data ?? []));
  if ((r.data ?? []).length < 200) break;
}

let fixed = 0;
for (const row of rows) {
  if (!looksLikeChanakya(row.body)) continue;
  const body = chanakyaToUnicode(row.body).replace(/[ \t]+/g, " ");
  const label = `${row.board}/${row.grade}/${row.subject}/${row.chapter_slug}`;
  console.log(`${label}: ${body.slice(0, 80).replace(/\s+/g, " ")}`);
  fixed++;
  if (DRY) continue;
  const u = await admin
    .from("chapter_sources")
    .update({ body })
    .eq("board", row.board)
    .eq("grade", row.grade)
    .eq("subject", row.subject)
    .eq("chapter_slug", row.chapter_slug);
  if (u.error) console.error(`${label} failed:`, u.error.message);
}
console.log(`${fixed} of ${rows.length} texts ${DRY ? "would be" : ""} converted`);
process.exit(0);
