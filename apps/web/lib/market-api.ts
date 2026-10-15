/**
 * market-api（赛事 / 赔率后端）base URL 的唯一来源。
 *
 * 单一来源：所有需要直连 market-api 绝对地址的 server 侧调用方
 * （app/api/v1 代理路由、SSR 页面 generateMetadata、AI match-context）
 * 一律从这里 import，禁止再各自硬编码 `process.env.MARKET_API_URL ?? "..."`。
 * 改端口 / 域名只动这一处；线上真正生效值仍是 env（Vercel 生产变量
 * `MARKET_API_URL` / 本地 `.env.local`）。
 *
 * fallback 仅为本地未配 env 时的开发兜底，指向正式服；生产与本地都已显式
 * 配置 `MARKET_API_URL`，正常命中不到，不要把它当作「改了就改了线上」。
 *
 * 注意：仅供 server 侧使用（`MARKET_API_URL` 无 NEXT_PUBLIC 前缀，client 端取不到）。
 */
export const MARKET_API_BASE = process.env.MARKET_API_URL ?? "https://market-api.oddfi.io";
