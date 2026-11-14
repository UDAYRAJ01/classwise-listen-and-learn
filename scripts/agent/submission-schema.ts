import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { buildTracks } from '../../src/lib/tracks';
import { submissionSchema } from '../../src/lib/agent-submissions';
export { draftNoteSchema, submissionSchema } from '../../src/lib/agent-submissions';
export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export function validateNarration(audio: Extract<z.infer<typeof submissionSchema>, {kind: 'speak'}>, note: z.infer<typeof submissionSchema>) {
  if (note.kind !== 'write') throw new Error('Narration must reference a writing draft');
  for (const key of ['board','grade','subject','chapter','language'] as const) {
    if (audio[key] !== note[key]) throw new Error(`Narration ${key} differs from note`);
  }
  if (audio.source.sha256 !== note.source.sha256) throw new Error('Narration source differs from note');
  const expected = buildTracks(note.content, note.language);
  if (expected.length !== audio.tracks.length) throw new Error('Narration must cover every note track');
  expected.forEach((track, i) => {
    const actual = audio.tracks[i];
    if (!actual || actual.index !== track.index || actual.textSha256 !== sha256(track.text)) {
      throw new Error(`Narration track ${i} does not match stored note text`);
    }
  });
}
export function validateWav(bytes: Buffer) {
  if (bytes.length < 44 || bytes.toString('ascii',0,4) !== 'RIFF' || bytes.toString('ascii',8,12) !== 'WAVE') throw new Error('Not a WAV file');
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Truncated WAV file');
  let fmt = false, data = false;
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(at + 4), start = at + 8, end = start + size;
    if (end > bytes.length) throw new Error('Truncated WAV chunk');
    const chunk = bytes.toString('ascii', at, at + 4);
    if (chunk === 'fmt ') {
      if (size < 16 || bytes.readUInt16LE(start) !== 1 || bytes.readUInt16LE(start+2) !== 1 || bytes.readUInt32LE(start+4) !== 24000 || bytes.readUInt16LE(start+14) !== 16 || bytes.readUInt16LE(start+12) !== 2 || bytes.readUInt32LE(start+8) !== 48000) throw new Error('Audio must be PCM 24 kHz, mono, 16-bit');
      fmt = true;
    }
    if (chunk === 'data') { if (size === 0 || size % 2) throw new Error('Empty or malformed PCM'); data = true; }
    at = end + (size % 2);
  }
  if (!fmt || !data) throw new Error('Missing WAV format or audio');
}
