/** [left, top, right, bottom] on a 0–1000 scale of the page. */
export type Box = [number, number, number, number];
export interface TextLine {
  text: string;
  box: Box;
}

/** A printed answer or solution line: "Answer: C", "Correct Answer (3)", "Ans. (4)", "Sol.", "Solution:". */
const ANSWER_LINE = /^\s*(?:\d+\s+)?(?:(?:correct\s+)?answer\s*(?:key)?\s*[:.(\-–]|ans\s*[.:(\-–]|ans\s*$|sol\s*[.:]|solution\s*[:.]|solution\s*$)/i;

/**
 * Cut a question's crop above the first answer / solution line printed inside it. Only lines
 * in the lower part of the crop count (an answer is printed after the question), and only
 * when enough of the question stays visible; otherwise the box is returned unchanged.
 */
export function trimAnswerFromBox(box: Box, lines: TextLine[]): Box {
  const [l, t, r, b] = box;
  const height = b - t;
  if (height <= 0) return box;
  const hit = lines
    .filter((ln) => ANSWER_LINE.test(ln.text))
    .filter((ln) => ln.box[2] > l && ln.box[0] < r) // overlaps the crop sideways
    .filter((ln) => ln.box[1] > t + height * 0.2 && ln.box[1] < b) // starts in the lower part
    .sort((a, c) => a.box[1] - c.box[1])[0];
  if (!hit) return box;
  // Just above the answer line, but never through the text line printed right before it
  // (often the last options row, sitting only a hair above).
  const above = lines
    .filter((ln) => ln !== hit && ln.box[2] > l && ln.box[0] < r && ln.box[1] >= t && ln.box[3] <= hit.box[1] + 1)
    .reduce((m, ln) => Math.max(m, ln.box[3]), t);
  const cut = Math.min(hit.box[1], Math.max(hit.box[1] - 4, above + 1));
  return cut - t < height * 0.2 ? box : [l, t, r, Math.ceil(cut)];
}
