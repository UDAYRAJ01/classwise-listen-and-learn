/**
 * Builds the NCERT location index for Class 11–12 Physics, Chemistry, Maths and Biology:
 * every numbered section, worked example, exercise question, figure and table of each
 * chapter PDF, with its PDF page and printed book page (parsing lives in ./ncert-layout.ts).
 *
 *   bun scripts/exam/ncert-sections.ts            # chapter PDFs are cached in /tmp/ncert/ch
 *
 * Exam questions and concepts point at these rows, so a student can open the exact page.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";

import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import type { SyllabusBook } from "@/lib/types";

import { locate, readLines, type SectionKind } from "./ncert-layout";

const DIR = "/tmp/ncert/ch";
mkdirSync(DIR, { recursive: true });

const SUBJECTS = ["physics", "chemistry", "maths", "biology"];

type Kind = SectionKind;
interface Row {
  grade: number;
  subject: string;
  chapter_slug: string;
  kind: Kind;
  ref: string;
  heading: string;
  page: number;
  printed_page: number | null;
  pdf_url: string;
}

async function download(url: string, file: string) {
  if (existsSync(file) && statSync(file).size > 1000) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return;
    }
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  throw new Error(`download failed ${url}`);
}

async function main() {
  const rows: Row[] = [];
  for (const grade of [11, 12]) {
    for (const subject of SUBJECTS) {
      const syl = await admin
        .from("syllabi")
        .select("books")
        .eq("board", "cbse")
        .eq("grade", grade)
        .eq("subject", subject)
        .maybeSingle();
      const books = (syl.data?.books ?? []) as unknown as SyllabusBook[];
      for (const book of books) {
        if (!book.code) continue;
        for (const ch of book.chapters) {
          const pdf = ch.pdf ?? ch.number;
          const name = `${book.code}${String(pdf).padStart(2, "0")}.pdf`;
          const url = `https://ncert.nic.in/textbook/pdf/${name}`;
          const file = `${DIR}/${name}`;
          await download(url, file);
          const found = locate(readLines(file));
          const counts = found.reduce<Record<string, number>>(
            (a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a),
            {},
          );
          console.log(`${grade}/${subject}/${ch.slug}`, JSON.stringify(counts));
          for (const f of found) {
            rows.push({ ...f, grade, subject, chapter_slug: ch.slug, pdf_url: url });
          }
        }
      }
    }
  }
  // Refs can change between parser versions, so the index is rebuilt from scratch.
  const del = await admin.from("ncert_sections").delete().gte("grade", 0);
  if (del.error) throw del.error;
  for (let i = 0; i < rows.length; i += 500) {
    const r = await admin
      .from("ncert_sections")
      .upsert(rows.slice(i, i + 500), { onConflict: "grade,subject,chapter_slug,kind,ref" });
    if (r.error) throw r.error;
  }
  console.log(`saved ${rows.length} locations`);
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
