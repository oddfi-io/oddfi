import { describe, it, expect } from "vitest";
import {
  mapAnomalyReason,
  mapBindErrorCode,
  mapDepositErrorCode,
  mapDepositValidationError,
} from "./error-map";

describe("mapDepositErrorCode — report-tx 业务码（§5.1）", () => {
  it("40006/40007/40008 → dialog + BSCScan", () => {
    expect(mapDepositErrorCode(40006).form).toBe("dialog");
    expect(mapDepositErrorCode(40006).showBscScan).toBe(true);
    expect(mapDepositErrorCode(40007).form).toBe("dialog");
    expect(mapDepositErrorCode(40008).message).toBe("depositError.notUsdt");
  });
  it("40405 TX_NOT_FOUND → pending（继续轮询不报错）", () => {
    expect(mapDepositErrorCode(40405).form).toBe("pending");
  });
  it("40902 WALLET_MISMATCH → dialog", () => {
    expect(mapDepositErrorCode(40902).form).toBe("dialog");
  });
  it("50301 LISTENER_LAG → silent", () => {
    expect(mapDepositErrorCode(50301).form).toBe("silent");
  });
  it("未知码 → toast 兜底", () => {
    expect(mapDepositErrorCode(99999).form).toBe("toast");
    expect(mapDepositErrorCode(99999).message).toBe("depositError.unknown");
  });
  it("各业务码映射到正确 i18n key", () => {
    expect(mapDepositErrorCode(40001).message).toBe("depositError.belowMin");
    expect(mapDepositErrorCode(40006).message).toBe("depositError.invalidTx");
    expect(mapDepositErrorCode(40007).message).toBe("depositError.notToVault");
    expect(mapDepositErrorCode(40901).message).toBe("depositError.roundNotActive");
    expect(mapDepositErrorCode(40902).message).toBe("depositError.walletMismatch");
  });
});

describe("mapBindErrorCode — referral/bind 业务码", () => {
  it("40004 自邀 / 40404 无效码 / 40903 已绑", () => {
    expect(mapBindErrorCode(40004).message).toBe("bindError.selfReferral");
    expect(mapBindErrorCode(40404).message).toBe("bindError.invalidCode");
    expect(mapBindErrorCode(40903).message).toBe("bindError.alreadyBound");
  });
  it("未知码兜底", () => {
    expect(mapBindErrorCode(12345).message).toBe("bindError.unknown");
  });
});

describe("mapAnomalyReason — §5.2（带 default 兜底）", () => {
  it("已知枚举各自映射到正确 i18n key + 客服 + BSCScan", () => {
    expect(mapAnomalyReason("overflow").message).toBe("anomaly.overflow");
    expect(mapAnomalyReason("overflow").showSupport).toBe(true);
    expect(mapAnomalyReason("from_mismatch").message).toBe("anomaly.fromMismatch");
    expect(mapAnomalyReason("non_usdt").message).toBe("anomaly.nonUsdt");
    expect(mapAnomalyReason("round_mismatch").message).toBe("anomaly.roundMismatch");
    expect(mapAnomalyReason("late_arrival").message).toBe("anomaly.lateArrival");
    expect(mapAnomalyReason("below_min").message).toBe("anomaly.belowMin");
    expect(mapAnomalyReason("unclaimed").message).toBe("anomaly.generic");
    expect(mapAnomalyReason("fake_referrer").message).toBe("anomaly.generic");
  });
  it("未知 reason（no_referrer_record / null / 后端新增）→ 通用兜底，不漏提示", () => {
    expect(mapAnomalyReason("no_referrer_record").message).toBe("anomaly.generic");
    expect(mapAnomalyReason("no_referrer_record").showSupport).toBe(true);
    expect(mapAnomalyReason(null).message).toBe("anomaly.generic");
    expect(mapAnomalyReason("brand_new_reason_2027").message).toBe("anomaly.generic");
  });
});

describe("mapDepositValidationError — 预校验 i18n key", () => {
  it("below_min 有 ctx → belowMin key；无 ctx → belowMinNoCtx key", () => {
    expect(mapDepositValidationError("below_min", { minSubscribeUsd: "1000" })).toBe(
      "validationError.belowMin"
    );
    expect(mapDepositValidationError("below_min")).toBe("validationError.belowMinNoCtx");
  });
  it("各错误均映射到非空 i18n key", () => {
    const cases: Parameters<typeof mapDepositValidationError>[0][] = [
      "not_authenticated",
      "wrong_chain",
      "invalid_amount",
      "round_not_active",
      "exceeds_remaining",
      "near_boundary",
      "insufficient_balance",
    ];
    for (const e of cases) {
      const key = mapDepositValidationError(e);
      expect(key).toBeTruthy();
      expect(key.startsWith("validationError.")).toBe(true);
    }
  });
});
