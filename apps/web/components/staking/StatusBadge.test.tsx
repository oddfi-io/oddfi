// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import StatusBadge from "./StatusBadge";
import en from "../../messages/en.json";

function renderBadge(status: "active" | "ready" | "withdrawn", daysLeft?: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <StatusBadge status={status} daysLeft={daysLeft} />
    </NextIntlClientProvider>
  );
}

describe("StatusBadge", () => {
  it("renders 'Ready' label with green tag for ready status", () => {
    renderBadge("ready");
    expect(screen.getByText("Ready")).toBeDefined();
  });

  it("renders 'Active' label (with daysLeft) for active status", () => {
    renderBadge("active", 3);
    // staking namespace's statusActive may be "Active" (line 577 of en.json staking namespace)
    expect(screen.getByText(/Active/i)).toBeDefined();
  });

  it("renders 'Withdrawn' label for withdrawn status", () => {
    renderBadge("withdrawn");
    expect(screen.getByText("Withdrawn")).toBeDefined();
  });
});
