// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "../../../messages/en.json";
import type { TaskItem } from "@/lib/rewards/types";

const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({ toastSuccess: (...a: unknown[]) => toastSuccess(...a) }));

import { TaskItemRow } from "./TaskItemRow";

function renderRow(task: TaskItem) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TaskItemRow task={task} />
    </NextIntlClientProvider>
  );
}

const baseTask: TaskItem = {
  id: "newbie-follow-x",
  status: "default",
  verifyKind: "click",
  reward: "50",
};

beforeEach(() => toastSuccess.mockClear());

describe("TaskItemRow", () => {
  it("renders title, desc and reward for a default task", () => {
    renderRow(baseTask);
    expect(screen.getByText("Follow @oddfilabs")).toBeInTheDocument();
    expect(screen.getByText("Follow OddFi's official account on X")).toBeInTheDocument();
    // reward appears twice (PC pill + H5 inline)
    expect(screen.getAllByText("+50 ODD").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("transitions default → verifying → done", () => {
    renderRow(baseTask);

    // default: only "Go"
    expect(screen.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    // verifying: "Verify" appears
    expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    // done: no action buttons, toast fired
    expect(screen.queryByRole("button", { name: "Go" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledOnce();
  });

  it("renders a done task without action buttons", () => {
    renderRow({ ...baseTask, status: "done" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
