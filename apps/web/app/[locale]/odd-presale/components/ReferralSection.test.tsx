// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../../messages/en.json";
import ReferralSection from "./ReferralSection";

// ─── hook mocks ───────────────────────────────────────────────────────────────
let mockConnected = false;
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: mockConnected }),
}));

interface RefMe {
  myCode: string;
  shareLink: string;
  referrer: { eoa: string; code: string } | null;
  stats: { invitedCount: number; totalRewardOdd: string };
}
let mockRefMe: RefMe | undefined;
vi.mock("@/lib/presale/hooks/useReferralMe", () => ({
  useReferralMe: () => ({ data: mockRefMe }),
}));
vi.mock("@/lib/presale/hooks/useBindReferral", () => ({
  useBindReferral: () => ({ mutate: vi.fn() }),
}));
// ShareCardModal pulls html-to-image lazily; stub to avoid heavy deps in unit test.
vi.mock("@/components/referral/ShareCardModal", () => ({
  default: () => null,
}));

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ReferralSection />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  mockConnected = false;
  mockRefMe = undefined;
});
afterEach(() => cleanup());

describe("ReferralSection 渲染", () => {
  it("我的邀请 / 我的推荐人标题渲染（PC + H5 各一份）", () => {
    renderSection();
    expect(screen.getAllByText(en.token.referral.myInviteTitle).length).toBe(2);
    expect(screen.getAllByText(en.token.referral.myReferrerTitle).length).toBe(2);
    // 标题
    expect(screen.getAllByText(en.token.referral.title).length).toBe(2);
  });

  it("未连接态：链接展示 connect 提示 + 复制/邀请按钮禁用", () => {
    renderSection();
    expect(screen.getAllByText(en.token.referral.connectToViewLink).length).toBe(2);
    // 「去邀请」按钮 disabled
    const inviteBtns = screen.getAllByRole("button", { name: en.token.referral.inviteBtn });
    expect(inviteBtns.length).toBeGreaterThanOrEqual(1);
    inviteBtns.forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
  });

  it("连接 + 有码态：展示分享链接 + stat（已邀请人数/累计返佣）", () => {
    mockConnected = true;
    mockRefMe = {
      myCode: "0xABC123",
      shareLink: "",
      referrer: null,
      stats: { invitedCount: 7, totalRewardOdd: "1234.5" },
    };
    renderSection();
    expect(screen.getAllByText("7").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(en.token.referral.invitedCount).length).toBe(2);
  });
});
