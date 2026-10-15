import { describe, it, expect, vi, afterEach } from "vitest";
import { isJwtExpired } from "./jwt";

// Build a minimal, structurally-valid JWT (header.payload.sig).
// We don't sign it — decodeExp only reads payload.exp, no signature verification.
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake_sig`;
}

// base64url variant (replace + with - and / with _)
function toBase64Url(s: string): string {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeTokenB64Url(payload: Record<string, unknown>): string {
  const header = toBase64Url(btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = toBase64Url(btoa(JSON.stringify(payload)));
  return `${header}.${body}.fake_sig`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isJwtExpired", () => {
  it("returns false for a token whose exp is in the future", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // +1 hour
    const token = makeToken({ exp: futureExp, role: "super_admin" });
    expect(isJwtExpired(token)).toBe(false);
  });

  it("returns true for a token whose exp is in the past", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // -1 hour
    const token = makeToken({ exp: pastExp });
    expect(isJwtExpired(token)).toBe(true);
  });

  it("returns true for a token whose exp equals current second (boundary)", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    vi.spyOn(Date, "now").mockReturnValue(nowSec * 1000); // freeze time
    const token = makeToken({ exp: nowSec });
    // exp * 1000 <= Date.now() → true (expired)
    expect(isJwtExpired(token)).toBe(true);
  });

  it("returns true when payload has no exp field", () => {
    const token = makeToken({ user_id: "u1" }); // no exp
    expect(isJwtExpired(token)).toBe(true);
  });

  it("returns true for a token with only 2 parts (malformed)", () => {
    expect(isJwtExpired("header.payload")).toBe(true);
  });

  it("returns true for a token with 4 parts (malformed)", () => {
    expect(isJwtExpired("a.b.c.d")).toBe(true);
  });

  it("returns true for an empty string", () => {
    expect(isJwtExpired("")).toBe(true);
  });

  it("returns true when payload part is not valid base64", () => {
    expect(isJwtExpired("header.!!!.sig")).toBe(true);
  });

  it("returns true when payload is valid base64 but not JSON", () => {
    const notJson = btoa("not json at all");
    expect(isJwtExpired(`header.${notJson}.sig`)).toBe(true);
  });

  it("handles base64url encoding (- and _ chars in payload)", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 7200;
    const token = makeTokenB64Url({ exp: futureExp });
    expect(isJwtExpired(token)).toBe(false);
  });

  it("decodes exp correctly — exp is seconds not milliseconds", () => {
    // If exp were accidentally treated as ms, a value of Date.now()/1000 would
    // look like year ~1970 and be expired. This test confirms seconds semantics.
    const futureExp = Math.floor(Date.now() / 1000) + 100;
    const token = makeToken({ exp: futureExp });
    expect(isJwtExpired(token)).toBe(false);
  });
});
