/**
 * availableRoundActions — pure state-machine helper.
 *
 * Given the current round status, returns which action buttons should be
 * enabled (true = allowed by the state machine; false = disabled/hidden).
 *
 * This is a pure function with no side effects so it can be tested
 * independently of React / Refine context.
 *
 * State-machine rules (docs/spa-presale-admin/03-pages.md §3, backend presale_routes.go):
 *   pause          : status === "active"
 *   resume         : status === "paused"
 *   reopen         : status === "ended"
 *   close          : status ∈ { "active", "paused" }
 *   updateReferralPct : always available (any status)
 */
import type { RoundStatus } from "@/types/presale";

export type RoundActionType =
  | "pause"
  | "resume"
  | "reopen"
  | "close"
  | "updateReferralPct";

export interface AvailableRoundActions {
  pause: boolean;
  resume: boolean;
  reopen: boolean;
  close: boolean;
  updateReferralPct: boolean;
}

export function availableRoundActions(status: RoundStatus): AvailableRoundActions {
  return {
    pause: status === "active",
    resume: status === "paused",
    reopen: status === "ended",
    close: status === "active" || status === "paused",
    updateReferralPct: true,
  };
}
