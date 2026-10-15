// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DateGroupHeader from "./DateGroupHeader";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      timelineToday: "Today",
      timelineTomorrow: "Tomorrow",
    };
    return map[key] ?? key;
  },
  useLocale: () => "en",
}));

describe("DateGroupHeader", () => {
  const today = "2026-06-11";

  it("renders 'Today' label when date equals today", () => {
    render(
      <DateGroupHeader
        date={today}
        today={today}
        matchCount={5}
        isCollapsed={true}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("renders 'Tomorrow' label when date is 1 day after today", () => {
    render(
      <DateGroupHeader
        date="2026-06-12"
        today={today}
        matchCount={3}
        isCollapsed={true}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText("Tomorrow")).toBeTruthy();
  });

  it("shows match count badge when collapsed", () => {
    render(
      <DateGroupHeader
        date={today}
        today={today}
        matchCount={12}
        isCollapsed={true}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("hides match count badge when expanded", () => {
    render(
      <DateGroupHeader
        date={today}
        today={today}
        matchCount={12}
        isCollapsed={false}
        onToggle={() => {}}
      />
    );
    expect(screen.queryByText("12")).toBeNull();
  });

  it("sets aria-expanded based on isCollapsed", () => {
    const { rerender } = render(
      <DateGroupHeader
        date={today}
        today={today}
        matchCount={1}
        isCollapsed={true}
        onToggle={() => {}}
      />
    );
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("false");

    rerender(
      <DateGroupHeader
        date={today}
        today={today}
        matchCount={1}
        isCollapsed={false}
        onToggle={() => {}}
      />
    );
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("true");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(
      <DateGroupHeader
        date={today}
        today={today}
        matchCount={1}
        isCollapsed={true}
        onToggle={onToggle}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders weekday format for dates within 7 days", () => {
    render(
      <DateGroupHeader
        date="2026-06-14"
        today={today}
        matchCount={2}
        isCollapsed={true}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText(/Sun, Jun 14/)).toBeTruthy();
  });

  it("renders DD.MM.YYYY format beyond 7 days", () => {
    render(
      <DateGroupHeader
        date="2026-06-20"
        today={today}
        matchCount={4}
        isCollapsed={true}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText("20.06.2026")).toBeTruthy();
  });
});
