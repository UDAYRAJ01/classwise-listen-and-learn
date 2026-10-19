// Board → class → subject catalog. Pure data, safe for both browser and server.

export type BoardId = "cbse" | "icse";
export type Lang = "en" | "hi" | "hinglish";
export type Tone = "ink" | "coral" | "leaf" | "sun" | "sky" | "rose" | "teal" | "brick";

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export interface BoardMeta {
  id: BoardId;
  name: string;
  short: string;
  books: string;
  tagline: string;
}

export const BOARDS: Record<BoardId, BoardMeta> = {
  cbse: {
    id: "cbse",
    name: "CBSE · NCERT",
    short: "CBSE",
    books: "NCERT textbooks",
    tagline: "NCERT ki books, CBSE pattern",
  },
  icse: {
    id: "icse",
    name: "ICSE · ISC",
    short: "ICSE",
    books: "CISCE syllabus (Selina, Frank, Goyal…)",
    tagline: "CISCE syllabus, ICSE / ISC pattern",
  },
};

export const BOARD_IDS: BoardId[] = ["cbse", "icse"];

export interface SubjectMeta {
  slug: string;
  name: string;
  hi: string;
  icon: string;
  tone: Tone;
}

export const SUBJECTS: Record<string, SubjectMeta> = {
  english: { slug: "english", name: "English", hi: "अंग्रेज़ी", icon: "BookOpen", tone: "sky" },
  hindi: { slug: "hindi", name: "Hindi", hi: "हिंदी", icon: "Languages", tone: "coral" },
  maths: { slug: "maths", name: "Mathematics", hi: "गणित", icon: "Sigma", tone: "ink" },
  evs: { slug: "evs", name: "EVS", hi: "पर्यावरण अध्ययन", icon: "Leaf", tone: "leaf" },
  science: { slug: "science", name: "Science", hi: "विज्ञान", icon: "FlaskConical", tone: "teal" },
  "social-science": {
    slug: "social-science",
    name: "Social Science",
    hi: "सामाजिक विज्ञान",
    icon: "Globe",
    tone: "brick",
  },
  "social-studies": {
    slug: "social-studies",
    name: "Social Studies",
    hi: "सामाजिक अध्ययन",
    icon: "Globe",
    tone: "brick",
  },
  sanskrit: { slug: "sanskrit", name: "Sanskrit", hi: "संस्कृत", icon: "ScrollText", tone: "sun" },
  history: { slug: "history", name: "History", hi: "इतिहास", icon: "Landmark", tone: "brick" },
  geography: { slug: "geography", name: "Geography", hi: "भूगोल", icon: "Mountain", tone: "leaf" },
  "political-science": {
    slug: "political-science",
    name: "Political Science",
    hi: "राजनीति विज्ञान",
    icon: "Scale",
    tone: "ink",
  },
  economics: { slug: "economics", name: "Economics", hi: "अर्थशास्त्र", icon: "TrendingUp", tone: "sun" },
  physics: { slug: "physics", name: "Physics", hi: "भौतिकी", icon: "Atom", tone: "sky" },
  chemistry: { slug: "chemistry", name: "Chemistry", hi: "रसायन विज्ञान", icon: "FlaskConical", tone: "coral" },
  biology: { slug: "biology", name: "Biology", hi: "जीव विज्ञान", icon: "Dna", tone: "leaf" },
  accountancy: { slug: "accountancy", name: "Accountancy", hi: "लेखाशास्त्र", icon: "Calculator", tone: "teal" },
  accounts: { slug: "accounts", name: "Accounts", hi: "लेखाशास्त्र", icon: "Calculator", tone: "teal" },
  commerce: { slug: "commerce", name: "Commerce", hi: "वाणिज्य", icon: "Store", tone: "sun" },
  "business-studies": {
    slug: "business-studies",
    name: "Business Studies",
    hi: "व्यवसाय अध्ययन",
    icon: "Briefcase",
    tone: "brick",
  },
  psychology: { slug: "psychology", name: "Psychology", hi: "मनोविज्ञान", icon: "Brain", tone: "rose" },
  sociology: { slug: "sociology", name: "Sociology", hi: "समाजशास्त्र", icon: "Users", tone: "rose" },
  "computer-science": {
    slug: "computer-science",
    name: "Computer Science",
    hi: "कंप्यूटर विज्ञान",
    icon: "Cpu",
    tone: "ink",
  },
  "physical-education": {
    slug: "physical-education",
    name: "Physical Education",
    hi: "शारीरिक शिक्षा",
    icon: "Dumbbell",
    tone: "coral",
  },
  "english-language": {
    slug: "english-language",
    name: "English Language",
    hi: "अंग्रेज़ी भाषा",
    icon: "PenLine",
    tone: "sky",
  },
  "english-literature": {
    slug: "english-literature",
    name: "English Literature",
    hi: "अंग्रेज़ी साहित्य",
    icon: "BookOpenText",
    tone: "rose",
  },
  "history-civics": {
    slug: "history-civics",
    name: "History & Civics",
    hi: "इतिहास और नागरिक शास्त्र",
    icon: "Landmark",
    tone: "brick",
  },
  computer: { slug: "computer", name: "Computer Studies", hi: "कंप्यूटर", icon: "Monitor", tone: "ink" },
  "computer-applications": {
    slug: "computer-applications",
    name: "Computer Applications",
    hi: "कंप्यूटर एप्लीकेशन्स",
    icon: "Code",
    tone: "ink",
  },
  "commercial-studies": {
    slug: "commercial-studies",
    name: "Commercial Studies",
    hi: "वाणिज्यिक अध्ययन",
    icon: "Store",
    tone: "teal",
  },
};

const CBSE_SENIOR = [
  "physics",
  "chemistry",
  "biology",
  "maths",
  "english",
  "hindi",
  "accountancy",
  "business-studies",
  "economics",
  "history",
  "geography",
  "political-science",
  "psychology",
  "sociology",
  "computer-science",
  "physical-education",
];

const ICSE_MIDDLE = [
  "english-language",
  "english-literature",
  "hindi",
  "maths",
  "physics",
  "chemistry",
  "biology",
  "history-civics",
  "geography",
  "computer",
];

const ISC_SENIOR = [
  "english",
  "physics",
  "chemistry",
  "biology",
  "maths",
  "accounts",
  "commerce",
  "economics",
  "business-studies",
  "history",
  "geography",
  "political-science",
  "psychology",
  "sociology",
  "computer-science",
  "hindi",
];

function subjectsFor(board: BoardId, grade: number): string[] {
  if (board === "cbse") {
    if (grade <= 2) return ["english", "hindi", "maths"];
    if (grade <= 5) return ["english", "hindi", "maths", "evs"];
    if (grade <= 8) return ["english", "hindi", "maths", "science", "social-science", "sanskrit"];
    if (grade <= 10)
      return [
        "english",
        "hindi",
        "maths",
        "science",
        "history",
        "geography",
        "political-science",
        "economics",
        "sanskrit",
      ];
    return CBSE_SENIOR;
  }
  if (grade <= 2) return ["english", "hindi", "maths", "evs", "computer"];
  if (grade <= 5) return ["english", "hindi", "maths", "science", "social-studies", "computer"];
  if (grade <= 8) return ICSE_MIDDLE;
  if (grade <= 10) return [...ICSE_MIDDLE.filter((s) => s !== "computer"), "computer-applications", "economics", "commercial-studies"];
  return ISC_SENIOR;
}

export function isBoard(value: unknown): value is BoardId {
  return value === "cbse" || value === "icse";
}

export function isGrade(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
}

export function parseGrade(value: string | number): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return isGrade(n) ? n : null;
}

export function getSubjects(board: BoardId, grade: number): SubjectMeta[] {
  return subjectsFor(board, grade).map((slug) => SUBJECTS[slug]!);
}

export function getSubject(board: BoardId, grade: number, slug: string): SubjectMeta | null {
  return subjectsFor(board, grade).includes(slug) ? (SUBJECTS[slug] ?? null) : null;
}

export function gradeLabel(board: BoardId, grade: number): string {
  if (board === "icse" && grade >= 11) return `ISC Class ${grade}`;
  return `Class ${grade}`;
}

export function gradeStage(grade: number): "primary" | "middle" | "secondary" | "senior" {
  if (grade <= 5) return "primary";
  if (grade <= 8) return "middle";
  if (grade <= 10) return "secondary";
  return "senior";
}

export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: "hinglish", label: "Hinglish", native: "Hinglish" },
  { id: "hi", label: "Hindi", native: "हिंदी" },
  { id: "en", label: "English", native: "English" },
];

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "hi" || value === "hinglish";
}

export const DEFAULT_LANG: Lang = "hinglish";

export const TONE_CLASSES: Record<Tone, { solid: string; soft: string; text: string; border: string }> = {
  ink: { solid: "bg-tone-ink", soft: "bg-tone-ink/12", text: "text-tone-ink", border: "border-tone-ink" },
  coral: { solid: "bg-tone-coral", soft: "bg-tone-coral/12", text: "text-tone-coral", border: "border-tone-coral" },
  leaf: { solid: "bg-tone-leaf", soft: "bg-tone-leaf/12", text: "text-tone-leaf", border: "border-tone-leaf" },
  sun: { solid: "bg-tone-sun", soft: "bg-tone-sun/15", text: "text-tone-sun", border: "border-tone-sun" },
  sky: { solid: "bg-tone-sky", soft: "bg-tone-sky/12", text: "text-tone-sky", border: "border-tone-sky" },
  rose: { solid: "bg-tone-rose", soft: "bg-tone-rose/12", text: "text-tone-rose", border: "border-tone-rose" },
  teal: { solid: "bg-tone-teal", soft: "bg-tone-teal/12", text: "text-tone-teal", border: "border-tone-teal" },
  brick: { solid: "bg-tone-brick", soft: "bg-tone-brick/12", text: "text-tone-brick", border: "border-tone-brick" },
};
