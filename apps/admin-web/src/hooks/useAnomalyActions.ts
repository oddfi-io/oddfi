/**
 * useAnomalyActions — stateless async action functions for anomaly event resolve.
 *
 * Contract:
 *   - Path/method: POST /admin/presale/anomaly/:id/resolve
 *     (internal/handler/presale_anomaly.go ResolveAnomalyEvent)
 *   - Idempotency header: X-Idempotency-Key (required by requireIdempotencyKey middleware)
 *   - Request body JSON tags (resolveReq): resolution / targetRoundId / note
 *   - Envelope unpacking: unwrap<AnomalyEvent>() from @/lib/api (throws ApiError on code !== 0)
 *   - Resolution enum (web-api service/presale_admin_anomaly.go):
 *       "convert_to_deposit" | "partial_credit" | "reject"
 *   - targetRoundId: required only for "convert_to_deposit" (web-api enforces this)
 *   - anomalyId: number (AnomalyEvent.id is uint64 in backend, number in frontend type)
 *   - RBAC: customer_service / operator / super_admin (finance excluded — presale_routes.go)
 *
 * docs/spa-presale-admin/02-data-layer.md §3, §6
 * docs/spa-presale-admin/06-acceptance-and-tasks.md M3-T21
 */
import { api, unwrap } from "@/lib/api";
import type { AnomalyEvent } from "@/types/presale";

// ── Resolution enum ───────────────────────────────────────────────────────────

/**
 * Valid resolution values for anomaly/resolve.
 * Source-of-truth: web-api internal/service/presale_admin_anomaly.go const block.
 *   ResolutionConvertToDeposit = "convert_to_deposit"
 *   ResolutionPartialCredit    = "partial_credit"
 *   ResolutionReject           = "reject"
 */
export type AnomalyResolution = "convert_to_deposit" | "partial_credit" | "reject";

// ── Argument types ────────────────────────────────────────────────────────────

export interface ResolveAnomalyArgs {
  /** Audit note — backend noteValidatorMW requires ≥ 10 runes. */
  note: string;
  /** UUID v4 generated and rotated by ConfirmMutationModal via useIdempotencyKey. */
  idempotencyKey: string;
  /**
   * Resolution type. Enum values:
   *   "convert_to_deposit" — confirm deposit into target round, update holding + sold_odd
   *   "partial_credit"     — confirm overflow deposit as-is (no reshare), update holding
   *   "reject"             — reject the anomaly, no deposit/holding changes
   */
  resolution: AnomalyResolution;
  /**
   * Required when resolution === "convert_to_deposit".
   * Omit (or pass undefined) for "partial_credit" and "reject".
   * Backend validates: targetRoundId must not be nil/empty for convert_to_deposit.
   */
  targetRoundId?: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AnomalyActionsApi {
  /**
   * POST /admin/presale/anomaly/:id/resolve
   * Processes the anomaly event according to the chosen resolution type.
   */
  resolve: (args: ResolveAnomalyArgs) => Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Returns an action function bound to the given anomalyId.
 * The hook itself holds no state. Errors propagate as-is to the caller (ConfirmMutationModal).
 *
 * @param anomalyId - Anomaly event ID (number from AnomalyEvent.id, uint64 in backend).
 *                   Converted to string via String() — never parseFloat or coercion.
 */
export function useAnomalyActions(anomalyId: string | number): AnomalyActionsApi {
  const encodedId = encodeURIComponent(String(anomalyId));
  const url = `admin/presale/anomaly/${encodedId}/resolve`;

  return {
    resolve: async ({ note, idempotencyKey, resolution, targetRoundId }: ResolveAnomalyArgs): Promise<void> => {
      // Build body matching resolveReq JSON tags exactly:
      //   resolution    string   (required)
      //   targetRoundId *string  (omitempty — only send when present)
      //   note          string
      const body: { resolution: string; note: string; targetRoundId?: string } = {
        resolution,
        note,
      };
      if (targetRoundId !== undefined) {
        body.targetRoundId = targetRoundId;
      }

      await unwrap<AnomalyEvent>(
        api.post(url, {
          json: body,
          headers: { "X-Idempotency-Key": idempotencyKey },
        }),
      );
      console.log(
        `[useAnomalyActions] resolve succeeded — anomalyId=${anomalyId} resolution=${resolution}`,
      );
    },
  };
}
