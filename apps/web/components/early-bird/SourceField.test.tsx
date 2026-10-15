// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import SourceField, { type SourceOption } from "./SourceField";

interface RenderProps {
  value?: SourceOption | "";
  other?: string;
}

function renderSourceField({ value = "", other = "" }: RenderProps = {}) {
  const onChange = vi.fn();
  const onOtherChange = vi.fn();
  const result = render(
    <NextIntlClientProvider messages={en} locale="en">
      <SourceField
        value={value}
        onChange={onChange}
        other={other}
        onOtherChange={onOtherChange}
        label="How did you hear about Oddfi?"
        hint="Help us know where you came from"
      />
    </NextIntlClientProvider>
  );
  return { onChange, onOtherChange, ...result };
}

const TRIGGER_NAME = /how did you hear/i;

describe("<SourceField>", () => {
  it("初始渲染：trigger 显示 placeholder + label", () => {
    renderSourceField();
    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toMatch(/please select/i);
  });

  it("当前 value=telegram → trigger 显示本地化 Telegram 文案", () => {
    renderSourceField({ value: "telegram" });
    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });
    expect(trigger.textContent).toMatch(/Telegram/);
  });

  it("点 trigger → 展开 popover 含全部 6 个选项", () => {
    renderSourceField();
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    for (const label of ["Telegram", "X", "Discord", "Friends", "KOL", "Other"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("点击 Telegram → onChange('telegram')，未触发 onOtherChange", () => {
    const { onChange, onOtherChange } = renderSourceField();
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    fireEvent.click(screen.getByRole("button", { name: "Telegram" }));
    expect(onChange).toHaveBeenCalledWith("telegram");
    expect(onOtherChange).not.toHaveBeenCalled();
  });

  it("点击 Other → onChange('other')，popover 仍展开（选项行仍在 DOM）", () => {
    const { onChange } = renderSourceField();
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(onChange).toHaveBeenCalledWith("other");
    // 选 Other 后 popover 不关闭 — Telegram 选项行仍能查到
    expect(screen.getByRole("button", { name: "Telegram" })).toBeInTheDocument();
  });

  it("value='other' → 展开 Other 复合块，含 input + Cancel 文案", () => {
    renderSourceField({ value: "other" });
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    // hint 文案 + Cancel 文案在面板内
    expect(screen.getByText(/tell us the exact source/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("Other 展开态点 Cancel → onChange('') + onOtherChange('')", () => {
    const { onChange, onOtherChange } = renderSourceField({
      value: "other",
      other: "twitter post",
    });
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(onOtherChange).toHaveBeenCalledWith("");
  });

  it("Other 展开态输入文字 → onOtherChange 接收最新值", () => {
    const { onOtherChange } = renderSourceField({ value: "other" });
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    const input = screen.getByPlaceholderText(/please specify/i);
    fireEvent.change(input, { target: { value: "kol mention" } });
    expect(onOtherChange).toHaveBeenCalledWith("kol mention");
  });
});
