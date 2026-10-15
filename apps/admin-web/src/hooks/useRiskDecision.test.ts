import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/types/api";

const { mockUnwrap, mockApiPost } = vi.hoisted(() => ({
  mockUnwrap: vi.fn(),
  mockApiPost: vi.fn(() => Promise.resolve(new Response("{}"))),
}));

vi.mock("@/lib/api", () => ({
  api: { post: mockApiPost, get: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  unwrap: mockUnwrap,
}));

import { submitRiskDecision, terminalDecisionNotice } from "./useRiskDecision";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitRiskDecision — 请求形态", () => {
  it("POST 正确路径 + body + 幂等 header", async () => {
    mockUnwrap.mockResolvedValueOnce({ event_id: "5", action: "stop" });
    await submitRiskDecision("5", {
      action: "stop",
      remark: "人工评估后维持停单",
      idempotencyKey: "uuid-1",
    });
    const [url, opts] = mockApiPost.mock.calls[0] as unknown as [
      string,
      { json: unknown; headers: Record<string, string> },
    ];
    expect(url).toBe("admin/events/5/risk-decision");
    expect(opts.json).toEqual({ action: "stop", remark: "人工评估后维持停单" });
    expect(opts.headers["X-Idempotency-Key"]).toBe("uuid-1");
  });

  it("event_id 编码防 URL 注入", async () => {
    mockUnwrap.mockResolvedValueOnce({});
    await submitRiskDecision("a/b", {
      action: "approve_continue",
      remark: "x".repeat(10),
      idempotencyKey: "k",
    });
    const [url] = mockApiPost.mock.calls[0] as unknown as [string];
    expect(url).toBe("admin/events/a%2Fb/risk-decision");
  });
});

describe("terminalDecisionNotice — 终态错误码分支", () => {
  it("EVENT_NOT_RED_SIGNAL → 已非红灯提示", () => {
    const err = new ApiError("EVENT_NOT_RED_SIGNAL", 200, "not red");
    expect(terminalDecisionNotice(err)).toMatch(/已不是红灯/);
  });

  it("RISK_DECISION_CONFLICT → 已有人处理提示", () => {
    const err = new ApiError("RISK_DECISION_CONFLICT", 200, "conflict");
    expect(terminalDecisionNotice(err)).toMatch(/已有其他管理员处理/);
  });

  it("其余 ApiError → null（交还弹窗内联报错）", () => {
    expect(terminalDecisionNotice(new ApiError("INSUFFICIENT_ROLE", 403, "no"))).toBeNull();
    expect(terminalDecisionNotice(new ApiError("UPSTREAM_UNAVAILABLE", 502, "down"))).toBeNull();
  });

  it("非 ApiError（网络层）→ null", () => {
    expect(terminalDecisionNotice(new TypeError("failed to fetch"))).toBeNull();
    expect(terminalDecisionNotice(null)).toBeNull();
  });
});
