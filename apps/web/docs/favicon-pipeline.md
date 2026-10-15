# Favicon 工程化最佳实践

> 唯一目标：**给 OddFi 一个像 Vercel / Claude / Linear 那样在现代浏览器 tab 里清晰锐利的 favicon**，并且设计师换 logo 时**一行命令重跑整个资源链**，不用手动改 5 个文件。

---

## 1. 一句话原理

让 favicon 在 Retina 屏 tab 上锐利，**不是因为某个特殊 PNG 尺寸或某种黑魔法**，而是三件事叠加：

| 关键点                           | 作用                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **SVG-first**                    | metadata 显式声明 `image/svg+xml`，Chrome / Safari / Firefox 优先用矢量直接 raster 到设备物理像素（Retina = 64×64 物理像素，3x 屏 = 96×96） |
| **大 viewBox SVG 源**            | `viewBox="0 0 512 512"` 的浮点路径精度 ≫ `viewBox="0 0 32 32"` 同形状路径，给浏览器 tessellation 充足精度                                   |
| **多尺寸 ICO + Lanczos3 降采样** | 老浏览器 / Windows 任务栏 / 1x 屏兜底，每档（16/32/48）从超高分辨率源**独立**降采样，而非彼此缩放                                           |

---

## 2. 资源架构

```
设计师 Figma 导出（512×512 viewBox SVG）
            │
public/images/favicon-source.svg  ← 唯一可信源（Single Source of Truth）
            │
       pnpm gen:favicons
            │
            ▼
   ┌────────┬───────────────┬──────────────────┬────────────┐
   │        │               │                  │            │
app/icon.svg  app/favicon.ico  app/apple-icon.png  public/icons/icon-192.png
(矢量直拷)  (16+32+48 多尺寸)  (180×180 iOS)      icon-512.png  (PWA manifest)
                                  │
                          public/apple-touch-icon.png
                          (兼容 metadata 引用)
```

---

## 3. 设计师交付要求

设计师每次给新 logo SVG 时，必须满足以下条件，否则脚本生成的 favicon 锐利度会打折：

| 检查项     | 要求                                                     |
| ---------- | -------------------------------------------------------- |
| viewBox    | `0 0 512 512`（必须正方形，必须 512）                    |
| 圆角矩形底 | 推荐 `<rect width="512" height="512" rx="128">`，rx 整数 |
| 主体居中   | logo 占 viewBox 中央 ~70-80%，留出安全边距，避免裁剪     |
| 颜色       | 直接 hex 或 `display-p3` 广色域；浏览器都能正确处理      |
| 文件大小   | < 5 KB（OddFi 当前 1.6 KB）                              |

---

## 4. 唯一更新流程（设计师给新 SVG 时）

```bash
# 1. 把设计师给的 SVG 覆盖到唯一可信源（文件名固定，不要改）
cp ~/Downloads/new-favicon.svg public/images/favicon-source.svg

# 2. 一行命令重新生成 6 个产物
pnpm gen:favicons

# 3. 启动 dev server 验证
pnpm dev

# 4. 重要：Chrome favicon 缓存极黏，必须在 无痕窗口 打开 localhost
#    或访问 chrome://favicon-internals 清缓存

# 5. 满意后 commit
git add public/images/favicon-source.svg app/icon.svg app/favicon.ico \
        app/apple-icon.png public/apple-touch-icon.png \
        public/icons/icon-192.png public/icons/icon-512.png
git commit -m "chore(favicon): 更新 favicon 至 vN"
```

---

## 5. 自动生成的产物清单

`pnpm gen:favicons` 一次重生成以下 6 个文件，禁止手工编辑：

| 路径                          | 尺寸           | 用途                                            |
| ----------------------------- | -------------- | ----------------------------------------------- |
| `app/icon.svg`                | 512×512 vector | Chrome / Safari / Firefox tab favicon（主路径） |
| `app/favicon.ico`             | 16+32+48 多档  | 老浏览器 / Windows 任务栏 / 1x 屏兜底           |
| `app/apple-icon.png`          | 180×180        | iOS Safari 主屏图标（Next.js 文件约定）         |
| `public/apple-touch-icon.png` | 180×180        | 兼容 metadata.icons.apple 引用                  |
| `public/icons/icon-192.png`   | 192×192        | PWA manifest                                    |
| `public/icons/icon-512.png`   | 512×512        | PWA manifest                                    |

---

## 6. metadata.icons 配置（一次性，已写好）

`app/[locale]/layout.tsx` 中：

```ts
icons: {
  icon: [
    { url: "/icon.svg", type: "image/svg+xml" },           // ← 第一项必须是 SVG
    { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
    { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: "/apple-touch-icon.png",
},
```

**关键**：`/icon.svg` 必须**第一个**列出，让现代浏览器优先选择 SVG 走矢量路径。如果只列 `.ico` / `.png`，Chrome 会按尺寸挑位图，失去 Retina 优势。

---

## 7. 工程化脚本（`scripts/generate-favicons.mjs`）

依赖：

```bash
pnpm add -D sharp png-to-ico   # 已装，不要重复装
```

完整源码（项目内同步维护，此处仅作参考）：

```js
#!/usr/bin/env node
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const SOURCE = resolve(ROOT, "public/images/favicon-source.svg");
const svgBuffer = readFileSync(SOURCE);

// 高分辨率 raster：固定 density=1024 让 librsvg 内部以 ~7280px 渲染 SVG，
// 再用 lanczos3 高质量降采样到目标尺寸。比直接 raster 到目标尺寸锐利得多。
async function rasterize(size) {
  return sharp(svgBuffer, { density: 1024 })
    .resize(size, size, { kernel: "lanczos3", fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function main() {
  copyFileSync(SOURCE, resolve(ROOT, "app/icon.svg"));
  const [b16, b32, b48] = await Promise.all([rasterize(16), rasterize(32), rasterize(48)]);
  writeFileSync(resolve(ROOT, "app/favicon.ico"), await pngToIco([b16, b32, b48]));
  const apple = await rasterize(180);
  writeFileSync(resolve(ROOT, "app/apple-icon.png"), apple);
  writeFileSync(resolve(ROOT, "public/apple-touch-icon.png"), apple);
  const [pwa192, pwa512] = await Promise.all([rasterize(192), rasterize(512)]);
  mkdirSync(resolve(ROOT, "public/icons"), { recursive: true });
  writeFileSync(resolve(ROOT, "public/icons/icon-192.png"), pwa192);
  writeFileSync(resolve(ROOT, "public/icons/icon-512.png"), pwa512);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

`package.json` 中：

```json
"scripts": {
  "gen:favicons": "node scripts/generate-favicons.mjs"
}
```

### 为什么 `density: 1024`

- librsvg raster SVG 时，density 越高内部画布越大，曲线 tessellation 精度越高
- 1024 让 512×512 viewBox 的 SVG raster 成约 7280×7280 中间画布
- 再用 Lanczos3 降采样到 16/32/48/180/192/512 各档，比 sharp 默认 72 density 锐利肉眼可见
- **不能更高**：超过 ~2000 density 会触发 sharp `Input image exceeds pixel limit`（默认 268MP 限制）

---

## 8. 验证方法

### 浏览器视觉验证（人肉 + 必做）

1. `pnpm dev` 启动
2. **Chrome 无痕窗口**打开 `http://localhost:3000`（必须无痕，避免 favicon 缓存）
3. tab 上看 favicon 边缘是否锐利
4. 对比参照：Vercel.com / Claude.ai / Linear.app 的 tab favicon

### 服务端字节验证（可自动化）

```bash
# SVG 主路径下发
curl -sI http://localhost:3000/icon.svg | grep content-type
# 期望：content-type: image/svg+xml

# .ico 多尺寸位图
curl -s http://localhost:3000/favicon.ico | wc -c
# 期望：~ 15000 bytes（16+32+48 三档位图）

# HTML link 标签 inject 是否包含 SVG 项
curl -s http://localhost:3000/en | grep -oE '<link[^>]*svg\+xml[^>]*>'
# 期望：<link rel="icon" href="/icon.svg" type="image/svg+xml"/>
```

---

## 9. 反模式（高频踩坑）

| 反模式                                      | 为什么错                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| 用 `viewBox="0 0 32 32"` 的 SVG 当 favicon  | 浮点锚点空间太小，浏览器在 Retina 上 raster 时仍亚像素 → 糊                           |
| 把大 logo SVG 等比缩到 32 viewBox           | 同上，缩放过程的浮点路径精度损失被保留下来                                            |
| metadata.icons 不显式声明 SVG 项            | Chrome 会回退选 `.ico`，失去矢量路径的 Retina 优势                                    |
| `.ico` 只内嵌一个尺寸，让浏览器自己缩       | 浏览器缩放算法不如 Lanczos3，且不同浏览器一致性差                                     |
| sharp `density: size * 4`（动态 density）   | 大尺寸目标会爆 pixel limit，应该用固定 density=1024                                   |
| 直接编辑 `app/icon.svg` / `app/favicon.ico` | 这些是脚本产物，下次 `gen:favicons` 会覆盖。改源 → `public/images/favicon-source.svg` |
| 验证时不开无痕窗口                          | Chrome favicon 缓存极黏，可能看到几个月前的版本                                       |

---

## 10. 与设计师 / PM 的协作约定

- 设计师给新 logo 时，**只需要给一份 512×512 viewBox 的 SVG**，不需要再单独给 PNG / ICO
- 文件名约定：`{topic}-favicon-512.svg`（仅作交付时命名，落库时统一改为 `public/images/favicon-source.svg`）
- 重大版本（V1 → V2）需要 commit 一次新 favicon-source.svg，git 历史可回溯每个版本
- iOS / Android / PWA / Windows 任务栏所有图标**全部从同一份源生成**，永远保持一致

---

## 参考

- [Web.dev — Favicon best practices](https://web.dev/articles/favicon)
- [Next.js Metadata Files API](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
- [sharp — high-performance image processing](https://sharp.pixelplumbing.com/)
- [librsvg density 与 raster 精度关系](https://gitlab.gnome.org/GNOME/librsvg)
