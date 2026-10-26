/** Finding the printed text of an NCERT example / exercise question in the stored chapter text. */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The printed text of an NCERT worked example / exercise question, from the stored book
 * text, so a "modelled on Example 3.4" claim can be checked against the real book.
 */
export function ncertSnippet(body: string, kind: string, ref: string): string | null {
  const from = (text: string, re: RegExp, n = 1300) => {
    const m = re.exec(text);
    return m ? text.slice(m.index, m.index + n).trim() : null;
  };
  if (kind === "example") return from(body, new RegExp(`Example\\s*${esc(ref)}(?![\\d.])`, "i"), 1500);
  if (kind !== "exercise") return null;
  const exStart = body.indexOf("EXERCISES") >= 0 ? body.indexOf("EXERCISES") : body.indexOf("EXERCISE");
  let m: RegExpExecArray | null;
  if ((m = /^Misc\s*(\d+)$/i.exec(ref))) {
    const i = body.search(/Miscellaneous\s+Exercises?/i);
    return i < 0 ? null : from(body.slice(i), new RegExp(`(^|\\n)\\s*${m[1]}\\.\\s`));
  }
  if ((m = /^(\d+\.\d+)\s*Q(\d+)$/.exec(ref))) {
    const set = new RegExp(`EXERCISE\\s*${esc(m[1]!)}(?![\\d.])`, "i").exec(body);
    return set ? from(body.slice(set.index), new RegExp(`(^|\\n)\\s*${m[2]}\\.\\s`)) : null;
  }
  if (exStart < 0) return null;
  const scope = body.slice(exStart);
  if ((m = /^\d+\.Q(\d+)$/.exec(ref))) return from(scope, new RegExp(`(^|\\n)\\s*${m[1]}\\.\\s`));
  if (/^\d+\.\d+$/.test(ref)) return from(scope, new RegExp(`(^|\\n)\\s*${esc(ref)}(?![\\d])\\s`));
  return null;
}
