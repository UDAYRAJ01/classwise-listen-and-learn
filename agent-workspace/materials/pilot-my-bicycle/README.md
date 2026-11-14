# Muse pilot — Issue #1

Task: [#1](https://github.com/UDAYRAJ01/classwise-listen-and-learn/issues/1). Write and check **CBSE Class 2 English, Mridang, My Bicycle, English (`en`) only**. Use `task: 1` in both JSON submissions. Hindi is also missing; Hinglish is already cached. Do not rewrite either under this pilot.

## Read first
- Root `AGENTS.md`, `scripts/agent/AGENTS.md`, `docs/AGENT_PIPELINE.md`.
- `manifest.json`: exact chapter identity, source hash, sample provenance.
- `source.txt`: exact stored NCERT text, unedited UTF-8. Hash these exact bytes, not a URL, a trimmed string or a copied PDF. Official PDF: https://ncert.nic.in/textbook/pdf/bemr101.pdf . The extraction contains form-feed page boundaries, timestamps and damaged activity symbols; use the PDF to inspect images and printed page numbers. Do not invent visual labels or printed page numbers.
- `missing-notes.json`: current chapter-language inventory across cached syllabi. No source means blocked; available source still requires completeness review. This list is a timestamped snapshot, not an authorization to generate all chapters or proof every syllabus is correct.
- `samples/`: three existing notes whose stored textbook check is newer than the note and has no reported issues. These are **checked style references, not human-approved or guaranteed error-free**. Each JSON includes `content` and provenance; copy the format, not facts. Samples may be Hinglish; the pilot must be English.
- `writer-instructions.txt`: the app's current teacher instructions and pilot-specific sizing, exported without any AI request.
- `scripts/agent/submission-schema.ts`, `src/lib/types.ts`, `src/lib/server/schemas.server.ts`: authoritative format.

## Write
Create `agent-workspace/submissions/pilot-1-my-bicycle-en-write.json` with `kind: "write"`, `task: 1`, identity from manifest, `source.reference` from manifest and `source.sha256` matching source.txt, plus complete `content` matching the strict draft schema. Do not paste the manifest or sample wrapper into a submission.

For Class 1–5: keyPoints 3–5 groups × 2–4 points, keyTerms 4–8, tricks 4–6, answered questions 5–8 (1–2 marks), quickRevision 5–7, examTips 3–4, mistakes 3–4, MCQs 5. Use clear short English; preserve poem quotations in English. Return formulas `[]` when irrelevant. Include every required field; no additional fields inside content. Keep tricks genuine and tied to source, with at least three kinds where appropriate. Do not call generated practice questions real past-paper questions.

Coverage: red bicycle, blue seat, black tyres/pedals, bell sound, speed variation, air and helmet; bicycle parts; sight/new words; vowel a and pictured a/an examples; speaking/listening, word and writing activities. Do not present personal answers, a magic-bicycle story or missing diagram labels as textbook facts. Avoid claims of guaranteed exam frequency.

## Independently check
Create `agent-workspace/submissions/pilot-1-my-bicycle-en-check.json` with `kind: "check"`, same identity and source, `task: 1`, exact write-JSON byte hash as `noteSha256`, `verdict`, and `checks`. Cover summary, keyPoints, terms, formulas (including why none), tricks, questions, revision, tips, funFact, MCQs and mistakes. Document page/quotation evidence, verify answer indexes and all calculations; report omissions and uncertainty. A pass cannot contain corrections. Be honest if the same agent performed both writing and checking; structure validation does not establish reviewer independence or factual accuracy.

Run `bun run agent:validate` and `bun run test`; submit a PR referencing issue #1 with evidence and test results. Only draft JSON goes in submissions. No audio in this pilot, no production import, no cached-note overwrite, no secrets, no student data, no paid Lovable generation. Owner approval and a separate import remain required.
