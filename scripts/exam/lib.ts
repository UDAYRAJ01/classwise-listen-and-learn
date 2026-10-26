/** Shared helpers for the offline JEE / NEET past-paper pipeline (scripts/exam/*). */
import { createOpenAI } from "@ai-sdk/openai";
import { jsonSchema, Output, streamText, type ModelMessage } from "ai";

import { GATEWAY_URL, TEXT_MODEL, toGatewayError } from "@/lib/server/ai.server";

export const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k ?? "", v.length ? v.join("=") : "true"] as const;
  }),
);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Credits / workspace problems stop the whole run (never retried). */
export class StopRun extends Error {}

/**
 * One strict-JSON model call, optionally with page images.
 * 429 / 5xx are retried with backoff; 402 / 403 stop the run.
 */
export async function askJson<T>(opts: {
  instructions: string;
  text: string;
  images?: Uint8Array[];
  schema: object;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new StopRun("LOVABLE_API_KEY missing");
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const content: Exclude<ModelMessage["content"], string> = [
    ...(opts.images ?? []).map((data) => ({
      type: "file" as const,
      data,
      mediaType: "image/png",
    })),
    { type: "text" as const, text: opts.text },
  ];
  for (let attempt = 1; ; attempt++) {
    let streamError: unknown = null;
    try {
      const result = streamText({
        model: provider.responses(TEXT_MODEL),
        instructions: opts.instructions,
        messages: [{ role: "user", content } as ModelMessage],
        maxRetries: 0,
        output: Output.object({
          schema: jsonSchema<T>(opts.schema as Parameters<typeof jsonSchema>[0]),
        }),
        onError: ({ error }) => {
          streamError = error;
        },
        providerOptions: {
          openai: { store: false, forceReasoning: true, reasoningEffort: opts.effort ?? "low" },
        },
      });
      for await (const _ of result.partialOutputStream) void _;
      if (streamError) throw streamError;
      const out = (await result.output) as T;
      if (!out) throw new Error("empty response");
      return out;
    } catch (error) {
      const err = toGatewayError(streamError ?? error);
      if (err.status === 402 || err.status === 403) {
        throw new StopRun(`AI stopped (${err.status}): ${err.message}`);
      }
      const retryable = err.status === 429 || err.status >= 500;
      if (!retryable || attempt >= 4) throw err;
      await sleep((err.status === 429 ? 30_000 : 5_000) * attempt + Math.random() * 2000);
    }
  }
}

/** Runs `fn` over items with a fixed number of workers; a StopRun ends everything. */
export async function pool<T>(items: T[], workers: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  let stop: StopRun | null = null;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (!stop) {
        const item = queue.shift();
        if (item === undefined) return;
        try {
          await fn(item);
        } catch (error) {
          if (error instanceof StopRun) stop = error;
          else console.error("item failed:", (error as Error).message);
        }
      }
    }),
  );
  if (stop) throw stop;
}

/** Normalises an answer to the stored form: "A".."D", "A,C", or a number / range. */
export function normalizeAnswer(raw: string | null | undefined, kind: string): string | null {
  if (!raw) return null;
  let s = raw.trim().toUpperCase().replace(/^ANS(WER)?\s*[:.-]?\s*/, "");
  if (!s || /DROP|BONUS|DELETED|CANCEL/.test(s)) return s ? "BONUS" : null;
  if (kind === "single" || kind === "multiple" || kind === "matrix") {
    s = s.replace(/[()]/g, "").replace(/\bOR\b|AND|&|\//g, ",");
    const map: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
    const letters = s
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((x) => map[x] ?? x)
      .filter((x) => /^[A-D]$/.test(x));
    if (letters.length === 0) return null;
    return [...new Set(letters)].sort().join(",");
  }
  return s.replace(/\s+/g, " ").replace(/\bTO\b/g, "-");
}

/** True when two answers mean the same (numeric answers may be a range). */
export function answersMatch(given: string | null, official: string | null): boolean {
  if (!given || !official) return false;
  if (official === "BONUS") return true;
  const a = given.replace(/\s/g, "");
  const b = official.replace(/\s/g, "");
  if (a === b) return true;
  const num = (x: string) => Number(x.replace(/,/g, ""));
  const range = /^(-?[\d.]+)-(-?[\d.]+)$/.exec(b);
  const ga = num(a);
  if (range && !Number.isNaN(ga)) return ga >= num(range[1]!) - 1e-9 && ga <= num(range[2]!) + 1e-9;
  if (!Number.isNaN(ga) && !Number.isNaN(num(b))) return Math.abs(ga - num(b)) <= 1e-6 + Math.abs(num(b)) * 0.01;
  return false;
}
