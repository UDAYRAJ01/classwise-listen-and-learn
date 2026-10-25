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
- [x] Full app check: every page opens without errors on phone and laptop
- [x] Read tracking: chapter auto-marked "Padh liya" once every part is read or heard; manual mark; read / left counts + filters on subject, class, notebook pages; status on recent cards
- [x] More tricks & tips: up to 14 tricks, 10 exam tips, new "Ye galti mat karna" (common mistakes) part in notes + audio
- [x] Textbook checker (catches wrong facts, wrong quiz answers, wrong tricks, missing topics) + shared note pipeline
- [x] CBSE Class 1–8 chapter lists rebuilt from the official NCERT chapter PDFs (36 subjects, every lesson incl. two-lesson PDFs and Poorvi units) + textbook text stored for notes, tutor and checking
- [x] ICSE Class 9 English Literature: Julius Caesar limited to Acts I–II (2026-27 split)
- [x] ICSE Class 9–10 lists corrected against current textbook contents + 2026-27 school syllabi (Biology, Maths, History & Civics, Geography, Economics, Chemistry, Commercial Studies 10, Hindi 10 split)
- [x] Offline audio: "Audio download karo" saves the whole chapter (or Exam Mode revision) as one file to play without internet
- [x] ISC Class 11–12 lists corrected against 2026-27 school syllabi + current syllabus transcriptions: Class 11 Biology, Business Studies (857, Commerce renamed), new Entrepreneurship (859), Computer Science (Java + Python), Economics, History, Maths, Political Science, Sociology, English title, Hindi split + Sara Aakash; Class 12 Hindi titles; new English Literature (Modern, 891) for 11 and 12
- [x] Old ISC Class 11 Commerce links open Business Studies
- [x] CBSE Class 1–8 (496) and Class 9–12 (613 of 614) chapter notes written and checked against the textbook
- [x] Fixed: Python power sign ** was disappearing from notes, quiz options and the checker (affected programming chapters re-checked)
- [x] AI tutor: "Meri class" picker; searches that class's books first and answers at that level

## In progress (request of 25 Oct: verify everything, more tricks & tips, read tracking)
- [ ] Re-check CBSE Class 10–12 Hindi + Class 10 Sanskrit from the now-readable book text — PAUSED by the user on 25 Oct 14:06 UTC. Done: Hindi 36/70, Sanskrit 9/10. Left: 26 Hindi chapters still on old notes, 8 Hindi chapters with no notes (written on first visit), 1 Sanskrit chapter unchecked. Resume: `bun run scripts/verify-notes.ts --board=cbse --grades=10-12 --subject=hindi --rewrite-before=2026-10-25T13:55:32Z` (and `--grades=10-10 --subject=sanskrit`)
- [ ] Second pass for 24 Class 11–12 Hindi chapters converted late (list in /tmp/verify/second-pass.txt): `--only=<list> --rewrite-before=2026-10-25T14:12:00Z` once the current Hindi runs finish
- [x] Class 11 History "Nomadic Empires": text split out of the Chapter 2 PDF, textbook link fixed, notes written + checked
- [x] Class 11 Hindi Vitan: dropped "लेखकों के बारे में" (an appendix, not a chapter)
- [x] Bold-word parser: "**=**", "**;**", unclosed highlights and p*** handled; Python/Java stars kept
- [ ] ICSE/ISC: still unverified — ICSE 9 Hindi split & drama/novel, ICSE 9 Commercial Studies full list, Computer Applications 9–10, ICSE 1–8 lists; ISC 11 Accounts, Chemistry, Geography, Physics, Psychology; ISC 12 Accounts, Business Studies, Commerce, Computer Science, Economics, History titles, Maths, Physics (exact publisher contents pages not reachable; cisce.org blocks downloads from here)
- [ ] CBSE Class 8 Social Science Part 2 (revised July 2026): chapter list stored, textbook text not reachable yet

## Ready next
- Official covers for Class 1–8 NCERT books
- Pre-make didi-voice audio for all notes with `scripts/audio-batch.ts` (only checked notes; ~1,200 chapters, many hours + AI credits) — not started; user paused work on 25 Oct
