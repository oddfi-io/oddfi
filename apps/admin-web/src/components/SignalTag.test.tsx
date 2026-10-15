import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalTag } from "./SignalTag";
import type { Signal } from "@/types/events";

describe("SignalTag", () => {
  it.each<[Signal, string]>([
    ["green", "绿灯"],
    ["yellow", "黄灯"],
    ["orange", "橙灯"],
    ["red", "红灯"],
  ])("signal=%s renders %s", (signal, text) => {
    render(<SignalTag signal={signal} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("opened=false renders 未开盘 grey tag regardless of signal", () => {
    render(<SignalTag signal="red" opened={false} />);
    expect(screen.getByText("未开盘")).toBeInTheDocument();
    expect(screen.queryByText("红灯")).not.toBeInTheDocument();
  });

  it("signal=null renders em-dash", () => {
    render(<SignalTag signal={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("unknown enum value degrades to plain tag with raw text (forward compat)", () => {
    render(<SignalTag signal={"purple" as Signal} />);
    expect(screen.getByText("purple")).toBeInTheDocument();
  });
});
