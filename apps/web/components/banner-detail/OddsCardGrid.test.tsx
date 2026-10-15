// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import OddsCardGrid from "./OddsCardGrid";

describe("OddsCardGrid", () => {
  afterEach(cleanup);

  it("renders 2-column figma node for default state", () => {
    const { container } = render(
      <OddsCardGrid columns={2}>
        <div>card</div>
      </OddsCardGrid>
    );
    expect(container.querySelector('[data-figma-node="3550:73359"]')).toBeInTheDocument();
  });

  it("switches to 1-column figma node when columns=1 (compact)", () => {
    const { container } = render(
      <OddsCardGrid columns={1}>
        <div>card</div>
      </OddsCardGrid>
    );
    expect(container.querySelector('[data-figma-node="3471:68174"]')).toBeInTheDocument();
  });

  it("applies grid-cols-1 / grid-cols-2 class according to prop", () => {
    const { rerender, container } = render(
      <OddsCardGrid columns={2}>
        <span>x</span>
      </OddsCardGrid>
    );
    expect(container.firstElementChild?.className).toContain("grid-cols-2");

    rerender(
      <OddsCardGrid columns={1}>
        <span>x</span>
      </OddsCardGrid>
    );
    expect(container.firstElementChild?.className).toContain("grid-cols-1");
  });

  it("uses column-major flow (rows-5 + grid-flow-col) when columns=2 — left col 1-5 / right col 6-10", () => {
    const { container } = render(
      <OddsCardGrid columns={2}>
        <span>x</span>
      </OddsCardGrid>
    );
    const grid = container.firstElementChild;
    expect(grid?.className).toContain("grid-flow-col");
    expect(grid?.className).toContain("grid-rows-5");
  });

  it("does not apply column-major flow when columns=1 (compact)", () => {
    const { container } = render(
      <OddsCardGrid columns={1}>
        <span>x</span>
      </OddsCardGrid>
    );
    const grid = container.firstElementChild;
    expect(grid?.className).not.toContain("grid-flow-col");
  });

  it("renders all children", () => {
    render(
      <OddsCardGrid columns={2}>
        <div data-testid="c1">c1</div>
        <div data-testid="c2">c2</div>
        <div data-testid="c3">c3</div>
      </OddsCardGrid>
    );
    expect(screen.getByTestId("c1")).toBeInTheDocument();
    expect(screen.getByTestId("c2")).toBeInTheDocument();
    expect(screen.getByTestId("c3")).toBeInTheDocument();
  });

  it("always has grid-cols-1 base class (H5 forced single column)", () => {
    const { container } = render(
      <OddsCardGrid columns={2}>
        <span>x</span>
      </OddsCardGrid>
    );
    expect(container.firstElementChild?.className).toContain("grid-cols-1");
  });

  it("applies md:grid-cols-2 + md:grid-rows-5 + md:grid-flow-col when columns=2 (PC two-column)", () => {
    const { container } = render(
      <OddsCardGrid columns={2}>
        <span>x</span>
      </OddsCardGrid>
    );
    const cls = container.firstElementChild?.className ?? "";
    expect(cls).toContain("md:grid-cols-2");
    expect(cls).toContain("md:grid-rows-5");
    expect(cls).toContain("md:grid-flow-col");
  });

  it("applies md:grid-cols-1 when columns=1 (PC compact single column)", () => {
    const { container } = render(
      <OddsCardGrid columns={1}>
        <span>x</span>
      </OddsCardGrid>
    );
    expect(container.firstElementChild?.className).toContain("md:grid-cols-1");
  });
});
