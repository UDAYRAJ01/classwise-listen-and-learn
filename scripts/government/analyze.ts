/** Write compact, independently reviewed topic guides from checked original questions only. */
import { createHash } from "node:crypto";
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { askJson, pool, args } from "../exam/lib";
import type { TopicGuide } from "@/lib/government-exams";
const exam = args.get("exam") ?? "upsc-cse";
const papers = await admin.from("gov_exam_papers").select("id,stage,section,jurisdiction,year").eq("exam", exam).eq("status","ready").in("source_kind",["official","verified_copy"]);
if(papers.error) throw papers.error;
const byId = new Map((papers.data ?? []).map(p=>[p.id,p]));
const qs = [];
for(let from=0;byId.size;from+=1000) {
  const r=await admin.from("gov_exam_questions").select("id,paper_id,number,topic,concept,body,options").in("paper_id",[...byId.keys()]).eq("reviewed",true).order("id").range(from,from+999);
  if(r.error) throw r.error; qs.push(...(r.data ?? [])); if((r.data ?? []).length<1000) break;
}
const groups=new Map<string,typeof qs>();
for(const q of qs) {const p=byId.get(q.paper_id);if(!p)continue;const key=JSON.stringify([p.jurisdiction,p.stage,p.section,q.topic]);const list=groups.get(key)??[];list.push(q);groups.set(key,list);}
const schema={type:"object",additionalProperties:false,properties:{easy:{type:"string"},trick:{type:"string"},trap:{type:"string"},revision:{type:"string"},patterns:{type:"array",items:{type:"string"}}},required:["easy","trick","trap","revision","patterns"]};
await pool([...groups],2,async([key,questions])=>{
  const [jurisdiction,stage,section,topic]=JSON.parse(key) as string[];
  if(jurisdiction!=="national") throw new Error("State topic storage needs separate exam identity; never merge states");
  const evidence_hash=createHash("sha256").update(JSON.stringify(questions)).digest("hex");
  const old=await admin.from("gov_exam_topics").select("evidence_hash,reviewed").eq("exam",exam).eq("stage",stage??"").eq("section",section??"").eq("topic",topic??"").maybeSingle();
  if(old.error)throw old.error;if(old.data?.reviewed&&old.data.evidence_hash===evidence_hash)return;
  const instructions="You are an expert Indian competitive exam tutor. Hinglish, compact, no filler. Only teach concepts evidenced in supplied real questions. Do NOT solve the questions or reveal option letters. Explain important distinctions, one genuinely reliable memory hook with its limitations, common traps, and a 30-second revision. Patterns are possible question variants, NEVER prediction or recurrence claims (frequency comes from the database). Do not invent NCERT/book/page claims. Current-affairs facts must explicitly say the exam year; do not portray historical facts as current. No claims of complete ten-year coverage.";
  const prompt=JSON.stringify({exam,stage,section,topic,questions:questions.slice(0,35).map(q=>({...q,year:byId.get(q.paper_id)?.year}))});
  const guide=await askJson<TopicGuide>({instructions,text:prompt,schema,effort:"medium"});
  const reviewed=await askJson<TopicGuide>({instructions:instructions+" Independently review the guide. Correct every factual error and misleading mnemonic. Remove unsupported claims and answer hints. Return corrected complete guide.",text:prompt+"\nCandidate guide:"+JSON.stringify(guide),schema,effort:"high"});
  const r=await admin.from("gov_exam_topics").upsert({exam,stage:stage??"",section:section??"",topic:topic??"",content:JSON.parse(JSON.stringify(reviewed)),reviewed:true,evidence_hash},{onConflict:"exam,stage,section,topic"});
  if(r.error)throw r.error;console.log("GUIDE",topic,questions.length);
});