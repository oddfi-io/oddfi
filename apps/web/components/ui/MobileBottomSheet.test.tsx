/**
 * @vitest-environment jsdom
 *
 * DD-125 Batch 1 — MobileBottomSheet 扩展（heightClassName + flushContent）。
 * 重点保证：新增 prop 默认值不改变现有所有调用方行为（max-h-[85vh] + overflow-y-auto）。
 */
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MobileBottomSheet from "./MobileBottomSheet";

/** sheet 容器靠 slideUp 入场动画 class 唯一定位（avoid role：组件无 role） */
function getSheet(): HTMLElement {
  const el = document.body.querySelector("[class*='animate-[slideUp']") as HTMLElement | null;
  if (!el) throw new Error("sheet element not found");
  return el;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

describe("MobileBottomSheet", () => {
  it("open=false 不渲染", () => {
    render(
      <MobileBottomSheet open={false} onClose={() => {}}>
        <p>content</p>
      </MobileBottomSheet>
    );
    expect(document.body.querySelector("[class*='animate-[slideUp']")).toBeNull();
  });

  it("默认行为：max-h-[85vh] + overflow-y-auto（现有调用方不受影响）", () => {
    render(
      <MobileBottomSheet open onClose={() => {}}>
        <p>content</p>
      </MobileBottomSheet>
    );
    const sheet = getSheet();
    expect(sheet.className).toContain("max-h-[85vh]");
    expect(sheet.className).toContain("overflow-y-auto");
  });

  it("heightClassName 覆盖默认高度", () => {
    render(
      <MobileBottomSheet open onClose={() => {}} heightClassName="h-[90vh]">
        <p>content</p>
      </MobileBottomSheet>
    );
    const sheet = getSheet();
    expect(sheet.className).toContain("h-[90vh]");
    expect(sheet.className).not.toContain("max-h-[85vh]");
  });

  it("flushContent=true 去掉整体滚动（交给内容自管）", () => {
    render(
      <MobileBottomSheet open onClose={() => {}} flushContent>
        <p>content</p>
      </MobileBottomSheet>
    );
    const sheet = getSheet();
    expect(sheet.className).not.toContain("overflow-y-auto");
  });

  it("flushContent 默认 false：仍保留 overflow-y-auto", () => {
    render(
      <MobileBottomSheet open onClose={() => {}}>
        <p>content</p>
      </MobileBottomSheet>
    );
    expect(getSheet().className).toContain("overflow-y-auto");
  });
});
