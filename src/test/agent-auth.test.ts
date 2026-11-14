import { describe, expect, it } from "vitest";
import { agentAuthorized } from "@/lib/server/agent-auth.server";

const KEY = "k".repeat(32);
const req = (headers: Record<string, string>) => new Request("https://x/api/public/agent", { headers });

describe("agent key check", () => {
  it("accepts Authorization: Bearer", () => expect(agentAuthorized(req({ authorization: `Bearer ${KEY}` }), KEY)).toBe(true));
  it("accepts x-agent-key header", () => expect(agentAuthorized(req({ "x-agent-key": KEY }), KEY)).toBe(true));
  it("ignores stray spaces around the key", () => expect(agentAuthorized(req({ "x-agent-key": ` ${KEY} ` }), `${KEY}\n`)).toBe(true));
  it("rejects a wrong key", () => expect(agentAuthorized(req({ "x-agent-key": "z".repeat(32) }), KEY)).toBe(false));
  it("rejects a missing key", () => expect(agentAuthorized(req({}), KEY)).toBe(false));
});
