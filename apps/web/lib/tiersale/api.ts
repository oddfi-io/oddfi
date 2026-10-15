/**
 * DD-146 TierSale 公开发售 API 层。
 *
 * 走 `authClient`（经 Next.js 代理 /api/account/* → 后端，绕过 MSW），
 * 复用 lib/api.ts 的 `authPost` / `onchainApprove` 底层 helper（与 lib/presale/api.ts 同范式）。
 *
 * 购买闭环（详见 hooks/useTierSaleBuy.ts 状态机）：
 *   ① getAccountBalance → usdt_available_balance（lib/api.ts 既有，本层不再包一层）
 *   ② approveTierSale(amountWei) → 授权 USDT 给 TierSale（spender 由后端按 target 映射）
 *   ③ estimateTierSale({usdt_amount}) → 预估 ODD / 档位 / 花费
 *   ④ buyTierSale({odd_amount_wei, nonce}) → 提交购买（不等上链，返回 tx_hash）
 *   ⑤ 前端凭 tx_hash 轮询 receipt（lib/onchain/receipt-poller.ts）
 */

import { authPost, onchainApprove } from "@/lib/api";
import type { OnchainTxRes } from "@/types/onchain-betting";
import type { TierSaleEstimateReq, TierSaleEstimateRes, TierSaleBuyReq } from "./types";

/**
 * 授权 USDT 给 TierSale。
 *
 * ⚠️ 授权的是 **USDT**（不是 ODD）；后端把 `target: "tiersale"` 映射为 TierSale 合约地址作 spender，
 * 并按设计授满额（已授权时短路返回空 tx_hash，见 useTierSaleBuy）。
 *
 * @param amountWei USDT wei 字符串（18 位）；后端实际授满额，此值仅参与「已授权短路」的足额判定。
 */
export const approveTierSale = (amountWei: string): Promise<OnchainTxRes> =>
  onchainApprove({ target: "tiersale", amount_wei: amountWei });

/**
 * 预估买入（只读，按链上实时阶梯定价）。
 * @param req `{ usdt_amount }` 人类可读十进制串。
 */
export const estimateTierSale = (req: TierSaleEstimateReq): Promise<TierSaleEstimateRes> =>
  authPost<TierSaleEstimateRes>("account/onchain/tiersale/estimate", req);

/**
 * 提交购买（后端 relay 代发上链，不等回执）。
 * @param req `{ odd_amount_wei, nonce }`，odd_amount_wei 取自 estimate 返回。
 */
export const buyTierSale = (req: TierSaleBuyReq): Promise<OnchainTxRes> =>
  authPost<OnchainTxRes>("account/onchain/tiersale/buy", req);
