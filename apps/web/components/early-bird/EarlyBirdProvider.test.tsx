// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages -- 测试需裸 <a> 验证 Provider 拦截行为 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { EarlyBirdProvider, useEarlyBird } from "./EarlyBirdProvider";

function Consumer() {
  const { open, isActive, step } = useEarlyBird();
  return (
    <div>
      <span data-testid="active">{String(isActive)}</span>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="step">{step}</span>
    </div>
  );
}

function renderHarness({ active }: { active: boolean }) {
  return render(
    <NextIntlClientProvider messages={en} locale="en">
      <EarlyBirdProvider active={active}>
        <Consumer />
        <a href="/markets" data-testid="internal-link">
          markets
        </a>
        <a href="/" data-testid="same-path-link">
          home
        </a>
        <a href="#section" data-testid="hash-link">
          anchor
        </a>
        <a
          href="https://x.com/oddfilabs"
          data-testid="external-link"
          target="_blank"
          rel="noreferrer"
        >
          twitter
        </a>
        <button data-earlybird-gate data-testid="gate-btn">
          wallet
        </button>
        <button data-testid="plain-btn">plain</button>
      </EarlyBirdProvider>
    </NextIntlClientProvider>
  );
}

describe("<EarlyBirdProvider>", () => {
  beforeEach(() => {
    // jsdom 默认 pathname=/
    window.history.pushState({}, "", "/");
  });

  it("active=false → 不挂 listener，点击任何元素都不开 Modal", () => {
    renderHarness({ active: false });
    expect(screen.getByTestId("active").textContent).toBe("false");
    expect(screen.getByTestId("open").textContent).toBe("false");

    fireEvent.click(screen.getByTestId("internal-link"));
    fireEvent.click(screen.getByTestId("gate-btn"));

    expect(screen.getByTestId("open").textContent).toBe("false");
  });

  it("active=true + 点击内部 <a> 跨路由 → 拦截 + openGate", () => {
    renderHarness({ active: true });
    expect(screen.getByTestId("open").textContent).toBe("false");

    act(() => {
      fireEvent.click(screen.getByTestId("internal-link"));
    });
    expect(screen.getByTestId("open").textContent).toBe("true");
    expect(screen.getByTestId("step").textContent).toBe("1");
  });

  it("active=true + 点击同 pathname <a> → 放行（不开 Modal）", () => {
    renderHarness({ active: true });
    act(() => {
      fireEvent.click(screen.getByTestId("same-path-link"));
    });
    expect(screen.getByTestId("open").textContent).toBe("false");
  });

  it("active=true + 点击 hash anchor → 放行", () => {
    renderHarness({ active: true });
    act(() => {
      fireEvent.click(screen.getByTestId("hash-link"));
    });
    expect(screen.getByTestId("open").textContent).toBe("false");
  });

  it("active=true + 点击外链 <a>（跨 origin）→ 放行", () => {
    renderHarness({ active: true });
    act(() => {
      fireEvent.click(screen.getByTestId("external-link"));
    });
    expect(screen.getByTestId("open").textContent).toBe("false");
  });

  it("active=true + 点击 [data-earlybird-gate] 按钮 → 拦截 + openGate", () => {
    renderHarness({ active: true });
    act(() => {
      fireEvent.click(screen.getByTestId("gate-btn"));
    });
    expect(screen.getByTestId("open").textContent).toBe("true");
  });

  it("active=true + 点击普通 button → 放行（不开 Modal）", () => {
    renderHarness({ active: true });
    act(() => {
      fireEvent.click(screen.getByTestId("plain-btn"));
    });
    expect(screen.getByTestId("open").textContent).toBe("false");
  });
});
