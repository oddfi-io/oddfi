"use client";

/**
 * DD-119 §4 认购交易编排：预校验 → 切链 → USDT.transfer(金库, 18 decimals)
 *   → waitForTransactionReceipt 等上链 → report-tx → 轮询。
 *
 * 关键约束：
 * - 钱包"已完成"≠ 已上链：先用 viem waitForTransactionReceipt 在前端 RPC 确认 receipt——
 *   status==='reverted' 直接判终态失败（不盲打后端空转）；success/超时则继续上报。
 * - txHash 一旦上链即资金已转出，report-tx 失败只重 POST 不重签（§4.2 #3）。report-tx 失败分类：
 *   40006（后端 RPC 偶发滞后）→ reportTxWithRetry 指数避让静默重试，耗尽转 worker 兜底轮询；
 *   network/未知/40405 → 直接进轮询靠 worker 兜底（§11.3 决策 #9，不前端补报）；
 *   40007/40008/40902（tx 本身有问题）→ dialog 报错（不可重转）。分类见 classifyReportTxError。
 * - 金额全程 decimal/parseUnits，禁止原生浮点；BSC USDT = 18 decimals（非 6）。
 * - 用户拒签（severity=info）不算失败，回 idle 可重试。
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { erc20Abi, formatUnits, getAddress, parseUnits } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getWalletErrorInfo, mapWalletError } from "@/lib/wallet-error";
import { presaleKeys, referralKeys } from "@/lib/query-keys";
import { reportDepositTx } from "../api";
import type { Deposit, PresaleConfig, PresaleRound } from "../types";
import { validateDeposit } from "../deposit-validation";
import {
  mapDepositErrorCode,
  mapDepositValidationError,
  type DepositErrorForm,
} from "../error-map";
import { useDepositStatus } from "./useDepositStatus";

export type DepositPhase =
  | "idle"
  | "signing"
  | "reporting"
  | "polling"
  | "confirmed"
  | "anomaly"
  | "failed"
  | "timeout";

const POLL_TIMEOUT_MS = 5 * 60 * 1000;

// report-tx 静默重试：40006（INVALID_TX）多为"上报过早"——钱包乐观显示已完成时，
// 后端 RPC 节点 eth_getTransactionReceipt 还是 null（tx 刚发出未被该节点索引）。
// 指数避让重试，给链上 + 后端节点时间收敛；耗尽仍失败则交 listener worker 兜底轮询。
export const REPORT_TX_MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** 指数避让（attempt 从 0 起）：1s,2s,4s,8s,8s(封顶 8s)，5 次重试共 ~23s。 */
export function reportTxBackoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}
export type ReportTxAction = "terminal" | "retry" | "poll";
/**
 * report-tx 失败分类（tx 已上链、资金已转出、不可重签，只可重 POST 或轮询）：
 * - 40007/40008/40902（tx 打错金库 / 非 USDT / 钱包不符）→ terminal：tx 本身有问题，立即报错
 * - 40006（receipt 不存在或 revert）→ retry：绝大多数是上报过早的瞬态，指数避让静默重试
 * - 40405 / 网络未知(null) / 其它 → poll：交后端 listener worker 兜底入账，由轮询确认（§11.3 #9）
 */
export function classifyReportTxError(code: number | null): ReportTxAction {
  if (code === 40007 || code === 40008 || code === 40902) return "terminal";
  if (code === 40006) return "retry";
  return "poll";
}

export interface DepositUiError {
  message: string;
  form: DepositErrorForm;
  showBscScan?: boolean;
}

export interface UseDepositResult {
  phase: DepositPhase;
  txHash: string | null;
  deposit: Deposit | null;
  error: DepositUiError | null;
  /** 人类可读 USDT 余额（null=未取到） */
  usdtBalance: string | null;
  start: (amount: string, round: PresaleRound) => Promise<void>;
  reset: () => void;
}

/** ky HTTPError → 业务码（proxy 透传 body.code）。无法解析返回 null（视为网络/未知）。 */
async function extractBizCode(err: unknown): Promise<number | null> {
  if (!err || typeof err !== "object" || !("response" in err)) return null;
  try {
    const body = await (err as { response: Response }).response.clone().json();
    return typeof body?.code === "number" ? body.code : null;
  } catch {
    return null;
  }
}

/** report-tx 结果：ok=上报成功 / poll=交 worker 兜底轮询 / {terminal}=tx 本身有问题立即失败 */
export type ReportTxOutcome = "ok" | "poll" | { terminal: number };

/**
 * report-tx 第二道兜底：receipt 已上链后调用，后端 RPC 偶发滞后仍可能短暂 40006 →
 * 指数避让静默重试；耗尽转 worker 兜底轮询。依赖注入（doReport/sleep）以便单测。
 */
export async function reportTxWithRetry(
  doReport: () => Promise<unknown>,
  opts: { maxRetries?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<ReportTxOutcome> {
  const maxRetries = opts.maxRetries ?? REPORT_TX_MAX_RETRIES;
  const sleepFn = opts.sleep ?? sleep;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await doReport();
      return "ok";
    } catch (e) {
      const code = await extractBizCode(e);
      const action = classifyReportTxError(code);
      if (action === "terminal") return { terminal: code as number };
      if (action === "poll") return "poll";
      // action === "retry"（40006）：指数避让后重试；最后一次仍失败 → 交 worker 兜底
      if (attempt < maxRetries) {
        await sleepFn(reportTxBackoffMs(attempt));
        continue;
      }
      return "poll";
    }
  }
  return "poll";
}

export function useDeposit(config: PresaleConfig | undefined): UseDepositResult {
  const t = useTranslations("invest");
  const { address, chainId } = useAccount();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<DepositPhase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<DepositUiError | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const expectedChainId = config?.vault.chainId ?? 56;
  const usdtAddress = config?.vault.usdtAddress;
  const publicClient = usePublicClient({ chainId: expectedChainId });

  // USDT 余额（balanceOf，18 decimals）
  const { data: balanceRaw } = useReadContract({
    address: usdtAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: expectedChainId,
    query: { enabled: !!address && !!usdtAddress },
  });
  const usdtBalance = balanceRaw != null ? formatUnits(balanceRaw, 18) : null;

  // 轮询单笔状态
  const polling = phase === "polling" && !pollTimedOut;
  const { data: deposit = null } = useDepositStatus(txHash, polling);

  // 5min 轮询超时（REV-v2 C-01：deps 不含 txHash，避免重试场景重置计时器无限延长）
  useEffect(() => {
    if (phase !== "polling") return;
    const t = setTimeout(() => setPollTimedOut(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (pollTimedOut && phase === "polling") setPhase("timeout");
  }, [pollTimedOut, phase]);

  // 轮询结果 → 相位转移（paused_arrival 是 confirmed，由 UI 在 confirmed 分支弱提示）
  useEffect(() => {
    if (phase !== "polling" || !deposit) return;
    if (deposit.status === "confirmed") {
      setPhase("confirmed");
      // REV-v2 C-02：邀请奖励在 referral 命名空间，需一并失效
      queryClient.invalidateQueries({ queryKey: presaleKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    } else if (deposit.status === "anomaly") {
      setPhase("anomaly");
      queryClient.invalidateQueries({ queryKey: presaleKeys.all });
    }
  }, [deposit, phase, queryClient]);

  const start = useCallback(
    async (amount: string, round: PresaleRound) => {
      // REV-v2 M-01：重入守卫，防止 reporting/polling 期间二次点击触发重复签名
      if (phase !== "idle" && phase !== "failed") return;
      if (!config || !usdtAddress) return;
      setError(null);
      setPollTimedOut(false);

      // 1. 切链
      if (chainId !== expectedChainId) {
        try {
          await switchChainAsync({ chainId: expectedChainId });
        } catch (e) {
          console.error("[useDeposit] Chain switch failed", e);
          setError({ message: mapWalletError(e, "switch"), form: "toast" });
          setPhase("failed");
          return;
        }
      }

      // 2. 预校验
      const v = validateDeposit({
        amount,
        isAuthenticated,
        chainId: expectedChainId,
        expectedChainId,
        round,
        minSubscribeUsd: config.vault.minSubscribeUsd,
        nowMs: Date.now(),
        usdtBalance,
      });
      if (!v.ok) {
        const validationKey = mapDepositValidationError(v.error, {
          minSubscribeUsd: config.vault.minSubscribeUsd,
        });
        setError({
          message:
            v.error === "below_min" && config.vault.minSubscribeUsd
              ? t("validationError.belowMin", { min: config.vault.minSubscribeUsd })
              : t(validationKey),
          form: "toast",
        });
        setPhase("failed");
        return;
      }

      // 3. 签名 USDT.transfer（18 decimals）
      let hash: `0x${string}`;
      try {
        setPhase("signing");
        hash = await writeContractAsync({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: "transfer",
          // REV-v2 M-05：getAddress 做 EIP-55 checksum + 地址合法性校验
          args: [getAddress(config.vault.depositAddress), parseUnits(amount, 18)],
          chainId: expectedChainId,
        });
      } catch (e) {
        const info = getWalletErrorInfo(e, "sign");
        console.error("[useDeposit] transfer sign failed —", info.kind);
        setError({ message: mapWalletError(e, "sign"), form: "toast" });
        // 用户主动取消（info）→ 回 idle 可重试；其它 → failed
        setPhase(info.severity === "info" ? "idle" : "failed");
        return;
      }

      // 4. 等 receipt 上链（前端自有 RPC；viem waitForTransactionReceipt 自带指数退避轮询 + 超时）。
      //    EVM 地道做法：钱包乐观显示"已完成"≠ 已上链，先在前端确认 receipt：
      //    - status==='reverted' → 链上确认失败，直接判终态（不再盲打后端空转）
      //    - status==='success' → tx 已上链，后端 report-tx 几乎必命中
      //    - 超时/RPC 错误 → tx 可能已上链但前端 RPC 没拿到，不判失败，照常上报 + 交 worker 兜底
      setTxHash(hash);
      setPhase("reporting");
      if (publicClient) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash,
            timeout: 60_000,
            pollingInterval: 3_000, // 贴 BSC ~3s 出块节奏
            confirmations: 1,
          });
          if (receipt.status === "reverted") {
            console.error("[useDeposit] tx reverted on-chain —", hash);
            const mapped = mapDepositErrorCode(40006); // 复用 INVALID_TX 文案
            setError({
              message: t(mapped.message),
              form: mapped.form,
              showBscScan: mapped.showBscScan,
            });
            setPhase("failed");
            return;
          }
        } catch (e) {
          console.warn(
            "[useDeposit] waitForTransactionReceipt timeout/error — proceeding to report",
            e
          );
        }
      }

      // 5. report-tx（幂等；失败不重签）。receipt 已确认上链后调用，后端 RPC 偶发滞后仍可能
      //    短暂 40006 → reportTxWithRetry 指数避让重试作第二道兜底，耗尽转 worker 轮询。
      const outcome = await reportTxWithRetry(() =>
        reportDepositTx({ txHash: hash, expectedRoundId: round.id, expectedAmountUsdt: amount })
      );
      if (typeof outcome === "object") {
        const mapped = mapDepositErrorCode(outcome.terminal);
        console.error("[useDeposit] report-tx rejected (terminal) — code", outcome.terminal);
        setError({
          message: t(mapped.message),
          form: mapped.form,
          showBscScan: mapped.showBscScan,
        });
        setPhase("failed");
        return;
      }

      // 6. 轮询确认（outcome === "ok" | "poll" 都进轮询，由 worker/后端推进状态）
      setPhase("polling");
    },
    [
      phase,
      config,
      usdtAddress,
      chainId,
      expectedChainId,
      isAuthenticated,
      usdtBalance,
      switchChainAsync,
      writeContractAsync,
      publicClient,
      t,
    ]
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(null);
    setError(null);
    setPollTimedOut(false);
  }, []);

  return { phase, txHash, deposit, error, usdtBalance, start, reset };
}
