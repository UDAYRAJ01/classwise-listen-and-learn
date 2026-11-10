/** Checks the external review agent's key (Authorization: Bearer <AGENT_ACCESS_KEY>). */
export function agentAuthorized(request: Request): boolean {
  const key = process.env["AGENT_ACCESS_KEY"];
  if (!key || key.length < 24) return false;
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (got.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= got.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}

/** Paths an agent may read: relative, no traversal, no secrets. */
export function safeCodePath(p: string): boolean {
  if (!p || p.length > 300 || p.startsWith("/") || p.includes("..") || p.includes("\\")) return false;
  return !/(^|\/)\.env/.test(p);
}
