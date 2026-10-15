import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

// ─── mock @/lib/proxy ─────────────────────────────────────────────────────────

const mockSanitizePath = vi.fn<(segs: string[]) => string[] | null>((segs) => segs);

vi.mock("@/lib/proxy", () => ({
  sanitizePath: (segs: string[]) => mockSanitizePath(segs),
  proxyRequest: vi.fn(),
}));

// ─── mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeReq(urlStr: string, options: { method?: string; body?: string } = {}): NextRequest {
  return new NextRequest(new URL(urlStr), options);
}

function relayOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function relayErr(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── GET /api/relay/[...path] ─────────────────────────────────────────────────

describe("GET /api/relay/[...path]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSanitizePath.mockImplementation((segs) => segs);
    mockFetch.mockResolvedValue(relayOk({ steps: [] }));
  });

  it("returns 400 when sanitizePath rejects path traversal", async () => {
    mockSanitizePath.mockReturnValue(null);

    const req = makeReq("http://localhost/api/relay/../secret");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["..", "secret"] }),
    });

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET to Relay API and returns upstream response", async () => {
    const upstream = { steps: [{ id: "approve" }] };
    mockFetch.mockResolvedValue(relayOk(upstream));

    const req = makeReq("http://localhost/api/relay/quote/v2?chainId=1");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["quote", "v2"] }),
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.relay.link/quote/v2?chainId=1",
      expect.objectContaining({ method: "GET" })
    );
    const body = await res.json();
    expect(body).toEqual(upstream);
  });

  it("passes upstream error status through", async () => {
    mockFetch.mockResolvedValue(relayErr(400, "Invalid params"));

    const req = makeReq("http://localhost/api/relay/quote/v2");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["quote", "v2"] }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 502 when fetch throws a network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const req = makeReq("http://localhost/api/relay/quote/v2");
    const res = await GET(req, {
      params: Promise.resolve({ path: ["quote", "v2"] }),
    });

    expect(res.status).toBe(502);
  });
});

// ─── POST /api/relay/[...path] ────────────────────────────────────────────────

describe("POST /api/relay/[...path]", () => {
  const quoteBody = JSON.stringify({ originChainId: 42161, destinationChainId: 56 });

  beforeEach(() => {
    vi.resetAllMocks();
    mockSanitizePath.mockImplementation((segs) => segs);
    mockFetch.mockResolvedValue(relayOk({ steps: [] }));
  });

  it("returns 400 when sanitizePath rejects the path", async () => {
    mockSanitizePath.mockReturnValue(null);

    const req = makeReq("http://localhost/api/relay/../exec", {
      method: "POST",
      body: quoteBody,
    });
    const res = await POST(req, {
      params: Promise.resolve({ path: ["..", "exec"] }),
    });

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies POST body to Relay API", async () => {
    const upstream = { txHash: "0xabc" };
    mockFetch.mockResolvedValue(relayOk(upstream));

    const req = makeReq("http://localhost/api/relay/execute", {
      method: "POST",
      body: quoteBody,
    });
    const res = await POST(req, {
      params: Promise.resolve({ path: ["execute"] }),
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.relay.link/execute",
      expect.objectContaining({ method: "POST", body: quoteBody })
    );
    const body = await res.json();
    expect(body).toEqual(upstream);
  });
});
