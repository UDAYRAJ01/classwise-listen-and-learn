import { describe, expect, it } from "vitest";

import { audioFileName, GAP_SECONDS, joinToWav, pcmFromWav } from "@/lib/audio-download";
import { PCM_RATE } from "@/lib/audio-engine";

/** Same layout the server saves (24 kHz, mono, 16-bit). */
function wav(samples: number[]): ArrayBuffer {
  const pcm = new Int16Array(samples);
  const buf = new ArrayBuffer(44 + pcm.byteLength);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + pcm.byteLength, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, PCM_RATE, true);
  v.setUint32(28, PCM_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, pcm.byteLength, true);
  new Int16Array(buf, 44).set(pcm);
  return buf;
}

/** jsdom's Blob has no arrayBuffer(); FileReader works everywhere. */
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

describe("offline audio download", () => {
  it("reads the spoken samples back out of a stored part", () => {
    expect(Array.from(pcmFromWav(wav([1, -2, 300, -32768])))).toEqual([1, -2, 300, -32768]);
  });

  it("joins every part in order with half a second of silence between them", async () => {
    const blob = joinToWav([new Int16Array([5, 6]), new Int16Array([7])]);
    const gap = Math.round(PCM_RATE * GAP_SECONDS);
    expect(GAP_SECONDS).toBe(0.5);
    const samples = pcmFromWav(await readBlob(blob));
    expect(samples.length).toBe(3 + gap);
    expect(Array.from(samples.slice(0, 2))).toEqual([5, 6]);
    expect(samples[2 + gap]).toBe(7);
    expect(samples.slice(2, 2 + gap).every((s) => s === 0)).toBe(true);
  });

  it("names the file after the chapter and the voice, keeping Hindi letters", () => {
    expect(audioFileName("हार की जीत", "didi")).toBe("PadhoSuno - हार की जीत (Didi).wav");
    expect(audioFileName('Light: "Reflection"/Refraction', "bhaiya")).toBe(
      "PadhoSuno - Light Reflection Refraction (Bhaiya).wav",
    );
  });
});
