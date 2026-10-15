import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PROMO_BANNER_THEMES } from "./home-banner-decorations";

// 资产存在性守卫（REV-v1-A C-1：组件只查 src 字符串，文件缺失测试不报，生产 404）
// 这里逐个核对 PROMO_BANNER_THEMES 引用的插画 + 背景文件确实在 public/ 落盘。
describe("PROMO_BANNER_THEMES 资产存在性", () => {
  const publicDir = join(__dirname, "..", "public");
  const entries = Object.entries(PROMO_BANNER_THEMES);

  it("覆盖全部 5 个 template", () => {
    expect(entries.length).toBe(5);
  });

  it.each(entries)("%s 的插画文件存在于 public/", (_template, theme) => {
    expect(existsSync(join(publicDir, theme.illustration.src))).toBe(true);
  });

  it.each(entries)("%s 的背景 SVG 文件存在于 public/", (_template, theme) => {
    expect(existsSync(join(publicDir, theme.background))).toBe(true);
  });
});
