// Turns a finished note into ordered audio "tracks". Each track maps to one
// visible block so playback can highlight what is being read. The server
// rebuilds the same list to decide what text to speak, so clients can never
// send arbitrary text to the voice service.

import type { Lang } from "./catalog";
import { sentence } from "./text";
import type { NoteContent } from "./types";

export interface Track {
  index: number;
  blockId: string;
  label: string;
  text: string;
  /** For playlists that mix notes: which note and which of its parts to play. */
  noteId?: string;
  sourceIndex?: number;
}

export const TERMS_PER_TRACK = 6;

const SPOKEN: Record<
  Lang,
  {
    intro: string;
    terms: string;
    formulas: string;
    trick: string;
    mistakes: string;
    wrong: string;
    right: string;
    question: string;
    answer: string;
    revision: string;
    tips: string;
    fun: string;
    part: string;
  }
> = {
  en: {
    intro: "Introduction",
    terms: "Important terms",
    formulas: "Formulas",
    trick: "Memory trick",
    mistakes: "Common mistakes to avoid",
    wrong: "Mistake",
    right: "Correct",
    question: "Question",
    answer: "Answer",
    revision: "Quick revision",
    tips: "Exam tips",
    fun: "Fun fact",
    part: "part",
  },
  hi: {
    intro: "परिचय",
    terms: "महत्वपूर्ण शब्द",
    formulas: "सूत्र",
    trick: "याद करने की ट्रिक",
    mistakes: "ये गलतियाँ मत करना",
    wrong: "गलती",
    right: "सही",
    question: "प्रश्न",
    answer: "उत्तर",
    revision: "झटपट दोहराव",
    tips: "परीक्षा टिप्स",
    fun: "मज़ेदार तथ्य",
    part: "भाग",
  },
  hinglish: {
    intro: "Shuruaat",
    terms: "Important words",
    formulas: "Formulas",
    trick: "Yaad karne ki trick",
    mistakes: "Ye galtiyan mat karna",
    wrong: "Galti",
    right: "Sahi",
    question: "Sawaal",
    answer: "Jawaab",
    revision: "Quick revision",
    tips: "Exam tips",
    fun: "Mazedaar fact",
    part: "part",
  },
};

export function spokenLabels(lang: Lang) {
  return SPOKEN[lang];
}

export function buildTracks(note: NoteContent, lang: Lang): Track[] {
  const L = SPOKEN[lang];
  const tracks: Omit<Track, "index">[] = [];

  tracks.push({
    blockId: "intro",
    label: L.intro,
    text: [sentence(note.title), sentence(note.oneLiner), sentence(note.summary)]
      .filter(Boolean)
      .join(" "),
  });

  note.keyPoints.forEach((group, i) => {
    const text = [sentence(group.heading), ...group.points.map(sentence)].filter(Boolean).join(" ");
    if (text)
      tracks.push({ blockId: `kp-${i}`, label: sentence(group.heading).replace(/\.$/, ""), text });
  });

  for (let start = 0; start < note.keyTerms.length; start += TERMS_PER_TRACK) {
    const chunk = note.keyTerms.slice(start, start + TERMS_PER_TRACK);
    const part = start / TERMS_PER_TRACK;
    const label =
      note.keyTerms.length > TERMS_PER_TRACK ? `${L.terms} — ${L.part} ${part + 1}` : L.terms;
    tracks.push({
      blockId: `terms-${part}`,
      label,
      text: [
        sentence(label),
        ...chunk.map((t) => `${sentence(t.term).replace(/\.$/, ":")} ${sentence(t.meaning)}`),
      ].join(" "),
    });
  }

  if (note.formulas.length > 0) {
    tracks.push({
      blockId: "formulas",
      label: L.formulas,
      text: [
        sentence(L.formulas),
        ...note.formulas.map((f) =>
          [
            `${sentence(f.name).replace(/\.$/, ":")} ${sentence(f.spoken || f.formula)}`,
            sentence(f.note),
          ]
            .filter(Boolean)
            .join(" "),
        ),
      ].join(" "),
    });
  }

  note.tricks.forEach((t, i) => {
    tracks.push({
      blockId: `trick-${i}`,
      label: `${L.trick}: ${sentence(t.title).replace(/\.$/, "")}`,
      text: [`${L.trick}: ${sentence(t.title)}`, sentence(t.trick), sentence(t.explanation)]
        .filter(Boolean)
        .join(" "),
    });
  });

  // Older notes have no mistakes list, so their part numbers stay unchanged.
  const mistakes = note.mistakes ?? [];
  if (mistakes.length > 0) {
    tracks.push({
      blockId: "mistakes",
      label: L.mistakes,
      text: [
        sentence(L.mistakes),
        ...mistakes.map(
          (m) =>
            `${L.wrong}: ${sentence(m.mistake)} ${L.right}: ${sentence(m.correct)}`,
        ),
      ].join(" "),
    });
  }

  note.questions.forEach((q, i) => {
    tracks.push({
      blockId: `q-${i}`,
      label: `${L.question} ${i + 1}`,
      text: `${L.question} ${i + 1}: ${sentence(q.question)} ${L.answer}: ${sentence(q.answer)}`,
    });
  });

  if (note.quickRevision.length > 0) {
    tracks.push({
      blockId: "revision",
      label: L.revision,
      text: [sentence(L.revision), ...note.quickRevision.map(sentence)].join(" "),
    });
  }

  const tipParts = [
    ...(note.examTips.length ? [sentence(L.tips), ...note.examTips.map(sentence)] : []),
    ...(note.funFact ? [`${L.fun}: ${sentence(note.funFact)}`] : []),
  ];
  if (tipParts.length) {
    tracks.push({
      blockId: "tips",
      label: note.examTips.length ? L.tips : L.fun,
      text: tipParts.join(" "),
    });
  }

  return tracks.filter((t) => t.text.trim().length > 0).map((t, index) => ({ ...t, index }));
}

export function speechLang(lang: Lang): string {
  return lang === "en" ? "en-IN" : "hi-IN";
}
