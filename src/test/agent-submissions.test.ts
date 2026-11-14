import { describe, expect, it } from 'vitest';
import { draftNoteSchema, submissionSchema, sha256, validateNarration, validateWav } from '../../scripts/agent/submission-schema';
import { buildTracks } from '../lib/tracks';
import { parseContentSubmission } from '../lib/agent-submissions';

const content = {
  title: 'Electricity', oneLiner: 'I = Q/t', summary: 'Electric current is charge per second.',
  keyPoints: [{ heading: 'Current', points: ['I = Q/t'] }], keyTerms: [], formulas: [],
  tricks: [{ title: 'VIR', kind: 'acronym' as const, trick: 'V = IR', explanation: 'Voltage equals current times resistance.' }],
  questions: [{ question: '2 C in 1 s?', answer: '2 A', marks: 1 }],
  quickRevision: ['I = Q/t'], examTips: ['Use SI units.'], funFact: '',
  mcqs: [{ question: 'Current unit?', options: ['A','V','C','J'], answer: 0, explanation: 'Ampere.' }],
  mistakes: [{ mistake: 'Charge is current.', correct: 'Current is charge per unit time.' }],
};
const identity = { task: 1, board: 'cbse' as const, grade: 10, subject: 'science', chapter: 'b1-c1-electricity', language: 'hinglish' as const, source: { reference: 'Owner-supplied official textbook', sha256: sha256('source') } };
const note = submissionSchema.parse({ ...identity, kind: 'write', content });
const audio = { ...identity, kind: 'speak' as const, voice: 'didi' as const, noteFile: 'agent-workspace/submissions/note.json', tracks: buildTracks(content, 'hinglish').map(t => ({ index: t.index, textSha256: sha256(t.text), file: `agent-workspace/submissions/task/${t.index}.wav` })) };

describe('external agent chapter tasks', () => {
  it('accepts the existing writing draft directly without a patch or wrapper', () => {
    expect(parseContentSubmission(JSON.stringify(note))).toEqual(note);
  });
  it('accepts checking directly and rejects a false pass with pending corrections', () => {
    const check = { ...identity, kind: 'check', noteSha256: sha256(JSON.stringify(note)), verdict: 'pass', checks: [{ section: 'summary', evidence: 'p1', finding: 'Checked', correction: '' }] };
    expect(parseContentSubmission(JSON.stringify(check)).kind).toBe('check');
    expect(() => parseContentSubmission(JSON.stringify({ ...check, checks: [{ ...check.checks[0], correction: 'Fix this' }] }))).toThrow('pending corrections');
  });
  it('does not accept narration declarations without audio in the direct inbox', () => {
    expect(() => parseContentSubmission(JSON.stringify(audio))).toThrow('write/check only');
  });
  it('rejects malformed and oversized inbox drafts', () => {
    expect(() => parseContentSubmission('{')).toThrow();
    expect(() => parseContentSubmission(' '.repeat(2_000_001))).toThrow('2 MB');
  });
  it('accepts writing, speaking and checking tasks', () => {
    expect(submissionSchema.parse(note).kind).toBe('write');
    expect(submissionSchema.parse(audio).kind).toBe('speak');
    expect(submissionSchema.parse({ ...identity, kind: 'check', noteSha256: sha256(JSON.stringify(note)), verdict: 'pass', checks: [{ section: 'keyPoints', evidence: 'p1', finding: 'Checked current formula', correction: '' }] }).kind).toBe('check');
  });
  it('requires original note text and every audio part in order', () => {
    expect(() => validateNarration(audio, note)).not.toThrow();
    expect(() => validateNarration({ ...audio, tracks: audio.tracks.slice(1) }, note)).toThrow('every note track');
    expect(() => validateNarration({ ...audio, tracks: audio.tracks.map(t => ({ ...t, textSha256: sha256('invented narration') })) }, note)).toThrow('does not match');
  });
  it('does not attach audio to another chapter', () => {
    expect(() => validateNarration({ ...audio, chapter: 'b1-c2-light' }, note)).toThrow('chapter differs');
  });
  it('rejects out-of-range MCQ answers rather than silently fixing them', () => {
    expect(draftNoteSchema.safeParse({ ...content, mcqs: [{ ...content.mcqs[0], answer: 4 }] }).success).toBe(false);
  });
  it('rejects audio paths outside the draft workspace', () => {
    expect(submissionSchema.safeParse({ ...audio, noteFile: '../../.env' }).success).toBe(false);
  });
  it('accepts 24 kHz mono 16-bit PCM and rejects a different sample rate', () => {
    const wav = Buffer.alloc(46);
    wav.write('RIFF'); wav.writeUInt32LE(38,4); wav.write('WAVE',8); wav.write('fmt ',12); wav.writeUInt32LE(16,16);
    wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(24000,24); wav.writeUInt32LE(48000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
    wav.write('data',36); wav.writeUInt32LE(2,40);
    expect(() => validateWav(wav)).not.toThrow();
    wav.writeUInt32LE(44100,24);
    expect(() => validateWav(wav)).toThrow('24 kHz');
  });
});