import { describe, it, expect } from "vitest";
import { mapStakeHistory } from "./useStakeHistory";
import type { StakeHistoryItem } from "@/types/onchain-stake";

const NOW = 1_780_000_000;

function item(over: Partial<StakeHistoryItem>): StakeHistoryItem {
  return {
    position_id: "1",
    plan_id: 0, // 8h / 0.5x
    lock_hours: 8,
    amount_wei: "100000000000000000000",
    amount_odd: "100",
    start_time: NOW - 3600,
    end_time: NOW + 3600,
    status: "active",
    withdrawn_early: false,
    tx_hash: "0xabc",
    ...over,
  };
}

describe("mapStakeHistory", () => {
  it("active + end_time>now → activePositions status=active，无 pending_reward_wei 时 earned 兜底 0", () => {
    const { activePositions, historyRecords } = mapStakeHistory([item({})], NOW);
    expect(historyRecords).toHaveLength(0);
    expect(activePositions).toHaveLength(1);
    expect(activePositions[0]).toMatchObject({
      id: "1",
      amount: "100", // 用 amount_odd 直接展示，不是 wei
      lockDays: 7, // DD-149：plan_id=0 → 真实锁仓 7 天（不再消费后端 lock_hours）
      multiplier: 0.5, // plan_id=0 → 0.5x
      status: "active",
      earned: "0",
    });
  });

  it("active 带 pending_reward_wei → earned 读后端值（REQ-005）", () => {
    const { activePositions } = mapStakeHistory(
      [item({ pending_reward_wei: "1234500000000000000" })],
      NOW
    );
    expect(activePositions[0].earned).toBe("1.2345");
  });

  it("active + end_time<=now → status=ready", () => {
    const { activePositions } = mapStakeHistory([item({ end_time: NOW - 10 })], NOW);
    expect(activePositions[0].status).toBe("ready");
  });

  it("withdrawn (normal) → historyRecords with reward from reward_wei", () => {
    const { activePositions, historyRecords } = mapStakeHistory(
      [
        item({
          status: "withdrawn",
          withdrawn_early: false,
          reward_wei: "5000000000000000000",
          withdrawn_time: NOW,
        }),
      ],
      NOW
    );
    expect(activePositions).toHaveLength(0);
    expect(historyRecords[0]).toMatchObject({ action: "unstake", amount: "100", reward: "5" });
  });

  it("withdrawn (early) → reward undefined (放弃收益)", () => {
    const { historyRecords } = mapStakeHistory(
      [item({ status: "withdrawn", withdrawn_early: true, withdrawn_time: NOW })],
      NOW
    );
    expect(historyRecords[0]).toMatchObject({ action: "early_unstake" });
    expect(historyRecords[0].reward).toBeUndefined();
  });

  it("withdrawn with absent reward_wei (omitempty) → reward undefined, no crash", () => {
    const { historyRecords } = mapStakeHistory(
      [item({ status: "withdrawn", withdrawn_early: false, withdrawn_time: NOW })],
      NOW
    );
    expect(historyRecords[0].reward).toBeUndefined();
  });
});
