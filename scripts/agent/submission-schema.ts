import { createHash } from 'node:crypto';
import { z } from 'zod';
import { buildTracks } from '../../src/lib/tracks';

const text = z.string().trim().min(1).max(40000);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(160);
const identity = {
  task: z.number().int().positive(),
  board: z.enum(['cbse', 'icse']),
  grade: z.number().int().min(1).max(12),
  subject: slug,
  chapter: slug,
  language: z.enum(['hinglish', 'hi', 'en']),
  source: z.object({ reference: text, sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
};
const optionalText = z.string().max(40000);
export const draftNoteSchema = z.object({
  title: text, oneLiner: text, summary: text,
  keyPoints: z.array(z.object({ heading: text, points: z.array(text).min(1) }).strict()).min(1),
  keyTerms: z.array(z.object({ term: text, meaning: text }).strict()),
  formulas: z.array(z.object({ name: text, formula: text, spoken: optionalText, note: optionalText }).strict()),
  tricks: z.array(z.object({ title: text, kind: z.enum(['acronym','rhyme','story','visual','pattern','shortcut']), trick: text, explanation: text }).strict()).min(1),
  questions: z.array(z.object({ question: text, answer: text, marks: z.number().int().min(1).max(6) }).strict()).min(1),
  quickRevision: z.array(text).min(1), examTips: z.array(text).min(1), funFact: optionalText,
  mcqs: z.array(z.object({ question: text, options: z.array(text).length(4), answer: z.number().int().min(0).max(3), explanation: text }).strict()).min(1),
  mistakes: z.array(z.object({ mistake: text, correct: text }).strict()).min(1),
}).strict();
export const submissionSchema = z.discriminatedUnion('kind', [
  z.object({ ...identity, kind: z.literal('write'), content: draftNoteSchema }).strict(),
  z.object({ ...identity, kind: z.literal('check'), noteSha256: z.string().regex(/^[a-f0-9]{64}$/),
    verdict: z.enum(['pass', 'changes-needed']),
    checks: z.array(z.object({ section: text, evidence: text, finding: text, correction: optionalText }).strict()).min(1),
  }).strict(),
  z.object({ ...identity, kind: z.literal('speak'), noteFile: z.string().regex(/^agent-workspace\/submissions\/[a-zA-Z0-9_-]+\.json$/),
    voice: z.enum(['didi','bhaiya']),
    tracks: z.array(z.object({ index: z.number().int().nonnegative(), textSha256: z.string().regex(/^[a-f0-9]{64}$/), file: z.string().regex(/^agent-workspace\/submissions\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.wav$/) }).strict()).min(1),
  }).strict(),
]);
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
