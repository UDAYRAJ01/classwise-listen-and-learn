# PadhoSuno — Roadmap

Class 1–12 short notes + memory tricks + audio for CBSE/NCERT and ICSE/ISC.

## Done
- [x] Design system, subject catalog for every class (CBSE/NCERT + ICSE/ISC)
- [x] AI chapter lists per subject (cached, streamed while writing)
- [x] AI notes per chapter: summary, short notes, key terms, formulas, tricks, important Q&A, quick revision, exam tips (streamed, cached, written in parallel parts)
- [x] 3 languages: Hinglish, Hindi, English
- [x] Audio per section with instant start, cached, read-along highlight, speed, Didi/Bhaiya voices, phone-voice fallback, lock-screen controls
- [x] Custom topic box, My Notebook (saved, recent, "yaad ho gaya"), flashcards, quiz, search, share, print
- [x] Rate limiting, SEO tags, tests
- [x] Exam Mode, mistake reports + owner page, streaks
- [x] Optional student login that syncs the notebook across devices
- [x] CBSE Class 9–12 chapter lists rebuilt from the official NCERT chapter PDFs (+ textbook links, covers)
- [x] AI tutor "Guru se poochho" that searches the stored NCERT books
- [x] Professional look
- [x] Read tracking: chapter auto-marked "Padh liya" once every part is read or heard; manual mark; read / left counts + filters on subject, class, notebook pages; status on recent cards
- [x] More tricks & tips: up to 14 tricks, 10 exam tips, new "Ye galti mat karna" (common mistakes) part in notes + audio
- [x] Textbook checker (catches wrong facts, wrong quiz answers, wrong tricks, missing topics) + shared note pipeline

## In progress (request of 25 Oct: verify everything, more tricks & tips, read tracking)
- [ ] Background run `scripts/verify-notes.ts`: every CBSE 9–12 chapter (Hinglish) + every stored note rewritten in the new format, checked against the textbook and fixed (749 jobs; reruns skip finished chapters)
- [ ] CBSE Class 1–8 chapter lists from the official NCERT books (+ textbook text for checking)
- [ ] ICSE/ISC chapter lists cross-checked against the official CISCE syllabus
- [ ] Full app check: every page opens without errors on phone and laptop

## Ready next
- Owner page: show textbook-check results per chapter (how many fixed, what is left)
- Pre-make didi-voice audio for all notes (after the notes check finishes, so audio is never made for notes that change)
- Download a chapter's audio for offline listening (needs a smaller audio format than today's files)
