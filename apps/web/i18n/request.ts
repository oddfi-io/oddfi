import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

/**
 * 递归把 `{symbol}` 占位符替换为平台币展示名（如 "ODD"）。
 *
 * 背景：next-intl v4 移除了 v3 的 `defaultTranslationValues` API。
 * 我们在加载阶段预插值 `{symbol}`，让业务 `t(key, { ...rest })` 调用
 * 无需显式传入 symbol，也不需要 wrapper hook — 保住完整类型推导。
 *
 * 只替换字面量 `{symbol}`；其他 ICU 占位符（`{count}`, plural 等）照常交给 next-intl。
 */
function interpolateSymbol<T>(value: T): T {
  if (typeof value === "string") {
    return value.replaceAll("{symbol}", PLATFORM_TOKEN_DISPLAY) as T;
  }
  if (Array.isArray(value)) {
    return value.map(interpolateSymbol) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolateSymbol(v)])
    ) as T;
  }
  return value;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // 确保 locale 合法，否则回退到默认语言
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const rawMessages = (await import(`../messages/${locale}.json`)).default;

  // Landing / Invest(认购) 仅维护 zh + en 两份文案。其他语种回退到 en，避免缺 key 报错或显示中文。
  let messages = rawMessages;
  if (locale !== "zh" && locale !== "en") {
    const enMessages = (await import(`../messages/en.json`)).default;
    messages = { ...rawMessages, landing: enMessages.landing, invest: enMessages.invest };
  }

  return {
    locale,
    messages: interpolateSymbol(messages),
  };
});
