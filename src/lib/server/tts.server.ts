import { chunkText } from "@/lib/chunk-text";
import { GATEWAY_URL, GatewayError } from "./ai.server";

export const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";

export const VOICES = {
  didi: { id: "didi", provider: "Kore" },
  bhaiya: { id: "bhaiya", provider: "Puck" },
} as const;
export type VoiceId = keyof typeof VOICES;

export function isVoice(v: unknown): v is VoiceId {
  return v === "didi" || v === "bhaiya";
}

export const SAMPLE_RATE = 24000;
const STYLE = "Read aloud in a warm, clear, friendly Indian teacher voice at a steady, easy-to-follow pace: ";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } | string; message?: string };
    return (typeof body.error === "string" ? body.error : body.error?.message) ?? body.message ?? "";
  } catch {
    return "";
  }
}

/** Streams one text chunk as PCM through the gateway's SSE speech stream. */
async function streamChunk(text: string, voiceName: string, onPcm: (pcm: Uint8Array) => void): Promise<void> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError(500, "AI service is not configured.");
  const res = await fetch(`${GATEWAY_URL}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: STYLE + text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
      stream_format: "sse",
    }),
  });
  if (!res.ok || !res.body) {
    const message = await readError(res);
    throw new GatewayError(res.status || 502, message || `Voice request failed (${res.status})`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let completed = false;
  let received = 0;
  const handleEvent = (raw: string) => {
    const data = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    let payload: { type?: string; audio?: string; error?: { message?: string } | string; message?: string };
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (payload.type === "error" || payload.error) {
      const msg = typeof payload.error === "string" ? payload.error : (payload.error?.message ?? payload.message ?? "");
      throw new GatewayError(502, msg || "Voice stream failed");
    }
    if (payload.type === "speech.audio.done") {
      completed = true;
      return;
    }
    if (payload.type === "speech.audio.delta" && payload.audio) {
      const pcm = b64ToBytes(payload.audio);
      received += pcm.byteLength;
      onPcm(pcm);
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx: number;
    while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
      handleEvent(raw);
    }
  }
  if (buffer.trim()) handleEvent(buffer);
  if (!completed || received < 2000) throw new GatewayError(502, "Voice service returned incomplete audio.");
}

/**
 * Streams a whole track as PCM (sentence-sized chunks, in order) and returns
 * the complete PCM so the caller can store it.
 */
export async function streamTrack(
  text: string,
  voice: VoiceId,
  onPcm: (pcm: Uint8Array) => void,
): Promise<Uint8Array> {
  const chunks = chunkText(text, 1100);
  const gap = new Uint8Array(Math.round(SAMPLE_RATE * 0.3) * 2);
  const parts: Uint8Array[] = [];
  let carry: Uint8Array = new Uint8Array(0);
  // Keep 16-bit samples aligned across deltas.
  const emit = (pcm: Uint8Array) => {
    let bytes = pcm;
    if (carry.length) {
      const merged = new Uint8Array(carry.length + pcm.length);
      merged.set(carry);
      merged.set(pcm, carry.length);
      bytes = merged;
    }
    const usable = bytes.length - (bytes.length % 2);
    carry = bytes.slice(usable);
    const aligned = bytes.subarray(0, usable);
    if (aligned.length) {
      parts.push(aligned);
      onPcm(aligned);
    }
  };
  for (const [i, chunk] of chunks.entries()) {
    if (i > 0) emit(gap);
    await streamChunk(chunk, VOICES[voice].provider, emit);
  }
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const pcm = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    pcm.set(p, o);
    o += p.byteLength;
  }
  return pcm;
}

export function buildWav(pcm: Uint8Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  v.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, "data");
  v.setUint32(40, pcm.byteLength, true);
  const out = new Uint8Array(44 + pcm.byteLength);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}
