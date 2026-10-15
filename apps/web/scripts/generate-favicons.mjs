#!/usr/bin/env node
// Favicon 多尺寸生成器
//
// 输入：public/images/favicon-source.svg（512×512 viewBox，设计师维护）
// 输出：
//   app/icon.svg              — Chrome/Safari/Firefox 主 favicon（SVG vector，Retina 自动锐利）
//   app/favicon.ico           — 16/32/48 多尺寸位图（1x 屏 / Windows / 老浏览器兜底）
//   app/apple-icon.png        — 180×180（Next.js 文件约定，iOS 主屏图标）
//   public/apple-touch-icon.png — 180×180（兼容 metadata.icons.apple 引用）
//   public/icons/icon-192.png — 192×192（PWA manifest）
//   public/icons/icon-512.png — 512×512（PWA manifest）
//
// 使用：pnpm gen:favicons

import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const SOURCE = resolve(ROOT, "public/images/favicon-source.svg");

const svgBuffer = readFileSync(SOURCE);

// 高分辨率 raster：固定 density=1024 让 librsvg 内部以 ~7280px 渲染 SVG，
// 再用 lanczos3 高质量降采样到目标尺寸。比直接 raster 到目标尺寸锐利得多。
// 1024 density 下中间画布约 53MP，远低于 sharp 默认 268MP 限制。
async function rasterize(size) {
  return sharp(svgBuffer, { density: 1024 })
    .resize(size, size, { kernel: "lanczos3", fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

async function main() {
  const tasks = [];

  // 1. app/icon.svg ← 直接拷贝矢量源
  const iconSvgPath = resolve(ROOT, "app/icon.svg");
  copyFileSync(SOURCE, iconSvgPath);
  console.log("✓ app/icon.svg (vector copy)");

  // 2. app/favicon.ico ← 16/32/48 多尺寸位图
  const [b16, b32, b48] = await Promise.all([rasterize(16), rasterize(32), rasterize(48)]);
  const icoBuffer = await pngToIco([b16, b32, b48]);
  const icoPath = resolve(ROOT, "app/favicon.ico");
  writeFileSync(icoPath, icoBuffer);
  console.log(`✓ app/favicon.ico (16+32+48, ${icoBuffer.length} bytes)`);

  // 3. app/apple-icon.png + public/apple-touch-icon.png ← 180×180
  const apple = await rasterize(180);
  const appleNextPath = resolve(ROOT, "app/apple-icon.png");
  const appleLegacyPath = resolve(ROOT, "public/apple-touch-icon.png");
  writeFileSync(appleNextPath, apple);
  writeFileSync(appleLegacyPath, apple);
  console.log("✓ app/apple-icon.png + public/apple-touch-icon.png (180×180)");

  // 4. public/icons/icon-192.png + icon-512.png ← PWA manifest
  const [pwa192, pwa512] = await Promise.all([rasterize(192), rasterize(512)]);
  const pwa192Path = resolve(ROOT, "public/icons/icon-192.png");
  const pwa512Path = resolve(ROOT, "public/icons/icon-512.png");
  ensureDir(pwa192Path);
  writeFileSync(pwa192Path, pwa192);
  writeFileSync(pwa512Path, pwa512);
  console.log("✓ public/icons/icon-192.png + icon-512.png");

  console.log("\n所有 favicon 资源已重新生成。");
  console.log("提示：Chrome favicon 缓存非常黏，验证时请新开无痕窗口或硬刷。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
