/** Precompute solutions only for complete reviewed originals; two blind solves must agree. */
import { createHash } from "node:crypto";
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { askJson, args, pool } from "../exam/lib";
import { usablePaper } from "@/lib/government-exams";
import { solutionAgreement } from "./validation";
const schema = { type: "object", additionalProperties: false, properties: {
  answer: { type: "string" }, explanation: { type: "string" }, methods: { type: "array", items: { type: "string" } },
  trick: { type: "string" }, trap: { type: "string" }, confident: { type: "boolean" },
}, required: ["answer", "explanation", "methods", "trick", "trap", "confident"] };
interface Solution { answer: string; explanation: string; methods: string[]; trick: string; trap: string; confident: boolean }
const papers = await admin.from("gov_exam_papers").select("id,exam,label,year,source_kind,status");
if (papers.error) throw papers.error;
const byId = new Map((papers.data ?? []).filter(usablePaper).filter(p => !args.get("exam") || p.exam === args.get("exam")).map(p => [p.id, p]));
const questions = [];
for (let from = 0; byId.size; from += 1000) {
  const r = await admin.from("gov_exam_questions").select("id,paper_id,body,options,kind").in("paper_id", [...byId.keys()]).eq("reviewed", true).order("id").range(from, from + 999);
  if (r.error) throw r.error; questions.push(...(r.data ?? [])); if ((r.data ?? []).length < 1000) break;
}
await pool(questions.slice(0, Number(args.get("limit") ?? questions.length)), Number(args.get("workers") ?? 2), async q => {
  if (q.kind !== "single") return;
  const paper = byId.get(q.paper_id); if (!paper) return;
  const evidence_hash = createHash("sha256").update(JSON.stringify([q.body,q.options,paper.year])).digest("hex");
  const old = await admin.from("gov_exam_solutions").select("evidence_hash,reviewed").eq("question_id", q.id).maybeSingle();
  if (old.error) throw old.error; if (old.data?.reviewed && old.data.evidence_hash === evidence_hash) return;
  const text = JSON.stringify({ paper: paper.label, year: paper.year, question: q.body, options: q.options });
  const instructions = "Solve this original Indian exam question independently. Hinglish, concise. answer must be the zero-based option index as a string (0,1,2,3), or empty if uncertain. Facts evaluated at the exam year, not today. Do not invent a key, book page or references. Give clear reasoning, 2-3 genuinely distinct easy approaches only where valid (otherwise one), a reliable memory trick with limitations and a trap. confident=false if uncertain, ambiguous, image-dependent or historical facts cannot be established. Never claim an official answer.";
  const a = await askJson<Solution>({instructions, text, schema, effort:"medium"});
  const b = await askJson<Solution>({instructions:instructions+" Independently audit all statements before choosing. No prior candidate is available.", text, schema, effort:"high"});
  if (!a.confident || !b.confident || a.answer !== b.answer || !/^[0-3]$/.test(a.answer)) { console.log("UNRESOLVED",q.id); return; }
  const checked = await askJson<Solution>({instructions:instructions+" Review both solutions for factual errors, misleading shortcuts and answer validity. Set confident=false for any remaining uncertainty. Return the corrected explanation; do not change answer to reconcile a disagreement.",text:text+"\nCandidates:"+JSON.stringify([a,b]),schema,effort:"high"});
  if (!solutionAgreement(a,b,checked)) return;
  const r = await admin.from("gov_exam_solutions").upsert({question_id:q.id,answer:checked.answer,content:JSON.parse(JSON.stringify(checked)),verification:"independent_agreement",reviewed:true,evidence_hash});
  if (r.error) throw r.error; console.log("SOLUTION",q.id);
});