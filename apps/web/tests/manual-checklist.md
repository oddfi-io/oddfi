# 人工测试清单

> 自动化测试（`pnpm test` / `pnpm build` / `bash tests/scripts/smoke-test.sh`）不在此列。
> 本文件只收录**必须人工验证**的用例，按场景组织。

---

## 1. 钱包连接

> 触发：Web3 依赖升级 / RainbowKit 配置变更 / 生产部署前

### 桌面

```
□ MetaMask 扩展连接 → 授权弹窗 → 地址显示正确
□ MetaMask 断开连接 → UI 恢复未连接状态
□ 刷新页面 → 自动重连
□ WalletConnect → QR 码正常弹出
□ OKX / Coinbase / Binance Wallet → 连接流程正常
□ 连接非 BSC 网络 → WrongNetworkBanner 出现
□ Banner 内点击切换 → 网络切换成功 → Banner 消失
```

### 移动端（真机）

```
□ 手机浏览器 → RainbowKit Modal 弹出（底部 Sheet 样式）
□ 选择 MetaMask → 跳转到 MetaMask App（深链接）
□ MetaMask 内置浏览器打开 H5 → 自动识别 injected provider
```

---

## 2. 交互体验

> 触发：React 升级 / UI 组件库升级 / 大范围重构

### 弹窗

```
□ Modal 打开/关闭动画流畅，无闪烁残影
□ 点击遮罩层关闭
□ ESC 键关闭
□ Modal 打开时页面不可滚动
```

### 下拉菜单

```
□ 语言切换器 — 打开/选择/关闭
□ 用户头像菜单 — 打开/关闭，点击外部关闭
□ Radix Select — 打开/选择/关闭
```

### 表单输入

```
□ 金额输入 — 数字、小数点、删除正常
□ 金额输入 — 粘贴数字正常
□ 搜索框 — 输入/清除/实时过滤
□ 中文输入法 — 组合输入不触发中间态提交
```

### 页面切换

```
□ 路由切换无白屏闪烁
□ 数据加载时显示 Skeleton
□ 浏览器前进/后退正常
```

---

## 3. 响应式布局

> 触发：布局组件改动 / 新页面上线

```
□ 桌面 (>1024px) — 双栏布局正常
□ 平板 (768-1024px) — 布局适配
□ 手机 (<768px) — 单栏 + 底部 TabBar
□ 手机底部安全区 — 内容不被遮挡
□ 可点击元素 ≥ 44px 触控热区
```

---

## 4. 国际化

> 触发：i18n 配置变更 / middleware 改动 / Next.js 升级

```
□ 切换语言 → URL locale 前缀变更 + 页面文案完整切换
□ 刷新页面 → locale 保持
□ 手动改 URL locale → 页面语言跟随
□ 书签直接打开深层页面 → 正常渲染
```

---

## 5. Sentry 监控

> 触发：Sentry 配置变更 / 框架升级

```
□ Console 无 Sentry init 错误
□ 手动触发错误 → Sentry Dashboard 收到 event
□ 路由切换 → Sentry Performance 出现 navigation transaction
□ 钱包注入错误 / ResizeObserver → 不上报（过滤生效）
```
