import { describe, it, expect } from "vitest";
import { derivePositionStatus, STAKE_POSITION_STATUS } from "./staking-state";

describe("derivePositionStatus", () => {
  const NOW = 1_700_000_000;

  it("returns 'active' when active=true and unlockAt > now", () => {
    expect(derivePositionStatus({ active: true, unlockAt: NOW + 3600 }, NOW)).toBe(
      STAKE_POSITION_STATUS.Active
    );
  });

  it("returns 'ready' when active=true and unlockAt < now", () => {
    expect(derivePositionStatus({ active: true, unlockAt: NOW - 1 }, NOW)).toBe(
      STAKE_POSITION_STATUS.Ready
    );
  });

  it("returns 'ready' on the boundary when unlockAt == now", () => {
    expect(derivePositionStatus({ active: true, unlockAt: NOW }, NOW)).toBe(
      STAKE_POSITION_STATUS.Ready
    );
  });

  it("returns 'withdrawn' when active=false regardless of unlockAt", () => {
    expect(derivePositionStatus({ active: false, unlockAt: NOW + 3600 }, NOW)).toBe(
      STAKE_POSITION_STATUS.Withdrawn
    );
    expect(derivePositionStatus({ active: false, unlockAt: NOW - 1 }, NOW)).toBe(
      STAKE_POSITION_STATUS.Withdrawn
    );
  });

  it("transitions active → ready when now crosses unlockAt", () => {
    const pos = { active: true, unlockAt: NOW + 100 };
    expect(derivePositionStatus(pos, NOW)).toBe(STAKE_POSITION_STATUS.Active);
    expect(derivePositionStatus(pos, NOW + 200)).toBe(STAKE_POSITION_STATUS.Ready);
  });
});
