/**
 * useKolReferralActions — stateless async action functions for KOL 特殊返佣 CRUD（REQ-004）。
 *
 * 后端契约（oddfi-admin-backend/internal/handler/presale_kol_referral.go + router.go）：
 *   - POST   /admin/presale/kol-referral        — super_admin（body: referrerEoa/referralPct/note）
 *   - PATCH  /admin/presale/kol-referral/:eoa    — super_admin（body: referralPct/note）
 *   - DELETE /admin/presale/kol-referral/:eoa     — super_admin（body: note）
 *   - ⚠️ 所有 presale 写接口经 noteValidatorMW：note 必填且 ≥10 runes，否则 400 NOTE_REQUIRED；
 *     DELETE 也必须带 JSON body（含 note），否则 400 INVALID_PARAM（body must be valid JSON）
 *   - note 同时被 web-api 存为 KOL 记录备注 + 充当审计备注（同一字段双用途）
 *   - 无 requireIdempotencyKey → 不带 X-Idempotency-Key
 *   - referralPct 为 decimal string，禁止 number 化；后端按 [0,100] 校验
 *   - 信封拆包：unwrap<T>()（code !== 0 抛 ApiError）
 */
import { api, unwrap } from "@/lib/api";
import type { KolReferral } from "@/types/presale";

// 写操作响应 data 形如 { kol: KolReferralItem }（admin-backend client.KolReferralResponse）。
interface KolWriteResult {
  kol: KolReferral;
}

export interface CreateKolArgs {
  referrerEoa: string;
  referralPct: string;
  /** 操作备注，必填且 ≥10 字（noteValidatorMW 强制）。 */
  note: string;
}

export interface UpdateKolArgs {
  referralPct: string;
  /** 操作备注，必填且 ≥10 字（noteValidatorMW 强制）。 */
  note: string;
}

export interface KolReferralActionsApi {
  /** POST /admin/presale/kol-referral — 新增（super_admin） */
  createKol: (args: CreateKolArgs) => Promise<KolReferral>;
  /** PATCH /admin/presale/kol-referral/:eoa — 更新返佣比例（super_admin） */
  updateKol: (eoa: string, args: UpdateKolArgs) => Promise<KolReferral>;
  /** DELETE /admin/presale/kol-referral/:eoa — 删除（super_admin），note ≥10 字充当审计备注 */
  deleteKol: (eoa: string, note: string) => Promise<void>;
}

const BASE = "admin/presale/kol-referral";

/**
 * KOL 特殊返佣 CRUD action 函数。本 hook 不持有状态，错误原样抛给调用方处理 UI。
 */
export function useKolReferralActions(): KolReferralActionsApi {
  return {
    createKol: async ({ referrerEoa, referralPct, note }: CreateKolArgs): Promise<KolReferral> => {
      const result = await unwrap<KolWriteResult>(
        api.post(BASE, { json: { referrerEoa, referralPct, note } }),
      );
      console.log(`[useKolReferralActions] createKol ok — eoa=${referrerEoa} pct=${referralPct}`);
      return result.kol;
    },

    updateKol: async (eoa: string, { referralPct, note }: UpdateKolArgs): Promise<KolReferral> => {
      const result = await unwrap<KolWriteResult>(
        api.patch(`${BASE}/${encodeURIComponent(eoa)}`, { json: { referralPct, note } }),
      );
      console.log(`[useKolReferralActions] updateKol ok — eoa=${eoa} pct=${referralPct}`);
      return result.kol;
    },

    // DELETE 必须带 JSON body（含 note ≥10），否则 noteValidatorMW 解析 body 失败 → 400。
    deleteKol: async (eoa: string, note: string): Promise<void> => {
      await unwrap<{ referrerEoa: string }>(
        api.delete(`${BASE}/${encodeURIComponent(eoa)}`, { json: { note } }),
      );
      console.log(`[useKolReferralActions] deleteKol ok — eoa=${eoa}`);
    },
  };
}
