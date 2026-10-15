"use client";

import { useEffect, useState } from "react";

// ─── Dev-only 全局开关 ────────────────────────────────────────────────────────
// DD-087 §4.1 验收：后端返回 enable_bet=false 数据稀缺，提供 dev override 方便测试
// 触发方式（浏览器 console）：
//   localStorage.setItem('dev:disable_bet', '1')                  → 全部赛事按钮置灰
//   localStorage.removeItem('dev:disable_bet')                    → 恢复
//   window.dispatchEvent(new Event('dev-toggles-change'))         → 同标签实时刷新

const STORAGE_KEY = "dev:disable_bet";
const EVENT_NAME = "dev-toggles-change";

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 读取「强制禁用下注」dev 开关（仅验收用，生产配置不依赖）。
 * - SSR 期间返回 false（避免 hydration mismatch）
 * - 客户端挂载后实时反映 localStorage
 * - 跨标签：listen "storage" 事件
 * - 同标签：listen 自定义 "dev-toggles-change" 事件
 */
export function useForceDisableBet(): boolean {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    setFlag(readFlag());
    const handler = () => setFlag(readFlag());
    window.addEventListener("storage", handler);
    window.addEventListener(EVENT_NAME, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(EVENT_NAME, handler);
    };
  }, []);

  return flag;
}
