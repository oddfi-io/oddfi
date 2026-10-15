"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
// ─── Error classes ────────────────────────────────────────────────────────────

/**
 * 用户取消钱包连接（关闭弹窗）或连接超时时抛出。
 */
export class WalletConnectCancelError extends Error {
  constructor() {
    super("User cancelled wallet connect");
    this.name = "WalletConnectCancelError";
  }
}

/**
 * 调用 requireWallet() 时无法触发连接弹窗（openConnectModal 未就绪）。
 */
export class WalletRequiredError extends Error {
  constructor() {
    super("Wallet required");
    this.name = "WalletRequiredError";
  }
}

// 等待连接完成的最大超时（60 秒）
const CONNECT_TIMEOUT_MS = 60_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * DD-072 Batch 3: H5 写操作前按需触发钱包连接。
 *
 * 浏览赛事 / 查余额等只读操作不需要钱包；投注 / 充值 / 提现等写操作
 * 才调用 requireWallet() 获取地址。
 *
 * 使用方式：
 *   const { requireWallet } = useRequireWallet();
 *   const address = await requireWallet(); // 已连接时立即 resolve；未连接时弹出连接弹窗
 */
export function useRequireWallet(): { requireWallet: () => Promise<`0x${string}`> } {
  const { address, status } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();

  // Refs 用于在 Promise 回调中访问最新状态，避免闭包过期
  const resolveRef = useRef<((addr: `0x${string}`) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 并发调用时复用同一个 Promise，避免覆盖前一个 resolve/reject 导致静默死锁
  const inflightRef = useRef<Promise<`0x${string}`> | null>(null);

  // 清理 pending 状态和定时器
  const cleanup = useCallback(() => {
    pendingRef.current = false;
    resolveRef.current = null;
    rejectRef.current = null;
    inflightRef.current = null;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 监听账户状态变化：连接成功 → resolve；弹窗关闭且未连接 → reject
  useEffect(() => {
    if (!pendingRef.current) return;

    if (status === "connected" && address) {
      // 连接成功
      const resolve = resolveRef.current;
      cleanup();
      resolve?.(address as `0x${string}`);
      return;
    }

    // 弹窗已关闭且仍未连接 → 用户取消
    // status 类型在此分支已排除 "connected"，只检查非 "connecting" 态
    if (connectModalOpen === false && status !== "connecting") {
      const reject = rejectRef.current;
      cleanup();
      reject?.(new WalletConnectCancelError());
    }
  }, [status, address, connectModalOpen, cleanup]);

  const requireWallet = useCallback((): Promise<`0x${string}`> => {
    // 已连接：直接返回
    if (status === "connected" && address) {
      return Promise.resolve(address as `0x${string}`);
    }

    // 并发调用：已有 inflight Promise → 直接复用，双方随同一次连接一起 resolve
    if (pendingRef.current && inflightRef.current) {
      return inflightRef.current;
    }

    // 未就绪
    if (!openConnectModal) {
      return Promise.reject(new WalletRequiredError());
    }

    const promise = new Promise<`0x${string}`>((resolve, reject) => {
      pendingRef.current = true;
      resolveRef.current = resolve;
      rejectRef.current = reject;

      // 60 秒超时兜底
      timerRef.current = setTimeout(() => {
        const reject_ = rejectRef.current;
        cleanup();
        reject_?.(new WalletConnectCancelError());
      }, CONNECT_TIMEOUT_MS);

      openConnectModal();
    });
    inflightRef.current = promise;
    return promise;
  }, [status, address, openConnectModal, cleanup]);

  return { requireWallet };
}
