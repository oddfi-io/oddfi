// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BetTypeCell } from "./BetTypeCell";

describe("BetTypeCell", () => {
  it("渲染玩法 / 盘口 / 赔率三行", () => {
    render(<BetTypeCell marketLabel="Asian Total" handicapLine="0.5" odds="1.59" />);
    expect(screen.getByText("Asian Total")).toBeDefined();
    expect(screen.getByText("Blend (0.5)")).toBeDefined();
    expect(screen.getByText("1.59 x")).toBeDefined();
  });

  it("盘口缺失（handicapLine undefined）→ 渲染 Blend (--)", () => {
    render(<BetTypeCell marketLabel="Asian Handicap" odds="3.1" />);
    expect(screen.getByText("Blend (--)")).toBeDefined();
  });

  it("玩法名透传（已 i18n 翻译后的字符串）", () => {
    render(<BetTypeCell marketLabel="Fulltime Result" odds="2.1" />);
    expect(screen.getByText("Fulltime Result")).toBeDefined();
  });

  it("blendLabel 可自定义", () => {
    render(
      <BetTypeCell marketLabel="Asian Total" handicapLine="2.5" odds="1.4" blendLabel="盘口" />
    );
    expect(screen.getByText("盘口 (2.5)")).toBeDefined();
  });

  it("赔率行带 x 后缀", () => {
    render(<BetTypeCell marketLabel="Asian Total" handicapLine="0.5" odds="4.428" />);
    expect(screen.getByText("4.428 x")).toBeDefined();
  });

  it("文本色按行分配（玩法 primary / 盘口 fn-yellow / 赔率 brand-default）", () => {
    render(<BetTypeCell marketLabel="Asian Total" handicapLine="0.5" odds="1.59" />);
    expect(screen.getByText("Asian Total").className).toContain("text-primary");
    expect(screen.getByText("Blend (0.5)").className).toContain("text-fn-yellow");
    expect(screen.getByText("1.59 x").className).toContain("text-brand-default");
  });
});
