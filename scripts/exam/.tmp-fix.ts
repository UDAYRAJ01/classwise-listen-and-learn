import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const { error } = await db
  .from("exam_papers")
  .update({ answer_source: "coaching" })
  .in("slug", ["neet-2021", "jee-main-2025-01-22-s1"]);
console.log(error ?? "ok");
