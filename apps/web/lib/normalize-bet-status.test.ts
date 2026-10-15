import { describe, it, expect } from "vitest";
import { normalizeBetStatus } from "./normalize-bet-status";

describe("normalizeBetStatus", () => {
  it.each([
    ["live", "live"],
    ["pending", "pending"],
    ["won", "won"],
    ["lost", "lost"],
    ["push", "push"],
    ["void", "void"],
  ])("小写 %s → %s（直通）", (input, expected) => {
    expect(normalizeBetStatus(input)).toBe(expected);
  });

  it.each([
    ["LIVE", "live"],
    ["WON", "won"],
    ["PUSH", "push"],
    ["VOID", "void"],
  ])("DB 大写 %s → 小写 %s（DD-087 §3.1 归一）", (input, expected) => {
    expect(normalizeBetStatus(input)).toBe(expected);
  });

  it("混合大小写 + 前后空白", () => {
    expect(normalizeBetStatus(" Won ")).toBe("won");
    expect(normalizeBetStatus("PuSh")).toBe("push");
  });

  it("null / undefined → active 兜底", () => {
    expect(normalizeBetStatus(null)).toBe("active");
    expect(normalizeBetStatus(undefined)).toBe("active");
  });

  it("空字符串 → active 兜底", () => {
    expect(normalizeBetStatus("")).toBe("active");
  });

  it("未知值 → active 兜底", () => {
    expect(normalizeBetStatus("CLAIMED")).toBe("active");
    expect(normalizeBetStatus("CANCELLED")).toBe("active");
    expect(normalizeBetStatus("foo")).toBe("active");
  });
});
