import { describe, it, expect } from "vitest";
import { nextReferralPollInterval } from "./useReferralMe";

// DD-119 #1：新用户空码轮询的双封顶决策（成功 10 次 / 错误 5 次）
describe("nextReferralPollInterval", () => {
  it("已拿到 myCode → 停止轮询", () => {
    expect(
      nextReferralPollInterval({
        data: { myCode: "0x45623a" },
        dataUpdateCount: 1,
        errorUpdateCount: 0,
      })
    ).toBe(false);
  });

  it("空码 + 计数未达上限 → 继续轮询 3s", () => {
    expect(
      nextReferralPollInterval({ data: { myCode: null }, dataUpdateCount: 2, errorUpdateCount: 0 })
    ).toBe(3_000);
  });

  it("首次无 data（undefined）→ 继续轮询 3s", () => {
    expect(
      nextReferralPollInterval({ data: undefined, dataUpdateCount: 0, errorUpdateCount: 0 })
    ).toBe(3_000);
  });

  it("myCode 空字符串视为无码 → 继续轮询", () => {
    expect(
      nextReferralPollInterval({ data: { myCode: "" }, dataUpdateCount: 1, errorUpdateCount: 0 })
    ).toBe(3_000);
  });

  it("成功 fetch 达 10 次仍无码 → 放弃（正常空窗封顶）", () => {
    expect(
      nextReferralPollInterval({ data: { myCode: null }, dataUpdateCount: 10, errorUpdateCount: 0 })
    ).toBe(false);
  });

  it("连续错误达 5 次 → 放弃（后端异常封顶，dataUpdateCount 不增也能停）", () => {
    expect(
      nextReferralPollInterval({ data: undefined, dataUpdateCount: 0, errorUpdateCount: 5 })
    ).toBe(false);
  });
});
