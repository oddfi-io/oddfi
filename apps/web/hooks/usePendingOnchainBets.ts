/**
 * DD-140 — 乐观链上注单状态跟踪 hook。
 *
 * 挂在 BetSlip（两个 tab 共同父级）上，对 pendingOnchainBetsStore 中 status="pending"
 * 的注单做后台跟踪，把状态推进到 confirmed / failed，并为 confirmed 单回填 onchainBetId
 * 供 MyBetsView 与后端 portfolio history 去重。
 *
 * 两段一次性跟踪（均按 orderId 去重，不轮询渲染）：
 *  1. 收据跟踪 `waitForReceipt` → confirmed / failed(+revert 原因)。失败必须前端判定：
 *     已查 web-api，用户 place_bet revert 后 order.status 仍 submitted 且响应无 last_error，
 *     故 receipt=reverted + decodeRevertedTx 取 kind（DD-105 旧 BetSummary 逻辑迁后台）。
 *  2. betId 对账：confirmed 单复用 `lib/onchain/order-poller.waitForOnchainBetReady`
 *     （指数退避轮询 getOnchainOrder 至 bet_ready），拿到 betId 回填供 MyBets 去重。
 */
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toastSuccess } from "@/lib/toast";
import { waitForReceipt } from "@/lib/onchain/receipt-poller";
import { decodeRevertedTx } from "@/lib/onchain/revert-decoder";
import { waitForOnchainBetReady } from "@/lib/onchain/order-poller";
import { revertKindToI18nKey, formatRevertArgs } from "@/lib/betting/onchain-error-i18n";
import {
  usePendingOnchainBetsStore,
  selectPendingByOrderId,
  type PendingOnchainBet,
  type PendingOnchainBetsStore,
} from "@/stores/pendingOnchainBetsStore";
import type { WaitForReceiptResult } from "@/lib/onchain/receipt-poller";
import type { DecodedRevert } from "@/lib/onchain/revert-decoder";

interface Deps {
  waitForReceipt: (hash: `0x${string}`) => Promise<WaitForReceiptResult>;
  decodeRevertedTx: (hash: `0x${string}`) => Promise<DecodedRevert | null>;
  waitForOnchainBetReady: (orderId: number) => Promise<{ betId: string }>;
}

const defaultDeps: Deps = {
  waitForReceipt: (hash) => waitForReceipt(hash),
  decodeRevertedTx: (hash) => decodeRevertedTx(hash),
  waitForOnchainBetReady: (orderId) => waitForOnchainBetReady(orderId),
};

/** 一笔 pending 单的收据跟踪：confirmed / failed(+原因) 终态写回 store */
async function trackReceipt(
  bet: PendingOnchainBet,
  deps: Deps,
  update: PendingOnchainBetsStore["update"],
  onConfirmed: () => void
): Promise<void> {
  try {
    const receipt = await deps.waitForReceipt(bet.txHash as `0x${string}`);
    // remount 竞态防护：sheet 关闭→重开会让 trackedRef 重置、对同一单再发起一次跟踪；
    // 若已被前一次跟踪推进到终态则跳过，避免重复 update + 重复弹 T2 toast。
    if (usePendingOnchainBetsStore.getState().byOrderId[bet.orderId]?.status !== "pending") {
      return;
    }
    if (receipt.status === "reverted") {
      let failReasonKey: string | undefined;
      let failReasonArgs: Record<string, string | number> | undefined;
      try {
        const decoded = await deps.decodeRevertedTx(bet.txHash as `0x${string}`);
        if (decoded) {
          failReasonKey = revertKindToI18nKey(decoded.kind);
          failReasonArgs = formatRevertArgs(decoded);
        }
      } catch {
        // 解码失败（RPC / 非标准 revert）→ 走通用失败文案
      }
      update(bet.orderId, { status: "failed", failReasonKey, failReasonArgs });
      return;
    }
    update(bet.orderId, { status: "confirmed" });
    onConfirmed(); // T2：真正上链确认 → 弹「已上链确认」toast
  } catch {
    // ReceiptTimeoutError / RPC 抖动 → 留 pending，后端 history 最终兜底；绝不误标失败
  }
}

export function usePendingOnchainBets(deps: Deps = defaultDeps): void {
  const byOrderId = usePendingOnchainBetsStore(selectPendingByOrderId);
  const update = usePendingOnchainBetsStore((s) => s.update);
  // useTranslations 的 t 引用每次 render 可能变；存 ref 供 async 回调读最新，避免进 effect 依赖
  const t = useTranslations("toast");
  const tRef = useRef(t);
  tRef.current = t;
  // 已发起收据跟踪 / betId 对账的 orderId，避免重复发起（同一单各只一次）
  const trackedRef = useRef<Set<number>>(new Set());
  const reconcilingRef = useRef<Set<number>>(new Set());

  // ① 收据跟踪：pending → confirmed / failed（confirmed 时弹 T2 toast）
  useEffect(() => {
    for (const bet of Object.values(byOrderId)) {
      if (bet.status !== "pending" || trackedRef.current.has(bet.orderId)) continue;
      trackedRef.current.add(bet.orderId);
      void trackReceipt(bet, deps, update, () =>
        toastSuccess(tRef.current("betOnchainConfirmed", { selection: bet.bet.selectionTag }))
      );
    }
  }, [byOrderId, update, deps]);

  // ② betId 对账：confirmed 且 onchainBetId 未回填 → 复用 order-poller 轮询至 bet_ready
  useEffect(() => {
    for (const bet of Object.values(byOrderId)) {
      if (
        bet.status !== "confirmed" ||
        bet.onchainBetId ||
        reconcilingRef.current.has(bet.orderId)
      ) {
        continue;
      }
      reconcilingRef.current.add(bet.orderId);
      deps
        .waitForOnchainBetReady(bet.orderId)
        .then(({ betId }) => update(bet.orderId, { onchainBetId: betId }))
        .catch(() => {
          // 超时（OrderNotReadyTimeoutError）/ getOrder 错误 → 留待 portfolio history 兜底去重
        })
        .finally(() => reconcilingRef.current.delete(bet.orderId));
    }
  }, [byOrderId, update, deps]);
}
