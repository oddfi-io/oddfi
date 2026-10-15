/**
 * useRoundEdit — PATCH /admin/presale/rounds/:id (super_admin only, high-sensitivity multi-field edit).
 *
 * Contract:
 *   - Backend struct: updateRoundReq (internal/handler/presale_round.go)
 *   - Fields: priceUsd / supplyOdd / endTs / minPerOrderUsd / maxPerWalletUsd / tgeReleasePct /
 *             linearReleaseDays / note
 *   - NOTE: startTs and referralRewardPct are NOT in updateRoundReq; use UpdateReferralPct endpoint
 *     for referralRewardPct changes.
 *   - All decimal/amount/pct fields transmitted as strings (shopspring/decimal alignment).
 *   - linearReleaseDays is integer days, transmitted as number (not string).
 *   - Idempotency header: X-Idempotency-Key (required by requireIdempotencyKey middleware).
 *   - Envelope unpacking: unwrap<T>() from @/lib/api (throws ApiError on code !== 0).
 *
 * docs/spa-presale-admin/02-data-layer.md §3, §6
 * docs/spa-presale-admin/06-acceptance-and-tasks.md M3-T18
 */
import { api, unwrap } from "@/lib/api";
import type { Round } from "@/types/presale";

// ── Payload type (mirrors backend updateRoundReq, all fields optional = patch semantics) ──

/**
 * Fields that can be patched on a round. All fields are optional — only non-undefined values
 * are sent to the backend (patch semantics: only change what is specified).
 *
 * Field alignment with backend updateRoundReq JSON tags:
 *   priceUsd          → *string  (decimal string, e.g. "0.05")
 *   supplyOdd         → *string  (decimal string, e.g. "1000000")
 *   endTs             → *int64   (epoch ms)
 *   minPerOrderUsd    → *string  (decimal string)
 *   maxPerWalletUsd   → *string  (decimal string)
 *   tgeReleasePct     → *string  (decimal string, 0–100)
 *   linearReleaseDays → *int     (integer days, transmitted as number)
 */
export interface RoundEditPayload {
  priceUsd?: string;
  supplyOdd?: string;
  endTs?: number; // epoch ms
  minPerOrderUsd?: string;
  maxPerWalletUsd?: string;
  tgeReleasePct?: string;
  linearReleaseDays?: number; // integer days — not stringMode
}

export interface UpdateRoundArgs extends RoundEditPayload {
  note: string;
  idempotencyKey: string;
}

export interface RoundEditApi {
  /** PATCH /admin/presale/rounds/:id — update one or more round fields (super_admin only) */
  updateRound: (args: UpdateRoundArgs) => Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Returns an updateRound function bound to the given roundId.
 * The hook itself holds no state. Errors propagate as-is to the caller (ConfirmMutationModal).
 *
 * @param roundId - Round identifier (e.g. "seed", "public_a"). URL-encoded on use.
 */
export function useRoundEdit(roundId: string): RoundEditApi {
  const encodedId = encodeURIComponent(roundId);
  const url = `admin/presale/rounds/${encodedId}`;

  return {
    updateRound: async ({ note, idempotencyKey, ...payload }: UpdateRoundArgs): Promise<void> => {
      await unwrap<Round>(
        api.patch(url, {
          json: { note, ...payload },
          headers: { "X-Idempotency-Key": idempotencyKey },
        }),
      );
      console.log(`[useRoundEdit] updateRound succeeded — roundId=${roundId}`);
    },
  };
}
