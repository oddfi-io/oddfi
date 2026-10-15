import { describe, it, expect } from "vitest";

import { activityColor, activityI18nKey, cashColor } from "./transaction-display";

// ENH-037：链上撤单兑现（cashout）流水行的展示派生。
// 产品确认：Activity 文案走「Cash Out / 已兑现」，Cash 列 +兑现额绿色。
describe("transaction-display · cashout（ENH-037）", () => {
  it("activityI18nKey(cashout) → actCashout", () => {
    expect(activityI18nKey("cashout")).toBe("actCashout");
  });

  it("cashColor(cashout, 正数) → 绿色（+兑现额）", () => {
    expect(cashColor("cashout", true)).toBe("text-fn-green");
  });

  it("cashColor(cashout) 不走 cancel/claim/void 白名单（与链下撤单 cancel 的白色区分）", () => {
    expect(cashColor("cancel", true)).toBe("text-primary");
    expect(cashColor("cashout", true)).not.toBe("text-primary");
  });

  it("activityColor(cashout) → 默认主色（白，仅金额绿，文案不强调色）", () => {
    expect(activityColor("cashout")).toBe("text-primary");
  });
});
