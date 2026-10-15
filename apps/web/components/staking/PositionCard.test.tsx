// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import PositionCard from "./PositionCard";
import type { StakingPosition, LockDays } from "./types";
import en from "../../messages/en.json";

function renderCard(props: {
  position: StakingPosition;
  onUnstake?: () => void;
  pendingUnstakeId?: string;
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PositionCard
        position={props.position}
        onUnstake={props.onUnstake ?? (() => {})}
        pendingUnstakeId={props.pendingUnstakeId}
      />
    </NextIntlClientProvider>
  );
}

const BASE: Omit<StakingPosition, "status"> = {
  id: "1",
  amount: "100",
  multiplier: 1.8,
  lockDays: 60 as LockDays, // DD-149：planId 2（1.8x）对应真实锁仓 60 天
  stakedAt: "2026-05-10T08:00:00Z",
  unlockAt: "2026-05-11T08:00:00Z",
  earned: "5",
};

describe("PositionCard", () => {
  it("ready status: shows Unstake button, clicking it fires onUnstake", () => {
    const onUnstake = vi.fn();
    renderCard({ position: { ...BASE, status: "ready" }, onUnstake });
    const btns = screen.getAllByRole("button", { name: /unstake/i });
    expect(btns.length).toBeGreaterThan(0);
    fireEvent.click(btns[0]);
    expect(onUnstake).toHaveBeenCalledTimes(1);
  });

  it("active status: renders no action button (early unstake entry hidden)", () => {
    renderCard({ position: { ...BASE, status: "active" } });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("withdrawn status: renders nothing (component returns null)", () => {
    const { container } = renderCard({ position: { ...BASE, status: "withdrawn" } });
    expect(container.firstChild).toBeNull();
  });
});
