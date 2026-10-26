import { createFileRoute } from "@tanstack/react-router";

import type { ExamSolution } from "@/lib/exam";

const INSTRUCTIONS = `Tum JEE / NEET ke sabse achhe teacher ho. Ek asli past-paper sawal ka hal likho — chhota, saaf, exam ke liye.
Bhasha: simple Hinglish (Roman script), technical words English mein. Maths / physics / chemistry LaTeX mein $...$ ya $$...$$ (chemistry ke liye \\ce{}). Markdown lists allowed.
- "steps": seedha step-by-step hal (3–8 chhote steps), har step ek line. Faltu baat nahi.
- "trick": sabse tez tarika / shortcut / elimination / dimension check / special case — jo exam hall mein time bachaye. Agar koi dusra aasaan tarika hai to woh bhi 1–2 line mein.
- "analysis": "Is sawal mein kya tha" — 1–2 line: kaunsa concept test hua aur sawal ka twist kya tha.
- "trap": students kahan galti karte hain (1 line).
- "answer": sirf final answer — option sawal mein option letter(s) jaise "B" ya "A,C"; integer/numerical mein sirf number.
Picture di ho to diagram usi se padho. Answer key di ho to tumhara hal usi answer tak pahunchna chahiye; agar tumhe key galat lage tab bhi apna sahi kaam dikhao aur "answer" mein apna answer likho.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["steps", "trick", "analysis", "trap", "answer"],
  properties: {
    steps: { type: "string" },
    trick: { type: "string" },
    analysis: { type: "string" },
    trap: { type: "string" },
    answer: { type: "string" },
  },
};

type Out = { steps: string; trick: string; analysis: string; trap: string; answer: string };

export const Route = createFileRoute("/api/exam-solution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonError, ndjsonStream } = await import("@/lib/server/ndjson.server");
        let body: { id?: unknown };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid request");
        }
        const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/.test(body.id) ? body.id : null;
        if (!id) return jsonError(400, "Invalid request");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: q, error } = await supabaseAdmin
          .from("exam_questions")
          .select(
            "id, subject, kind, passage, body, options, answer, page, has_figure, figure, concept, solution, solution_ok, exam_papers!inner(slug, label, exam)",
          )
          .eq("id", id)
          .maybeSingle();
        if (error || !q) return jsonError(404, "Sawal nahi mila");

        const cached = q.solution as Omit<ExamSolution, "ok"> | null;
        if (cached) {
          const result: ExamSolution = { ...cached, ok: q.solution_ok };
          return ndjsonStream(async (send) => send({ type: "done", data: result }));
        }

        const { consumeRateLimit } = await import("@/lib/server/rate-limit.server");
        if (!(await consumeRateLimit(supabaseAdmin, request, "solution")))
          return jsonError(429, "Is ghante ke solutions poore ho gaye. Thodi der baad dekho.");

        const { streamStructured, friendlyMessage, toGatewayError } = await import("@/lib/server/ai.server");
        const { answersMatch, normalizeAnswer } = await import("@/lib/exam-answers");
        const paper = q.exam_papers as unknown as { slug: string; label: string; exam: string };

        // The scanned page, so diagrams and structures are read from the real paper.
        const images: { data: Uint8Array; mediaType: string }[] = [];
        if (q.has_figure && q.page) {
          const file = await supabaseAdmin.storage.from("exam-pages").download(`${paper.slug}/${q.page}.webp`);
          if (file.data) images.push({ data: new Uint8Array(await file.data.arrayBuffer()), mediaType: "image/webp" });
        }
        const box = (q.figure as { box?: number[] } | null)?.box;
        const options = Array.isArray(q.options) ? (q.options as string[]) : [];
        const key = q.answer && q.answer !== "BONUS" ? q.answer : null;
        const prompt = [
          `Paper: ${paper.label}. Subject: ${q.subject}. Concept: ${q.concept ?? "—"}. Type: ${q.kind}.`,
          images.length && box ? `Sawal picture mein is hisse mein hai (0–1000 scale, left/top/right/bottom): ${box.join(", ")}.` : "",
          q.passage ? `Passage:\n${q.passage}` : "",
          `Sawal:\n${q.body}`,
          options.length ? `Options:\n${options.map((o, i) => `(${"ABCD"[i]}) ${o}`).join("\n")}` : "",
          options.length && paper.exam !== "jee-advanced"
            ? 'Student ko yeh options (1), (2), (3), (4) naam se dikhte hain (A=1, B=2, C=3, D=4). "steps", "trick", "analysis" aur "trap" mein options ko (1)–(4) hi likho; sirf "answer" field mein letter.'
            : "",
          key ? `Answer key: ${key}` : "Answer key: (nahi mili — khud dhyan se solve karo)",
        ]
          .filter(Boolean)
          .join("\n\n");

        return ndjsonStream(async (send) => {
          send({ type: "partial", data: { stage: "solving" } });
          const solve = (effort: "medium" | "high", extra = "") =>
            streamStructured<Out>({ instructions: INSTRUCTIONS, prompt: prompt + extra, schema, effort, images });
          try {
            let out = await solve("medium");
            let ok: boolean;
            let checkedBy: ExamSolution["checkedBy"];
            if (key) {
              checkedBy = "key";
              ok = answersMatch(normalizeAnswer(out.answer, q.kind), key, q.kind);
              if (!ok) {
                send({ type: "partial", data: { stage: "checking" } });
                out = await solve(
                  "high",
                  `\n\nPichhli baar tumhara answer "${out.answer}" aaya jo key se match nahi hua. Shuru se dhyan se dobara solve karo.`,
                );
                ok = answersMatch(normalizeAnswer(out.answer, q.kind), key, q.kind);
              }
            } else {
              // No key: two independent solutions must agree before the answer is shown.
              checkedBy = "self";
              send({ type: "partial", data: { stage: "checking" } });
              const second = await solve("high");
              const a = normalizeAnswer(out.answer, q.kind);
              ok = Boolean(a) && answersMatch(a, normalizeAnswer(second.answer, q.kind), q.kind);
            }
            const answer = key ?? normalizeAnswer(out.answer, q.kind) ?? out.answer;
            const solution = { steps: out.steps, trick: out.trick, analysis: out.analysis, trap: out.trap, answer, checkedBy };
            await supabaseAdmin
              .from("exam_questions")
              .update({ solution, solution_ok: ok })
              .eq("id", q.id);
            send({ type: "done", data: { ...solution, ok } satisfies ExamSolution });
          } catch (e) {
            const err = toGatewayError(e);
            console.error("exam solution failed", err.status, err.message);
            send({ type: "error", status: err.status, message: friendlyMessage(err, "solution") });
          }
        });
      },
    },
  },
});
