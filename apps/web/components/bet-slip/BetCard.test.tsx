// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBetSlipStore } from "@/stores/betSlipStore";
import type { BetSelection } from "@/types/betting";

// 可变 live 结果（各用例覆盖 signal）
const { liveHolder } = vi.hoisted(() => ({
  liveHolder: {
    value: {
      displayValue: "2.29",
      flashDirection: null as "up" | "down" | null,
      flashSignature: 0,
      isLive: true,
      signal: 0 as number | null,
    },
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/hooks/useCurrencyDisplay", () => ({
  useCurrencyDisplay: () => ({ canConvert: false, rate: null, convert: (v: string) => v }),
}));
vi.mock("@/hooks/useAccountBalance", () => ({
  useAccountBalance: () => ({ data: { available_balance: "10000" } }),
}));
vi.mock("@/hooks/useOnchainMarketBySelection", () => ({
  useOnchainMarketsByFixture: () => ({ markets: [] }),
  selectOnchainMarketForEntry: () => ({ marketId: null, outcomeIndex: null }),
}));
vi.mock("@/hooks/usePreviewSignal", () => ({
  usePreviewSignal: () => ({ data: null, loading: false, error: null }),
}));
vi.mock("@/hooks/useLiveOddsForEntry", () => ({
  useLiveOddsForEntry: () => liveHolder.value,
}));
vi.mock("@/lib/betslip-animations", () => ({
  flashOddsDirection: vi.fn(),
}));

import BetCard from "./BetCard";

function renderCard(selection: BetSelection) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BetCard selection={selection} />
    </QueryClientProvider>
  );
}

function makeSel(overrides: Partial<BetSelection> = {}): BetSelection {
  return {
    id: "sel-red",
    oddId: 1001,
    fixtureId: 11,
    fixtureName: "Argentina vs Brazil",
    leagueName: "World Cup",
    marketType: "1x2",
    marketDescription: "Fulltime Result",
    selection: "Home",
    displayLabel: "Argentina",
    odds: "2.29",
    ...overrides,
  };
}

describe("BetCard — DD-119 P2 blocked (signal===3)", () => {
  beforeEach(() => {
    useBetSlipStore.setState({
      selections: [],
      amounts: {},
      mode: "single",
      signalDisabledById: {},
      partialFillById: {},
    });
    liveHolder.value = {
      displayValue: "2.29",
      flashDirection: null,
      flashSignature: 0,
      isLive: true,
      signal: 0,
    };
  });

  it("non-blocked (signal=0): renders odds with x, no blocked copy", () => {
    liveHolder.value = { ...liveHolder.value, signal: 0 };
    renderCard(makeSel());
    expect(screen.getByText("2.29x")).toBeTruthy();
    expect(screen.queryByText("blockedRedline")).toBeNull();
  });

  it("blocked (signal=3): odds locked to '--' + blockedRedline copy shown", () => {
    liveHolder.value = { ...liveHolder.value, signal: 3 };
    renderCard(makeSel());
    expect(screen.getByText("--")).toBeTruthy();
    expect(screen.queryByText("2.29x")).toBeNull();
    expect(screen.getByText("blockedRedline")).toBeTruthy();
  });

  it("partialFill present (non-blocked): renders partialFill copy", () => {
    liveHolder.value = { ...liveHolder.value, signal: 0 };
    useBetSlipStore.setState({
      partialFillById: {
        "sel-red": { accepted: "8,000.00", origin: "10,000.00", remain: "2,000.00" },
      },
    });
    renderCard(makeSel());
    expect(screen.getByText("partialFill")).toBeTruthy();
  });
});
