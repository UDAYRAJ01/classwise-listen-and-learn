// Official NCERT textbooks (2026-27 session) for CBSE Classes 9–12, in reading order.
// `code` is NCERT's book code; `files` is how many chapter PDFs NCERT publishes.
// Chapter n of a book is the PDF ncert.nic.in/textbook/pdf/{code}{nn}.pdf.

export interface NcertBook {
  code: string;
  name: string;
  files: number;
}

const b = (code: string, name: string, files: number): NcertBook => ({ code, name, files });

export const NCERT_BOOKS: Record<string, NcertBook[]> = {
  "9/english": [b("iebe1", "Kaveri", 8)],
  "9/hindi": [b("ihga1", "गंगा", 12)],
  "9/sanskrit": [b("ihsh1", "शारदा", 16)],
  "9/maths": [b("iemh1", "Ganita Manjari — Part I", 8), b("iemh2", "Ganita Manjari — Part II", 6)],
  "9/science": [b("iesc1", "Exploration", 13)],
  "9/social-science": [
    b("iest1", "Understanding Society: India and Beyond — Part I", 9),
    b("iest2", "Understanding Society: India and Beyond — Part II", 6),
  ],

  "10/english": [b("jeff1", "First Flight", 9), b("jefp1", "Footprints without Feet", 9)],
  "10/hindi": [
    b("jhks1", "क्षितिज भाग 2", 12),
    b("jhsp1", "स्पर्श भाग 2", 14),
    b("jhkr1", "कृतिका भाग 2", 3),
    b("jhsy1", "संचयन भाग 2", 3),
  ],
  "10/sanskrit": [b("jhsk1", "शेमुषी — द्वितीयो भागः", 10)],
  "10/maths": [b("jemh1", "Mathematics", 14)],
  "10/science": [b("jesc1", "Science", 13)],
  "10/history": [b("jess3", "India and the Contemporary World – II", 5)],
  "10/geography": [b("jess1", "Contemporary India – II", 7)],
  "10/political-science": [b("jess4", "Democratic Politics – II", 5)],
  "10/economics": [b("jess2", "Understanding Economic Development", 5)],

  "11/accountancy": [b("keac1", "Financial Accounting – I", 7), b("keac2", "Accountancy – II", 2)],
  "11/biology": [b("kebo1", "Biology", 19)],
  "11/business-studies": [b("kebs1", "Business Studies", 11)],
  "11/chemistry": [b("kech1", "Chemistry Part I", 6), b("kech2", "Chemistry Part II", 3)],
  "11/computer-science": [b("kecs1", "Computer Science", 11)],
  "11/economics": [
    b("kest1", "Statistics for Economics", 8),
    b("keec1", "Indian Economic Development", 8),
  ],
  "11/english": [b("kehb1", "Hornbill", 14), b("kesp1", "Snapshots", 5)],
  "11/geography": [
    b("kegy2", "Fundamentals of Physical Geography", 14),
    b("kegy1", "India: Physical Environment", 6),
    b("kegy3", "Practical Work in Geography – Part I", 6),
  ],
  "11/hindi": [b("khar1", "आरोह भाग 1", 16), b("khvt1", "वितान भाग 1", 5)],
  "11/history": [b("kehs1", "Themes in World History", 7)],
  "11/maths": [b("kemh1", "Mathematics", 14)],
  "11/physical-education": [b("kehp1", "Health and Physical Education", 11)],
  "11/physics": [b("keph1", "Physics Part I", 7), b("keph2", "Physics Part II", 7)],
  "11/political-science": [
    b("keps2", "Indian Constitution at Work", 10),
    b("keps1", "Political Theory", 8),
  ],
  "11/psychology": [b("kepy1", "Introduction to Psychology", 8)],
  "11/sociology": [b("kesy1", "Introducing Sociology", 5), b("kesy2", "Understanding Society", 5)],

  "12/accountancy": [
    b("leac1", "Accountancy Part I", 4),
    b("leac2", "Accountancy Part II", 6),
    b("leca1", "Computerised Accounting System", 4),
  ],
  "12/biology": [b("lebo1", "Biology", 13)],
  "12/business-studies": [b("lebs1", "Business Studies Part I", 8), b("lebs2", "Business Studies Part II", 3)],
  "12/chemistry": [b("lech1", "Chemistry Part I", 5), b("lech2", "Chemistry Part II", 5)],
  "12/computer-science": [b("lecs1", "Computer Science", 13)],
  "12/economics": [
    b("leec1", "Introductory Macroeconomics", 6),
    b("leec2", "Introductory Microeconomics", 5),
  ],
  "12/english": [b("lefl1", "Flamingo", 13), b("levt1", "Vistas", 6)],
  "12/geography": [
    b("legy1", "Fundamentals of Human Geography", 8),
    b("legy2", "India: People and Economy", 9),
    b("legy3", "Practical Work in Geography – Part II", 4),
  ],
  "12/hindi": [b("lhar1", "आरोह भाग 2", 15), b("lhvt1", "वितान भाग 2", 3)],
  "12/history": [
    b("lehs1", "Themes in Indian History – I", 4),
    b("lehs2", "Themes in Indian History – II", 4),
    b("lehs3", "Themes in Indian History – III", 4),
  ],
  "12/maths": [b("lemh1", "Mathematics Part I", 6), b("lemh2", "Mathematics Part II", 7)],
  "12/physics": [b("leph1", "Physics Part I", 8), b("leph2", "Physics Part II", 6)],
  "12/political-science": [
    b("leps1", "Contemporary World Politics", 7),
    b("leps2", "Politics in India since Independence", 8),
  ],
  "12/psychology": [b("lepy1", "Psychology", 7)],
  "12/sociology": [
    b("lesy1", "Indian Society", 7),
    b("lesy2", "Social Change and Development in India", 8),
  ],
};

export function ncertBooks(grade: number, subject: string): NcertBook[] | null {
  return NCERT_BOOKS[`${grade}/${subject}`] ?? null;
}

export function ncertBookUrl(book: NcertBook): string {
  return `https://ncert.nic.in/textbook.php?${book.code}=0-${book.files}`;
}

export function ncertChapterPdf(book: NcertBook, n: number): string {
  return `https://ncert.nic.in/textbook/pdf/${book.code}${String(n).padStart(2, "0")}.pdf`;
}
