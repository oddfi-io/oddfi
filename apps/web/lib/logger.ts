/**
 * 轻量日志工具 — 区分 dev/prod 输出。
 *
 * - `logger.debug(...)` 仅 dev 环境打印（开发链路追踪、状态机分支日志等）。
 * - `logger.info / warn / error` 始终打印，保留生产排错能力。
 *
 * 替代裸 `console.info("[xxx] ...")`，避免线上 Console 被调试日志淹没。
 */

const isDev = process.env.NODE_ENV !== "production";

type LogArgs = Parameters<typeof console.log>;

export const logger = {
  debug: (...args: LogArgs) => {
    if (isDev) console.info(...args);
  },
  info: (...args: LogArgs) => console.info(...args),
  warn: (...args: LogArgs) => console.warn(...args),
  error: (...args: LogArgs) => console.error(...args),
};
