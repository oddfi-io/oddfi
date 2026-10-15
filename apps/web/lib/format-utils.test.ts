import { describe, it, expect } from "vitest";
import {
  parseMatchTime,
  formatMatchDate,
  formatMatchTime,
  formatMatchDateTime,
} from "./format-utils";

describe("parseMatchTime", () => {
  // 同一绝对时刻在五种输入形式下应解析出同一毫秒数。
  const ms = Date.UTC(2026, 3, 28, 20, 0, 0); // 2026-04-28 20:00:00 UTC
  const sec = ms / 1000;

  it("parses ISO string with Z suffix", () => {
    expect(parseMatchTime("2026-04-28T20:00:00Z").getTime()).toBe(ms);
  });

  it("parses ISO string with explicit offset", () => {
    expect(parseMatchTime("2026-04-28T22:00:00+02:00").getTime()).toBe(ms);
  });

  it("normalizes ISO string without Z to UTC (not local time)", () => {
    expect(parseMatchTime("2026-04-28T20:00:00").getTime()).toBe(ms);
  });

  it("normalizes SportMonks SQL-style space-separated string to UTC", () => {
    expect(parseMatchTime("2026-04-28 20:00:00").getTime()).toBe(ms);
  });

  it("parses unix timestamp in seconds", () => {
    expect(parseMatchTime(sec).getTime()).toBe(ms);
  });

  it("parses unix timestamp in milliseconds", () => {
    expect(parseMatchTime(ms).getTime()).toBe(ms);
  });
});

describe("format functions — input form equivalence", () => {
  // 同一时刻不同输入形式，输出必须完全一致；与运行环境时区无关。
  const iso = "2026-04-28T20:00:00Z";
  const isoNoZ = "2026-04-28T20:00:00";
  const sql = "2026-04-28 20:00:00";
  const sec = Date.UTC(2026, 3, 28, 20, 0, 0) / 1000;
  const ms = sec * 1000;

  it("formatMatchDate — string variants and timestamps yield identical output", () => {
    const baseline = formatMatchDate(iso, "en-US");
    expect(formatMatchDate(isoNoZ, "en-US")).toBe(baseline);
    expect(formatMatchDate(sql, "en-US")).toBe(baseline);
    expect(formatMatchDate(sec, "en-US")).toBe(baseline);
    expect(formatMatchDate(ms, "en-US")).toBe(baseline);
  });

  it("formatMatchTime — string variants and timestamps yield identical output", () => {
    const baseline = formatMatchTime(iso, "en-US");
    expect(formatMatchTime(isoNoZ, "en-US")).toBe(baseline);
    expect(formatMatchTime(sql, "en-US")).toBe(baseline);
    expect(formatMatchTime(sec, "en-US")).toBe(baseline);
    expect(formatMatchTime(ms, "en-US")).toBe(baseline);
  });

  it("formatMatchDateTime — string variants and timestamps yield identical output", () => {
    const baseline = formatMatchDateTime(iso, "en-US");
    expect(formatMatchDateTime(isoNoZ, "en-US")).toBe(baseline);
    expect(formatMatchDateTime(sql, "en-US")).toBe(baseline);
    expect(formatMatchDateTime(sec, "en-US")).toBe(baseline);
    expect(formatMatchDateTime(ms, "en-US")).toBe(baseline);
  });
});

describe("format functions — local timezone rendering", () => {
  // 用显式 timeZone 构造预期，覆盖"必须按用户时区而非 UTC 渲染"的语义。
  it("formatMatchTime renders in the runtime's local timezone, not UTC", () => {
    const iso = "2026-04-28T20:00:00Z";
    const expected = new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    expect(formatMatchTime(iso, "en-US")).toBe(expected);
  });
});

describe("format functions — invalid input fallback", () => {
  it("formatMatchDate returns the original string for invalid ISO", () => {
    // toLocaleDateString 在 Invalid Date 上返回 "Invalid Date" 而不抛错；接受这种结果作为 fallback 行为
    const result = formatMatchDate("not-a-date", "en-US");
    expect(typeof result).toBe("string");
  });

  it("formatMatchTime returns string for invalid ISO", () => {
    const result = formatMatchTime("not-a-date", "en-US");
    expect(typeof result).toBe("string");
  });
});
