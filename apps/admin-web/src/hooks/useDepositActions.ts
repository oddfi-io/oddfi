/**
 * useDepositActions — stateless async action functions for presale deposit high-sensitivity mutations.
 *
 * Each action accepts caller-supplied idempotencyKey (generated + managed by ConfirmMutationModal
 * via useIdempotencyKey). This hook owns NO UI state; errors propagate to the caller.
 *
 * Contract:
 *   - Paths/methods/bodies: internal/handler/presale_deposit.go + internal/router/presale_routes.go
 *   - POST /admin/presale/deposits/:txHash/migrate-round (operatorPlus = operator | super_admin)
 *   - Idempotency header: X-Idempotency-Key (required by requireIdempotencyKey middleware)
 *   - Body JSON tags: targetRoundId (from migrateRoundReq struct in presale_deposit.go)
 *   - Envelope unpacking: unwrap<T>() from @/lib/api (throws ApiError on code !== 0)
 *   - txHash is 0x-prefixed hex — ASCII-safe, but always encodeURIComponent for defensive consistency
 *
 * docs/spa-presale-admin/02-data-layer.md §3, §6
 * docs/spa-presale-admin/06-acceptance-and-tasks.md M3-T20
 */
import { api, unwrap } from "@/lib/api";
import type { MigrateResult } from "@/types/presale";

// ── Argument types ────────────────────────────────────────────────────────────

export interface MigrateRoundArgs {
  /** Audit note — backend requires ≥ 10 runes (noteValidatorMW). */
  note: string;
  /** UUID v4 generated and rotated by ConfirmMutationModal via useIdempotencyKey. */
  idempotencyKey: string;
  /**
   * Target round ID as a string (e.g. "seed", "public_a").
   * Must remain a string — never coerced to a number.
   * Corresponds to `targetRoundId` JSON tag in backend migrateRoundReq struct.
   */
  targetRoundId: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DepositActionsApi {
  /**
   * POST /admin/presale/deposits/:txHash/migrate-round
   * Moves this deposit's round ownership from its current round to targetRoundId.
   * High-sensitivity: affects target round's share totals and user vesting schedule.
   * Rate-limited to 10/min by sensitiveLimit middleware.
   */
  migrateRound: (args: MigrateRoundArgs) => Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Returns action functions bound to the given txHash.
 * The hook itself holds no state. Errors propagate as-is to the caller (ConfirmMutationModal).
 *
 * @param txHash - Deposit transaction hash (0x-prefixed hex). URL-encoded on use.
 */
export function useDepositActions(txHash: string): DepositActionsApi {
  const encodedTxHash = encodeURIComponent(txHash);
  const baseUrl = `admin/presale/deposits/${encodedTxHash}`;

  return {
    migrateRound: async ({ note, idempotencyKey, targetRoundId }: MigrateRoundArgs): Promise<void> => {
      await unwrap<MigrateResult>(
        api.post(`${baseUrl}/migrate-round`, {
          json: { targetRoundId, note },
          headers: { "X-Idempotency-Key": idempotencyKey },
        }),
      );
      console.log(`[useDepositActions] migrateRound succeeded — txHash=${txHash}`);
    },
  };
}
