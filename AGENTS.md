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

Subdirectories have their own `AGENTS.md` (e.g. `scripts/exam/` for the JEE/NEET pipeline); read it before changing files there.

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
- CBSE chapter lists come from the official NCERT chapter PDFs (Class 9–12: `src/lib/ncert-books.ts`; 1–8: `scripts/build-ncert-primary.ts`); each chapter keeps its NCERT `pdf` number (gaps, multi-lesson PDFs) for the textbook link, and its text sits in backend-only `chapter_sources` to ground notes (no stored text → no invented story details). Stored text must be Unicode: Class 10–12 Hindi/Sanskrit PDFs use the legacy Walkman-Chanakya font, so convert with `src/lib/walkman-chanakya.ts`.
- Note writing, saving and purging (notes + audio files) live only in `src/lib/server/note-pipeline.server.ts`, shared by `/api/notes`, the owner rebuild and `scripts/verify-notes.ts`, so every path writes notes the same way.
- Bulk generation + textbook check is `scripts/verify-notes.ts` (`note-check.server.ts` does the check); results live in `note_checks`, found problems become resolved `note_reports` corrections and the chapter is rewritten (max 2 rounds). A chapter is finished when its notes have `mistakes` and a check newer than the notes, so reruns skip it.
- "Padh liya" is earned per note section (`src/lib/note-sections.ts`): a section counts once its end was on screen long enough (`use-read-tracker.ts`) or all its audio parts played through; all sections → chapter read. "Yaad ho gaya" implies read.
- The AI tutor (`/ask`, `src/routes/api/tutor.ts`) answers by full-text searching `chapter_sources` via the service-role-only `search_book_passages` RPC (the student's chosen class and board rank first) and passing the matches to the model; it is retrieval, not model training, so new book text is usable as soon as it is stored.
- When a board renames or drops a subject for a class, remove it from that class in `src/lib/catalog.ts` and map the old slug in `renamedSubject` so saved links redirect instead of 404.
- Note highlight markup is `**word**`; remove it only with `stripEmphasis`/`splitEmphasis` from `src/lib/text.ts`, never a blanket `**` replace, so code operators like Python `**` survive in display, saved notes and the checker.
- Phone-first shell: `__root.tsx` renders desktop `SiteHeader`/`SiteFooter` and the phone `BottomNav` (`src/components/app/`); screens open with `ScreenHeader`, and fixed bottom bars sit above the tab bar via the `--nav-h` CSS variable so nothing overlaps.
- "Meri class" is a board+grade pair in notebook prefs (validated together, kept on merge), so it syncs; class shelves show one tile per textbook from cached `syllabi.books`, and a book page is the subject page with `?book=n`, so chapter links never change.
- Install is manifest + PNG icons only (no service worker), so updates never stick behind a stale cache.
- The voice batch is kept alive by `scripts/audio-watchdog.sh`; it skips finished tracks, so restarts never repeat paid work.
- Government recruitment exams use a separate `gov_exam_*` domain and `/competitive` screens; never send them through the NCERT/JEE subject segmentation pipeline. Frequency comes only from reviewed questions in ready original papers, separated by exam, jurisdiction, stage and section; pipeline rules live in `scripts/government/AGENTS.md`.
- External review agent: reads a code snapshot (`agent_code_files`, refresh with `scripts/agent/snapshot.ts`) and submits diffs to `agent_fixes` via key-protected `/api/public/agent`; fixes are applied only by the Lovable agent after review (`scripts/agent/inbox.ts`), never automatically.
