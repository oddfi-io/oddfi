"use client";

import { useCallback } from "react";
import Decimal from "decimal.js";
import { mul, formatDisplayAmount } from "@/lib/decimal";
import { useCurrencyStore, selectCurrency, type DisplayCurrency } from "@/stores/currencyStore";
import { useOddPrice } from "@/hooks/useOddPrice";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

export interface CurrencyDisplayResult {
  currency: DisplayCurrency;
  rate: string | null;
  /** rate 是否可用（已加载且 > 0）。secondary 双币种预览行应 gate 在此值。 */
  hasRate: boolean;
  /** 当前是否应以 USD 为主展示（= isUsd && hasRate）。 */
  canConvert: boolean;
  isOdd: boolean;
  isUsd: boolean;

  convert(oddAmount: string): string;
  format(oddAmount: string, decimals?: number): string;
  formatDual(
    oddAmount: string,
    decimals?: number
  ): {
    primary: string;
    primaryUnit: string;
    secondary: string | null;
  };
  toggle(): void;
}

/**
 * 统一 ODD/USD 展示 Hook — 项目金额展示的唯一入口。
 *
 * 组合 useCurrencyStore（用户偏好）+ useOddPrice（实时汇率），
 * 提供三个 API：
 * - convert(x)   按当前单位转换数值
 * - format(x)    带单位的展示字符串："1,234.56 ODD" / "$1,234.56 USD"
 * - formatDual(x) 主+次双行展示，用于有括号的场景
 *
 * 关键：所有展示标签基于 canConvert 而非 isUsd，
 * 确保 rate 未加载时不会错误地把 ODD 原值标注为 USD。
 */
function safeGtZero(val: string): boolean {
  try {
    return new Decimal(val).gt(0);
  } catch {
    return false;
  }
}

export function useCurrencyDisplay(): CurrencyDisplayResult {
  const currency = useCurrencyStore(selectCurrency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const { data: rateRaw } = useOddPrice();
  const rate = rateRaw ?? null;

  const isOdd = currency === "ODD";
  const isUsd = !isOdd;
  const hasRate = rate != null && rate !== "" && safeGtZero(rate);
  const canConvert = isUsd && hasRate;

  const convert = useCallback(
    (oddAmount: string) => (canConvert ? mul(oddAmount, rate as string) : oddAmount),
    [canConvert, rate]
  );

  const format = useCallback(
    (oddAmount: string, decimals = 2) => {
      const val = formatDisplayAmount(convert(oddAmount), decimals);
      return canConvert ? `$${val} USD` : `${val} ${PLATFORM_TOKEN_DISPLAY}`;
    },
    [convert, canConvert]
  );

  const formatDual = useCallback(
    (oddAmount: string, decimals = 2) => {
      const primaryVal = formatDisplayAmount(convert(oddAmount), decimals);
      const primaryUnit = canConvert ? "USD" : PLATFORM_TOKEN_DISPLAY;
      const primary = canConvert ? `$${primaryVal}` : primaryVal;

      let secondary: string | null = null;
      if (hasRate) {
        if (canConvert) {
          secondary = `≈${formatDisplayAmount(oddAmount, decimals)} ${PLATFORM_TOKEN_DISPLAY}`;
        } else {
          secondary = `≈$${formatDisplayAmount(mul(oddAmount, rate as string), decimals)}`;
        }
      }
      return { primary, primaryUnit, secondary };
    },
    [convert, canConvert, hasRate, rate]
  );

  // 注：此处 "ODD" 是 DisplayCurrency 模式标识（平台币模式），不是 UI 展示单位，不替换。
  const toggle = useCallback(() => setCurrency(isOdd ? "USD" : "ODD"), [isOdd, setCurrency]);

  return {
    currency,
    rate,
    hasRate,
    canConvert,
    isOdd,
    isUsd,
    convert,
    format,
    formatDual,
    toggle,
  };
}
