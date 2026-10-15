// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BracketSwitcher from "./BracketSwitcher";

describe("BracketSwitcher", () => {
  it("渲染 Group 和 Bracket 两个按钮", () => {
    render(<BracketSwitcher mode="group" onChange={vi.fn()} />);
    expect(screen.getByText("Group")).toBeDefined();
    expect(screen.getByText("Bracket")).toBeDefined();
  });

  it("mode=group 时 Group 按钮 aria-selected=true", () => {
    render(<BracketSwitcher mode="group" onChange={vi.fn()} />);
    expect(screen.getByText("Group").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Bracket").getAttribute("aria-selected")).toBe("false");
  });

  it("mode=bracket 时 Bracket 按钮 aria-selected=true", () => {
    render(<BracketSwitcher mode="bracket" onChange={vi.fn()} />);
    expect(screen.getByText("Bracket").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Group").getAttribute("aria-selected")).toBe("false");
  });

  it("点击 Bracket 触发 onChange('bracket')", () => {
    const onChange = vi.fn();
    render(<BracketSwitcher mode="group" onChange={onChange} />);
    fireEvent.click(screen.getByText("Bracket"));
    expect(onChange).toHaveBeenCalledWith("bracket");
  });

  it("点击 Group 触发 onChange('group')", () => {
    const onChange = vi.fn();
    render(<BracketSwitcher mode="bracket" onChange={onChange} />);
    fireEvent.click(screen.getByText("Group"));
    expect(onChange).toHaveBeenCalledWith("group");
  });
});
