// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import SignalLightIndicator, { resolveSignal, isSignalDisabled } from "./SignalLightIndicator";
import type { PreviewSignalState } from "@/hooks/usePreviewSignal";
import type { PreviewSignalRes, SignalLevel } from "@/types/onchain-betting";

function withIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function makeData(overrides: Partial<PreviewSignalRes> = {}): PreviewSignalRes {
  return {
    signal: 0 as SignalLevel,
    acceptedAmount: "100000000000000000000",
    lockedOdds: "22900",
    partialFill: false,
    maxAcceptableAmount: "300000000000000000000",
    quoteVersion: "21",
    cachedAt: 1779544338,
    cacheTtlMs: 500,
    degraded: false,
    ...overrides,
  };
}

function state(overrides: Partial<PreviewSignalState>): PreviewSignalState {
  return {
    data: null,
    loading: false,
    error: null,
    lastQuoteVersion: null,
    ...overrides,
  };
}

// ─── resolveSignal — DD §3.3 优先级表 9 分支 ──────────────────────────────────

describe("resolveSignal — 优先级表", () => {
  it("1. loading → loading variant", () => {
    expect(resolveSignal(state({ loading: true }))?.variant).toBe("loading");
  });

  it("2. error.kind=network → network variant（高于 server）", () => {
    const r = resolveSignal(state({ error: { kind: "network", message: "timeout" } }));
    expect(r?.variant).toBe("network");
  });

  it("3. error.kind=server → errorOther variant", () => {
    const r = resolveSignal(state({ error: { kind: "server", status: 500, message: "boom" } }));
    expect(r?.variant).toBe("errorOther");
  });

  it("3. error.kind=params → errorOther variant", () => {
    const r = resolveSignal(state({ error: { kind: "params", code: 1001, message: "bad" } }));
    expect(r?.variant).toBe("errorOther");
  });

  it("4. degraded=true 覆盖 signal/partialFill", () => {
    const r = resolveSignal(
      state({ data: makeData({ degraded: true, signal: 0, partialFill: true }) })
    );
    expect(r?.variant).toBe("degraded");
  });

  it("5. signal=3 → red, max 用 maxAcceptableAmount 换算", () => {
    const r = resolveSignal(
      state({
        data: makeData({ signal: 3, maxAcceptableAmount: "150000000000000000000" }),
      })
    );
    expect(r?.variant).toBe("red");
    expect(r?.amount).toBe("150.00");
  });

  it("6. signal=2 + partialFill → orange, accepted 用 acceptedAmount 换算", () => {
    const r = resolveSignal(
      state({
        data: makeData({
          signal: 2,
          partialFill: true,
          acceptedAmount: "120000000000000000000",
        }),
      })
    );
    expect(r?.variant).toBe("orange");
    expect(r?.amount).toBe("120.00");
  });

  it("7. signal=1 → yellow", () => {
    const r = resolveSignal(state({ data: makeData({ signal: 1 }) }));
    expect(r?.variant).toBe("yellow");
  });

  it("8. signal=0 → green, oddsValue 用 formatOdds(lockedOdds)", () => {
    const r = resolveSignal(state({ data: makeData({ signal: 0, lockedOdds: "22900" }) }));
    expect(r?.variant).toBe("green");
    expect(r?.oddsValue).toBe("2.29");
  });

  it("9. data=null → null（idle 不渲染）", () => {
    expect(resolveSignal(state({ data: null }))).toBeNull();
  });
});

// ─── isSignalDisabled ────────────────────────────────────────────────────────

describe("isSignalDisabled", () => {
  it("loading → disabled", () => {
    expect(isSignalDisabled(state({ loading: true }))).toBe(true);
  });
  it("any error → disabled", () => {
    expect(isSignalDisabled(state({ error: { kind: "network", message: "x" } }))).toBe(true);
  });
  it("degraded → disabled", () => {
    expect(isSignalDisabled(state({ data: makeData({ degraded: true }) }))).toBe(true);
  });
  it("signal=3 → disabled", () => {
    expect(isSignalDisabled(state({ data: makeData({ signal: 3 }) }))).toBe(true);
  });
  it("signal=0 green → not disabled", () => {
    expect(isSignalDisabled(state({ data: makeData({ signal: 0 }) }))).toBe(false);
  });
  it("idle (no data) → not disabled", () => {
    expect(isSignalDisabled(state({ data: null }))).toBe(false);
  });
});

// ─── 渲染 ────────────────────────────────────────────────────────────────────

describe("SignalLightIndicator render", () => {
  it("idle → 返回 null（不渲染容器）", () => {
    const { container } = withIntl(<SignalLightIndicator state={state({})} />);
    expect(container.firstChild).toBeNull();
  });

  it("green → data-variant=green + 文案包含锁定赔率", () => {
    withIntl(
      <SignalLightIndicator state={state({ data: makeData({ signal: 0, lockedOdds: "22900" }) })} />
    );
    const el = screen.getByRole("status");
    expect(el.dataset.variant).toBe("green");
    expect(el.textContent).toContain("2.29");
  });

  it("orange partial → data-variant=orange + 文案含 accepted 主单位", () => {
    withIntl(
      <SignalLightIndicator
        state={state({
          data: makeData({
            signal: 2,
            partialFill: true,
            acceptedAmount: "150000000000000000000",
          }),
        })}
      />
    );
    const el = screen.getByRole("status");
    expect(el.dataset.variant).toBe("orange");
    expect(el.textContent).toContain("150");
  });

  it("degraded → data-variant=degraded（即使 signal=0 也走 degraded）", () => {
    withIntl(
      <SignalLightIndicator state={state({ data: makeData({ signal: 0, degraded: true }) })} />
    );
    expect(screen.getByRole("status").dataset.variant).toBe("degraded");
  });

  it("loading → spinner 显示", () => {
    withIntl(<SignalLightIndicator state={state({ loading: true })} />);
    expect(screen.getByRole("status").dataset.variant).toBe("loading");
  });
});
