<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Study content (chapter lists, notes, audio) is AI-generated on demand by server routes in `src/routes/api/` and cached in Lovable Cloud tables (`syllabi`, `notes`, `note_audio`); a cached row is never regenerated, so every visitor after the first gets it instantly.
- Generation routes stream NDJSON (`partial` / `done` / `error`); the browser attaches through `src/lib/generation-store.ts` so remounts never start a second paid generation.
- The note shape lives in three places that must change together: `src/lib/types.ts`, the strict JSON schema in `src/lib/server/schemas.server.ts`, and `normalizeNote` in `src/lib/server/normalize.server.ts`.
- Audio parts come from `buildTracks` (`src/lib/tracks.ts`), shared by browser and server, so the voice service only ever speaks stored note text; changing it shifts track indices and makes stored audio (keyed by note, index, voice) mismatch.
- Playlists that span chapters (Exam Mode) reuse the same audio by giving each track its own `noteId` + `sourceIndex`; the narration hook resolves audio per track, never per page.
- Uncached audio streams PCM to the browser (Web Audio) while the server saves a WAV to the private `note-audio` bucket; stored audio is served via short-lived signed URLs.
- Offline audio download is built in the browser (`src/lib/audio-download.ts`) from the same audio jobs the player uses, joined into one WAV; no extra server route, so nothing is generated twice.
- The notebook (saved, history, read, per-chapter read parts, done, streak days, prefs) lives in localStorage (`src/lib/notebook-store.ts`) and, when signed in, syncs as one JSON row per user in `user_notebooks` via `src/lib/notebook-sync.ts`; login stays optional.
- Every fresh AI generation passes the per-visitor hourly limit in `src/lib/server/rate-limit.server.ts`; cached reads never count.
- Chapter slugs are positional (`b{book}-c{chapter}-title`); typed topics use `t-…-hash` and must match `customTopicSlug(title)` on the server.
- Student mistake reports go to `note_reports` through a rate-limited server function; the table has no public policies and is read only from the backend.
- The owner area lives under `src/routes/_authenticated/` (client-only gate to `/auth`); owner rights come only from `user_roles` checked server-side via `has_role`, and the first account ever created becomes the owner.
- Resolved report corrections are injected into the notes prompt for that chapter; "rebuild" deletes the chapter's cached notes and audio so the next visit regenerates them.
- CBSE chapter lists are built from the official NCERT chapter PDFs (Class 9–12: `src/lib/ncert-books.ts`; Class 1–8: `scripts/build-ncert-primary.ts`); each chapter keeps its NCERT `pdf` number (numbering has gaps, and one PDF can hold several lessons) for the textbook link, and its extracted text sits in `chapter_sources` (backend-only) to ground note generation. Notes for a chapter without stored text must not invent story details. Stored text must be Unicode: NCERT Class 10–12 Hindi/Sanskrit PDFs extract in the legacy Walkman-Chanakya font, so convert with `src/lib/walkman-chanakya.ts` (`scripts/fix-legacy-hindi-sources.ts` repairs stored rows) — notes, checks and the tutor cannot read the raw form.
- Note writing, saving and purging (notes + audio files) live only in `src/lib/server/note-pipeline.server.ts`, shared by `/api/notes`, the owner rebuild and `scripts/verify-notes.ts`, so every path writes notes the same way.
- Bulk generation + textbook check is `scripts/verify-notes.ts` (`note-check.server.ts` does the check); results live in `note_checks`, found problems become resolved `note_reports` corrections and the chapter is rewritten (max 2 rounds). A chapter is finished when its notes have `mistakes` and a check newer than the notes, so reruns skip it.
- "Padh liya" is earned per note section (`src/lib/note-sections.ts`): a section counts once its end was on screen long enough (`use-read-tracker.ts`) or all its audio parts played through; all sections → chapter read. "Yaad ho gaya" implies read.
- The AI tutor (`/ask`, `src/routes/api/tutor.ts`) answers by full-text searching `chapter_sources` via the service-role-only `search_book_passages` RPC (the student's chosen class and board rank first) and passing the matches to the model; it is retrieval, not model training, so new book text is usable as soon as it is stored.
- When a board renames or drops a subject for a class, remove it from that class in `src/lib/catalog.ts` and map the old slug in `renamedSubject` so saved links redirect instead of 404.
- Note highlight markup is `**word**`; remove it only with `stripEmphasis`/`splitEmphasis` from `src/lib/text.ts`, never a blanket `**` replace, so code operators like Python `**` survive in display, saved notes and the checker.
- JEE/NEET section: real past papers listed in `scripts/exam/papers.json` are read offline by `scripts/exam/extract.ts` (page reads cached under /tmp/exam/out, page images in the private `exam-pages` bucket, served by signed URL) into `exam_papers`/`exam_questions`; question counts and weightage are always counted from stored questions, never asked from the model.
- A question's subject comes from the paper's subject blocks (`scripts/exam/segment.ts`, snapped to the exam's fixed per-subject counts), not from its wording; each paper's `answer_source` (official/coaching/none) is shown to students as is, so never label a coaching key official.
- Re-reading a paper upserts by (paper, number) and keeps the chapter/concept mapping (and a checked solution if the answer is unchanged) of every question whose text is unchanged, so a redo never wipes paid analysis.
- `scripts/exam/analyze.ts` runs classify → home → units → concepts → index; questions on topics removed from current NCERT keep `in_syllabus=false` (home stage gives them their unit's chapter, the units stage files the rest under a dropped unit from `OLD_UNITS` in `src/lib/exam.ts` with its own page), are left out of weightage views and concept maps, and are listed apart on the chapter page; a new concept map drops that chapter's written index (ids change), every "NCERT example/exercise jaisa" claim must be confirmed against the stored book text (`ncert-snippet.ts`) or it is demoted to a section, and each written index passes an expert review against the NCERT chapter before it is stored.
- Exam answers are compared only through `src/lib/exam-answers.ts` (pipeline and solution route alike); a worked solution that disagrees with the key (or, without a key, with a second independent solve) is stored with `solution_ok=false` and never shown.
