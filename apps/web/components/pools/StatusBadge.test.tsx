// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PositionStatusBadge, PositionAction } from "./StatusBadge";
import type { PositionStatus } from "./types";
import enMessages from "@/messages/en.json";

// 现在 PositionStatusBadge / PositionAction 都走 next-intl，render 必须套 Provider
function renderBadge(status: PositionStatus, timeLeft = "") {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PositionStatusBadge status={status} timeLeft={timeLeft} />
    </NextIntlClientProvider>
  );
}
function renderAction(status: PositionStatus) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PositionAction status={status} onClick={() => {}} />
    </NextIntlClientProvider>
  );
}

describe("PositionStatusBadge — 6 个 LpPositionState 都有独立文案", () => {
  it("active 显示 'Active' 或 'Active · Xd'（有 timeLeft 时）", () => {
    const { rerender } = renderBadge("active");
    expect(screen.getByText("Active")).toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PositionStatusBadge status="active" timeLeft="3d" />
      </NextIntlClientProvider>
    );
    // U+00B7 中点 + 前后空格
    expect(screen.getByText("Active · 3d")).toBeInTheDocument();
  });

  it("ready 显示 'Ready'", () => {
    renderBadge("ready");
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("unbonding 独立显示 'Unbonding'，不被误归类为 active", () => {
    renderBadge("unbonding");
    expect(screen.getByText("Unbonding")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("withdrawable 显示 'Withdrawable'", () => {
    renderBadge("withdrawable");
    expect(screen.getByText("Withdrawable")).toBeInTheDocument();
  });

  it("withdrawn 显示 'Withdrawn'（灰色终态）", () => {
    renderBadge("withdrawn");
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
  });

  it("liquidated 显示 'Liquidated'（红色警示）", () => {
    renderBadge("liquidated");
    expect(screen.getByText("Liquidated")).toBeInTheDocument();
  });
});

describe("PositionAction — 操作列按 status 分 2 种视觉（按用户映射表）", () => {
  it("ready → Redeem 按钮（可点击）", () => {
    renderAction("ready");
    const btn = screen.getByRole("button", { name: "Redeem" });
    expect(btn).toBeInTheDocument();
  });

  it("withdrawable → Withdraw 按钮（最终提币）", () => {
    renderAction("withdrawable");
    const btn = screen.getByRole("button", { name: "Withdraw" });
    expect(btn).toBeInTheDocument();
  });

  it("active → 灰色 — 占位（无按钮）", () => {
    renderAction("active");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("unbonding → 灰色 — 占位（排队等 epoch）", () => {
    renderAction("unbonding");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("withdrawn → 灰色 — 终态占位", () => {
    renderAction("withdrawn");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("liquidated → 灰色 — 终态占位", () => {
    renderAction("liquidated");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
