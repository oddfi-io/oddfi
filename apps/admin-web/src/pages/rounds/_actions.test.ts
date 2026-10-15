/**
 * Unit tests for availableRoundActions — pure state-machine helper.
 *
 * Uses it.each table-driven coverage for every status × action combination.
 * No React / Refine context needed — pure function.
 */
import { describe, it, expect } from "vitest";
import { availableRoundActions } from "./_actions";
import type { RoundStatus } from "@/types/presale";

// ── Status × expected actions matrix ─────────────────────────────────────────
//
// Columns: [status, pause, resume, reopen, close, updateReferralPct]
// Source of truth: presale_routes.go (operatorPlus for all 5 actions)
//                  + state-machine rules in 03-pages.md §3

type Row = [
  status: RoundStatus,
  pause: boolean,
  resume: boolean,
  reopen: boolean,
  close: boolean,
  updateReferralPct: boolean,
];

const MATRIX: Row[] = [
  // status       pause  resume reopen close  referral
  ["upcoming",    false, false, false, false, true],
  ["active",      true,  false, false, true,  true],
  ["paused",      false, true,  false, true,  true],
  ["ended",       false, false, true,  false, true],
];

describe("availableRoundActions", () => {
  it.each(MATRIX)(
    "status=%s → pause=%s resume=%s reopen=%s close=%s updateReferralPct=%s",
    (status, pause, resume, reopen, close, updateReferralPct) => {
      const result = availableRoundActions(status);
      expect(result.pause).toBe(pause);
      expect(result.resume).toBe(resume);
      expect(result.reopen).toBe(reopen);
      expect(result.close).toBe(close);
      expect(result.updateReferralPct).toBe(updateReferralPct);
    },
  );

  it("returns all five keys for every status", () => {
    const statuses: RoundStatus[] = ["upcoming", "active", "paused", "ended"];
    for (const status of statuses) {
      const result = availableRoundActions(status);
      expect(Object.keys(result)).toHaveLength(5);
      expect("pause" in result).toBe(true);
      expect("resume" in result).toBe(true);
      expect("reopen" in result).toBe(true);
      expect("close" in result).toBe(true);
      expect("updateReferralPct" in result).toBe(true);
    }
  });

  it("updateReferralPct is always true regardless of status", () => {
    const statuses: RoundStatus[] = ["upcoming", "active", "paused", "ended"];
    for (const status of statuses) {
      expect(availableRoundActions(status).updateReferralPct).toBe(true);
    }
  });

  it("only active status allows pause", () => {
    expect(availableRoundActions("active").pause).toBe(true);
    expect(availableRoundActions("upcoming").pause).toBe(false);
    expect(availableRoundActions("paused").pause).toBe(false);
    expect(availableRoundActions("ended").pause).toBe(false);
  });

  it("only paused status allows resume", () => {
    expect(availableRoundActions("paused").resume).toBe(true);
    expect(availableRoundActions("upcoming").resume).toBe(false);
    expect(availableRoundActions("active").resume).toBe(false);
    expect(availableRoundActions("ended").resume).toBe(false);
  });

  it("only ended status allows reopen", () => {
    expect(availableRoundActions("ended").reopen).toBe(true);
    expect(availableRoundActions("upcoming").reopen).toBe(false);
    expect(availableRoundActions("active").reopen).toBe(false);
    expect(availableRoundActions("paused").reopen).toBe(false);
  });

  it("active and paused statuses allow close", () => {
    expect(availableRoundActions("active").close).toBe(true);
    expect(availableRoundActions("paused").close).toBe(true);
    expect(availableRoundActions("upcoming").close).toBe(false);
    expect(availableRoundActions("ended").close).toBe(false);
  });
});
