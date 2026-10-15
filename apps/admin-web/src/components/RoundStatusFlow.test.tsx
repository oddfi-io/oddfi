// Tests for RoundStatusFlow — AntD Steps 状态机可视化。
// 契约：docs/spa-presale-admin/04-components.md §2，M5-T25。
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfigProvider } from "antd";
import { vercelTheme } from "@/theme/vercelTheme";
import { RoundStatusFlow } from "./RoundStatusFlow";
import type { RoundStatus } from "@/types/presale";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderFlow(status: RoundStatus, manualOverride?: boolean) {
  return render(
    <ConfigProvider theme={vercelTheme}>
      <RoundStatusFlow status={status} manualOverride={manualOverride} />
    </ConfigProvider>,
  );
}

// AntD Steps injects aria / title attributes; query by title text.
function getStepByTitle(title: string) {
  // AntD renders step titles as plain text nodes inside .ant-steps-item-title
  return screen.getByText(title);
}

// ── 4 状态映射 ────────────────────────────────────────────────────────────────

describe("RoundStatusFlow — status rendering", () => {
  it.each([
    ["upcoming", "未开始", false] as [RoundStatus, string, boolean],
    ["active", "进行中", false] as [RoundStatus, string, boolean],
    ["paused", "进行中（已暂停）", false] as [RoundStatus, string, boolean],
    ["ended", "已结束", false] as [RoundStatus, string, boolean],
  ])("status=%s renders step title=%s", (status, expectedTitle) => {
    renderFlow(status);
    expect(getStepByTitle(expectedTitle)).toBeInTheDocument();
  });

  it("upcoming — 未开始 step is present and 进行中/已结束 also present", () => {
    renderFlow("upcoming");
    expect(screen.getByText("未开始")).toBeInTheDocument();
    expect(screen.getByText("进行中")).toBeInTheDocument();
    expect(screen.getByText("已结束")).toBeInTheDocument();
  });

  it("active — standard 进行中 label (not 已暂停 variant)", () => {
    renderFlow("active");
    expect(screen.getByText("进行中")).toBeInTheDocument();
    expect(screen.queryByText("进行中（已暂停）")).not.toBeInTheDocument();
  });

  it("paused — shows paused variant label", () => {
    renderFlow("paused");
    expect(screen.getByText("进行中（已暂停）")).toBeInTheDocument();
    expect(screen.queryByText(/^进行中$/, { exact: true })).not.toBeInTheDocument();
  });

  it("ended — all three step titles visible", () => {
    renderFlow("ended");
    expect(screen.getByText("未开始")).toBeInTheDocument();
    expect(screen.getByText("进行中")).toBeInTheDocument();
    expect(screen.getByText("已结束")).toBeInTheDocument();
  });
});

// ── AntD Steps current index（通过 aria-current 或 .ant-steps-item-active）────

describe("RoundStatusFlow — current step index via DOM class", () => {
  // AntD marks the current step with .ant-steps-item-active on its container.
  // We verify the correct title text is inside an active step.
  function getActiveStepTitles(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll(".ant-steps-item-active"))
      .map((el) => el.querySelector(".ant-steps-item-title")?.textContent?.trim() ?? "");
  }

  it("upcoming — step 0 (未开始) is active", () => {
    const { container } = renderFlow("upcoming");
    const activeTitles = getActiveStepTitles(container);
    expect(activeTitles.some((t) => t.includes("未开始"))).toBe(true);
  });

  it("active — step 1 (进行中) is active", () => {
    const { container } = renderFlow("active");
    const activeTitles = getActiveStepTitles(container);
    expect(activeTitles.some((t) => t.includes("进行中"))).toBe(true);
  });

  it("paused — step 1 (进行中 variant) is active", () => {
    const { container } = renderFlow("paused");
    const activeTitles = getActiveStepTitles(container);
    expect(activeTitles.some((t) => t.includes("进行中（已暂停）"))).toBe(true);
  });

  it("ended — step 2 (已结束) is marked finish", () => {
    const { container } = renderFlow("ended");
    // AntD marks finished steps with .ant-steps-item-finish
    const finishItems = container.querySelectorAll(".ant-steps-item-finish");
    expect(finishItems.length).toBeGreaterThan(0);
  });
});

// ── paused uses error status ──────────────────────────────────────────────────

describe("RoundStatusFlow — paused uses error status class", () => {
  it("paused — Steps container carries ant-steps-status-error", () => {
    const { container } = renderFlow("paused");
    // AntD applies the status class to the Steps root element or item.
    const errorEl = container.querySelector(".ant-steps-item-error");
    expect(errorEl).not.toBeNull();
  });

  it("active — no error class", () => {
    const { container } = renderFlow("active");
    expect(container.querySelector(".ant-steps-item-error")).toBeNull();
  });
});

// ── manualOverride Tag ────────────────────────────────────────────────────────

describe("RoundStatusFlow — manualOverride Tag", () => {
  it.each([
    ["upcoming", true] as [RoundStatus, boolean],
    ["active", true] as [RoundStatus, boolean],
    ["paused", true] as [RoundStatus, boolean],
    ["ended", true] as [RoundStatus, boolean],
  ])("status=%s manualOverride=true → shows 手动干预 tag", (status) => {
    renderFlow(status, true);
    expect(screen.getByText(/手动干预/)).toBeInTheDocument();
  });

  it.each([
    ["upcoming"] as [RoundStatus],
    ["active"] as [RoundStatus],
    ["paused"] as [RoundStatus],
    ["ended"] as [RoundStatus],
  ])("status=%s manualOverride=false → no 手动干预 tag", (status) => {
    renderFlow(status, false);
    expect(screen.queryByText(/手动干预/)).not.toBeInTheDocument();
  });

  it("manualOverride defaults to false when omitted", () => {
    renderFlow("active");
    expect(screen.queryByText(/手动干预/)).not.toBeInTheDocument();
  });

  it("manualOverride tag text includes cron 已停止 hint", () => {
    renderFlow("active", true);
    expect(screen.getByText(/cron 已停止/)).toBeInTheDocument();
  });
});
