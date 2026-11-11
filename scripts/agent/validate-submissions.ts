import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { submissionSchema, validateNarration, validateWav } from './submission-schema';

const root = 'agent-workspace/submissions';
function safeRead(path: string) {
  const parts = path.split('/');
  for (let i = 1; i <= parts.length; i++) {
    if (lstatSync(parts.slice(0, i).join('/')).isSymbolicLink()) throw new Error('Symlinks are not accepted');
  }
  return readFileSync(path);
}
let count = 0;
for (const name of readdirSync(root)) {
  if (!name.endsWith('.json')) continue;
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(name)) throw new Error('Invalid submission filename');
  const path = join(root, name);
  const bytes = safeRead(path);
  if (bytes.length > 2_000_000) throw new Error('Draft exceeds 2 MB');
  const draft = submissionSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (draft.kind === 'check' && draft.verdict === 'pass' && draft.checks.some(c => c.correction.trim())) throw new Error('Pass verdict cannot contain pending corrections');
  if (draft.kind === 'speak') {
    const note = submissionSchema.parse(JSON.parse(safeRead(draft.noteFile).toString('utf8')));
    validateNarration(draft, note);
    for (const track of draft.tracks) {
      const wav = safeRead(track.file);
      if (wav.length > 10_000_000) throw new Error('Audio part exceeds repository file limit');
      validateWav(wav);
    }
  }
  count++;
}
console.log(`Validated ${count} agent submissions. Drafts only; no Cloud writes or AI calls.`);
