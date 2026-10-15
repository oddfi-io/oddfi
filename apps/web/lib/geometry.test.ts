import { describe, it, expect } from "vitest";
import { rectOverlapArea, rectArea, type Rect } from "./geometry";

const mk = (l: number, t: number, r: number, b: number): Rect => ({
  left: l,
  top: t,
  right: r,
  bottom: b,
});

describe("rectOverlapArea", () => {
  it("完全重叠 → a 的面积", () => {
    const a = mk(0, 0, 10, 10);
    expect(rectOverlapArea(a, a)).toBe(100);
  });

  it("部分重叠（右下角四分之一）", () => {
    expect(rectOverlapArea(mk(0, 0, 10, 10), mk(5, 5, 15, 15))).toBe(25);
  });

  it("无相交 → 0", () => {
    expect(rectOverlapArea(mk(0, 0, 10, 10), mk(20, 20, 30, 30))).toBe(0);
  });

  it("仅边接触 → 0（无面积）", () => {
    expect(rectOverlapArea(mk(0, 0, 10, 10), mk(10, 0, 20, 10))).toBe(0);
  });

  it("a 完全包含 b → b 的面积", () => {
    expect(rectOverlapArea(mk(0, 0, 100, 100), mk(20, 20, 30, 40))).toBe(200);
  });

  it("交换参数对称（commutative）", () => {
    const a = mk(0, 0, 10, 10);
    const b = mk(5, 5, 15, 15);
    expect(rectOverlapArea(a, b)).toBe(rectOverlapArea(b, a));
  });

  it("负坐标系统也正确", () => {
    expect(rectOverlapArea(mk(-10, -10, 0, 0), mk(-5, -5, 5, 5))).toBe(25);
  });

  // DD-108 §3.5 实际场景：浮窗 440×617 vs dock slot 440×533，左上重合
  it("DD-108 场景：浮窗左上对齐 slot → overlap = min(浮窗, slot) 面积", () => {
    const rnd = mk(1200, 100, 1640, 717); // 浮窗 440×617
    const slot = mk(1200, 200, 1640, 733); // slot 440×533
    // 重叠区域：宽 440 × 高 (717-200)=517 → 440*517 = 227,480
    expect(rectOverlapArea(rnd, slot)).toBe(440 * 517);
  });
});

describe("rectArea", () => {
  it("正常矩形", () => {
    expect(rectArea(mk(0, 0, 5, 4))).toBe(20);
  });

  it("退化矩形（点）→ 0", () => {
    expect(rectArea(mk(5, 5, 5, 5))).toBe(0);
  });

  it("逆序坐标 → 0（防御非法 rect）", () => {
    expect(rectArea(mk(10, 10, 5, 5))).toBe(0);
  });
});
