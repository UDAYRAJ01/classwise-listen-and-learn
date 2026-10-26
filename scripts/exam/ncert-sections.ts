/**
 * Builds the NCERT location index for Class 11–12 Physics, Chemistry, Maths and Biology:
 * every numbered section, worked example, exercise question, figure and table of each
 * chapter PDF, with its PDF page and printed book page.
 *
 *   bun scripts/exam/ncert-sections.ts            # chapter PDFs are cached in /tmp/ncert/ch
 *
 * Exam questions and concepts point at these rows, so a student can open the exact page.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";

import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import type { SyllabusBook } from "@/lib/types";

const DIR = "/tmp/ncert/ch";
mkdirSync(DIR, { recursive: true });

const SUBJECTS = ["physics", "chemistry", "maths", "biology"];

type Kind = "section" | "example" | "exercise" | "figure" | "table";
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

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, "")
    .trim()
    .slice(0, 140);

/** Printed page = PDF page + the offset most pages agree on. */
function printedOffset(pages: string[]): number | null {
  const votes = new Map<number, number>();
  pages.forEach((p, i) => {
    const lines = p
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const edge = [...lines.slice(0, 3), ...lines.slice(-4)];
    for (const l of edge) {
      const m = /^(?:[A-Za-z ,]+\s)?(\d{1,3})$/.exec(l) ?? /^(\d{1,3})\s[A-Za-z ,]+$/.exec(l);
      if (!m) continue;
      const n = Number(m[1]);
      if (n < 1 || n > 600) continue;
      const off = n - (i + 1);
      votes.set(off, (votes.get(off) ?? 0) + 1);
    }
  });
  let best: number | null = null;
  let bestVotes = 0;
  for (const [off, v] of votes) {
    if (v > bestVotes) {
      best = off;
      bestVotes = v;
    }
  }
  return bestVotes >= Math.max(2, Math.floor(pages.length / 4)) ? best : null;
}

function parseChapter(text: string): Omit<Row, "grade" | "subject" | "chapter_slug" | "pdf_url">[] {
  const pages = text.split("\f");
  const offset = printedOffset(pages);
  const found: Omit<Row, "grade" | "subject" | "chapter_slug" | "pdf_url">[] = [];
  const seen = new Set<string>();

  // The chapter number is the prefix most section numbers share (e.g. "3" in 3.4).
  const prefixVotes = new Map<string, number>();
  for (const m of text.matchAll(/^(\d{1,2})\.\d{1,2}(?:\.\d{1,2})?\s+[A-Z]/gm)) {
    prefixVotes.set(m[1]!, (prefixVotes.get(m[1]!) ?? 0) + 1);
  }
  const chapterNo = [...prefixVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!chapterNo) return found;
  const num = `${chapterNo}\\.\\d{1,2}`;

  let inExercises = false;
  pages.forEach((page, i) => {
    const pageNo = i + 1;
    const printed = offset === null ? null : pageNo + offset;
    const lines = page.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]!.trim();
      if (!line) continue;
      if (/^(EXERCISES?|Exercises?)\s*$/.test(line)) inExercises = true;
      const add = (kind: Kind, ref: string, heading: string) => {
        const key = `${kind}:${ref}`;
        if (seen.has(key)) return;
        seen.add(key);
        found.push({ kind, ref, heading: clean(heading), page: pageNo, printed_page: printed });
      };
      let m: RegExpExecArray | null;
      if ((m = new RegExp(`^(?:Example|EXAMPLE)\\s+(${num})\\s*(.*)$`).exec(line))) {
        add("example", m[1]!, m[2] || lines[li + 1]?.trim() || "");
        continue;
      }
      if ((m = new RegExp(`^(?:Fig(?:ure)?\\.?)\\s*(${num})\\s*[:.]?\\s*(.*)$`).exec(line))) {
        if (m[2] && m[2].length > 3) add("figure", m[1]!, m[2]);
        continue;
      }
      if ((m = new RegExp(`^Table\\s+(${num})\\s*[:.]?\\s*(.*)$`).exec(line))) {
        if (m[2] && m[2].length > 3) add("table", m[1]!, m[2]);
        continue;
      }
      m = new RegExp(`^(${num}(?:\\.\\d{1,2})?)\\s+(.{2,})$`).exec(line);
      if (!m) continue;
      const [, ref, rest] = m;
      if (inExercises && !ref!.split(".")[2]) {
        add("exercise", ref!, rest!);
        continue;
      }
      // Section headings start with a capital, are short and are not sentences in the body.
      if (!/^[A-Z]/.test(rest!) || rest!.length > 90 || /[=×]/.test(rest!)) continue;
      add("section", ref!, rest!.replace(/\s+\d+$/, ""));
    }
  });
  return found;
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
          const text = execFileSync("pdftotext", [file, "-"], { maxBuffer: 64 << 20 }).toString();
          const found = parseChapter(text);
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
