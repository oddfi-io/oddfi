/**
 * ENH-012: CI 守门 — 校验 messages/*.json 中不应残留"裸 ODD / TODD"字面量。
 *
 * 允许规则（与 migrate-i18n-symbol.ts 对齐）：
 * - Key 路径任一层级含 "odd"（大小写不敏感） → 品牌命名空间
 * - 最后一段 key 属于 PRODUCT_KEYS → 产品/促销名
 *
 * 其余 string value 若含 \bODD\b 或 \bTODD\b → 视为未清理完毕，CI 失败。
 *
 * Usage: pnpm check:i18n-symbol
 * 退出码：0 通过；1 有残留。
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const MESSAGES_DIR = path.join(ROOT, "messages");

const PRODUCT_KEYS = new Set([
  "bannerItem1",
  "bannerItem3",
  "firstDepositTitle",
  "firstDepositNote",
  "depositVaultTitle",
  "redeemVaultTitle",
  "cardTitle",
]);

interface Violation {
  file: string;
  keyPath: string;
  value: string;
}

const violations: Violation[] = [];

function isAllowed(keyPath: string[]): boolean {
  for (const k of keyPath) {
    if (/odd/i.test(k)) return true;
  }
  const last = keyPath[keyPath.length - 1];
  if (PRODUCT_KEYS.has(last)) return true;
  return false;
}

function walk(node: unknown, keyPath: string[], file: string): void {
  if (typeof node === "string") {
    if (isAllowed(keyPath)) return;
    if (/\b(TODD|ODD)\b/.test(node)) {
      violations.push({ file, keyPath: keyPath.join("."), value: node });
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, [...keyPath, String(i)], file));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      walk(v, [...keyPath, k], file);
    }
  }
}

for (const entry of fs.readdirSync(MESSAGES_DIR)) {
  if (!entry.endsWith(".json")) continue;
  const file = path.join(MESSAGES_DIR, entry);
  const json = JSON.parse(fs.readFileSync(file, "utf-8"));
  walk(json, [], entry);
}

if (violations.length === 0) {
  console.log("✅ check-i18n-symbol: no bare ODD/TODD literals in non-whitelisted i18n keys.");
  process.exit(0);
}
console.error(`❌ check-i18n-symbol: ${violations.length} bare ODD/TODD literal(s) found:\n`);
for (const v of violations) {
  console.error(`  ${v.file}: ${v.keyPath}`);
  console.error(`    ${v.value}`);
}
process.exit(1);
