// Strict JSON schemas for structured AI output (all properties required,
// additionalProperties false, object root).

const str = { type: "string" } as const;

export const syllabusJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["books"],
  properties: {
    books: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "chapters"],
        properties: {
          name: str,
          chapters: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "gist"],
              properties: { title: str, gist: str },
            },
          },
        },
      },
    },
  },
} as const;

export const noteJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "oneLiner",
    "summary",
    "keyPoints",
    "keyTerms",
    "formulas",
    "tricks",
    "questions",
    "quickRevision",
    "examTips",
    "funFact",
    "mcqs",
  ],
  properties: {
    title: str,
    oneLiner: str,
    summary: str,
    keyPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "points"],
        properties: { heading: str, points: { type: "array", items: str } },
      },
    },
    keyTerms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "meaning"],
        properties: { term: str, meaning: str },
      },
    },
    formulas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "formula", "spoken", "note"],
        properties: { name: str, formula: str, spoken: str, note: str },
      },
    },
    tricks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "trick", "explanation"],
        properties: {
          title: str,
          kind: {
            type: "string",
            enum: ["acronym", "rhyme", "story", "visual", "pattern", "shortcut"],
          },
          trick: str,
          explanation: str,
        },
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer", "marks"],
        properties: { question: str, answer: str, marks: { type: "integer" } },
      },
    },
    quickRevision: { type: "array", items: str },
    examTips: { type: "array", items: str },
    funFact: str,
    mcqs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "options", "answer", "explanation"],
        properties: {
          question: str,
          options: { type: "array", items: str },
          answer: { type: "integer" },
          explanation: str,
        },
      },
    },
  },
} as const;

/** Notes are written in two halves at the same time to halve waiting time. */
const pick = (keys: readonly (keyof typeof noteJsonSchema.properties)[]) => ({
  type: "object",
  additionalProperties: false,
  required: [...keys],
  properties: Object.fromEntries(keys.map((k) => [k, noteJsonSchema.properties[k]])),
});

export const NOTE_PART_KEYS = {
  core: ["title", "oneLiner", "summary", "keyPoints", "keyTerms", "formulas"],
  practice: ["tricks", "questions", "quickRevision", "examTips", "funFact"],
  quiz: ["mcqs"],
} as const;

export const notePartSchemas = {
  core: pick(NOTE_PART_KEYS.core),
  practice: pick(NOTE_PART_KEYS.practice),
  quiz: pick(NOTE_PART_KEYS.quiz),
};
