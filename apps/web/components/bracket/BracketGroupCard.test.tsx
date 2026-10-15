// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BRACKET_GROUPS } from "@/lib/bracket/mock-data";

import BracketGroupCard from "./BracketGroupCard";

const groupA = BRACKET_GROUPS[0];

describe("BracketGroupCard", () => {
  it("pc-side variant 渲染 4 国旗 + Group label", () => {
    render(<BracketGroupCard variant="pc-side" group={groupA} />);
    expect(screen.getByText(/Group A/i)).toBeDefined();
    const flags = screen.getAllByRole("img");
    expect(flags).toHaveLength(4);
  });

  it("h5-list variant 渲染 4 队队名 + 4 国旗", () => {
    render(<BracketGroupCard variant="h5-list" group={groupA} />);
    expect(screen.getByText(/Group A/i)).toBeDefined();
    groupA.teams.forEach((team) => {
      expect(screen.getByText(team.name)).toBeDefined();
    });
    const flags = screen.getAllByRole("img");
    expect(flags).toHaveLength(4);
  });

  it("data-group 属性反映分组 key", () => {
    const { container } = render(<BracketGroupCard variant="pc-side" group={groupA} />);
    expect(container.querySelector('[data-group="A"]')).toBeDefined();
  });
});
