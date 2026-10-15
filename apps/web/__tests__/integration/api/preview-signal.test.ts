import { describe, it, expect, vi, beforeEach } from "vitest";

// DD-117 Batch 1 — previewSignal API 契约测试
//
// 验证 lib/api.ts:previewSignal 解包 ApiResponse<PreviewSignalRes>，
// 并正确处理 happy / 400 (params) / 5xx (server) / degraded 四类响应。
// 不验证 hook 层的 abort / debounce —— 那是 Batch 2 的测试范围。

vi.mock("ky", () => {
  const mockPost = vi.fn();
  return {
    default: {
      create: () => ({
        get: vi.fn(),
        post: mockPost,
      }),
    },
    __mockPost: mockPost,
  };
});

const { __mockPost } = (await import("ky")) as unknown as { __mockPost: ReturnType<typeof vi.fn> };

const MARKET_ID = "0x020368b0e5316baa9a48b3e7c77872b0e7ca0ffcfd2f18319ebea5b25e762164";

describe("previewSignal API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy: 绿灯响应解包 ApiResponse<PreviewSignalRes>", async () => {
    __mockPost.mockReturnValue({
      json: () =>
        Promise.resolve({
          code: 0,
          message: "success",
          data: {
            signal: 0,
            acceptedAmount: "200000000000000000000",
            lockedOdds: "22900",
            partialFill: false,
            maxAcceptableAmount: "300000000000000000000",
            quoteVersion: "21",
            cachedAt: 1779544338,
            cacheTtlMs: 500,
            degraded: false,
          },
        }),
    });

    const { previewSignal } = await import("@/lib/api");
    const res = await previewSignal(MARKET_ID, {
      outcome: 0,
      requestedAmount: "200000000000000000000",
    });

    expect(__mockPost).toHaveBeenCalledWith(`market/${MARKET_ID}/preview-signal`, {
      json: { outcome: 0, requestedAmount: "200000000000000000000" },
    });
    expect(res.signal).toBe(0);
    expect(res.lockedOdds).toBe("22900");
    expect(res.partialFill).toBe(false);
    expect(res.degraded).toBe(false);
  });

  it("degraded: HTTP 200 + degraded=true + lockedOdds='0' + signal=2", async () => {
    // 后端 RPC 失败兜底 — 必须是 HTTP 200 而非 5xx，前端通过 degraded 字段识别
    __mockPost.mockReturnValue({
      json: () =>
        Promise.resolve({
          code: 0,
          message: "success",
          data: {
            signal: 2,
            acceptedAmount: "0",
            lockedOdds: "0",
            partialFill: true,
            maxAcceptableAmount: "0",
            quoteVersion: "0",
            cachedAt: 0,
            cacheTtlMs: 500,
            degraded: true,
          },
        }),
    });

    const { previewSignal } = await import("@/lib/api");
    const res = await previewSignal(MARKET_ID, {
      outcome: 0,
      requestedAmount: "200000000000000000000",
    });

    expect(res.degraded).toBe(true);
    expect(res.lockedOdds).toBe("0");
    expect(res.signal).toBe(2);
  });

  it("partial fill: 橙灯响应", async () => {
    __mockPost.mockReturnValue({
      json: () =>
        Promise.resolve({
          code: 0,
          message: "success",
          data: {
            signal: 2,
            acceptedAmount: "150000000000000000000",
            lockedOdds: "22900",
            partialFill: true,
            maxAcceptableAmount: "150000000000000000000",
            quoteVersion: "21",
            cachedAt: 1779544338,
            cacheTtlMs: 500,
            degraded: false,
          },
        }),
    });

    const { previewSignal } = await import("@/lib/api");
    const res = await previewSignal(MARKET_ID, {
      outcome: 0,
      requestedAmount: "200000000000000000000",
    });

    expect(res.signal).toBe(2);
    expect(res.partialFill).toBe(true);
    expect(res.degraded).toBe(false);
    expect(res.acceptedAmount).toBe("150000000000000000000");
  });

  it("params 400: ky 抛 HTTPError，调用方需 catch 后读 response", async () => {
    // 模拟 ky 行为：HTTP 4xx → throw HTTPError（携带 response）
    const httpError = Object.assign(new Error("Bad Request"), {
      name: "HTTPError",
      response: {
        status: 400,
        json: () => Promise.resolve({ code: 1001, message: "invalid requestedAmount" }),
      },
    });
    __mockPost.mockReturnValue({
      json: () => Promise.reject(httpError),
    });

    const { previewSignal } = await import("@/lib/api");
    await expect(
      previewSignal(MARKET_ID, { outcome: 0, requestedAmount: "0" })
    ).rejects.toMatchObject({ name: "HTTPError" });
  });

  it("server 5xx: ky 抛 HTTPError 500", async () => {
    const httpError = Object.assign(new Error("Internal Server Error"), {
      name: "HTTPError",
      response: {
        status: 500,
        json: () => Promise.resolve({ code: -1, message: "Unexpected" }),
      },
    });
    __mockPost.mockReturnValue({
      json: () => Promise.reject(httpError),
    });

    const { previewSignal } = await import("@/lib/api");
    await expect(
      previewSignal(MARKET_ID, { outcome: 0, requestedAmount: "100000000000000000000" })
    ).rejects.toMatchObject({ name: "HTTPError" });
  });
});
