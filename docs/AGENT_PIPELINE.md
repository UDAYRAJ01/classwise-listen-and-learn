# External agent contract

Read root AGENTS.md first. Work in a branch and submit a PR; never force-push the synced branch, auto-merge, or access production secrets. No provider credentials are needed by this workflow. It makes no model calls and writes no Cloud data.

## Tasks and outputs

Use one issue per chapter/task. Put JSON in `agent-workspace/submissions/<task-name>.json`. Every JSON requires:

- `task`: positive GitHub issue number
- `kind`: `write`, `speak` or `check`
- `board`: `cbse` or `icse`; `grade`: 1–12
- `subject`, `chapter`: existing slugs, never invent/reorder chapter identities
- `language`: `hinglish`, `hi` or `en`
- `source`: `{ "reference": "official book link and printed pages", "sha256": "64 lowercase hex characters" }`; hash the exact source bytes supplied for the task, not a URL. Owner verifies this hash and provenance.

### write

Add `content` matching `NoteContent` in `src/lib/types.ts` and the strict `noteJsonSchema` in `src/lib/server/schemas.server.ts`. All fields including mcqs and mistakes are required. Include key points, terms, relevant formulas, memory tricks with explanation, answered questions, revision, tips and common mistakes. MCQs have four options, answer index 0–3; marks 1–6. Empty formulas/terms are allowed when irrelevant. Cite textbook evidence in the PR; do not invent source text or claim AI checks prove correctness.

### check

Add `noteSha256` (hash the exact writing JSON bytes), `verdict` (`pass` or `changes-needed`), and `checks`: `[{ "section": "keyPoints", "evidence": "Book page and quotation", "finding": "What was checked", "correction": "Correction, or empty when no change" }]`. Check facts, calculations, MCQ answers, tricks, omissions and source claims independently. A pass cannot include pending corrections. Report uncertainty; the pipeline validates structure, not factual accuracy or reviewer independence. Owner checks note/source hashes before approval.

### speak

Add `noteFile` referencing a writing JSON in `agent-workspace/submissions/`, `voice` (`didi` or `bhaiya`, app voice slot, not a guarantee of provider voice identity), and `tracks`: `[{ "index": 0, "textSha256": "hash of exact buildTracks text", "file": "agent-workspace/submissions/task-name/0.wav" }]`.

Generate track text with the existing `buildTracks(note.content, note.language)` in `src/lib/tracks.ts`. Include every track in its original order, including section labels; never reword/add narration or change indices. Hash exact UTF-8 track text. WAV must be uncompressed PCM, 24,000 Hz, mono, 16-bit, nonempty, under 10 MB per file. Automated matching checks the declared text hash, not whether the spoken words are accurate; owner must listen before approval. Use only approved notes. JSON and audio must share chapter, language and source identity. Do not commit an entire book audio collection; use small chapter-scoped PRs.

## Self-serve task queue

The app keeps a to-do list of chapters that still have no notes. With the same agent key:

- `GET /api/public/agent?action=tasks&status=open&limit=25` — chapters that can be written now, because their official textbook text is stored. Optional `board`, `grade`, `subject` filters. `status=blocked` lists chapters with no stored text: do not write those from memory.
- `GET /api/public/agent?action=task&id=12` — that task's full material: chapter identity, the exact textbook text with its SHA-256, up to three checked style notes, and this app's own teacher instructions for that class, subject and language.
- `POST /api/public/agent?action=claim&id=12` — take the task so another writer does not repeat it. Only an `open` task can be claimed.

Send both drafts back carrying that number as `task`: `POST /api/public/agent?action=submit`, exact file bytes, one POST per file. The queue row stays `open`/`claimed` until the owner imports the notes, then it becomes `applied`. Structural validation still does not prove factual accuracy.

## Run locally

```sh
bun install --frozen-lockfile
bun run agent:validate
bun run test
```

Actions runs on pull requests with read-only permissions, no application secrets, no paid jobs and a 15-minute timeout. Do not change it to `pull_request_target` or expose secrets to agent code. GitHub repository protection, collaborator permissions, required checks and Git sync connection are configured by the repository owner; files alone do not enforce owner approval or establish a connection.

## Approved import

### Direct inbox when GitHub push is unavailable

Use the existing agent key in `Authorization: Bearer <key>` (or `x-agent-key: <key>`); never put it in JSON, a committed file or chat. Send each original write/check JSON file unchanged to:

`POST https://classwise-listen-and-learn.lovable.app/api/public/agent?action=submit`

Content-Type is `application/json`; request body is the exact file bytes, not a wrapper and not a reserialized object. Preserve the writing file bytes because the check's `noteSha256` hashes those bytes. Receipt includes `id`, `sha256` and `status`; resending identical bytes returns the existing receipt. `GET ?action=submissions&task=1` lists receipts/status, and `GET ?action=submission&id=<uuid>` reads the original draft. Repository write permission is not needed. This endpoint accepts writing/checking only, not WAV uploads. Structural validation does not prove factual correctness; review must compare the task, current source hash and checker hash before import.

Lovable reviewer: `bun scripts/agent/inbox.ts content` lists drafts; `content show <id>` exports exact JSON into `/tmp`; `content mark <id> applied|rejected "review note"` records the result. Only mark applied after the separate approved import succeeds. No watcher or background importer runs.

Merge stores drafts only. Ask Lovable to review and import an approved task. Note writes must use `note-pipeline.server.ts`, changed notes invalidate old audio, audio writes use the existing private bucket/cache identity, and imports require checking current chapter/source identity and owner approval. No automatic import is implemented here; never hand external agents a service-role key or widen anonymous policies.
