import { describe, it, expect } from "vitest";
import { toUserTxMessage } from "./tx-error";
import { ReceiptTimeoutError } from "./receipt-poller";

describe("toUserTxMessage", () => {
  it("ReceiptTimeoutError → 超时友好句", () => {
    const msg = toUserTxMessage(new ReceiptTimeoutError("0xabc" as `0x${string}`, 30000));
    expect(msg).toMatch(/taking longer/i);
  });

  it("*RevertedError（按 name 识别）→ 链上拒绝句", () => {
    const err = new Error("reverted");
    err.name = "DepositRevertedError";
    expect(toUserTxMessage(err)).toMatch(/rejected on-chain/i);
  });

  it("后端 500 retryable（用户实测 deposit_match 场景）→ 服务器繁忙，不透传 Go 串", () => {
    const err = {
      name: "HTTPError",
      response: { status: 500 },
      responseJSON: {
        code: 500,
        message:
          "retryable: DepositMatch.InsertOrLoad: ErrInfraRPC: business: db SelectInserted: record not found",
      },
    };
    const msg = toUserTxMessage(err);
    expect(msg).toMatch(/server is busy/i);
    expect(msg).not.toMatch(/InsertOrLoad|ErrInfraRPC|record not found/);
  });

  it("业务码 INSUFFICIENT_BALANCE → 余额不足句", () => {
    const err = { response: { status: 400 }, responseJSON: { message: "INSUFFICIENT_BALANCE" } };
    expect(toUserTxMessage(err)).toMatch(/insufficient balance/i);
  });

  it("业务码 DEPOSIT_AMOUNT_TOO_SMALL → 低于最小额", () => {
    const err = {
      response: { status: 400 },
      responseJSON: { message: "DEPOSIT_AMOUNT_TOO_SMALL" },
    };
    expect(toUserTxMessage(err)).toMatch(/below the minimum/i);
  });

  it("其它 4xx → 通用请求失败句", () => {
    const err = { response: { status: 422 }, responseJSON: { message: "weird" } };
    expect(toUserTxMessage(err)).toMatch(/check and try again/i);
  });

  it("未知错误 → 通用兜底，不抛", () => {
    expect(toUserTxMessage(new Error("boom"))).toMatch(/transaction failed/i);
    expect(toUserTxMessage(null)).toMatch(/transaction failed/i);
    expect(toUserTxMessage(undefined)).toMatch(/transaction failed/i);
  });
});
