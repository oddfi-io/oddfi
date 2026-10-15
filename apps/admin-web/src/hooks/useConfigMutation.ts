/**
 * useConfigMutation — stateless async action function for PATCH /admin/presale/config.
 *
 * Contract:
 *   - Path/method/body: internal/handler/presale_config.go (updateConfigReq struct)
 *   - Idempotency header: X-Idempotency-Key (required by requireIdempotencyKey middleware)
 *   - Envelope unpacking: unwrap<T>() from @/lib/api (throws ApiError on code !== 0)
 *   - All decimal values transmitted as strings (shopspring/decimal alignment)
 *   - All pointer fields are optional (omit = no change, backend partial update semantics)
 *
 * Backend JSON tags (updateConfigReq in presale_config.go):
 *   tgeTs                *int64   → "tgeTs"
 *   tgeOpenPriceUsd      *string  → "tgeOpenPriceUsd"
 *   vaultAddress         *string  → "vaultAddress"
 *   minSubscribeUsd      *string  → "minSubscribeUsd"
 *   boundaryToleranceMin *int     → "boundaryToleranceMin"
 *   totalTargetUsd       *string  → "totalTargetUsd"
 *   auditLabel           *string  → "auditLabel"
 *   larkWebhookUrl       *string  → "larkWebhookUrl"
 *   note                  string  → "note" (required)
 *
 * docs/spa-presale-admin/02-data-layer.md §3, §6
 * docs/spa-presale-admin/06-acceptance-and-tasks.md M3-T19
 */
import { api, unwrap } from "@/lib/api";
import type { UpdateConfigResult } from "@/types/presale";

// ── Payload types ─────────────────────────────────────────────────────────────

/**
 * All config fields are optional — send only the ones you want to change.
 * String decimal fields (tgeOpenPriceUsd, minSubscribeUsd, totalTargetUsd) must
 * remain strings; never coerce to number (shopspring/decimal alignment).
 */
export interface ConfigPatchPayload {
  tgeTs?: number;
  tgeOpenPriceUsd?: string;
  vaultAddress?: string;
  minSubscribeUsd?: string;
  boundaryToleranceMin?: number;
  totalTargetUsd?: string;
  auditLabel?: string;
  larkWebhookUrl?: string;
}

export interface UpdateConfigArgs extends ConfigPatchPayload {
  /** Audit note — backend requires ≥ 10 runes (noteValidatorMW). */
  note: string;
  /** UUID v4 generated and managed by ConfirmMutationModal via useIdempotencyKey. */
  idempotencyKey: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ConfigMutationApi {
  /** PATCH /admin/presale/config — super_admin only */
  updateConfig: (args: UpdateConfigArgs) => Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Returns the updateConfig action function.
 * This hook holds no state. Errors propagate as-is to the caller (ConfirmMutationModal).
 */
export function useConfigMutation(): ConfigMutationApi {
  return {
    updateConfig: async ({ note, idempotencyKey, ...payload }: UpdateConfigArgs): Promise<void> => {
      await unwrap<UpdateConfigResult>(
        api.patch("admin/presale/config", {
          json: { ...payload, note },
          headers: { "X-Idempotency-Key": idempotencyKey },
        }),
      );
      console.log("[useConfigMutation] updateConfig succeeded");
    },
  };
}
