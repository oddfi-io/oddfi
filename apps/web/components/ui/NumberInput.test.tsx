// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NumberInput from "./NumberInput";

describe("NumberInput", () => {
  it('type="text" 且 inputMode 正确（隐藏浏览器 spinner）', () => {
    render(<NumberInput value={0} onChange={vi.fn()} integerOnly ariaLabel="n" />);
    const input = screen.getByLabelText("n") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("numeric");
  });

  it("integerOnly：键入小数点拒绝", () => {
    const onChange = vi.fn();
    render(<NumberInput value={0} onChange={onChange} integerOnly ariaLabel="n" />);
    const input = screen.getByLabelText("n") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12.3" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("");
  });

  it("键入合法整数：onChange 收到 number，input 显示无前导 0", () => {
    const onChange = vi.fn();
    render(<NumberInput value={0} onChange={onChange} integerOnly ariaLabel="n" />);
    const input = screen.getByLabelText("n") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1000" } });
    expect(input.value).toBe("1000");
    expect(onChange).toHaveBeenCalledWith(1000);
  });

  it("清空：onChange(min)，input 留空", () => {
    const onChange = vi.fn();
    render(<NumberInput value={5} onChange={onChange} min={0} ariaLabel="n" />);
    const input = screen.getByLabelText("n") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("非 integerOnly：键入小数点允许", () => {
    const onChange = vi.fn();
    render(<NumberInput value={0} onChange={onChange} ariaLabel="n" />);
    const input = screen.getByLabelText("n") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0.5" } });
    expect(input.value).toBe("0.5");
    expect(onChange).toHaveBeenCalledWith(0.5);
  });
});
