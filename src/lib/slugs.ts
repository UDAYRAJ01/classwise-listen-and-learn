// Deterministic slugs shared by browser and server.

export function asciiSlug(input: string, max = 48): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= max) return slug;
  return slug.slice(0, max).replace(/-+[^-]*$/, "") || slug.slice(0, max);
}

/** 32-bit FNV-1a hash rendered in base36. */
export function hash36(input: string): string {
  let h = 0x811c9dc5;
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    h ^= code & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= code >>> 8;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function normalizeTopic(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Official chapter slug: b{book}-c{chapter}[-ascii-title]. */
export function chapterSlug(bookIndex: number, chapterIndex: number, title: string): string {
  const base = `b${bookIndex + 1}-c${chapterIndex + 1}`;
  const tail = asciiSlug(title, 40);
  return tail ? `${base}-${tail}` : base;
}

/** Student-entered topic slug: t-[ascii-title-]hash. */
export function customTopicSlug(title: string): string {
  const clean = normalizeTopic(title).toLowerCase();
  const tail = asciiSlug(clean, 40);
  const h = hash36(clean).slice(0, 6);
  return tail ? `t-${tail}-${h}` : `t-${h}`;
}

export function isCustomSlug(slug: string): boolean {
  return slug.startsWith("t-");
}

export const TOPIC_MIN = 3;
export const TOPIC_MAX = 120;
