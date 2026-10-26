/**
 * Entrance papers print each subject as one block (Physics, then Chemistry, …). The page
 * reader labels every question's subject from its content, which is sometimes wrong (a
 * thermodynamics question in the Chemistry part reads like Physics). This picks the block
 * layout that disagrees with the fewest labels and returns the corrected subject of every
 * question, in the same order.
 */
export function segmentSubjects<S extends string>(labels: S[], minCount = 5): S[] {
  const n = labels.length;
  if (n === 0) return [];
  const counts = new Map<S, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  // A "subject" seen only a few times is a mislabel, not a block of its own.
  const subjects = [...counts.keys()].filter((s) => counts.get(s)! >= Math.min(minCount, n));
  if (subjects.length === 0) return [...labels];
  if (subjects.length === 1) return labels.map(() => subjects[0]!);

  const median = (s: S) => {
    const pos = labels.flatMap((l, i) => (l === s ? [i] : []));
    return pos[Math.floor(pos.length / 2)]!;
  };
  subjects.sort((a, b) => median(a) - median(b));
  const K = subjects.length;

  // cost[k] = fewest disagreements so far when the current question sits in block k.
  let cost = subjects.map((s) => (labels[0] === s ? 0 : 1));
  const back: number[][] = [];
  for (let i = 1; i < n; i++) {
    const next: number[] = [];
    const from: number[] = [];
    let best = Infinity;
    let bestK = 0;
    for (let k = 0; k < K; k++) {
      // Staying in the same block wins ties, so boundaries move only when labels say so.
      if (cost[k]! <= best) {
        best = cost[k]!;
        bestK = k;
      }
      next.push(best + (labels[i] === subjects[k] ? 0 : 1));
      from.push(bestK);
    }
    back.push(from);
    cost = next;
  }
  let k = cost.indexOf(Math.min(...cost));
  const out = new Array<S>(n);
  for (let i = n - 1; i >= 0; i--) {
    out[i] = subjects[k]!;
    if (i > 0) k = back[i - 1]![k]!;
  }
  return out;
}

/**
 * Papers have a fixed number of questions per subject (JEE: a third each; NEET: Physics and
 * Chemistry a quarter, Biology half). When the blocks found are within a few questions of
 * that, the boundaries are set exactly — a mislabel right at a boundary cannot move it.
 */
export function snapBlocks<S extends string>(subjects: S[], expectedShare: (s: S) => number, slack = 3): S[] {
  const n = subjects.length;
  const blocks: { s: S; len: number }[] = [];
  for (const s of subjects) {
    const last = blocks.at(-1);
    if (last && last.s === s) last.len++;
    else blocks.push({ s, len: 1 });
  }
  if (new Set(blocks.map((b) => b.s)).size !== blocks.length) return subjects;
  const expected = blocks.map((b) => expectedShare(b.s) * n);
  if (expected.some((e) => !Number.isInteger(e))) return subjects;
  if (expected.reduce((a, b) => a + b, 0) !== n) return subjects;
  if (blocks.some((b, i) => Math.abs(b.len - expected[i]!) > slack)) return subjects;
  return blocks.flatMap((b, i) => Array.from({ length: expected[i]! }, () => b.s));
}
