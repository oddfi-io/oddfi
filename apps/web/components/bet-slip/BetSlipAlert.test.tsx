// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BetSlipAlert from "./BetSlipAlert";

describe("BetSlipAlert", () => {
  it("renders err variant with red tokens + alert role + message", () => {
    render(<BetSlipAlert variant="err" message="Network error, please try again later" />);
    const el = screen.getByRole("alert");
    expect(el.getAttribute("data-variant")).toBe("err");
    expect(el.className).toContain("text-fn-red");
    expect(el.className).toContain("bg-tag-red");
    expect(screen.getByText("Network error, please try again later")).toBeTruthy();
  });

  it("renders warn variant with yellow tokens", () => {
    render(<BetSlipAlert variant="warn" message="Network congested" />);
    const el = screen.getByRole("alert");
    expect(el.getAttribute("data-variant")).toBe("warn");
    expect(el.className).toContain("text-fn-yellow");
    expect(el.className).toContain("bg-tag-yellow");
  });
});
