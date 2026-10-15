/**
 * Figma Design Token Sync Script
 *
 * Reads Figma-exported JSON token files and generates:
 * 1. app/design-tokens.css  — CSS custom properties (:root for Dark, [data-theme="light"] for Light)
 * 2. lib/design-tokens.ts   — TypeScript constants for programmatic access (chart libs, inline styles)
 *
 * Sources:
 *   tokens/figma/Dark.tokens.json + Light.tokens.json — semantic tokens (mode-aware)
 *   tokens/figma/Primitive.tokens.json (optional)     — base palette (mode-invariant, e.g. yellow-brand-400)
 *
 * Usage: npx tsx scripts/sync-tokens.ts
 */

import * as fs from "fs";
import * as path from "path";

// ─── Config ────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const FIGMA_DIR = path.join(ROOT, "tokens/figma");
const CSS_OUTPUT = path.join(ROOT, "app/design-tokens.css");
const TS_OUTPUT = path.join(ROOT, "lib/design-tokens.ts");

// Mapping: Figma JSON path → CSS variable name
// Figma uses nested keys like text.primary, fill.fill.input, fill.button.primary-btn-default
// We flatten to: --text-primary, --fill-input, --btn-primary-default, etc.
const CATEGORY_PREFIX_MAP: Record<string, string> = {
  text: "text",
  bg: "bg",
  "fill/fill": "fill",
  "fill/button": "btn",
  "fill/tag": "tag",
  line: "line",
  function: "fn",
};

// Known typos in Figma variable names — auto-corrected during generation
const KNOWN_TYPO_FIXES: Record<string, string> = {
  "secondary-btn-pres": "secondary-btn-press",
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface FigmaColorValue {
  colorSpace: string;
  components: number[];
  alpha: number;
  hex: string;
}

interface FigmaToken {
  $type: string;
  $value: FigmaColorValue;
  $extensions?: Record<string, unknown>;
}

type FigmaTokenGroup = Record<
  string,
  FigmaToken | Record<string, FigmaToken | Record<string, FigmaToken>>
>;

interface TokenEntry {
  cssVar: string;
  cssValue: string;
  tsKey: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function figmaColorToCss(value: FigmaColorValue): string {
  const { hex, alpha } = value;

  if (alpha < 1) {
    // Convert hex to rgb components for rgba
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Round alpha to 2 decimal places
    const a = Math.round(alpha * 100) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return hex;
}

function kebabCase(str: string): string {
  return str
    .replace(/[&]/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function camelCase(str: string): string {
  return kebabCase(str)
    .split("-")
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

// ─── Token Extraction ──────────────────────────────────────────────────────

/**
 * Extract Primitive palette tokens (Yellow/Orange/Brand/...) — mode-invariant.
 * 顶层 key 是颜色族名（"Yellow" / "Brand 2"），子 key 是 "brand-50".."brand-900" 阶。
 * 输出 CSS 变量名格式：--{group-kebab}-{subkey} 例如 --yellow-brand-400。
 */
function extractPrimitive(data: FigmaTokenGroup): TokenEntry[] {
  const entries: TokenEntry[] = [];

  for (const [group, subgroup] of Object.entries(data)) {
    if (group.startsWith("$")) continue;
    if (typeof subgroup !== "object" || subgroup === null) continue;

    const groupPrefix = kebabCase(group);
    const palette = subgroup as Record<string, FigmaToken | unknown>;

    for (const [step, token] of Object.entries(palette)) {
      if (typeof token !== "object" || token === null) continue;
      if (!("$type" in token)) continue;
      const t = token as FigmaToken;
      if (t.$type !== "color" || !t.$value?.hex) continue;

      const cssVar = `--${groupPrefix}-${kebabCase(step)}`;
      entries.push({
        cssVar,
        cssValue: figmaColorToCss(t.$value),
        tsKey: camelCase(`${groupPrefix}-${step}`),
      });
    }
  }

  return entries;
}

function extractTokens(data: FigmaTokenGroup): TokenEntry[] {
  const entries: TokenEntry[] = [];

  for (const [category, group] of Object.entries(data)) {
    // Skip Figma metadata fields
    if (category.startsWith("$")) continue;

    if (typeof group !== "object" || group === null) continue;

    // Determine the prefix for this category
    const categoryGroup = group as Record<string, FigmaToken | Record<string, FigmaToken>>;

    for (const [subKey, subValue] of Object.entries(categoryGroup)) {
      // Skip non-object values (metadata strings, etc.)
      if (typeof subValue !== "object" || subValue === null) continue;

      if ("$type" in subValue) {
        // Direct token under category (e.g., text.primary, bg.primary, line.divider-primary)
        const token = subValue as FigmaToken;
        const prefix = CATEGORY_PREFIX_MAP[category] || kebabCase(category);
        const cssVar = `--${prefix}-${kebabCase(subKey)}`;
        entries.push({
          cssVar,
          cssValue: figmaColorToCss(token.$value),
          tsKey: camelCase(`${prefix}-${subKey}`),
        });
      } else {
        // Nested group (e.g., fill.fill.*, fill.button.*, fill.tag.*)
        const nestedGroup = subValue as Record<string, FigmaToken>;
        const fullPath = `${category}/${subKey}`;
        const prefix = CATEGORY_PREFIX_MAP[fullPath] || kebabCase(`${category}-${subKey}`);

        for (const [tokenKey, token] of Object.entries(nestedGroup)) {
          if (!("$type" in token)) continue;
          const rawName = kebabCase(tokenKey);
          const fixedName = KNOWN_TYPO_FIXES[rawName] || rawName;
          const cssVar = `--${prefix}-${fixedName}`;
          entries.push({
            cssVar,
            cssValue: figmaColorToCss(token.$value),
            tsKey: camelCase(`${prefix}-${fixedName}`),
          });
        }
      }
    }
  }

  return entries;
}

// ─── CSS Generation ────────────────────────────────────────────────────────

function generateCss(
  darkTokens: TokenEntry[],
  lightTokens: TokenEntry[],
  primitiveTokens: TokenEntry[]
): string {
  const header = `/**
 * Design Tokens — Auto-generated by scripts/sync-tokens.ts
 * DO NOT EDIT MANUALLY. Run: pnpm sync-tokens
 *
 * Source: tokens/figma/Dark.tokens.json + Light.tokens.json + Primitive.tokens.json
 */

`;

  // Group tokens by category for readability
  const groupByCssPrefix = (tokens: TokenEntry[]) => {
    const groups: Record<string, TokenEntry[]> = {};
    for (const t of tokens) {
      // Extract the semantic prefix: --text-xxx → "text", --btn-xxx → "btn"
      const varName = t.cssVar.replace("--", "");
      const prefix = varName.split("-")[0];
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(t);
    }
    return groups;
  };

  const darkGroups = groupByCssPrefix(darkTokens);
  const lightGroups = groupByCssPrefix(lightTokens);

  let css = header;

  // Dark theme (default)
  css += `:root {\n`;
  for (const [group, tokens] of Object.entries(darkGroups)) {
    const label = group.replace("--", "");
    css += `  /* ${label} */\n`;
    for (const t of tokens) {
      css += `  ${t.cssVar}: ${t.cssValue};\n`;
    }
    css += `\n`;
  }
  // Primitive palette (mode-invariant, e.g. --yellow-brand-400)
  if (primitiveTokens.length > 0) {
    const primitiveGroups = groupByCssPrefix(primitiveTokens);
    css += `  /* primitive palette */\n`;
    for (const [group, tokens] of Object.entries(primitiveGroups)) {
      css += `  /* ${group} */\n`;
      for (const t of tokens) {
        css += `  ${t.cssVar}: ${t.cssValue};\n`;
      }
    }
    css += `\n`;
  }
  // Theme-invariant scalars (not in palette JSON)
  css += `  /* radius */\n`;
  css += `  --radius-4: 4px;\n`;
  css += `  --radius-8: 8px;\n`;
  css += `  --radius-12: 12px;\n`;
  css += `  --radius-16: 16px;\n`;
  css += `  --radius-24: 24px;\n`;
  css += `  --radius-100: 100px;\n`;
  css += `}\n\n`;

  // Light theme
  const darkMap = new Map(darkTokens.map((t) => [t.cssVar, t.cssValue]));
  css += `[data-theme="light"] {\n`;
  for (const [group, tokens] of Object.entries(lightGroups)) {
    // Only include tokens that differ from dark
    const diffTokens = tokens.filter((t) => darkMap.get(t.cssVar) !== t.cssValue);

    if (diffTokens.length === 0) continue;

    const label = group.replace("--", "");
    css += `  /* ${label} */\n`;
    for (const t of diffTokens) {
      css += `  ${t.cssVar}: ${t.cssValue};\n`;
    }
    css += `\n`;
  }
  css += `}\n`;

  return css;
}

// ─── TypeScript Generation ─────────────────────────────────────────────────

function generateTs(tokens: TokenEntry[]): string {
  const header = `/**
 * Design Tokens — Auto-generated by scripts/sync-tokens.ts
 * DO NOT EDIT MANUALLY. Run: pnpm sync-tokens
 *
 * Usage: import { tokens } from '@/lib/design-tokens'
 * For CSS variable references (Tailwind / inline styles):
 *   tokens.textPrimary.var  → 'var(--text-primary)'
 *   tokens.textPrimary.value → '#FFFFFF' (dark mode default)
 */

`;

  let ts = header;

  ts += `export const tokens = {\n`;
  for (const t of tokens) {
    ts += `  ${t.tsKey}: { var: '${`var(${t.cssVar})`}', value: '${t.cssValue}' },\n`;
  }
  ts += `} as const;\n\n`;

  ts += `export type TokenKey = keyof typeof tokens;\n`;

  return ts;
}

// ─── Tailwind Config Helper ────────────────────────────────────────────────

function generateTailwindTokenComment(tokens: TokenEntry[]): string {
  // Group by prefix for the Tailwind config structure
  const groups: Record<string, string[]> = {};
  for (const t of tokens) {
    const parts = t.cssVar.replace("--", "").split("-");
    const prefix = parts[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(`  '${parts.slice(1).join("-") || "DEFAULT"}': 'var(${t.cssVar})',`);
  }

  let result = `\n// ─── Tailwind Config Token Reference ───\n`;
  result += `// Copy into tailwind.config.ts → theme.extend.colors\n\n`;
  for (const [prefix, lines] of Object.entries(groups)) {
    result += `// ${prefix}:\n// {\n`;
    for (const line of lines) {
      result += `// ${line}\n`;
    }
    result += `// }\n\n`;
  }
  return result;
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log("[sync-tokens] Reading Figma token files...");

  const darkPath = path.join(FIGMA_DIR, "Dark.tokens.json");
  const lightPath = path.join(FIGMA_DIR, "Light.tokens.json");
  const primitivePath = path.join(FIGMA_DIR, "Primitive.tokens.json");

  if (!fs.existsSync(darkPath) || !fs.existsSync(lightPath)) {
    console.error(
      "[sync-tokens] Missing token files in tokens/figma/. Expected Dark.tokens.json and Light.tokens.json"
    );
    process.exit(1);
  }

  const darkData = JSON.parse(fs.readFileSync(darkPath, "utf-8")) as FigmaTokenGroup;
  const lightData = JSON.parse(fs.readFileSync(lightPath, "utf-8")) as FigmaTokenGroup;

  console.log("[sync-tokens] Extracting tokens...");
  const darkTokens = extractTokens(darkData);
  const lightTokens = extractTokens(lightData);

  let primitiveTokens: TokenEntry[] = [];
  if (fs.existsSync(primitivePath)) {
    const primitiveData = JSON.parse(fs.readFileSync(primitivePath, "utf-8")) as FigmaTokenGroup;
    primitiveTokens = extractPrimitive(primitiveData);
    console.log(`[sync-tokens] Loaded Primitive palette — ${primitiveTokens.length} tokens`);
  }

  console.log(
    `[sync-tokens] Found ${darkTokens.length} dark tokens, ${lightTokens.length} light tokens, ${primitiveTokens.length} primitive tokens`
  );

  // Generate CSS
  const css = generateCss(darkTokens, lightTokens, primitiveTokens);
  fs.writeFileSync(CSS_OUTPUT, css, "utf-8");
  console.log(`[sync-tokens] Generated ${CSS_OUTPUT}`);

  // Generate TypeScript（含 primitive 调色板）
  const ts = generateTs([...darkTokens, ...primitiveTokens]);
  fs.writeFileSync(TS_OUTPUT, ts, "utf-8");
  console.log(`[sync-tokens] Generated ${TS_OUTPUT}`);

  // Print Tailwind reference
  const tailwindRef = generateTailwindTokenComment(darkTokens);
  console.log(tailwindRef);

  console.log("[sync-tokens] Done!");
}

main();
