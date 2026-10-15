import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const mockSanitizePath = vi.fn<(segs: string[]) => string[] | null>((segs) => segs);
const mockProxyRequest = vi.fn();

vi.mock("@/lib/proxy", () => ({
  sanitizePath: (segs: string[]) => mockSanitizePath(segs),
  proxyRequest: (...args: unknown[]) => mockProxyRequest(...args),
}));

function makeReq(
  urlStr: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {}
): NextRequest {
  return new NextRequest(new URL(urlStr), options);
}

function ok200(payload: unknown = { code: 0, data: {} }): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/market/[...path]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSanitizePath.mockImplementation((segs) => segs);
    mockProxyRequest.mockResolvedValue(ok200());
  });

  it("returns 400 when sanitizePath returns null", async () => {
    mockSanitizePath.mockReturnValue(null);
    const req = makeReq("http://localhost/api/market/../secret");
    const res = await GET(req, { params: Promise.resolve({ path: ["..", "secret"] }) });
    expect(res.status).toBe(400);
    expect(mockProxyRequest).not.toHaveBeenCalled();
  });

  it("passes query string through to upstream URL", async () => {
    const req = makeReq("http://localhost/api/market/price?chain=bsc&symbol=odd");
    await GET(req, { params: Promise.resolve({ path: ["price"] }) });
    const [url] = mockProxyRequest.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("/market/price?chain=bsc&symbol=odd");
  });

  it("sets Cache-Control: no-store on GET response", async () => {
    const req = makeReq("http://localhost/api/market/price");
    const res = await GET(req, { params: Promise.resolve({ path: ["price"] }) });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("POST /api/market/[...path] (DD-117 preview-signal)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSanitizePath.mockImplementation((segs) => segs);
    mockProxyRequest.mockResolvedValue(ok200({ code: 0, message: "success", data: {} }));
  });

  it("returns 400 when sanitizePath returns null", async () => {
    mockSanitizePath.mockReturnValue(null);
    const req = makeReq("http://localhost/api/market/../preview-signal", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, {
      params: Promise.resolve({ path: ["..", "preview-signal"] }),
    });
    expect(res.status).toBe(400);
    expect(mockProxyRequest).not.toHaveBeenCalled();
  });

  it("forwards body bytes verbatim to proxyRequest (no JSON re-encoding)", async () => {
    // 验证转发是字节级透传，不会被 JSON.parse → JSON.stringify 改写。
    const marketId = "0x020368b0e5316baa9a48b3e7c77872b0e7ca0ffcfd2f18319ebea5b25e762164";
    const bodyStr = JSON.stringify({
      outcome: 0,
      requestedAmount: "200000000000000000000",
    });
    const req = makeReq(`http://localhost/api/market/${marketId}/preview-signal`, {
      method: "POST",
      body: bodyStr,
      headers: { "Content-Type": "application/json" },
    });

    await POST(req, {
      params: Promise.resolve({ path: [marketId, "preview-signal"] }),
    });

    expect(mockProxyRequest).toHaveBeenCalledTimes(1);
    const [url, method, auth, body] = mockProxyRequest.mock.calls[0] as [
      string,
      string,
      string | null,
      string,
    ];
    expect(method).toBe("POST");
    expect(auth).toBeNull();
    expect(body).toBe(bodyStr);
    expect(url).toContain(`/market/${marketId}/preview-signal`);
  });

  it("forwards Authorization header to proxyRequest", async () => {
    const req = makeReq("http://localhost/api/market/0xabc/preview-signal", {
      method: "POST",
      body: "{}",
      headers: { Authorization: "Bearer tk" },
    });

    await POST(req, { params: Promise.resolve({ path: ["0xabc", "preview-signal"] }) });

    expect(mockProxyRequest).toHaveBeenCalledWith(expect.any(String), "POST", "Bearer tk", "{}");
  });

  it("sets Cache-Control: no-store on POST response", async () => {
    const req = makeReq("http://localhost/api/market/0xabc/preview-signal", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, {
      params: Promise.resolve({ path: ["0xabc", "preview-signal"] }),
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("constructs upstream URL by joining sanitized path with /", async () => {
    const req = makeReq("http://localhost/api/market/0xabc/preview-signal", {
      method: "POST",
      body: "{}",
    });
    await POST(req, { params: Promise.resolve({ path: ["0xabc", "preview-signal"] }) });
    const [url] = mockProxyRequest.mock.calls[0] as [string, ...unknown[]];
    expect(url).toMatch(/\/market\/0xabc\/preview-signal$/);
  });
});
