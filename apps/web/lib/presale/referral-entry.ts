/**
 * DD-119 #3 邀请码入口决策（纯函数，认购页登录后调用）。
 *
 * - 已绑推荐人 → bound（不预填、不弹窗）
 * - URL 带他人有效码（≠ 自己）→ prefill（填入「我的推荐人」输入框，由用户手动点「绑定」提交）
 * - 自己的链接（ref == myCode）/ 无码 / 非法码 → modal（弹引导填码弹窗）
 *
 * 注：绑定永远是用户主动动作，本函数不触发任何网络请求。
 */

// 邀请码格式（对齐后端 referral.go：generateCode = "0x" + 6 位大写 Base32）：
// 字符集 23456789ABCDEFGHJKLMNPQRSTUVWXYZ（去掉易混的 0/1/I/O，含 L/M）= [2-9A-HJ-NP-Z]，长度恒 6。
// 示例：0x3YCBK8、0xMVEKMP（非 hex！旧的 [0-9a-fA-F] 正则会把含 M/V/K/Y 的合法码误判无效）。
const REFERRAL_CODE_REGEX = /^0x[2-9A-HJ-NP-Z]{6}$/;

/**
 * 归一为后端 canonical：0x 前缀小写 + 码体大写。
 * 后端 bind 亦 ToUpper(TrimSpace(input)) + DB CI collation，故任意大小写输入都能绑；
 * 前端统一成大写码体，既过校验也与 /referral/me 返回的展示码一致。
 */
export function normalizeReferralCode(raw: string): string {
  const t = raw.trim();
  if (/^0x/i.test(t)) return "0x" + t.slice(2).toUpperCase();
  return t.toUpperCase();
}

/** 校验已归一化（大写码体）的邀请码。生产中调用方均先 normalizeReferralCode 再校验。 */
export function isValidReferralCode(code: string): boolean {
  return REFERRAL_CODE_REGEX.test(code);
}

export type ReferralEntry =
  | { kind: "bound" }
  | { kind: "prefill"; code: string }
  | { kind: "modal" };

/**
 * @remarks 调用方需保证 myCode 已就绪（新用户异步建码场景下，先等 /referral/me 轮询拿到码再调）。
 * 本函数把 `myCode == null` 视为「他人码」处理（用于已确认无自有码的边界），
 * 故 InvestContent 的 effect 在 myCode 未就绪且 URL 有有效码时会 early-return 等待，
 * 避免把「自己的链接」误判成他人码而预填。
 */
export function decideReferralEntry(input: {
  urlRef: string | null;
  myCode: string | null;
  hasReferrer: boolean;
}): ReferralEntry {
  if (input.hasReferrer) return { kind: "bound" };

  const ref = normalizeReferralCode(input.urlRef ?? "");
  if (ref && isValidReferralCode(ref)) {
    const mine = normalizeReferralCode(input.myCode ?? "");
    // 他人有效码（自己 myCode 未生成时 mine 为空，也视为他人）→ 预填
    if (!mine || ref !== mine) return { kind: "prefill", code: ref };
  }
  // 自己链接 / 无码 / 非法码 → 弹引导
  return { kind: "modal" };
}
