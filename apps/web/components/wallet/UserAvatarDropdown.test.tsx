// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/markets",
  Link: ({ children }: Record<string, unknown>) => children,
}));

import { UserAvatarDropdown } from "./UserAvatarDropdown";

const mockAddress = "0x1234567890abcdef1234567890abcdef12345678";
const mockDisconnect = vi.fn();

function renderDropdown(overrides: Partial<Parameters<typeof UserAvatarDropdown>[0]> = {}) {
  return render(
    <UserAvatarDropdown address={mockAddress} onDisconnect={mockDisconnect} {...overrides} />
  );
}

describe("UserAvatarDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: touch device
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });
  afterEach(cleanup);

  it("renders avatar button with UserCircle icon", () => {
    renderDropdown();
    expect(screen.getByLabelText("User menu")).toBeTruthy();
  });

  it("opens dropdown on click (touch device)", () => {
    renderDropdown();
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("shows truncated address in dropdown", () => {
    renderDropdown();
    fireEvent.click(screen.getByLabelText("User menu"));
    // truncateAddress uses slice(0,6) + "..." + slice(-4) → "0x1234...5678"
    expect(screen.getAllByText("0x1234...5678").length).toBeGreaterThan(0);
  });

  it("shows displayName when provided", () => {
    renderDropdown({ displayName: "alice.eth" });
    fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("alice.eth")).toBeTruthy();
  });

  it("calls onDisconnect when Disconnect is clicked", () => {
    renderDropdown();
    fireEvent.click(screen.getByLabelText("User menu"));
    fireEvent.click(screen.getByText("disconnect"));
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("does not render Add Funds button (removed from dropdown menu)", () => {
    renderDropdown();
    fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.queryByText("Add Funds")).toBeNull();
  });

  it("has avatar container with w-10 h-10 dimensions", () => {
    renderDropdown();
    const btn = screen.getByLabelText("User menu") as HTMLElement;
    // Avatar inner div uses w-10 h-10 = 40px circle
    const avatarCircle = btn.querySelector("div");
    expect(avatarCircle?.className).toContain("w-10");
    expect(avatarCircle?.className).toContain("h-10");
  });

  it("disables avatar button when isDisconnecting=true", () => {
    renderDropdown({ isDisconnecting: true });
    const avatarBtn = screen.getByLabelText("User menu") as HTMLButtonElement;
    expect(avatarBtn.disabled).toBe(true);
  });

  it("shows Disconnecting... and disables disconnect button when isDisconnecting=true mid-flow", () => {
    // Simulate: user opens dropdown → clicks disconnect → isDisconnecting becomes true
    const { rerender } = renderDropdown({ isDisconnecting: false });
    fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("disconnect")).toBeTruthy();

    rerender(
      <UserAvatarDropdown
        address={mockAddress}
        onDisconnect={mockDisconnect}
        isDisconnecting={true}
      />
    );
    // Dropdown stays open; button now shows spinner (no text) and is disabled
    const menuItems = screen.getAllByRole("menuitem");
    const disconnectBtn = menuItems[menuItems.length - 1] as HTMLButtonElement;
    expect(disconnectBtn.disabled).toBe(true);
  });
});
