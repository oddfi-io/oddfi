// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../../messages/en.json";
import FinalCtaSection from "./FinalCtaSection";

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <FinalCtaSection />
    </NextIntlClientProvider>
  );
}

afterEach(() => cleanup());

describe("FinalCtaSection 渲染", () => {
  it("渲染标题 + 3 容器 + CTA 文案", () => {
    renderSection();
    expect(screen.getByText(en.token.finalCta.title)).toBeTruthy();
    expect(screen.getByText(en.token.finalCta.card1Title)).toBeTruthy();
    expect(screen.getByText(en.token.finalCta.card2Title)).toBeTruthy();
    expect(screen.getByText(en.token.finalCta.card3Title)).toBeTruthy();
    expect(screen.getByText(en.token.finalCta.cta)).toBeTruthy();
  });

  it("点击 CTA 滚动到购买区 #tiersale-buy", () => {
    // 注入 buy 锚点 + scrollIntoView spy
    const anchor = document.createElement("div");
    anchor.id = "tiersale-buy";
    const scrollSpy = vi.fn();
    anchor.scrollIntoView = scrollSpy;
    document.body.appendChild(anchor);

    renderSection();
    fireEvent.click(screen.getByText(en.token.finalCta.cta));
    expect(scrollSpy).toHaveBeenCalled();

    document.body.removeChild(anchor);
  });
});
