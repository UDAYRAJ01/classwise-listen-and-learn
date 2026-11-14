/** Checks the external review agent's key: `Authorization: Bearer <key>` or `x-agent-key: <key>`. */
export function agentAuthorized(request: Request, secret = process.env["AGENT_ACCESS_KEY"]): boolean {
  const key = secret?.trim();
  if (!key || key.length < 24) return false;
  const bearer = (request.headers.get("authorization") ?? "").trim().replace(/^Bearer\s+/i, "").trim();
  const got = bearer || (request.headers.get("x-agent-key") ?? "").trim();
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
