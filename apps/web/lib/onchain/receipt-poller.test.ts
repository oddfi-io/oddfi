import { describe, it, expect, vi } from "vitest";
import { waitForReceipt, ReceiptTimeoutError } from "./receipt-poller";

type ReceiptLike = { status: "success" | "reverted"; blockNumber: bigint };

function makeStubClient(sequence: Array<ReceiptLike | "pending">) {
  let i = 0;
  return {
    async getTransactionReceipt(): Promise<ReceiptLike> {
      const next = sequence[Math.min(i, sequence.length - 1)];
      i++;
      if (next === "pending") throw new Error("not found");
      return next;
    },
  };
}

const noSleep = () => Promise.resolve();
const TX = "0x1234" as `0x${string}`;

describe("waitForReceipt", () => {
  it("returns success when receipt status=success on first poll", async () => {
    const client = makeStubClient([{ status: "success", blockNumber: 12345n }]);
    const result = await waitForReceipt(TX, { client, sleep: noSleep });
    expect(result).toEqual({ status: "success", blockNumber: 12345n, txHash: TX });
  });

  it("retries when receipt pending then resolves on subsequent poll", async () => {
    const sequence: Array<ReceiptLike | "pending"> = [
      "pending",
      "pending",
      { status: "success", blockNumber: 99n },
    ];
    let i = 0;
    const spy = vi.fn(async (): Promise<ReceiptLike> => {
      const next = sequence[i++];
      if (next === "pending") throw new Error("not found");
      return next;
    });
    const result = await waitForReceipt(TX, {
      client: { getTransactionReceipt: spy },
      sleep: noSleep,
    });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("success");
    expect(result.blockNumber).toBe(99n);
  });

  it("returns reverted when receipt status=reverted (no throw)", async () => {
    const client = makeStubClient([{ status: "reverted", blockNumber: 7n }]);
    const result = await waitForReceipt(TX, { client, sleep: noSleep });
    expect(result.status).toBe("reverted");
    expect(result.blockNumber).toBe(7n);
  });

  it("throws ReceiptTimeoutError when polling exceeds timeoutMs", async () => {
    // 始终 pending 的 client + 受控 fake clock：sleep 推进虚拟时间
    let virtualNow = 0;
    const client = {
      async getTransactionReceipt(): Promise<ReceiptLike> {
        throw new Error("not found");
      },
    };
    const fakeSleep = (ms: number) => {
      virtualNow += ms;
      return Promise.resolve();
    };
    const fakeNow = () => virtualNow;
    await expect(
      waitForReceipt(TX, { client, sleep: fakeSleep, now: fakeNow, timeoutMs: 1000 })
    ).rejects.toBeInstanceOf(ReceiptTimeoutError);
  });

  it("ReceiptTimeoutError carries txHash + elapsedMs", async () => {
    let virtualNow = 0;
    const client = {
      async getTransactionReceipt(): Promise<ReceiptLike> {
        throw new Error("not found");
      },
    };
    const fakeSleep = (ms: number) => {
      virtualNow += ms;
      return Promise.resolve();
    };
    try {
      await waitForReceipt(TX, {
        client,
        sleep: fakeSleep,
        now: () => virtualNow,
        timeoutMs: 500,
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ReceiptTimeoutError);
      const err = e as ReceiptTimeoutError;
      expect(err.txHash).toBe(TX);
      expect(err.elapsedMs).toBeGreaterThanOrEqual(500);
    }
  });
});
