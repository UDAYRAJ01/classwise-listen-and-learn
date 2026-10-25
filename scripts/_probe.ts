import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { getSubject } from "@/lib/catalog";
import { checkNote } from "@/lib/server/note-check.server";
import { findNote, loadChapterContext } from "@/lib/server/note-pipeline.server";
import type { NoteRecord } from "@/lib/types";
const subject = getSubject("cbse", 10, "science")!;
const where = { board: "cbse" as const, grade: 10, subject, chapter: "b1-c1-chemical-reactions-and-equations" };
const note = (await findNote(admin, where, "hinglish")).data as unknown as NoteRecord;
const ctx = await loadChapterContext(admin, where);
console.log("source chars", ctx.source?.length, "corrections", ctx.corrections.length);
const c = structuredClone(note.content);
c.keyPoints[0]!.points[3] = "Magnesium air mein **dazzling red flame** ke saath jalta hai aur black magnesium oxide banata hai.";
if (c.mcqs?.[0]) { c.mcqs[0].answer = (c.mcqs[0].answer + 1) % 4; }
c.formulas = c.formulas;
const t0 = Date.now();
const issues = await checkNote({ board: "cbse", grade: 10, subject, chapterTitle: ctx.chapterTitle, content: c, source: ctx.source });
console.log(Math.round((Date.now()-t0)/1000)+"s", JSON.stringify(issues, null, 1));
process.exit(0);
