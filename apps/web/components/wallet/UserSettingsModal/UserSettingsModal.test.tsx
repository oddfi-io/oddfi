// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import UserSettingsModal from "./index";
import { loadProfile } from "@/hooks/useUserProfile";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: "Settings",
      username: "Username",
      usernamePlaceholder: "default username",
      address: "Address",
      copy: "Copy",
      copied: "Copied",
      addressHint: "Do not send funds to this address. This address is for API use only",
      connectSocialMedia: "Connect Social Media",
      connect: "Connect",
      disconnect: "Disconnect",
      save: "Save",
      saved: "Saved",
      socialComingSoon: "Social connect coming soon",
      "errors.tooShort": "Username must be at least 3 characters",
      "errors.tooLong": "Username must be at most 20 characters",
      "errors.invalidChars": "Username must be alphanumeric with ._- only",
      "errors.consecutiveSpecial": "Username cannot contain consecutive special characters",
      "errors.edgeSpecial": "Username must start and end with a letter or number",
    };
    return map[key] ?? key;
  },
}));

const toastSuccessMock = vi.fn();
const toastInfoMock = vi.fn();
vi.mock("@/lib/toast", () => ({
  toastSuccess: (msg: string) => toastSuccessMock(msg),
  toastInfo: (msg: string) => toastInfoMock(msg),
  toastError: (msg: string) => toastInfoMock(msg),
}));

// DD-148：X 行已抽成后端驱动的 TwitterConnectRow（依赖 QueryClient），
// 此处 stub 掉，X 行的状态机渲染由 TwitterConnectRow.test.tsx 独立覆盖。
vi.mock("./TwitterConnectRow", () => ({
  default: () => <div data-testid="twitter-connect-row" />,
}));

const ADDR = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";

beforeEach(() => {
  localStorage.clear();
  toastSuccessMock.mockClear();
  toastInfoMock.mockClear();
});

describe("UserSettingsModal", () => {
  it("does not render content when closed", () => {
    render(<UserSettingsModal open={false} onClose={vi.fn()} address={ADDR} />);
    expect(screen.queryByText("Settings")).toBeNull();
  });

  it("renders title / address / hint / save when open", () => {
    render(<UserSettingsModal open={true} onClose={vi.fn()} address={ADDR} />);
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Username")).toBeTruthy();
    expect(screen.getByText("Address")).toBeTruthy();
    expect(screen.getByDisplayValue(ADDR)).toBeTruthy();
    expect(
      screen.getByText("Do not send funds to this address. This address is for API use only")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("Save button starts disabled when no profile and no input", () => {
    render(<UserSettingsModal open={true} onClose={vi.fn()} address={ADDR} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows error when typing invalid username (after blur)", () => {
    render(<UserSettingsModal open={true} onClose={vi.fn()} address={ADDR} />);
    const input = screen.getByPlaceholderText("default username");
    fireEvent.change(input, { target: { value: "will eth" } });
    fireEvent.blur(input);
    expect(screen.getByText("Username must be alphanumeric with ._- only")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("enables Save when valid + dirty, persists to localStorage, and closes", () => {
    const onClose = vi.fn();
    render(<UserSettingsModal open={true} onClose={onClose} address={ADDR} />);
    const input = screen.getByPlaceholderText("default username");
    fireEvent.change(input, { target: { value: "will.eth" } });
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(toastSuccessMock).toHaveBeenCalledWith("Saved");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(loadProfile(ADDR)?.username).toBe("will.eth");
  });

  it("preloads existing profile username on open", () => {
    localStorage.setItem(
      "oddfi_user_profile_v1",
      JSON.stringify({
        [ADDR.toLowerCase()]: {
          username: "alice",
          socials: {},
          updatedAt: 0,
        },
      })
    );
    render(<UserSettingsModal open={true} onClose={vi.fn()} address={ADDR} />);
    expect(screen.getByDisplayValue("alice")).toBeTruthy();
    // No dirty change yet → Save disabled
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("telegram social row is disabled (coming soon, not clickable)", () => {
    render(<UserSettingsModal open={true} onClose={vi.fn()} address={ADDR} />);
    const tgRow = screen.getByRole("button", { name: /Telegram/ });
    expect(tgRow).toBeDisabled();
    fireEvent.click(tgRow);
    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  it("Save validates on click even if input never blurred", () => {
    const onClose = vi.fn();
    render(<UserSettingsModal open={true} onClose={onClose} address={ADDR} />);
    const input = screen.getByPlaceholderText("default username");
    fireEvent.change(input, { target: { value: "ab" } }); // too short
    // Save is disabled because invalid — but force a click via DOM event
    // (covers race where validation flag missed)
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    // Even if a UA somehow dispatched click on disabled, the guard would catch:
    act(() => {
      save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
