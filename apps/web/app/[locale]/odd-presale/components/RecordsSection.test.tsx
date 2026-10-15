// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../../messages/en.json";
import RecordsSection from "./RecordsSection";

// ─── hook mocks ───────────────────────────────────────────────────────────────
let mockConnected = false;
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: mockConnected }),
}));

let mockReferralItems: Array<{
  userId: string;
  eoa: string;
  joinedAt: number;
  totalRewardOdd: string;
  deposits: unknown[];
}> = [];
vi.mock("@/lib/presale/hooks/useReferralList", () => ({
  useReferralList: () => ({ data: { items: mockReferralItems, total: mockReferralItems.length } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RecordsSection />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  mockConnected = false;
  mockReferralItems = [];
});
afterEach(() => cleanup());

describe("RecordsSection 渲染", () => {
  it("默认交易记录 tab：无数据源 → 空态（未连接走连接引导）", () => {
    renderSection();
    // 标题（PC + H5）
    expect(screen.getAllByText(en.token.records.title).length).toBe(2);
    // 默认 tab = 交易记录，未连接 → 连接引导（PC + H5）
    expect(screen.getAllByText(en.token.records.connectHint).length).toBe(2);
  });

  it("连接态交易记录 tab：仍为空（数据源待对齐）→ txEmpty", () => {
    mockConnected = true;
    renderSection();
    expect(screen.getAllByText(en.token.records.txEmpty).length).toBe(2);
  });

  it("切到邀请记录 tab：复用 useReferralList 渲染逐笔行", () => {
    mockConnected = true;
    mockReferralItems = [
      {
        userId: "u1",
        eoa: "0x656ef9aabbccddeeff00112233445566778899cc",
        joinedAt: 1717245480, // 秒级
        totalRewardOdd: "100",
        deposits: [],
      },
    ];
    renderSection();
    // 切到邀请记录（PC + H5 各一个 tab 按钮，点 PC 那个即可让两侧同步——状态共享于 section）
    const inviteTabs = screen.getAllByRole("tab", { name: en.token.records.tabInvite });
    fireEvent.click(inviteTabs[0]);
    // 类型 tag「邀请」(PC + H5 各一行)
    expect(screen.getAllByText(en.token.records.typeInvite).length).toBeGreaterThanOrEqual(1);
    // 金额 100 ODD
    expect(screen.getAllByText(/100 ODD/).length).toBeGreaterThanOrEqual(1);
  });
});
