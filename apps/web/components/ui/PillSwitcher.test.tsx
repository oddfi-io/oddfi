// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PillSwitcher, type PillSwitcherItem } from "./PillSwitcher";

const items: PillSwitcherItem[] = [
  { key: "a", label: "Tab A" },
  { key: "b", label: "Tab B" },
  { key: "c", label: "Tab C", disabled: true },
];

describe("PillSwitcher", () => {
  it("marks active tab with aria-selected", () => {
    render(<PillSwitcher items={items} value="a" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Tab A" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Tab B" }).getAttribute("aria-selected")).toBe("false");
  });

  it("calls onChange when clicking an enabled tab", () => {
    const onChange = vi.fn();
    render(<PillSwitcher items={items} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Tab B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("blocks click on disabled tab", () => {
    const onChange = vi.fn();
    render(<PillSwitcher items={items} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Tab C" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
