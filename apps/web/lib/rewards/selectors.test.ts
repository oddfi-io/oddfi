import { describe, expect, it } from "vitest";

import type { RewardRecord, TaskGroup, TaskItem } from "./types";
import { getGroupProgress, getRewardsByStatus } from "./selectors";

function task(partial: Partial<TaskItem> = {}): TaskItem {
  return { id: "t", status: "default", verifyKind: "click", reward: "50", ...partial };
}

function group(tasks: TaskItem[]): TaskGroup {
  return {
    id: "g",
    iconName: "rocket",
    totalReward: "250",
    poolStat: "5,930",
    endTime: "2026-07-22 23:59:59",
    showDays: true,
    tasks,
  };
}

describe("getGroupProgress", () => {
  it("counts only done tasks against total", () => {
    const g = group([
      task({ status: "done" }),
      task({ status: "verifying" }),
      task({ status: "default" }),
    ]);
    expect(getGroupProgress(g)).toEqual({ done: 1, total: 3 });
  });

  it("returns 0/0 for an empty group", () => {
    expect(getGroupProgress(group([]))).toEqual({ done: 0, total: 0 });
  });

  it("counts all done", () => {
    const g = group([task({ status: "done" }), task({ status: "done" })]);
    expect(getGroupProgress(g)).toEqual({ done: 2, total: 2 });
  });
});

describe("getRewardsByStatus", () => {
  const records: RewardRecord[] = [
    { id: "a", status: "claimable", amount: "100", date: "2026-06-12" },
    { id: "b", status: "claimed", amount: "50", date: "2026-06-10" },
    { id: "c", status: "claimable", amount: "80", date: "2026-06-11" },
    { id: "d", status: "expired", amount: "50", date: "2026-06-05" },
  ];

  it("filters claimable", () => {
    expect(getRewardsByStatus(records, "claimable").map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("filters claimed", () => {
    expect(getRewardsByStatus(records, "claimed").map((r) => r.id)).toEqual(["b"]);
  });

  it("returns [] when no record matches", () => {
    expect(getRewardsByStatus([], "claimable")).toEqual([]);
    expect(getRewardsByStatus(records, "expired").map((r) => r.id)).toEqual(["d"]);
  });
});
