import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { looksLikeChanakya } from "@/lib/walkman-chanakya";
let total = 0;
for (let from = 0; ; from += 50) {
  const r = await admin.from("chapter_sources").select("board, grade, subject, chapter_slug, body").order("grade").order("subject").order("chapter_slug").range(from, from + 49);
  if (r.error) { console.log(r.error.message); break; }
  for (const x of r.data ?? []) {
    total++;
    const hints = (x.body.match(/osQ|esa |gSA|ugha|fd |gqvk|dk |dh /g) ?? []).length;
    if (looksLikeChanakya(x.body) || hints >= 10) {
      const i = x.body.search(/osQ|gSA/);
      console.log(x.grade, x.subject, x.chapter_slug, "legacy=", looksLikeChanakya(x.body), "hints", hints, "|", x.body.slice(Math.max(0, i - 60), i + 60).replace(/\s+/g, " "));
    }
  }
  if ((r.data ?? []).length < 50) break;
}
console.log("total", total);
process.exit(0);
