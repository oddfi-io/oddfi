import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ky before importing api module
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

describe("Betting API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("placeBet calls POST account/bet_place and returns PlaceBetRes", async () => {
    const mockResponse = {
      msg: "ALL_SUCCESS" as const,
      results: [{ odd_id: 42, bet_id: 1001, status: "SUCCESS" as const }],
    };

    __mockPost.mockReturnValue({
      json: () => Promise.resolve({ code: 0, message: "ok", data: mockResponse }),
    });

    const { placeBet } = await import("@/lib/api");
    const result = await placeBet({
      odd_ids: [42],
      stakes: ["100"],
      type: "single",
      market: ["fulltime_result"],
      label: ["1"],
      handicapline: ["0"],
      odds: ["2.5"],
      ref_id: "test-ref-single",
    });

    expect(__mockPost).toHaveBeenCalledWith("account/bet_place", {
      json: {
        odd_ids: [42],
        stakes: ["100"],
        type: "single",
        market: ["fulltime_result"],
        label: ["1"],
        handicapline: ["0"],
        odds: ["2.5"],
        ref_id: "test-ref-single",
      },
    });

    expect(result).toEqual(mockResponse);
    expect(result.msg).toBe("ALL_SUCCESS");
    expect(result.results[0].odd_id).toBe(42);
    expect(result.results[0].bet_id).toBe(1001);
    expect(result.results[0].status).toBe("SUCCESS");
  });

  it("placeBet supports parlay type with multiple odd_ids", async () => {
    const mockResponse = {
      msg: "ALL_SUCCESS" as const,
      results: [
        { odd_id: 10, bet_id: 2001, status: "SUCCESS" as const },
        { odd_id: 20, bet_id: 2002, status: "SUCCESS" as const },
      ],
    };

    __mockPost.mockReturnValue({
      json: () => Promise.resolve({ code: 0, message: "ok", data: mockResponse }),
    });

    const { placeBet } = await import("@/lib/api");
    const result = await placeBet({
      odd_ids: [10, 20],
      stakes: ["50", "50"],
      type: "parlay",
      market: ["asian_handicap", "asian_over_under"],
      label: ["1", "over"],
      handicapline: ["-0.5", "2.5"],
      odds: ["1.92", "1.88"],
      ref_id: "test-ref-parlay",
    });

    expect(result.msg).toBe("ALL_SUCCESS");
    expect(result.results).toHaveLength(2);
  });
});
