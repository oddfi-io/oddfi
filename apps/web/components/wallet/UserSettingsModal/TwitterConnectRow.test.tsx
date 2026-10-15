// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ── mocks ─────────────────────────────────────────────────────
const bindingState = { data: undefined as unknown, isLoading: false };
const followState = {
  follow: undefined as unknown,
  refresh: vi.fn(),
  isRefreshing: false,
  refreshError: null as unknown,
  resetRefreshError: vi.fn(),
};
const bindMutate = vi.fn();
const unbindMutate = vi.fn();

vi.mock("@/lib/twitter/hooks/useTwitterBinding", () => ({
  useTwitterBinding: () => bindingState,
}));
vi.mock("@/lib/twitter/hooks/useTwitterFollow", () => ({
  useTwitterFollow: () => followState,
}));
vi.mock("@/lib/twitter/hooks/useBindTwitter", () => ({
  useBindTwitter: () => ({ mutate: bindMutate, isPending: false, error: null, reset: vi.fn() }),
}));
vi.mock("@/lib/twitter/hooks/useUnbindTwitter", () => ({
  useUnbindTwitter: () => ({ mutate: unbindMutate, isPending: false }),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ isAuthenticated: true, sessionAddress: "0xabc" }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
const toastInfoMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("@/lib/toast", () => ({
  toastInfo: (m: string) => toastInfoMock(m),
  toastError: (m: string) => toastErrorMock(m),
}));

import TwitterConnectRow from "./TwitterConnectRow";

beforeEach(() => {
  bindingState.data = undefined;
  bindingState.isLoading = false;
  followState.follow = undefined;
  followState.isRefreshing = false;
  followState.refreshError = null;
  bindMutate.mockClear();
  unbindMutate.mockClear();
  followState.refresh.mockClear();
  toastInfoMock.mockClear();
  toastErrorMock.mockClear();
});

describe("TwitterConnectRow", () => {
  it("loading → 显示骨架，不渲染可点 Connect", () => {
    bindingState.isLoading = true;
    const { container } = render(<TwitterConnectRow />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("disabled（503）→ coming soon，点击弹 toast", () => {
    bindingState.data = { bound: false, disabled: true };
    render(<TwitterConnectRow />);
    const row = screen.getByRole("button", { name: "X: coming soon" });
    fireEvent.click(row);
    expect(toastInfoMock).toHaveBeenCalledWith("socialComingSoon");
  });

  it("未绑定 → Connect 触发绑定跳转", () => {
    bindingState.data = { bound: false };
    render(<TwitterConnectRow />);
    const row = screen.getByRole("button", { name: "X: connect" });
    fireEvent.click(row);
    expect(bindMutate).toHaveBeenCalledTimes(1);
  });

  it("已绑定 → @username + verified badge + 关注状态 + 刷新", () => {
    bindingState.data = { bound: true, twitter: { username: "alice", verified: true } };
    followState.follow = { status: "verified" };
    render(<TwitterConnectRow />);
    expect(screen.getByText("@alice")).toBeTruthy();
    expect(screen.getByText("twitter.follow.verified")).toBeTruthy();
    const refreshBtn = screen.getByRole("button", { name: "twitter.refresh" });
    fireEvent.click(refreshBtn);
    expect(followState.refresh).toHaveBeenCalledTimes(1);
  });

  it("已绑定 + 未关注 → notFollowing 文案 + 官号 Follow chip 外跳 x.com/OddFiLabs", () => {
    bindingState.data = { bound: true, twitter: { username: "bob", verified: false } };
    followState.follow = { status: "not_following" };
    render(<TwitterConnectRow />);
    expect(screen.getByText("twitter.follow.notFollowing")).toBeTruthy();
    // 官号 chip：handle + Follow 胶囊（aria-label「twitter.follow.cta @OddFiLabs」），均指向官号外链
    const followCta = screen.getByRole("link", { name: "twitter.follow.cta @OddFiLabs" });
    expect(followCta).toHaveAttribute("href", "https://x.com/OddFiLabs");
    expect(followCta).toHaveAttribute("target", "_blank");
    expect(screen.getByText("@OddFiLabs")).toBeTruthy();
  });

  it("已绑定 + unverified → 同样展示官号 Follow chip", () => {
    bindingState.data = { bound: true, twitter: { username: "ivy", verified: false } };
    followState.follow = { status: "unverified" };
    render(<TwitterConnectRow />);
    expect(screen.getByRole("link", { name: "twitter.follow.cta @OddFiLabs" })).toBeTruthy();
  });

  it("已绑定 + 已关注（verified）→ 不展示官号 Follow chip", () => {
    bindingState.data = { bound: true, twitter: { username: "eve", verified: true } };
    followState.follow = { status: "verified" };
    render(<TwitterConnectRow />);
    expect(screen.queryByRole("link", { name: "twitter.follow.cta @OddFiLabs" })).toBeNull();
  });

  it("点 Disconnect → 行内冷却确认 → 确认触发解绑", () => {
    bindingState.data = { bound: true, twitter: { username: "carol", verified: false } };
    followState.follow = { status: "not_following" };
    render(<TwitterConnectRow />);
    fireEvent.click(screen.getByRole("button", { name: "disconnect" }));
    // 冷却警告出现
    expect(screen.getByText("twitter.unbindConfirm.cooldown")).toBeTruthy();
    // 确认解绑
    fireEvent.click(screen.getByRole("button", { name: "twitter.unbindConfirm.confirm" }));
    expect(unbindMutate).toHaveBeenCalledTimes(1);
  });

  it("解绑确认可取消（不调用 unbind）", () => {
    bindingState.data = { bound: true, twitter: { username: "dave", verified: false } };
    followState.follow = { status: "verified" };
    render(<TwitterConnectRow />);
    fireEvent.click(screen.getByRole("button", { name: "disconnect" }));
    fireEvent.click(screen.getByRole("button", { name: "twitter.unbindConfirm.cancel" }));
    expect(screen.queryByText("twitter.unbindConfirm.cooldown")).toBeNull();
    expect(unbindMutate).not.toHaveBeenCalled();
  });
});
