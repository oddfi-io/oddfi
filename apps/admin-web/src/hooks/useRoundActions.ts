/**
 * useRoundActions — stateless async action functions for presale round state machine.
 *
 * Each action accepts caller-supplied idempotencyKey (generated + managed by ConfirmMutationModal
 * via useIdempotencyKey). This hook owns NO UI state; errors propagate to the caller.
 *
 * Contract:
 *   - Paths/methods/bodies: internal/handler/presale_round.go
 *   - Idempotency header: X-Idempotency-Key (required by requireIdempotencyKey middleware)
 *   - Envelope unpacking: unwrap<T>() from @/lib/api (throws ApiError on code !== 0)
 *   - Field name for referral: referralRewardPct (NOT referralPct — confirmed from updateReferralPctReq)
 *   - All decimal values transmitted as strings (shopspring/decimal alignment)
 *
 * docs/spa-presale-admin/02-data-layer.md §3, §6
 * docs/spa-presale-admin/06-acceptance-and-tasks.md M2-T16
 */
import { api, unwrap } from "@/lib/api";
import type { Round } from "@/types/presale";

// ── Argument types ────────────────────────────────────────────────────────────

export interface RoundActionArgs {
  /** Audit note — backend requires ≥ 10 runes (noteValidatorMW). */
  note: string;
  /** UUID v4 generated and rotated by ConfirmMutationModal via useIdempotencyKey. */
  idempotencyKey: string;
}

export interface UpdateReferralPctArgs extends RoundActionArgs {
  /**
   * Referral reward percentage as a decimal string (e.g. "10" or "12.5").
   * Must be a string — never a number — to preserve precision (shopspring/decimal alignment).
   */
  referralRewardPct: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RoundActionsApi {
  /** POST /admin/presale/rounds/:id/pause — active → paused */
  pause: (args: RoundActionArgs) => Promise<void>;
  /** POST /admin/presale/rounds/:id/resume — paused → active */
  resume: (args: RoundActionArgs) => Promise<void>;
  /** POST /admin/presale/rounds/:id/reopen — ended → active (super_admin + operator) */
  reopen: (args: RoundActionArgs) => Promise<void>;
  /** POST /admin/presale/rounds/:id/close — active/paused → ended */
  close: (args: RoundActionArgs) => Promise<void>;
  /** PATCH /admin/presale/rounds/:id/referral-pct — update referralRewardPct */
  updateReferralPct: (args: UpdateReferralPctArgs) => Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Returns five action functions bound to the given roundId.
 * The hook itself holds no state. Errors propagate as-is to the caller (ConfirmMutationModal).
 *
 * @param roundId - Round identifier (e.g. "seed", "public_a"). URL-encoded on use.
 */
export function useRoundActions(roundId: string): RoundActionsApi {
  const encodedId = encodeURIComponent(roundId);
  const baseUrl = `admin/presale/rounds/${encodedId}`;

  /**
   * Shared helper for the four state-transition POSTs.
   * Sends { note } as JSON body + X-Idempotency-Key header.
   * Discards the returned RoundItem (callers refresh via Refine invalidation).
   */
  async function stateTransition(
    action: "pause" | "resume" | "reopen" | "close",
    { note, idempotencyKey }: RoundActionArgs,
  ): Promise<void> {
    await unwrap<Round>(
      api.post(`${baseUrl}/${action}`, {
        json: { note },
        headers: { "X-Idempotency-Key": idempotencyKey },
      }),
    );
    console.log(`[useRoundActions] ${action} ok roundId=${roundId}`);
  }

  return {
    pause: (args) => stateTransition("pause", args),
    resume: (args) => stateTransition("resume", args),
    reopen: (args) => stateTransition("reopen", args),
    close: (args) => stateTransition("close", args),

    updateReferralPct: async ({ note, idempotencyKey, referralRewardPct }) => {
      await unwrap<Round>(
        api.patch(`${baseUrl}/referral-pct`, {
          json: { referralRewardPct, note },
          headers: { "X-Idempotency-Key": idempotencyKey },
        }),
      );
      console.log(`[useRoundActions] updateReferralPct ok roundId=${roundId}`);
    },
  };
}
