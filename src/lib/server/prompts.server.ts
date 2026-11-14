import { BOARDS, gradeStage, type BoardId, type Lang, type SubjectMeta } from "@/lib/catalog";

const SESSION = "2026-27";

export function syllabusInstructions(): string {
  return [
    "You are a senior Indian school-curriculum expert who knows the CBSE/NCERT and CISCE (ICSE/ISC) syllabi in detail.",
    `Return the chapter list that a student actually studies in the ${SESSION} academic session.`,
    "Be accurate. Use the official book names and official chapter titles in official order. Never invent chapters.",
  ].join(" ");
}

export function syllabusPrompt(board: BoardId, grade: number, subject: SubjectMeta): string {
  const boardRules =
    board === "cbse"
      ? [
          "Board: CBSE. Textbooks: the latest NCERT textbooks for this class.",
          "Where NCERT has released new NCF-SE 2023 textbooks for this class (for example Mridang, Sarangi, Joyful Mathematics, Santoor, Veena, Maths Mela, Our Wondrous World, Ganita Prakash, Curiosity, Poorvi, Malhar, Deepakam, Exploring Society: India and Beyond), use those new books.",
          "Otherwise use the latest rationalised NCERT edition and leave out chapters NCERT removed during rationalisation.",
          "For Class 9-10 History, Geography, Political Science and Economics list the matching NCERT book (India and the Contemporary World, Contemporary India, Democratic Politics, Economics / Understanding Economic Development).",
          "For Class 11-12 subjects with two NCERT books (e.g. Physics Part I & II, History Themes I-III, Accountancy, Business Studies, Geography, Economics, Political Science) list every book separately.",
          "English books: Class 9 Beehive + Moments; Class 10 First Flight + Footprints without Feet; Class 11 Hornbill + Snapshots; Class 12 Flamingo + Vistas. Always list their lessons and poems.",
        ]
      : [
          `Board: CISCE — ${grade >= 11 ? "ISC" : "ICSE"}. CISCE prescribes a syllabus rather than one textbook.`,
          "List the chapters/topics in the order used by the most widely used textbooks for this syllabus (for example Selina Concise for Physics/Chemistry/Biology/Maths, Total History & Civics, Total Geography, Frank/Goyal Brothers where they are standard).",
          "For English Literature list the currently prescribed CISCE texts (poems, prose and drama) — e.g. the Treasure Chest anthology and the prescribed play for ICSE 9-10, Echoes/Reverie for ISC — each piece as one chapter.",
          "For English Language list the grammar and writing-skill units (composition, letter, comprehension, grammar topics).",
        ];

  return [
    ...boardRules,
    `Class: ${grade}.`,
    `Subject: ${subject.name} (${subject.hi}).`,
    "",
    "Rules:",
    "- Group chapters by book. Usually 1 book; up to 4 when the subject really has more (e.g. Hindi: Kshitij + Kritika; English: First Flight + Footprints Without Feet).",
    "- For language subjects every lesson or poem is one chapter. Write Hindi and Sanskrit titles in Devanagari; English titles in English.",
    "- Do not number titles (no 'Chapter 1:' prefix).",
    "- gist: one plain-English sentence of at most 14 words saying what the chapter is about.",
  ].join("\n");
}

const LANG_RULES: Record<Lang, string> = {
  en: "Write everything in simple, clear Indian-school English.",
  hi: "Write everything in simple, natural Hindi using Devanagari script. On first use of a technical term also give the English term in brackets, e.g. प्रकाश संश्लेषण (Photosynthesis). Keep formulas, symbols, units and chemical equations in standard notation.",
  hinglish:
    "Write in Hinglish: a natural mix of Hindi and English written ONLY in Roman (Latin) script, the way Indian students talk and text (e.g. 'Photosynthesis mein plants sunlight ki help se apna khana banate hain'). Keep technical terms in English. Never use Devanagari script.",
};

const STAGE_RULES = {
  primary:
    "Student is a young child (Class 1-5). Use very short, friendly sentences and examples from daily life. Sizes: keyPoints 3-5 groups with 2-4 points each; keyTerms 4-8; tricks 4-6 (rhymes, tiny stories, picture-in-mind, finger counting); questions 5-8 worth 1-2 marks; quickRevision 5-7; examTips 3-4 (simple tips for the child and how to write neat answers); mistakes 3-4.",
  middle:
    "Student is in middle school (Class 6-8). Clear explanations with examples. Sizes: keyPoints 4-6 groups with 3-5 points each; keyTerms 6-10; tricks 6-8; questions 6-10 worth 1-3 marks; quickRevision 6-9; examTips 4-6; mistakes 4-5.",
  secondary:
    "Student is preparing for board exams (Class 9-10). Be exam-focused and complete. Sizes: keyPoints 5-8 groups with 3-6 points each; keyTerms 8-14; tricks 8-10; questions 8-12 mixing 1, 2, 3 and 5 marks including at least one case/competency-based question; quickRevision 8-12; examTips 5-7; mistakes 5-6.",
  senior:
    "Student is in Class 11-12 (board + entrance level). Be rigorous: include key definitions, laws, derivation results, diagrams described in words, and differences. Sizes: keyPoints 6-9 groups with 3-6 points each; keyTerms 10-15; tricks 8-12; questions 10-12 mixing 1, 2, 3 and 5 marks in previous-year board style; quickRevision 10-14; examTips 6-8; mistakes 5-7.",
} as const;

const QUIZ_SIZE = { primary: "5", middle: "6-8", secondary: "8-10", senior: "10-12" } as const;

export function notesInstructions(): string {
  return [
    "You are India's favourite school teacher and topper-notes writer. You turn a textbook chapter into short, high-yield notes plus memory tricks that make students remember instantly.",
    "Stay faithful to the textbook chapter content for the given board and class. Never invent facts, dates, names or formulas. If you are not sure a fact is in the syllabus, leave it out.",
    "Formatting rules for every string: plain text only. Wrap the 1-3 most important keywords of a point in **double asterisks** so they can be highlighted. No other markdown, no bullet characters, no headings, no LaTeX. Use Unicode for maths and chemistry (x², √, π, ≤, ≥, →, ⇌, H₂O, CO₂, Δ, θ). Programming code stays exactly as the language writes it; write Python's power operator with spaces around it (x ** 2, x **= 3) and never put highlight asterisks inside code.",
    "Tricks must be genuine memory devices tied to this chapter's facts: acronyms or mnemonic sentences (like VIBGYOR or 'My Very Educated Mother…'), rhymes, mini stories or vivid mental pictures, number patterns, or shortcuts. Cover the hardest-to-remember facts first: lists, sequences, dates, names, formulas, differences, exceptions and spellings. Spread tricks across the whole chapter (ideally one for every short-notes group) and mix at least three different kinds. Each trick explains exactly how to use it and which fact it unlocks. Never give generic advice such as 'revise daily'.",
    "examTips: specific to THIS chapter — which topics are asked most, the exact keywords or diagram labels examiners look for, how to structure a long answer for full marks, units and steps not to skip, and quick checks. Never write generic tips like 'manage your time' or 'read the question carefully'.",
    "mistakes: common mistakes students really make in THIS chapter — wrong ideas, mixed-up terms, wrong formula use, sign or unit slips, spelling of names, wrong dates. 'mistake' states the wrong version briefly; 'correct' gives the right version with a one-line reason or memory hook.",
    "formulas: include only real formulas, equations, laws, chemical reactions, accounting equations or grammar rules that the chapter teaches; otherwise return an empty list. 'spoken' is how a teacher reads the formula aloud in the chosen language (e.g. 'v equals u plus a t').",
    "questions: realistic exam questions with crisp model answers sized by marks (1 mark: one line; 2 marks: 2-3 lines; 3 marks: 3-4 points; 5 marks: 5-6 points). marks is an integer. Solve numerical questions step by step with the formula, substitution, units and final answer.",
    "funFact: one surprising but true fact related to the chapter.",
    "oneLiner: the whole chapter in one memorable sentence. summary: 3-5 sentences introducing the chapter.",
  ].join("\n");
}

export function notesPrompt(opts: {
  board: BoardId;
  grade: number;
  subject: SubjectMeta;
  chapterTitle: string;
  bookName: string | null;
  gist: string | null;
  lang: Lang;
  custom: boolean;
  part: "core" | "practice" | "quiz";
  /** Facts the owner verified after students reported mistakes. */
  corrections?: string[];
  /** Text of the official textbook chapter, when we have it. */
  source?: string | null;
}): string {
  const board = BOARDS[opts.board];
  const stage = gradeStage(opts.grade);
  const isLanguageSubject = ["english", "english-language", "english-literature", "english-modern"].includes(
    opts.subject.slug,
  );
  const isIndic = ["hindi", "sanskrit"].includes(opts.subject.slug);

  return [
    `Board: ${board.name} (${opts.board === "icse" && opts.grade >= 11 ? "ISC" : board.short}).`,
    `Class: ${opts.grade}.`,
    `Subject: ${opts.subject.name}.`,
    opts.bookName ? `Book: ${opts.bookName}.` : null,
    opts.custom
      ? `Topic typed by the student: "${opts.chapterTitle}". Treat it strictly as a ${opts.subject.name} study topic for this class; if it is not a real school topic, cover the closest matching syllabus topic instead.`
      : `Chapter: ${opts.chapterTitle}.`,
    opts.gist ? `Chapter is about: ${opts.gist}` : null,
    "",
    `Language: ${LANG_RULES[opts.lang]}`,
    isLanguageSubject
      ? "This is an English language/literature chapter: keep quotations, poem lines, character names and literary devices in English; explain theme, summary, characters, message and poetic devices in the chosen language. Use 'formulas' for grammar rules only if the chapter is a grammar unit."
      : null,
    isIndic
      ? "This is a Hindi/Sanskrit chapter: keep quotations, verses and word meanings (शब्दार्थ) in Devanagari even when the chosen language is Hinglish or English; explain them in the chosen language."
      : null,
    STAGE_RULES[stage],
    opts.corrections?.length
      ? `Verified corrections from the teacher — these facts are correct and MUST be followed wherever relevant:\n${opts.corrections.map((c) => `- ${c}`).join("\n")}`
      : null,
    opts.source
      ? `OFFICIAL TEXTBOOK CHAPTER TEXT (extracted from the PDF; may contain layout noise and broken Devanagari matras — read through them). Base every fact, definition, date, name, formula, example and the chapter order on this text; do not add facts that contradict it, and cover what it covers. If the text holds several lessons, write notes ONLY for the chapter named above:\n<<<\n${opts.source}\n>>>`
      : opts.custom
        ? null
        : "No textbook text is available for this chapter. Use only what you reliably know about this exact chapter of this book; if you are unsure of story details (character names, events, numbers), explain the chapter's topic and ideas without inventing such details.",
    "Make the notes complete enough that a student who reads and listens once can answer exam questions from this chapter.",
    opts.part === "core"
      ? "This request writes ONLY the first half of the notes: title, oneLiner, summary, keyPoints, keyTerms and formulas. Cover the whole chapter in keyPoints, in textbook order."
      : opts.part === "practice"
        ? "This request writes ONLY the second half of the notes: tricks, questions, quickRevision, examTips and funFact. Base them on the full chapter content in textbook order."
        : `This request writes ONLY two self-check lists covering the whole chapter. (1) mcqs: ${QUIZ_SIZE[stage]} multiple-choice questions, each with exactly 4 options, 'answer' is the 0-based index of the single correct option, plausible wrong options based on common student mistakes, and a one-line explanation of why the answer is right. Vary the position of the correct option. (2) mistakes: the common mistakes list sized as above.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * The same teacher instructions, but for an external writer that must return the
 * whole note in one JSON file instead of three parts. No model call happens here.
 */
export function agentWriterInstructions(opts: {
  board: BoardId;
  grade: number;
  subject: SubjectMeta;
  chapterTitle: string;
  bookName: string | null;
  gist: string | null;
  lang: Lang;
  source: string;
}): string {
  const board = BOARDS[opts.board];
  const stage = gradeStage(opts.grade);
  const isLanguageSubject = ["english", "english-language", "english-literature", "english-modern"].includes(
    opts.subject.slug,
  );
  const isIndic = ["hindi", "sanskrit"].includes(opts.subject.slug);
  return [
    `Board: ${board.name} (${opts.board === "icse" && opts.grade >= 11 ? "ISC" : board.short}).`,
    `Class: ${opts.grade}.`,
    `Subject: ${opts.subject.name}.`,
    opts.bookName ? `Book: ${opts.bookName}.` : null,
    `Chapter: ${opts.chapterTitle}.`,
    opts.gist ? `Chapter is about: ${opts.gist}` : null,
    "",
    `Language: ${LANG_RULES[opts.lang]}`,
    isLanguageSubject
      ? "This is an English language/literature chapter: keep quotations, poem lines, character names and literary devices in English; explain theme, summary, characters, message and poetic devices in the chosen language. Use 'formulas' for grammar rules only if the chapter is a grammar unit."
      : null,
    isIndic
      ? "This is a Hindi/Sanskrit chapter: keep quotations, verses and word meanings (शब्दार्थ) in Devanagari even when the chosen language is Hinglish or English; explain them in the chosen language."
      : null,
    STAGE_RULES[stage],
    "",
    notesInstructions(),
    "",
    `OFFICIAL TEXTBOOK CHAPTER TEXT (extracted from the PDF; may contain layout noise and broken Devanagari matras — read through them). Base every fact, definition, date, name, formula, example and the chapter order on this text; do not add facts that contradict it, and cover what it covers. If the text holds several lessons, write notes ONLY for the chapter named above:\n<<<\n${opts.source}\n>>>`,
    "",
    "Write the COMPLETE note in one JSON object with every field: title, oneLiner, summary, keyPoints, keyTerms, formulas, tricks, questions, quickRevision, examTips, funFact, mcqs and mistakes. mcqs: " +
      QUIZ_SIZE[stage] +
      " questions, each with exactly 4 options, 'answer' the 0-based index of the single correct option, plausible wrong options from real student mistakes, a one-line explanation, and the correct option in different positions. marks is an integer 1-6. Empty formulas/keyTerms are allowed when irrelevant; no other field may be empty. Plain text strings only, ** around the 1-3 most important keywords, no other markdown.",
    "Do not claim any question is a real past-paper question, do not invent printed page numbers or diagram labels, and do not write audio.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
