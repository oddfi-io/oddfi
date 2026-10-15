// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import Step1Form from "./Step1Form";

function renderForm(onSubmit = vi.fn()) {
  return {
    onSubmit,
    ...render(
      <NextIntlClientProvider messages={en} locale="en">
        <Step1Form onSubmit={onSubmit} />
      </NextIntlClientProvider>
    ),
  };
}

/** 测试不通过 Radix Select 的下拉 UI（jsdom 不支持 PointerEvent.releasePointerCapture 等），
 *  直接派发原生 change 事件给 Trigger 的隐藏 select。Radix Select 没暴露非交互 API，
 *  这里通过测试桥 — 在 jsdom 模拟 fireEvent.keyDown 让 Radix 接管选项选择不稳定。
 *  改用：在测试组件外注入 onSubmit 验证，并直接覆盖 source 状态需 Step1Form 暴露 prop。
 *  简化方案：测试覆盖三种情况 — 不选 source → submit 阻塞 / 必填校验。完整 source 选择走人工验收。
 */

const VALID_EMAIL = "user@example.com";
const VALID_BSC = "0x1234567890abcdef1234567890ABCDEF12345678";

describe("<Step1Form>", () => {
  it("初始渲染：Save 按钮 disabled，必填字段未填", () => {
    renderForm();
    const submit = screen.getByRole("button", { name: /save/i });
    expect(submit).toBeDisabled();
  });

  it("仅填邮箱 → Save 仍 disabled（wallet 必填）", () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: VALID_EMAIL } });
    const submit = screen.getByRole("button", { name: /save/i });
    expect(submit).toBeDisabled();
    act(() => {
      fireEvent.submit(submit.closest("form")!);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("钱包格式错误（缺位 / 非 hex / 无 0x 前缀）→ 显示错误 + 不提交", () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: VALID_EMAIL } });
    const walletInput = screen.getByLabelText(/bsc receive/i);
    fireEvent.change(walletInput, { target: { value: "0xZZZZ" } });
    fireEvent.blur(walletInput);
    expect(screen.getByRole("alert").textContent).toMatch(/valid bsc wallet/i);
    act(() => {
      fireEvent.submit(walletInput.closest("form")!);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("邮箱 + 合法 BSC 地址但未选 source → Save 仍 disabled（source 必填）", () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: VALID_EMAIL } });
    fireEvent.change(screen.getByLabelText(/bsc receive/i), { target: { value: VALID_BSC } });
    fireEvent.change(screen.getByLabelText(/tell us/i), { target: { value: "more sports" } });
    const submit = screen.getByRole("button", { name: /save/i });
    expect(submit).toBeDisabled();
    act(() => {
      fireEvent.submit(submit.closest("form")!);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("source field trigger 渲染了 placeholder 文案", () => {
    renderForm();
    const trigger = screen.getByRole("button", { name: /how did you hear/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toMatch(/please select/i);
  });
});
