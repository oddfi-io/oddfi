// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import BracketGroupHoverCard from "./BracketGroupHoverCard";

// next/image mock
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

function makeDOMRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 100,
    right: 300,
    bottom: 150,
    left: 200,
    width: 100,
    height: 50,
    x: 200,
    y: 100,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

describe("BracketGroupHoverCard", () => {
  beforeEach(() => {
    // 设置 window 尺寸
    Object.defineProperty(window, "innerWidth", { value: 1440, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 900, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("visible=false 时不渲染任何内容", () => {
    render(<BracketGroupHoverCard groupKey="A" triggerRect={makeDOMRect()} visible={false} />);
    expect(document.querySelector("[data-bracket-hover-card]")).toBeNull();
  });

  it("groupKey=null 时不渲染", () => {
    render(<BracketGroupHoverCard groupKey={null} triggerRect={makeDOMRect()} visible={true} />);
    expect(document.querySelector("[data-bracket-hover-card]")).toBeNull();
  });

  it("triggerRect=null 时不渲染", () => {
    render(<BracketGroupHoverCard groupKey="A" triggerRect={null} visible={true} />);
    expect(document.querySelector("[data-bracket-hover-card]")).toBeNull();
  });

  it("visible=true 渲染 Group A 标题和 4 个队名", () => {
    render(<BracketGroupHoverCard groupKey="A" triggerRect={makeDOMRect()} visible={true} />);
    // Group label
    expect(screen.getByText(/Group A/i)).toBeDefined();
    // 4 个国旗
    const flags = screen.getAllByRole("img");
    expect(flags).toHaveLength(4);
  });

  it("渲染 M1 日期副标题（Figma 5024:60804）", () => {
    render(<BracketGroupHoverCard groupKey="A" triggerRect={makeDOMRect()} visible={true} />);
    expect(screen.getByText(/M1, Jun 14·16:00 UTC/)).toBeDefined();
  });

  it("定位算法：trigger.right + GAP 不溢出时 left = right+12", () => {
    // trigger.right = 300，window.innerWidth = 1440 → 300 + 12 + 280 = 592 < 1440，不溢出
    render(
      <BracketGroupHoverCard
        groupKey="B"
        triggerRect={makeDOMRect({ right: 300, left: 200, top: 100 })}
        visible={true}
      />
    );
    const card = document.querySelector("[data-bracket-hover-card]") as HTMLElement;
    expect(card).toBeDefined();
    expect(card.style.left).toBe("312px"); // 300 + 12
  });

  it("定位算法：右侧溢出时 left 翻转到触发元素左侧", () => {
    // trigger.right = 1400，window.innerWidth = 1440 → 1400 + 12 + 280 = 1692 > 1440，溢出
    render(
      <BracketGroupHoverCard
        groupKey="C"
        triggerRect={makeDOMRect({ right: 1400, left: 1300, top: 100 })}
        visible={true}
      />
    );
    const card = document.querySelector("[data-bracket-hover-card]") as HTMLElement;
    expect(card).toBeDefined();
    // left = trigger.left - GAP - CARD.w = 1300 - 12 - 280 = 1008
    expect(card.style.left).toBe("1008px");
  });

  it("portal 挂载在 document.body 下", () => {
    render(<BracketGroupHoverCard groupKey="A" triggerRect={makeDOMRect()} visible={true} />);
    const card = document.body.querySelector("[data-bracket-hover-card]");
    expect(card).toBeDefined();
  });

  it("弹层有 role=tooltip", () => {
    render(<BracketGroupHoverCard groupKey="A" triggerRect={makeDOMRect()} visible={true} />);
    expect(screen.getByRole("tooltip")).toBeDefined();
  });
});
