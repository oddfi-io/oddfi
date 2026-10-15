import { describe, it, expect } from "vitest";
import { parseFixtureName } from "./fixture";

describe("parseFixtureName", () => {
  it("小写 vs 分隔符", () => {
    expect(parseFixtureName("Argentina vs Brazil")).toEqual({
      home: "Argentina",
      away: "Brazil",
    });
  });

  it("大写 VS 分隔符", () => {
    expect(parseFixtureName("Mexico VS South Africa")).toEqual({
      home: "Mexico",
      away: "South Africa",
    });
  });

  it("混合大小写 Vs 分隔符", () => {
    expect(parseFixtureName("Real Madrid Vs Bayern Munich")).toEqual({
      home: "Real Madrid",
      away: "Bayern Munich",
    });
  });

  it("多个 vs 时取第一个分隔", () => {
    expect(parseFixtureName("A vs B vs C")).toEqual({ home: "A", away: "B vs C" });
  });

  it("无分隔符时 home 为完整原文", () => {
    expect(parseFixtureName("Parlay Ticket")).toEqual({ home: "Parlay Ticket", away: "" });
  });

  it("undefined 返回空", () => {
    expect(parseFixtureName(undefined)).toEqual({ home: "", away: "" });
  });

  it("空串返回空", () => {
    expect(parseFixtureName("")).toEqual({ home: "", away: "" });
  });

  it("trim 首尾空白", () => {
    expect(parseFixtureName("  A   vs   B  ")).toEqual({ home: "A", away: "B" });
  });

  // DD-105 验收 — 后端中文翻译 fixture_name
  it("中文 对 分隔符", () => {
    expect(parseFixtureName("巴黎圣日耳曼 对 阿森纳")).toEqual({
      home: "巴黎圣日耳曼",
      away: "阿森纳",
    });
  });

  it("中文 对阵 分隔符", () => {
    expect(parseFixtureName("皇家马德里 对阵 拜仁慕尼黑")).toEqual({
      home: "皇家马德里",
      away: "拜仁慕尼黑",
    });
  });

  it("对阵 优先于 对(避免 对阵 被部分匹配)", () => {
    // 当前实现 SEPARATOR 顺序: vs | 对阵 | 对,正则交替会按声明顺序匹配
    expect(parseFixtureName("A 对阵 B")).toEqual({ home: "A", away: "B" });
  });
});
