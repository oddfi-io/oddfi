import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getCacheControl } from "../cache-control";

// ─── mock @/lib/proxy ─────────────────────────────────────────────────────────
// vi.mock is hoisted before imports, so the route module picks up these mocks.

const mockSanitizePath = vi.fn<(segs: string[]) => string[] | null>((segs) => segs);
const mockProxyRequest = vi.fn();

vi.mock("@/lib/proxy", () => ({
  sanitizePath: (segs: string[]) => mockSanitizePath(segs),
  proxyRequest: (...args: unknown[]) => mockProxyRequest(...args),
}));

// ─── helper: build URLSearchParams from an object ────────────────────────────
function sp(params: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(params);
}

// ─── helper: date string at offset from today ────────────────────────────────
function dateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── helper: build a NextRequest-like object ──────────────────────────────────
function makeReq(
  urlStr: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {}
): NextRequest {
  return new NextRequest(new URL(urlStr), options);
}

// ─── helper: build 200 NextResponse proxy result ─────────────────────────────
function ok200(data: unknown = [{ id: 1 }]): Response {
  return new Response(JSON.stringify({ code: 200, msg: "success", data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function err404(): Response {
  return new Response(JSON.stringify({ code: -1, message: "not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── getCacheControl unit tests ───────────────────────────────────────────────

describe("getCacheControl", () => {
  describe("detail/sports_all with type=live", () => {
    it("returns short TTL for live scores", () => {
      expect(getCacheControl(["detail", "sports_all"], sp({ type: "live" }))).toBe(
        "public, s-maxage=10, stale-while-revalidate=30"
      );
    });
  });

  describe("detail/sports_all without type=live", () => {
    it("returns minute-level TTL when type param is absent", () => {
      expect(getCacheControl(["detail", "sports_all"], sp())).toBe(
        "public, s-maxage=60, stale-while-revalidate=300"
      );
    });

    it("returns minute-level TTL when type param has a different value", () => {
      expect(getCacheControl(["detail", "sports_all"], sp({ type: "upcoming" }))).toBe(
        "public, s-maxage=60, stale-while-revalidate=300"
      );
    });
  });

  describe("detail/fixture/{id}", () => {
    it("returns short TTL for single fixture", () => {
      expect(getCacheControl(["detail", "fixture", "12345"], sp())).toBe(
        "public, s-maxage=10, stale-while-revalidate=30"
      );
    });

    it("returns short TTL regardless of fixture id value", () => {
      expect(getCacheControl(["detail", "fixture", "99999999"], sp())).toBe(
        "public, s-maxage=10, stale-while-revalidate=30"
      );
    });
  });

  describe("detail/fixture_date/{date} — date-distance branching", () => {
    it("returns today TTL when date is today", () => {
      expect(getCacheControl(["detail", "fixture_date", dateString(0)], sp())).toBe(
        "public, s-maxage=60, stale-while-revalidate=300"
      );
    });

    it("returns today TTL when date is yesterday (diffDays ≤ 0)", () => {
      expect(getCacheControl(["detail", "fixture_date", dateString(-1)], sp())).toBe(
        "public, s-maxage=60, stale-while-revalidate=300"
      );
    });

    it("returns today TTL when date is a past date two days ago", () => {
      expect(getCacheControl(["detail", "fixture_date", dateString(-2)], sp())).toBe(
        "public, s-maxage=60, stale-while-revalidate=300"
      );
    });

    it("returns tomorrow TTL when date is tomorrow (diffDays = 1)", () => {
      expect(getCacheControl(["detail", "fixture_date", dateString(1)], sp())).toBe(
        "public, s-maxage=300, stale-while-revalidate=600"
      );
    });

    it("returns future TTL when date is the day after tomorrow (diffDays = 2)", () => {
      expect(getCacheControl(["detail", "fixture_date", dateString(2)], sp())).toBe(
        "public, s-maxage=600, stale-while-revalidate=1800"
      );
    });

    it("returns future TTL when date is far in the future", () => {
      expect(getCacheControl(["detail", "fixture_date", dateString(30)], sp())).toBe(
        "public, s-maxage=600, stale-while-revalidate=1800"
      );
    });

    it("falls through to fallback when date string is invalid", () => {
      expect(getCacheControl(["detail", "fixture_date", "invalid-date"], sp())).toBe(
        "public, s-maxage=15, stale-while-revalidate=60"
      );
    });

    it("falls through to fallback when date segment is missing", () => {
      // path[2] is undefined — the condition `path[2]` is falsy
      expect(getCacheControl(["detail", "fixture_date"], sp())).toBe(
        "public, s-maxage=15, stale-while-revalidate=60"
      );
    });
  });

  describe("fallback", () => {
    it("returns fallback TTL for an unrecognised path", () => {
      expect(getCacheControl(["detail", "unknown"], sp())).toBe(
        "public, s-maxage=15, stale-while-revalidate=60"
      );
    });

    it("returns fallback TTL for a top-level unrecognised path", () => {
      expect(getCacheControl(["leagues"], sp())).toBe(
        "public, s-maxage=15, stale-while-revalidate=60"
      );
    });

    it("returns fallback TTL for an empty path array", () => {
      expect(getCacheControl([], sp())).toBe("public, s-maxage=15, stale-while-revalidate=60");
    });
  });
});

// ─── route handler integration tests ─────────────────────────────────────────

describe("GET /api/v1/[...path]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: path is valid, upstream returns 200
    mockSanitizePath.mockImplementation((segs) => segs);
    mockProxyRequest.mockResolvedValue(ok200());
  });

  it("returns 400 when sanitizePath returns null (path traversal attempt)", async () => {
    mockSanitizePath.mockReturnValue(null);

    const req = makeReq("http://localhost/api/v1/../secret");
    const res = await GET(req, { params: Promise.resolve({ path: ["..", "secret"] }) });

    expect(res.status).toBe(400);
    expect(mockProxyRequest).not.toHaveBeenCalled();
  });

  it("sets Cache-Control header on a 200 upstream response", async () => {
    const req = makeReq("http://localhost/api/v1/detail/sports_all");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["detail", "sports_all"] }),
    });

    expect(res.headers.get("Cache-Control")).toBeTruthy();
  });

  it("sets the correct Cache-Control value for detail/sports_all?type=live on 200", async () => {
    const req = makeReq("http://localhost/api/v1/detail/sports_all?type=live");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["detail", "sports_all"] }),
    });

    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=10, stale-while-revalidate=30");
  });

  it("does NOT set Cache-Control header when upstream returns non-200", async () => {
    mockProxyRequest.mockResolvedValue(err404());

    const req = makeReq("http://localhost/api/v1/detail/fixture/0");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["detail", "fixture", "0"] }),
    });

    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("passes null as the auth header to strip Authorization for CDN caching", async () => {
    const req = makeReq("http://localhost/api/v1/detail/sports_all", {
      headers: { Authorization: "Bearer token-abc" },
    });

    await GET(req, { params: Promise.resolve({ path: ["detail", "sports_all"] }) });

    expect(mockProxyRequest).toHaveBeenCalledWith(
      expect.any(String),
      "GET",
      null // auth must be stripped
    );
  });
});

describe("POST /api/v1/[...path]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSanitizePath.mockImplementation((segs) => segs);
    mockProxyRequest.mockResolvedValue(ok200());
  });

  it("returns 400 when sanitizePath returns null", async () => {
    mockSanitizePath.mockReturnValue(null);

    const req = makeReq("http://localhost/api/v1/../secret", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ path: ["..", "secret"] }) });

    expect(res.status).toBe(400);
  });

  it("does not set Cache-Control header on POST response", async () => {
    const req = makeReq("http://localhost/api/v1/bet", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ path: ["bet"] }) });

    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("forwards the Authorization header on POST", async () => {
    const req = makeReq("http://localhost/api/v1/bet", {
      method: "POST",
      body: "{}",
      headers: { Authorization: "Bearer user-token" },
    });

    await POST(req, { params: Promise.resolve({ path: ["bet"] }) });

    expect(mockProxyRequest).toHaveBeenCalledWith(
      expect.any(String),
      "POST",
      "Bearer user-token",
      expect.any(String)
    );
  });

  it("passes null auth when Authorization header is absent on POST", async () => {
    const req = makeReq("http://localhost/api/v1/bet", {
      method: "POST",
      body: "{}",
    });

    await POST(req, { params: Promise.resolve({ path: ["bet"] }) });

    expect(mockProxyRequest).toHaveBeenCalledWith(
      expect.any(String),
      "POST",
      null,
      expect.any(String)
    );
  });
});
