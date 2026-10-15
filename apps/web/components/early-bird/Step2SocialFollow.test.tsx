// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import Step2SocialFollow from "./Step2SocialFollow";

function renderStep2(onDone = vi.fn()) {
  return {
    onDone,
    ...render(
      <NextIntlClientProvider messages={en} locale="en">
        <Step2SocialFollow onDone={onDone} />
      </NextIntlClientProvider>
    ),
  };
}

describe("<Step2SocialFollow>", () => {
  it("X 行外跳 https://x.com/oddfilabs，target=_blank 且 rel 同时含 noopener + noreferrer", () => {
    renderStep2();
    const link = screen.getByRole("link", { name: /follow @oddfilabs on x/i });
    expect(link).toHaveAttribute("href", "https://x.com/oddfilabs");
    expect(link).toHaveAttribute("target", "_blank");
    const rel = link.getAttribute("rel") ?? "";
    expect(rel).toMatch(/noopener/);
    expect(rel).toMatch(/noreferrer/);
  });

  it("Telegram 行外跳 https://t.me/OddFi_Official，rel 同时含 noopener + noreferrer", () => {
    renderStep2();
    const link = screen.getByRole("link", { name: /join @oddfi_official on telegram/i });
    expect(link).toHaveAttribute("href", "https://t.me/OddFi_Official");
    expect(link).toHaveAttribute("target", "_blank");
    const rel = link.getAttribute("rel") ?? "";
    expect(rel).toMatch(/noopener/);
    expect(rel).toMatch(/noreferrer/);
  });

  it("点击 I Know 按钮 → 触发 onDone", () => {
    const { onDone } = renderStep2();
    fireEvent.click(screen.getByRole("button", { name: /i know/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
