#!/usr/bin/env node
// ENH-011 资产清单生成器
//
// 第一性原理（分层职责）：
//   - 业务分类区（人工维护，§1–§N）：发现 + 判断 — 按业务场景分组 + file-level 说明
//   - AUTO-GENERATED 块（脚本维护）：兜底索引 — 完整路径 + export 列表，不含说明
//
// 两层定位不同，不应同步。AUTO 块的职责是"新 export 不遗漏"，不是"每个 export 都有注释"。

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUT = join(ROOT, "docs/ASSETS.md");

const SCAN = [
  { label: "hooks", dir: "hooks" },
  { label: "components/ui", dir: "components/ui" },
  { label: "components/icons", dir: "components/icons" },
  { label: "lib", dir: "lib" },
  { label: "stores", dir: "stores" },
];

const EXCLUDE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".d.ts"];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !EXCLUDE_SUFFIXES.some((suf) => name.endsWith(suf))) {
      out.push(full);
    }
  }
  return out;
}

// 抽取文件里的 export 名。覆盖常见模式：
//   export const X / export function X / export class X / export type X / export interface X
//   export default function X / export default class X
//   export { A, B as C } / export * from
// 被 export default 的匿名对象（如 Zustand create()）用文件名作为符号名。
function extractExports(file) {
  const src = readFileSync(file, "utf8");
  const names = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+class\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /export\s+type\s+([A-Za-z_$][\w$]*)/g,
    /export\s+interface\s+([A-Za-z_$][\w$]*)/g,
    /export\s+enum\s+([A-Za-z_$][\w$]*)/g,
    /export\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+default\s+class\s+([A-Za-z_$][\w$]*)/g,
  ];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) names.add(m[1]);
  }
  // export { A, B as C }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(",")) {
      const token = part.trim().split(/\s+as\s+/i).pop();
      if (token && /^[A-Za-z_$][\w$]*$/.test(token)) names.add(token);
    }
  }
  // 匿名 export default → 用文件名
  if (/export\s+default\s+/.test(src) && names.size === 0) {
    const base = file.split("/").pop().replace(/\.(ts|tsx)$/, "");
    names.add(base);
  }
  return [...names].filter((n) => n !== "default");
}

const BEGIN_AUTO = "<!-- AUTO-GENERATED:BEGIN -->";
const END_AUTO = "<!-- AUTO-GENERATED:END -->";

function renderAutoBlockBody(entries) {
  // AUTO 块 = 纯机器索引：path → export 列表
  // 不含人工注释；说明请写在业务分类区。
  const body = [];
  for (const section of SCAN) {
    const items = entries.filter((e) => e.section === section.label);
    if (items.length === 0) continue;
    body.push(`## ${section.label}`, "");
    const byFile = new Map();
    for (const it of items) {
      if (!byFile.has(it.path)) byFile.set(it.path, []);
      byFile.get(it.path).push(it.name);
    }
    const sortedFiles = [...byFile.keys()].sort();
    for (const file of sortedFiles) {
      const names = byFile.get(file).sort();
      body.push(`- ${names.join(" / ")} — ${file}`);
    }
    body.push("");
  }
  return body.join("\n");
}

function renderFullFile(entries) {
  // 首次生成（OUT 不存在时用）：给一个最小壳，人类再往外层写业务分类
  const header = [
    "# ASSETS — 资产清单（ENH-011 唯一数据源）",
    "",
    "> 本文件为 Agent / 人类新建 hook / 组件 / 工具 / 关键基建前的**强制查询表**。",
    "> `PreToolUse(Write)` hook 会校验 Agent 在新建前是否 Read 过此文件。",
    "",
    "**结构分层**：",
    "1. 业务分类区（手写）— 按场景分组 + file-level 说明，**复用判断的主入口**",
    "2. AUTO-GENERATED 块（脚本）— 完整路径 + export 列表，**新 export 不遗漏的兜底索引**",
    "",
    "**生成方式**：`pnpm gen-assets`（只替换 AUTO 块，业务分类区保留）。",
    "",
    BEGIN_AUTO,
    "",
  ];
  const footer = ["", END_AUTO, ""];
  return [...header, renderAutoBlockBody(entries), ...footer].join("\n");
}

function collect() {
  const entries = [];
  for (const { label, dir } of SCAN) {
    const absDir = join(ROOT, dir);
    for (const file of walk(absDir)) {
      const rel = relative(ROOT, file);
      const names = extractExports(file);
      for (const name of names) entries.push({ section: label, path: rel, name });
    }
  }
  return entries;
}

function extractAutoBlock(raw) {
  if (!raw.includes(BEGIN_AUTO) || !raw.includes(END_AUTO)) return null;
  const beginIdx = raw.indexOf(BEGIN_AUTO) + BEGIN_AUTO.length;
  const endIdx = raw.indexOf(END_AUTO);
  return raw.slice(beginIdx, endIdx).trim();
}

function run() {
  const check = process.argv.includes("--check");
  const entries = collect();
  const existingRaw = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";

  if (check) {
    // 检测 AUTO 块是否过期，过期则 exit 1 阻塞 commit
    // 紧急绕过：SKIP_ASSETS_CHECK=1 git commit ...
    const currentBlock = extractAutoBlock(existingRaw);
    const expectedBlock = renderAutoBlockBody(entries).trim();
    if (currentBlock !== expectedBlock) {
      console.error(
        "[gen-assets] ❌ docs/ASSETS.md 的 AUTO 块已过期\n" +
          "  请跑 `pnpm gen-assets` 并把 docs/ASSETS.md 一起 commit\n" +
          "  紧急绕过: SKIP_ASSETS_CHECK=1 git commit ..."
      );
      process.exit(1);
    }
    process.exit(0);
  }

  let next;
  const hasAutoBlock =
    existingRaw.includes(BEGIN_AUTO) && existingRaw.includes(END_AUTO);
  if (hasAutoBlock) {
    const beginIdx = existingRaw.indexOf(BEGIN_AUTO);
    const endIdx = existingRaw.indexOf(END_AUTO) + END_AUTO.length;
    const before = existingRaw.slice(0, beginIdx);
    const after = existingRaw.slice(endIdx);
    const inner = renderAutoBlockBody(entries);
    next = `${before}${BEGIN_AUTO}\n\n${inner}\n${END_AUTO}${after}`;
  } else {
    next = renderFullFile(entries);
  }

  writeFileSync(OUT, next);
  console.log(`[gen-assets] Wrote ${OUT} — ${entries.length} exports`);
}

run();
