# 05 · 部署 / Nginx / CI / 联调

> 现状：`admin.oddfi.io` 已配 DNS + Let's Encrypt + Nginx，反代到 admin-backend `127.0.0.1:8081`，当前返回占位页。本期加 SPA 静态托管。
> 部署目标：EC2 `<SERVER_IP>`（oddfi-admin），静态产物到 `/var/www/oddfi-admin/`（CLAUDE.md 约定；brief 提的 `/var/www/html/admin/` 以实际 vhost 为准，落地前 SSH 确认）。

---

## 1. 构建产物

```bash
pnpm build        # tsc -b && vite build → dist/
pnpm preview      # 本地验证生产构建（5173）
```

- SPA 是纯静态（`dist/index.html` + `assets/`）。
- **base path**：根路径部署，`vite.config.ts` 不需要设 `base`（默认 `/`）。
- **SPA fallback 必需**：前端路由（`/rounds/:id` 等）刷新时 Nginx 必须回 `index.html`，否则 404。

---

## 2. Nginx vhost 改动（关键）

当前 `admin.oddfi.io` 全量反代后端。需改成：**静态优先 + 后端路径反代**。注意顺序——`/auth` `/admin` `/health` 反代后端，其余兜底 SPA。

```nginx
server {
    server_name admin.oddfi.io;
    listen 443 ssl;
    ssl_certificate     /etc/letsencrypt/live/admin.oddfi.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.oddfi.io/privkey.pem;

    root /var/www/oddfi-admin;      # ← SPA 产物目录
    index index.html;

    # 后端 API / OAuth / 健康检查 —— 反代 admin-backend（必须在 location / 之前）
    location /auth   { proxy_pass http://127.0.0.1:8081; include /etc/nginx/proxy_params; }
    location /admin  { proxy_pass http://127.0.0.1:8081; include /etc/nginx/proxy_params; }
    location /health { proxy_pass http://127.0.0.1:8081; }

    # 静态资源带缓存（hash 文件名可长缓存）
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback：其余全部回 index.html（前端路由刷新不 404）
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";   # index.html 不缓存，保证发版即时生效

        # ⚠️ 安全头：静态响应不经 admin-backend SecurityHeaders 中间件，必须在此补。
        # JWT 存 localStorage，CSP 是其关键补偿控制（限制 XSS 下 token 外传），首次部署必做、非"可后补"。
        add_header Content-Security-Policy "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
        add_header X-Frame-Options "DENY" always;            # 防 clickjacking
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
    }
}
```

> CSP 说明：AntD 运行时注入 `<style>`，`style-src` 需 `'unsafe-inline'`（或改 nonce 方案）；API 同源反代，`connect-src 'self'` 足够；BSCscan 是 `target=_blank` 跳转不走 fetch，无需放行。`frame-ancestors 'none'` 与 `X-Frame-Options DENY` 双保险。

**要点**：
- `proxy_params` 须含 `proxy_set_header Host $host; X-Real-IP; X-Forwarded-For; X-Forwarded-Proto $scheme;`（OAuth 回调 redirect_uri 依赖正确 Host）。
- **OAuth 回调落根路径**：后端 302 到 `https://admin.oddfi.io/#token=...`，命中 `location /` → 返回 `index.html` → SPA bootstrap 解析 hash（00-architecture §3）。无需为 `/auth/lark/callback` 配前端路由（fragment 模式）。
- `index.html` **不缓存**（`no-cache`），`/assets/*`（带内容 hash）长缓存——发版后用户立刻拿到新 index 引用的新 assets。
- 安全 header（X-Frame-Options 等）后端已在 API 响应加（api.md §4.2）；静态响应可在 vhost 补 `X-Frame-Options DENY`（防 clickjacking，admin 后台应禁止被 iframe）。

---

## 3. deploy.sh 模板

参考 oddfi-backend `web-api/deploy/build-prod-binary.sh` 风格（先构建、再传、原子切换）。放 `deploy/deploy.sh`：

```bash
#!/usr/bin/env bash
# 预售运营后台 SPA 部署脚本
# 用法：./deploy/deploy.sh
set -euo pipefail

HOST="ubuntu@<SERVER_IP>"          # oddfi-admin EC2
REMOTE_DIR="/var/www/oddfi-admin"
LOCAL_DIST="dist"

echo "[deploy] 1/4 类型检查 + lint + 构建"
pnpm install --frozen-lockfile
pnpm build                             # tsc -b && vite build

echo "[deploy] 2/4 上传到临时目录（不直接覆盖线上，保证原子切换）"
TMP="/tmp/oddfi-admin-$(date +%s)"
ssh "$HOST" "mkdir -p $TMP"
rsync -az --delete "$LOCAL_DIST/" "$HOST:$TMP/"

echo "[deploy] 3/4 原子切换 + 备份上一版"
ssh "$HOST" "sudo rsync -a --delete --backup --backup-dir=${REMOTE_DIR}.bak $TMP/ ${REMOTE_DIR}/ && rm -rf $TMP"

echo "[deploy] 4/4 校验"
curl -fsS -o /dev/null -w "%{http_code}\n" https://admin.oddfi.io/ || { echo "[deploy] 线上校验失败"; exit 1; }
echo "[deploy] done. 回滚：ssh $HOST 'sudo rsync -a --delete ${REMOTE_DIR}.bak/ ${REMOTE_DIR}/'"
```

> 多 GitHub 账号 / sudo 权限按现场实际调整。`--backup-dir` 保留上一版便于秒级回滚。Nginx 改 vhost 后需 `sudo nginx -t && sudo systemctl reload nginx`（首次部署一次性操作，单列 OPS 任务）。

---

## 4. 本地联调

| 项 | 配置 |
|---|---|
| Vite proxy | `vite.config.ts` 已把 `/auth` `/admin` 转 `http://127.0.0.1:8081`（本地后端）。直连线上联调改 target 为 `<SERVER_IP>:8081`（需 SSH tunnel，api-conventions）。 |
| 端口 | 固定 5173（`strictPort`），与 Lark 回调白名单 `http://localhost:5173/...` 一致——但**注意 fragment 模式回调落根路径** `/`，确保 Lark 开放平台白名单含 `http://localhost:5173`（根）。 |
| 跳过 OAuth | 本地用后端 `cmd/dev-token` 生成 JWT（api.md §6.3），手动 `localStorage.setItem('oddfi_admin_jwt', '<token>')` 调试，免走完整 Lark 流程。 |
| CORS | dev 走 proxy 同源，无 CORS；直连线上需后端 `cors.allowed_origins` 含 `http://localhost:5173`（api.md §4.1，已配）。 |

**联调前置**（跨仓库，agent-delegation.md）：
```bash
git -C ~/work/oddfi-admin-backend pull --ff-only   # 确认后端最新接口
# 读 internal/router/router.go + presale_routes.go 核对路径/RBAC（本方案已核对一次）
```

---

## 5. CI（建议，本期可后补）

仓库当前无 CI。建议 GitHub Actions 最小门禁（与 dd-flow.md「完工口径」一致）：

```yaml
# .github/workflows/ci.yml
name: ci
on: { pull_request: {}, push: { branches: [main] } }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec tsc -b --noEmit   # 类型检查
      - run: pnpm lint
      - run: pnpm build
      # - run: pnpm test                 # vitest 上线后启用（见 06 §测试缺口）
```

- **完工口径（当前 baseline）**：`tsc -b` + `pnpm lint` + `pnpm build` 全绿（dd-flow.md）。
- UI 类变更必须 `pnpm dev` 浏览器走 golden path + 边缘 case，console 无 warning/error。
