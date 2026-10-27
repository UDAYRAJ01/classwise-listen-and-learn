import { createServerFn } from "@tanstack/react-start";
import { isGovernmentCategory, usablePaper, type GovernmentPaper, type GovernmentQuestion, type TopicGuide } from "./government-exams";

export const fetchGovernmentExams = createServerFn({ method: "GET" })
  .inputValidator((input: { category: unknown }) => {
    if (!isGovernmentCategory(input.category)) throw new Error("Invalid exam");
    return { category: input.category };
  })
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Cloud is not configured");
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key); return fetch(input, { ...init, headers });
      } },
    });
    const result = await sb.from("gov_exam_papers").select("id,slug,category,exam,jurisdiction,stage,section,year,label,source_url,source_kind,key_source,key_url,status,expected_questions").eq("category", data.category).order("year", { ascending: false });
    if (result.error) throw new Error("Paper list load nahi hui");
    const papers = (result.data ?? []) as GovernmentPaper[];
    const readyIds = papers.filter(usablePaper).map((p) => p.id);
    const questions: GovernmentQuestion[] = [];
    if (readyIds.length) {
      for (let from = 0; ; from += 1000) {
        const r = await sb.from("gov_exam_questions").select("id,paper_id,number,page,body,options,kind,section,topic,concept").in("paper_id", readyIds).order("id").range(from, from + 999);
        if (r.error) throw new Error("Sawal load nahi hue");
        questions.push(...(r.data ?? []) as GovernmentQuestion[]);
        if ((r.data ?? []).length < 1000) break;
      }
    }
    const exams = [...new Set(papers.map((p) => p.exam))];
    const guides = exams.length ? await sb.from("gov_exam_topics").select("exam,stage,section,topic,content").in("exam", exams) : { data: [], error: null };
    if (guides.error) throw new Error("Topic notes load nahi hue");
    return { papers, questions, guides: (guides.data ?? []) as { exam: string; stage: string; section: string; topic: string; content: TopicGuide }[] };
  });