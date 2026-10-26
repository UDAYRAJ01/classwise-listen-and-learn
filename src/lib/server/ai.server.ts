import { createOpenAI } from "@ai-sdk/openai";
import { jsonSchema, Output, streamText } from "ai";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const TEXT_MODEL = "openai/gpt-6-astra";

export class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getApiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new GatewayError(500, "AI service is not configured.");
  return key;
}

function createLovableAiGatewayRunIdFetch() {
  let runId: string | undefined;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has("X-Lovable-AIG-Run-ID")) headers.set("X-Lovable-AIG-Run-ID", runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
      return response;
    },
  };
}

/** Pulls a status + safe message out of whatever the AI SDK threw. */
export function toGatewayError(error: unknown): GatewayError {
  if (error instanceof GatewayError) return error;
  const e = error as {
    statusCode?: number;
    status?: number;
    responseBody?: string;
    message?: string;
    cause?: unknown;
    lastError?: unknown;
  };
  if (e?.lastError) return toGatewayError(e.lastError);
  const status = e?.statusCode ?? e?.status;
  let message = "";
  if (e?.responseBody) {
    try {
      const body = JSON.parse(e.responseBody) as {
        error?: { message?: string } | string;
        message?: string;
      };
      message =
        (typeof body.error === "string" ? body.error : body.error?.message) ?? body.message ?? "";
    } catch {
      message = "";
    }
  }
  if (typeof status === "number")
    return new GatewayError(status, message || e?.message || "AI request failed");
  if (e?.cause && e.cause !== error) {
    const inner = toGatewayError(e.cause);
    if (inner.status !== 500) return inner;
  }
  return new GatewayError(500, e?.message || "AI request failed");
}

/** Friendly Hinglish message for each gateway status. */
export function friendlyMessage(err: GatewayError, what: string): string {
  switch (err.status) {
    case 402:
      return `AI credits khatam ho gaye hain, isliye abhi ${what} nahi ban sakte. ${err.message ? `(${err.message})` : ""}`.trim();
    case 403:
      return err.message || `Is waqt ${what} banane ki permission nahi hai.`;
    case 429:
      return "Abhi bahut saare students ek saath padh rahe hain. 1 minute baad dobara try karein.";
    default:
      return `${what.charAt(0).toUpperCase()}${what.slice(1)} banane mein dikkat aayi. Thodi der baad dobara try karein.`;
  }
}

/**
 * Streams a strict-JSON structured response and reports partial objects.
 * Resolves with the final object; throws GatewayError on failure.
 */
export async function streamStructured<T>(opts: {
  instructions: string;
  prompt: string;
  schema: object;
  effort: "low" | "medium" | "high";
  /** Optional pictures sent before the prompt text (e.g. a scanned question page). */
  images?: { data: Uint8Array; mediaType: string }[];
  onPartial?: (partial: unknown) => void;
}): Promise<T> {
  const apiKey = getApiKey();
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  let streamError: unknown = null;
  const result = streamText({
    model: provider.responses(TEXT_MODEL),
    instructions: opts.instructions,
    ...(opts.images?.length
      ? {
          messages: [
            {
              role: "user" as const,
              content: [
                ...opts.images.map((img) => ({
                  type: "file" as const,
                  data: img.data,
                  mediaType: img.mediaType,
                })),
                { type: "text" as const, text: opts.prompt },
              ],
            },
          ],
        }
      : { prompt: opts.prompt }),
    maxRetries: 1,
    output: Output.object({
      schema: jsonSchema<T>(opts.schema as Parameters<typeof jsonSchema>[0]),
    }),
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: opts.effort,
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    for await (const partial of result.partialOutputStream) {
      opts.onPartial?.(partial);
    }
  } catch (error) {
    throw toGatewayError(error);
  }

  if (streamError) throw toGatewayError(streamError);

  try {
    const output = (await result.output) as T;
    if (!output) throw new GatewayError(502, "Empty AI response");
    return output;
  } catch (error) {
    throw toGatewayError(streamError ?? error);
  }
}
