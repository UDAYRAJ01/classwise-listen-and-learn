import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant"; content: string };

const INSTRUCTIONS = `Tum "PadhoSuno Guru" ho — Class 1–12 (CBSE/NCERT aur ICSE/ISC) ke ek pyaare, expert teacher.
- Student jis bhasha mein likhe usi mein jawab do (default Hinglish, Roman script).
- Jab "Textbook se mile hisse" diye hon, facts unhi par base karo aur end mein chhota sa "📖 Source: Class X Subject – chapter" likho. Textbook ke bahar ki baat ho to apni knowledge se sahi jawab do.
- Sawal solve karna ho: pehle step-by-step hal karo, phir "## Aur 2–3 aasaan tarike" mein alag tarike / shortcut, phir "## Yaad rakhne ki trick" (mnemonic, kahani, pattern).
- Theory sawal: seedha short jawab, phir key points, phir ek memory trick.
- Formulas ke liye simple text/markdown use karo (jaise v = u + at). Markdown headings, lists, bold use karo. Chhota aur saaf rakho.
- Kabhi galat fact mat banao; pakka na ho to bata do.`;

export const Route = createFileRoute("/api/tutor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonError } = await import("@/lib/server/ndjson.server");
        let body: { messages?: unknown };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid request");
        }
        const raw = Array.isArray(body.messages) ? body.messages : [];
        const messages: Msg[] = raw
          .filter(
            (m): m is Msg =>
              !!m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string",
          )
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
        const last = messages[messages.length - 1];
        if (!last || last.role !== "user" || !last.content.trim())
          return jsonError(400, "Sawal likho");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { consumeRateLimit } = await import("@/lib/server/rate-limit.server");
        if (!(await consumeRateLimit(supabaseAdmin, request, "tutor")))
          return jsonError(429, "Is ghante ke sawal poore ho gaye. Thodi der baad poochho.");

        // Find matching textbook passages.
        const words = last.content
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 12)
          .join(" ");
        let context = "";
        if (words) {
          const { data } = await supabaseAdmin.rpc("search_chapter_sources", { q: words, n: 4 });
          if (data?.length)
            context = data
              .map(
                (r) =>
                  `[${r.board.toUpperCase()} Class ${r.grade} ${r.subject} – ${r.chapter_slug}]\n${r.snippet}`,
              )
              .join("\n\n");
        }

        const { createOpenAI } = await import("@ai-sdk/openai");
        const { streamText } = await import("ai");
        const { GATEWAY_URL, TEXT_MODEL, toGatewayError, friendlyMessage } = await import(
          "@/lib/server/ai.server"
        );
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return jsonError(500, "AI service is not configured.");
        const provider = createOpenAI({
          baseURL: GATEWAY_URL,
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });

        const prompt = context
          ? [
              ...messages.slice(0, -1),
              {
                role: "user" as const,
                content: `Textbook se mile hisse (sirf madad ke liye):\n${context}\n\nStudent ka sawal: ${last.content}`,
              },
            ]
          : messages;

        const result = streamText({
          model: provider.responses(TEXT_MODEL),
          instructions: INSTRUCTIONS,
          messages: prompt,
          maxRetries: 1,
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const enc = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(c) {
            try {
              for await (const part of result.fullStream) {
                if (part.type === "text-delta") c.enqueue(enc.encode(part.text));
                if (part.type === "error") throw part.error;
              }
            } catch (e) {
              const err = toGatewayError(e);
              console.error("tutor failed", err.status, err.message);
              c.enqueue(enc.encode(`\n\n⚠️ ${friendlyMessage(err, "jawab")}`));
            } finally {
              try {
                c.close();
              } catch {
                /* closed */
              }
            }
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
