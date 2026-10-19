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
- Saved chapters, history, "done" marks and listening preferences are per-device in localStorage (`src/lib/notebook-store.ts`); there are no user accounts.
- Every fresh AI generation passes the per-visitor hourly limit in `src/lib/server/rate-limit.server.ts`; cached reads never count.
- Chapter slugs are positional (`b{book}-c{chapter}-title`); typed topics use `t-…-hash` and must match `customTopicSlug(title)` on the server.
- Student mistake reports go to `note_reports` through a rate-limited server function; the table has no public policies and is read only from the backend.
