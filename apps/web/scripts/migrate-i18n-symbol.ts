/**
 * ENH-012: 把平台币单位 i18n 文案中的 "ODD" 替换为 "{symbol}"。
 *
 * 决策规则（迁移 / CI 守门共享）：
 * 1. Key 路径任一层级含 "odd"（大小写不敏感） → 品牌命名空间（oddPresale / oddPrice /
 *    oddWallet / oddRelease / stakeOdd / colOddBoost / colIndirectBonusOdd / tagOddBoost 等）→ 跳过
 * 2. PRODUCT_KEYS 列表中的最后一段 key → 值是产品/促销名 → 跳过
 *    - bannerItem1/3 · firstDepositTitle · firstDepositNote（"ODD Bonus/奖励/報酬/ödülleri"）
 *    - depositVaultTitle · redeemVaultTitle（"ODD Vault"）
 *    - staking.cardTitle（"ODD Staking"）
 * 3. 其余 string value 中的 \bODD\b → {symbol}
 *
 * Usage:
 *   pnpm migrate:i18n-symbol             应用
 *   pnpm migrate:i18n-symbol --dry-run   预览
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const MESSAGES_DIR = path.join(ROOT, "messages");

/** 最后一段 key 落在此集合 → 值当作产品名保留 */
const PRODUCT_KEYS = new Set([
  "bannerItem1",
  "bannerItem3",
  "firstDepositTitle",
  "firstDepositNote",
  "depositVaultTitle",
  "redeemVaultTitle",
  "cardTitle", // staking.cardTitle = "ODD Staking"
]);

const DRY_RUN = process.argv.includes("--dry-run");

interface Change {
  file: string;
  keyPath: string;
  before: string;
  after: string;
}

const changes: Change[] = [];

function shouldSkip(keyPath: string[]): boolean {
  for (const k of keyPath) {
    if (/odd/i.test(k)) return true;
  }
  const last = keyPath[keyPath.length - 1];
  if (PRODUCT_KEYS.has(last)) return true;
  return false;
}

function transformString(s: string): string {
  return s.replace(/\bODD\b/g, "{symbol}");
}

function walk(node: unknown, keyPath: string[], file: string): unknown {
  if (typeof node === "string") {
    if (shouldSkip(keyPath)) return node;
    const after = transformString(node);
    if (after !== node) {
      changes.push({ file, keyPath: keyPath.join("."), before: node, after });
    }
    return after;
  }
  if (Array.isArray(node)) {
    return node.map((v, i) => walk(v, [...keyPath, String(i)], file));
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = walk(v, [...keyPath, k], file);
    }
    return out;
  }
  return node;
}

for (const entry of fs.readdirSync(MESSAGES_DIR)) {
  if (!entry.endsWith(".json")) continue;
  const file = path.join(MESSAGES_DIR, entry);
  const raw = fs.readFileSync(file, "utf-8");
  const json = JSON.parse(raw);
  const transformed = walk(json, [], entry);
  if (!DRY_RUN) {
    const hadTrailingNl = raw.endsWith("\n");
    fs.writeFileSync(
      file,
      JSON.stringify(transformed, null, 2) + (hadTrailingNl ? "\n" : ""),
      "utf-8"
    );
  }
}

const byFile = new Map<string, Change[]>();
for (const c of changes) {
  if (!byFile.has(c.file)) byFile.set(c.file, []);
  byFile.get(c.file)!.push(c);
}
console.log(
  `${DRY_RUN ? "[DRY RUN]" : "[APPLIED]"} ${changes.length} changes across ${byFile.size} files\n`
);
for (const [f, cs] of byFile) {
  console.log(`─── ${f} (${cs.length}) ───`);
  for (const c of cs) {
    console.log(`  ${c.keyPath}`);
    console.log(`    - ${c.before}`);
    console.log(`    + ${c.after}`);
  }
}
