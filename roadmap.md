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
- [x] Chapter names stored in ALL CAPS / lower case tidied to Title Case (157 names; links unchanged)

## In progress (request of 26 Oct: JEE / NEET section for Class 11–12)
- [x] Real past papers 2017–2026: JEE Advanced both papers every year (official); NEET every year (one code); JEE Main 2 shifts per year (2017–2026); answers labelled official / coaching / none
- [x] Paper reader: every question with text, options, answer, page and figure position; subject fixed from the paper's subject blocks; answer forms like "AC", "A or B", ranges
- [x] NCERT location index: sections, examples, exercises, figures, tables of Class 11–12 PCMB with printed page (5,893 places)
- [x] Pages: /exam → /exam/jee|neet (chapters by weightage, due revisions) → chapter index (concepts, asked questions, one-screen revision, NCERT links, real paper image); "Revise kiya" spaced revision synced in the notebook; menu + home + chapter-page links
- [x] On-demand solution + trick + "is sawal mein kya tha" + trap, checked against the key (or solved twice when no key)
- [x] Re-read all papers with the new subject-block rule + read the 4 new papers (NEET 2024, JEE Main Jan 2023, Jan + Apr 2026): 50 papers, 4,642 questions
- [x] Second re-read from cache: exact per-subject counts (JEE a third each, NEET 1/4–1/4–1/2), missing shared paragraphs / List-I–II tables added, keys printed as option values ("(12)") read, chapter mapping kept for unchanged questions
- [x] Dropped NCERT units (p-Block, Solid State, Communication Systems…) get their own page with all 352 asked questions
- [x] Map every question to its NCERT chapter (3,912 in current NCERT; 730 on removed topics, 378 of them placed in their unit's chapter under "Purane syllabus ke sawal" and left out of weightage)
- [ ] Concepts per chapter + NCERT example/exercise claims checked against the book text — running: `bun scripts/exam/analyze.ts --stage=concepts --workers=5`
- [ ] Written index per chapter + expert review against the NCERT chapter: `--stage=index`
- [x] Browser check of the full flow with real data (chapter page, revision, asked questions, solution + key match, paper figure); solutions now name options as printed ((1)–(4) for Main/NEET)

## In progress (request of 25 Oct: verify everything, more tricks & tips, read tracking)
- [x] Re-check CBSE Class 10–12 Hindi + Class 10 Sanskrit from the now-readable book text (80 of 80 chapters written + checked)
- [x] Second pass for Class 11–12 Hindi chapters converted late
- [x] Class 11 History "Nomadic Empires": text split out of the Chapter 2 PDF, textbook link fixed, notes written + checked
- [x] Class 11 Hindi Vitan: dropped "लेखकों के बारे में" (an appendix, not a chapter)
- [x] Bold-word parser: "**=**", "**;**", unclosed highlights and p*** handled; Python/Java stars kept
- [ ] ICSE/ISC: still unverified — ICSE 9 Hindi split & drama/novel, ICSE 9 Commercial Studies full list, Computer Applications 9–10, ICSE 1–8 lists; ISC 11 Accounts, Chemistry, Geography, Physics, Psychology; ISC 12 Accounts, Business Studies, Commerce, Computer Science, Economics, History titles, Maths, Physics (exact publisher contents pages not reachable; cisce.org blocks downloads from here)
- [ ] CBSE Class 8 Social Science Part 2 (revised July 2026): chapter list stored, textbook text not reachable yet

## Ready next
- JEE Main: add more shifts per year (each year has 10–20 shifts; we use 2)
- JEE Main 2026 Jan 24 source has only 21 of 25 Maths questions; find a complete copy
- JEE Advanced 2018, 2020, 2021: official answer keys not found yet (solutions are solved twice and shown only when both agree)
- Pre-make solutions for the most-asked questions so the first click is instant
- Official covers for Class 1–8 NCERT books
- Pre-make didi-voice audio for all notes with `scripts/audio-batch.ts` (only checked notes; ~1,200 chapters, many hours + AI credits) — not started; user paused work on 25 Oct
