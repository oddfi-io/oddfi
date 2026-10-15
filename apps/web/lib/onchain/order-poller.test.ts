import { describe, it, expect, vi } from "vitest";
import {
  waitForOnchainBetReady,
  OrderNotReadyTimeoutError,
  OrderBetReadyInconsistentError,
} from "./order-poller";
import type { OnchainOrderResponse } from "@/types/onchain-betting";

const baseOrder = (overrides: Partial<OnchainOrderResponse> = {}): OnchainOrderResponse => ({
  order_id: 99,
  user_id: 1,
  op: "place_bet",
  status: "submitted",
  tx_hash: "0xBBB",
  idempotency_key: "k",
  bet_ready: false,
  created_at: "",
  updated_at: "",
  ...overrides,
});

const noSleep = () => Promise.resolve();

describe("waitForOnchainBetReady — happy path", () => {
  it("returns immediately when bet_ready=true on first poll", async () => {
    const getOrder = vi.fn(async () => baseOrder({ bet_ready: true, bet_id: "0xdead" }));
    const result = await waitForOnchainBetReady(99, { getOrder, sleep: noSleep });
    expect(getOrder).toHaveBeenCalledTimes(1);
    expect(getOrder).toHaveBeenCalledWith(99);
    expect(result.betId).toBe("0xdead");
    expect(result.order.bet_ready).toBe(true);
  });

  it("polls until bet_ready flips true", async () => {
    const sequence: OnchainOrderResponse[] = [
      baseOrder({ bet_ready: false }),
      baseOrder({ bet_ready: false }),
      baseOrder({ bet_ready: true, bet_id: "0xfeed" }),
    ];
    let i = 0;
    const getOrder = vi.fn(async () => sequence[i++]);
    const result = await waitForOnchainBetReady(99, { getOrder, sleep: noSleep });
    expect(getOrder).toHaveBeenCalledTimes(3);
    expect(result.betId).toBe("0xfeed");
  });
});

describe("waitForOnchainBetReady — error modes", () => {
  it("throws OrderBetReadyInconsistentError when bet_ready=true but bet_id missing", async () => {
    const getOrder = vi.fn(async () => baseOrder({ bet_ready: true, bet_id: "" }));
    await expect(waitForOnchainBetReady(99, { getOrder, sleep: noSleep })).rejects.toBeInstanceOf(
      OrderBetReadyInconsistentError
    );
  });

  it("throws OrderBetReadyInconsistentError when bet_id is undefined despite ready", async () => {
    const getOrder = vi.fn(async () => baseOrder({ bet_ready: true }));
    await expect(waitForOnchainBetReady(99, { getOrder, sleep: noSleep })).rejects.toBeInstanceOf(
      OrderBetReadyInconsistentError
    );
  });

  it("throws OrderNotReadyTimeoutError when timeout exhausts before ready", async () => {
    let virtualNow = 0;
    const getOrder = vi.fn(async () => baseOrder({ bet_ready: false }));
    const fakeSleep = (ms: number) => {
      virtualNow += ms;
      return Promise.resolve();
    };
    await expect(
      waitForOnchainBetReady(99, {
        getOrder,
        sleep: fakeSleep,
        now: () => virtualNow,
        timeoutMs: 1000,
      })
    ).rejects.toBeInstanceOf(OrderNotReadyTimeoutError);
  });

  it("propagates getOrder API errors without retry", async () => {
    const getOrder = vi.fn(async () => {
      throw new Error("HTTP 500");
    });
    await expect(waitForOnchainBetReady(99, { getOrder, sleep: noSleep })).rejects.toThrow(
      "HTTP 500"
    );
    expect(getOrder).toHaveBeenCalledTimes(1);
  });

  it("OrderNotReadyTimeoutError carries orderId + elapsedMs", async () => {
    let virtualNow = 0;
    const getOrder = vi.fn(async () => baseOrder({ bet_ready: false }));
    const fakeSleep = (ms: number) => {
      virtualNow += ms;
      return Promise.resolve();
    };
    try {
      await waitForOnchainBetReady(99, {
        getOrder,
        sleep: fakeSleep,
        now: () => virtualNow,
        timeoutMs: 500,
      });
      expect.unreachable();
    } catch (e) {
      const err = e as OrderNotReadyTimeoutError;
      expect(err.orderId).toBe(99);
      expect(err.elapsedMs).toBeGreaterThanOrEqual(500);
    }
  });
});
