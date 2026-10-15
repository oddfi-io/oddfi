// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TeamVsVerticalCell } from "./TeamVsVerticalCell";

const home = { name: "Portugal", iconUrl: "https://cdn.example.com/home.png" };
const away = { name: "Argentina", iconUrl: "https://cdn.example.com/away.png" };

describe("TeamVsVerticalCell", () => {
  it("渲染主客队名 + 比分", () => {
    render(<TeamVsVerticalCell home={home} away={away} homeScore={6} awayScore={1} />);
    expect(screen.getByText("Portugal")).toBeDefined();
    expect(screen.getByText("Argentina")).toBeDefined();
    expect(screen.getByText("6")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
  });

  it("主队胜 → 仅主队行展示胜方箭头", () => {
    render(<TeamVsVerticalCell home={home} away={away} homeScore={3} awayScore={1} />);
    expect(screen.getAllByLabelText("winner")).toHaveLength(1);
  });

  it("客队胜 → 仅客队行展示胜方箭头", () => {
    render(<TeamVsVerticalCell home={home} away={away} homeScore={0} awayScore={2} />);
    expect(screen.getAllByLabelText("winner")).toHaveLength(1);
  });

  it("平局（score 相等）→ 不展示箭头", () => {
    render(<TeamVsVerticalCell home={home} away={away} homeScore={1} awayScore={1} />);
    expect(screen.queryAllByLabelText("winner")).toHaveLength(0);
  });

  it("比分缺失（任一 undefined）→ 比分位渲染 -- + 不展示箭头", () => {
    render(<TeamVsVerticalCell home={home} away={away} />);
    // 两个 "--" 占位（主客各一个）
    const dashes = screen.getAllByText("--");
    expect(dashes).toHaveLength(2);
    expect(screen.queryAllByLabelText("winner")).toHaveLength(0);
  });

  it("仅主队比分有值 → 缺失侧渲染 --，胜方箭头隐藏（防止误导胜负）", () => {
    render(<TeamVsVerticalCell home={home} away={away} homeScore={2} awayScore={undefined} />);
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("--")).toBeDefined();
    expect(screen.queryAllByLabelText("winner")).toHaveLength(0);
  });

  it("队标缺失 → 退化为首字母 placeholder", () => {
    render(
      <TeamVsVerticalCell
        home={{ name: "Bull" }}
        away={{ name: "Galatasaray" }}
        homeScore={1}
        awayScore={6}
      />
    );
    // 主队首字母 "B"，客队首字母 "G"
    expect(screen.getByText("B")).toBeDefined();
    expect(screen.getByText("G")).toBeDefined();
  });

  it("负方文本走 text-tertiary（dimmed），胜方走 text-primary", () => {
    render(<TeamVsVerticalCell home={home} away={away} homeScore={6} awayScore={1} />);
    expect(screen.getByText("Portugal").className).toContain("text-primary");
    expect(screen.getByText("Argentina").className).toContain("text-tertiary");
  });

  it("平局两侧文本都走 text-primary（无负方）", () => {
    render(<TeamVsVerticalCell home={home} away={away} homeScore={2} awayScore={2} />);
    expect(screen.getByText("Portugal").className).toContain("text-primary");
    expect(screen.getByText("Argentina").className).toContain("text-primary");
    expect(screen.getByText("Argentina").className).not.toContain("text-tertiary");
  });
});
