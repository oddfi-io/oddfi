import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeChips } from "./TimeChips";
import { currentStage } from "@/pages/events/_format";
import type { EventTimes } from "@/types/events";

const TIMES: EventTimes = {
  open: "2026-06-01T10:00:00+08:00",
  lock: "2026-06-01T19:55:00+08:00",
  kickoff: "2026-06-01T20:00:00+08:00",
  settle: null,
};

// DD003 W2（走查 6/5）：高亮纯 status 驱动，不再被「未开盘」抢占。
// opened 与 status 正交（DD002 §3.1），未开盘语义由整行置灰 + SignalTag 独立承担。
describe("currentStage — 阶段高亮映射（DD003 W2）", () => {
  it("pending（未开赛，含未开盘组合）→ kickoff", () => {
    expect(currentStage("pending")).toBe("kickoff");
  });
  it("active（已开赛未锁定 + 锁定中）→ lock", () => {
    expect(currentStage("active")).toBe("lock");
  });
  it("settled → settle", () => {
    expect(currentStage("settled")).toBe("settle");
  });
});

describe("TimeChips", () => {
  it("chip 显示当前阶段标签 + 时间", () => {
    render(<TimeChips times={TIMES} status="pending" />);
    expect(screen.getByText(/开赛 2026-06-01 20:00/)).toBeInTheDocument();
  });

  it("settle 时间为 null 的 settled 行 chip 显示「—」不报错", () => {
    render(<TimeChips times={TIMES} status="settled" />);
    expect(screen.getByText(/结算 —/)).toBeInTheDocument();
  });

  it("kickoff 为 null 的 pending 行 chip 显示「开赛 —」不报错（DD003 W2 边界）", () => {
    render(<TimeChips times={{ ...TIMES, kickoff: null }} status="pending" />);
    expect(screen.getByText(/开赛 —/)).toBeInTheDocument();
  });
});
