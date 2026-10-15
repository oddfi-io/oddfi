// badge 计算纯函数层（轮询/降级行为由联调 A「停 mock 验证保持上次值」覆盖）。
import { describe, it, expect } from "vitest";
import { badgeValue } from "./useApprovalCounts";

describe("badgeValue — 乐观更新 badge 钳制", () => {
  it("无本地决策时 = 服务端计数", () => {
    expect(badgeValue(3, 0)).toBe(3);
  });

  it("本地已决策 → 减扣", () => {
    expect(badgeValue(3, 1)).toBe(2);
  });

  it("减扣不为负（服务端已收敛 + 本地残留）", () => {
    expect(badgeValue(1, 2)).toBe(0);
  });

  it("服务端从未成功返回 → 0（首载失败不弹错）", () => {
    expect(badgeValue(undefined, 0)).toBe(0);
    expect(badgeValue(undefined, 3)).toBe(0);
  });
});
