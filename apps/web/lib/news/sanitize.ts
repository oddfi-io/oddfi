/**
 * DD-110 §3.3 sanitize.ts (v2 修订 B:C3)
 *
 * 后端 bluemonday 已清洗；前端二次校验（防上游回归 + 防 HTML entity 注入）。
 *
 * 仅允许 `<b class="delta-up">…</b>` 与 `<b class="delta-down">…</b>`；
 * 文本部分必须不含 `<`、`>`、`&` —— 封死 `&lt;script&gt;` 经 dangerouslySetInnerHTML 解码路径。
 *
 * 决策记录（B:C3）：
 *   方案 (a) 引 isomorphic-dompurify (+2KB gzip · 标准库) vs (b) 收紧正则禁 &。
 *   选 (b) 因为 (i) 后端 bluemonday 已是真正的 sanitizer，前端只是二道线；
 *   (ii) 业务字段语义就是 "±N%" 简单文本，禁 & 不损功能；
 *   (iii) DOMPurify 在 SSR Node 环境要 jsdom shim，引入心智负担。
 */

const MAX_LEN = 2000;
const ALLOWED = /^(<b class="delta-(up|down)">[^<>&]*<\/b>|[^<>&]*)+$/;

/**
 * 校验 HTML 是否符合 allow-list；不合规 → 全剥 HTML + entity 兜底。
 * 返回字符串可直接用于 dangerouslySetInnerHTML。
 */
export function sanitizeDeltaHtml(html: string): string {
  if (typeof html !== "string" || html.length === 0) return "";
  if (html.length > MAX_LEN) return "";
  if (ALLOWED.test(html)) return html;
  return html.replace(/<[^>]+>/g, "").replace(/&[a-zA-Z#0-9]+;/g, "");
}
