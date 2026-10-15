/**
 * @vitest-environment jsdom
 *
 * DD-125 — ChatComposer sendVariant 配色（H5 白底 / PC 薄荷底）。
 * 仅覆盖新增变体；输入有值时 Send 按钮非 disabled，变体底色才生效（disabled 态统一 bg-tertiary）。
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatComposer } from "./ChatComposer";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

function renderComposer(variant?: "brand" | "white") {
  render(
    <ChatComposer onSend={vi.fn()} onAbort={vi.fn()} isLoading={false} sendVariant={variant} />
  );
  // 输入内容让 Send 脱离 disabled
  fireEvent.change(screen.getByLabelText("Message input"), { target: { value: "hi" } });
  return screen.getByLabelText("Send");
}

describe("ChatComposer sendVariant", () => {
  it("默认 brand → 薄荷底（bg-fn-brand）", () => {
    expect(renderComposer().className).toContain("bg-fn-brand");
  });

  it("white → 白底（bg-btn-primary-white），黑 icon", () => {
    const btn = renderComposer("white");
    expect(btn.className).toContain("bg-btn-primary-white");
    expect(btn.className).toContain("text-static-black");
    expect(btn.className).not.toContain("bg-fn-brand");
  });
});
