import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

// ─── mock @/lib/proxy ─────────────────────────────────────────────────────────
// vi.mock is hoisted before imports, so the route module picks up these mocks.

const mockSanitizePath = vi.fn<(segs: string[]) => string[] | null>((segs) => segs);
const mockProxyRequest = vi.fn();

vi.mock("@/lib/proxy", () => ({
  sanitizePath: (segs: string[]) => mockSanitizePath(segs),
  proxyRequest: (...args: unknown[]) => mockProxyRequest(...args),
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeReq(
  urlStr: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {}
): NextRequest {
  return new NextRequest(new URL(urlStr), options);
}

function ok200(): Response {
  return new Response(JSON.stringify({ code: 0, data: { balance: "100.00" } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function err401(): Response {
  return new Response(JSON.stringify({ code: 401, message: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── GET /api/account/[...path] ───────────────────────────────────────────────

describe("GET /api/account/[...path]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSanitizePath.mockImplementation((segs) => segs);
    mockProxyRequest.mockResolvedValue(ok200());
  });

  it("returns 400 when sanitizePath returns null (path traversal attempt)", async () => {
    mockSanitizePath.mockReturnValue(null);

    const req = makeReq("http://localhost/api/account/../secret");
    const res = await GET(req, { params: Promise.resolve({ path: ["..", "secret"] }) });

    expect(res.status).toBe(400);
    expect(mockProxyRequest).not.toHaveBeenCalled();
  });

  it("always sets Cache-Control: private, no-store on a 200 GET response", async () => {
    const req = makeReq("http://localhost/api/account/balance");
    const res = await GET(req, { params: Promise.resolve({ path: ["balance"] }) });

    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Cache-Control: private, no-store even when upstream returns a non-200 status", async () => {
    mockProxyRequest.mockResolvedValue(err401());

    const req = makeReq("http://localhost/api/account/profile", {
      headers: { Authorization: "Bearer expired" },
    });
    const res = await GET(req, { params: Promise.resolve({ path: ["profile"] }) });

    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("forwards the Authorization header to proxyRequest on GET", async () => {
    const req = makeReq("http://localhost/api/account/balance", {
      headers: { Authorization: "Bearer user-jwt" },
    });

    await GET(req, { params: Promise.resolve({ path: ["balance"] }) });

    expect(mockProxyRequest).toHaveBeenCalledWith(expect.any(String), "GET", "Bearer user-jwt");
  });

  it("passes null auth header when Authorization is absent on GET", async () => {
    const req = makeReq("http://localhost/api/account/balance");

    await GET(req, { params: Promise.resolve({ path: ["balance"] }) });

    expect(mockProxyRequest).toHaveBeenCalledWith(expect.any(String), "GET", null);
  });
});

// ─── POST /api/account/[...path] ─────────────────────────────────────────────

describe("POST /api/account/[...path]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSanitizePath.mockImplementation((segs) => segs);
    mockProxyRequest.mockResolvedValue(ok200());
  });

  it("returns 400 when sanitizePath returns null", async () => {
    mockSanitizePath.mockReturnValue(null);

    const req = makeReq("http://localhost/api/account/../secret", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ path: ["..", "secret"] }) });

    expect(res.status).toBe(400);
    expect(mockProxyRequest).not.toHaveBeenCalled();
  });

  it("always sets Cache-Control: private, no-store on POST response", async () => {
    const req = makeReq("http://localhost/api/account/login", {
      method: "POST",
      body: JSON.stringify({ address: "0x123" }),
    });
    const res = await POST(req, { params: Promise.resolve({ path: ["login"] }) });

    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("forwards the Authorization header to proxyRequest on POST", async () => {
    const req = makeReq("http://localhost/api/account/refresh", {
      method: "POST",
      body: "{}",
      headers: { Authorization: "Bearer refresh-token" },
    });

    await POST(req, { params: Promise.resolve({ path: ["refresh"] }) });

    expect(mockProxyRequest).toHaveBeenCalledWith(
      expect.any(String),
      "POST",
      "Bearer refresh-token",
      expect.any(String)
    );
  });

  it("passes null auth header when Authorization is absent on POST", async () => {
    const req = makeReq("http://localhost/api/account/login", {
      method: "POST",
      body: "{}",
    });

    await POST(req, { params: Promise.resolve({ path: ["login"] }) });

    expect(mockProxyRequest).toHaveBeenCalledWith(
      expect.any(String),
      "POST",
      null,
      expect.any(String)
    );
  });
});
