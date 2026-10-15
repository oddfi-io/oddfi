# 前端部署 Runbook · oddfi-admin-frontend

> 把 `main` 上的前端构建产物部署到生产 `admin.oddfi.io`。
> 本 runbook 基于 2026-05-27 首次真机部署固化,命令均为实跑验证过的。
> 部署方式:**静态产物 rsync 到 EC2**(不上 Vercel、不用 git-deploy)。

---

> **相关运营手册**:
> - [`admin-users-manual.md`](./admin-users-manual.md) — 给同事开权限 / 改角色 / 收回权限的端到端流程。
> - [`reset-and-vault-switch-runbook.md`](./reset-and-vault-switch-runbook.md) — 测试期结束、正式上线前 prod DB 重置 + 金库切换流程(backend 真值源副本,执行前去 backend 仓库拉最新)。
> - [`mtls-runbook.md`](./mtls-runbook.md) — **mTLS 设备准入**(2026-06-04 上线):发证/吊销/enforce 开关;enforce 开启后无证书设备连页面都打不开,公网验证 curl 必须带 `--cert`。

## 0. 一句话流程

**一键**:`./deploy/deploy.sh`（或 `-y` 跳过确认）—— 下面所有步骤它都做了,失败即停。本文是它的展开/降级参考。

```
前置检查 → pnpm build → rsync dist/ 到服务器临时目录 → sudo 安装到 /var/www/oddfi-admin（带备份）
        → chown www-data → 公网验证 → 打 deploy tag
```

---

## 1. 部署目标与依赖（环境事实）

| 项 | 值 |
|---|---|
| 域名 | `https://admin.oddfi.io` |
| 服务器 SSH 别名 | `oddfi-admin`（`~/.ssh/config` 已配；免密 + 免密 sudo(NOPASSWD)） |
| 静态根目录 | `/var/www/oddfi-admin/`（属主 `www-data`） |
| 后端 | 同机 `127.0.0.1:8081`（admin-backend），由 nginx 反代 |
| nginx vhost | `/etc/nginx/sites-enabled/admin.oddfi.io`（**已配好 SPA 托管,日常部署不动它**） |
| mTLS 设备准入 | vhost 内 `ssl_verify_client optional` + `/etc/nginx/mtls/enforce.conf` 开关；管理命令 `sudo oddfi-mtls`；详见 [`mtls-runbook.md`](./mtls-runbook.md) |

**nginx vhost 关键配置（已就位,仅供参考/灾备重建）**：

```nginx
server {
    listen 443 ssl;  server_name admin.oddfi.io;
    root /var/www/oddfi-admin;  index index.html;
    # server 级安全头（用 add_header）
    add_header Strict-Transport-Security ... ; add_header X-Frame-Options DENY; add_header X-Content-Type-Options nosniff; add_header Referrer-Policy no-referrer;
    # index.html 不缓存（发版即时生效）；用 expires 而非 add_header，避免覆盖上面的安全头
    location = /index.html { expires -1; }
    # 内容 hash 命名的静态资源：长缓存
    location /assets/ { expires 1y; access_log off; }
    # SPA 路由 fallback：深链刷新不 404
    location / { try_files $uri $uri/ /index.html; }
    # /auth /admin 反代后端
    location ~ ^/(auth|admin)/ { proxy_pass http://127.0.0.1:8081; proxy_set_header Host $host; ... }
    location = /health { proxy_pass http://127.0.0.1:8081/health; }
}
# 80 → 443 跳转
```

> ⚠️ 给 location 加缓存务必用 `expires`（不要用 `add_header Cache-Control`）—— nginx 里 location 一旦出现 `add_header`，**会丢弃 server 级继承的安全头**；`expires` 不触发这个覆盖。

> ⚠️ **日常部署不需要碰 nginx**。只有改路由规则/加 CSP/换证书时才动 vhost(那属于变更,走单独评审 + `nginx -t` 后 reload)。

---

## 2. 前置检查

```bash
cd ~/work/oddfi-admin-frontend
git branch --show-current      # 必须 main
git status --short             # 必须干净
git pull --ff-only origin main # 确保最新（功能分支应已 merge 进 main）
node -v && pnpm -v             # 工具链就绪（pnpm 版本由 package.json 的 packageManager 字段固定，与 CI 一致）
ssh -o BatchMode=yes oddfi-admin 'echo ok && sudo -n true && echo sudo-ok'  # SSH + 免密 sudo 可用

# CI green gate（强烈推荐 — 不绿不发版）
gh run list -R Crypto-Barrett/oddfi-admin-frontend --workflow=CI --limit 1 --branch main
# 期望最近一次 main 上的 CI 状态为 ✓ completed/success；若 failure 必须先修
```

> 代码上 main 的前置(功能分支 → main)见 `.claude/rules/git-workflow.md`(Squash/ff-merge + push origin)。
> CI workflow:`.github/workflows/ci.yml`(push/PR 到 main 自动跑 `install → tsc(app) → tsc(test) → lint → build → test`)。本地与 CI 用同一 pnpm 版本由 `package.json` `packageManager` 字段对齐,避免"本地绿 CI 红"的版本飘移。

---

## 3. 部署步骤（实跑验证）

### 3.1 构建

```bash
cd ~/work/oddfi-admin-frontend
pnpm install --frozen-lockfile   # 依赖有变动时
pnpm exec tsc -b                  # 类型检查（app + node）
pnpm type-check:test              # 测试代码独立 typecheck（tsconfig.test.json）
pnpm lint                         # ESLint
pnpm test                         # vitest 全量（≈6s）— deploy.sh 也跑这一条,失败即停
pnpm build                        # tsc -b && vite build → dist/
# 自检：产物存在且 index 引用了 hash 化 bundle
ls dist/ && grep -oE 'assets/[^"]+\.js' dist/index.html
```

> 构建用 `VITE_API_BASE`(默认 `/`)→ 生产同源,请求 `/auth` `/admin` 由 nginx 反代到 :8081。
> `vite.config.ts` 的 `VITE_PROXY_TARGET` 是**本地 dev proxy 专用**,不进构建产物,部署无关。
> 跑 `pnpm test` 是发版前最后一道 guard,与 CI 的口径一致(`tsc + tsc:test + lint + test + build`)。如 CI 已绿,本地可以省 test 这一步,但不省 build。

### 3.2 上传 + 原子安装（带备份）

```bash
# (1) 先传到服务器临时目录（你的用户可写）
rsync -az --delete dist/ oddfi-admin:/tmp/oddfi-admin-dist/

# (2) sudo 安装到正式目录：--backup-dir 把被替换/删除的旧文件留作快照，便于回滚
ssh oddfi-admin '
  sudo rsync -a --delete \
    --backup --backup-dir=/var/www/oddfi-admin.bak.$(date +%s) \
    /tmp/oddfi-admin-dist/ /var/www/oddfi-admin/ \
  && sudo chown -R www-data:www-data /var/www/oddfi-admin \
  && rm -rf /tmp/oddfi-admin-dist \
  && echo DEPLOYED
'
```

> 用「临时目录 → sudo rsync」两步,避免本地 rsync 直接 sudo 的权限/交互问题。`--delete` 保证产物目录干净(清掉上一版残留文件;hash 化 assets 不会冲突)。

### 3.3 打部署 tag（记录线上版本 + 回滚锚点）

```bash
# 部署成功后，给"被部署的那个 commit"打 tag 并推送（多次/天加序号：-2、-3）
git tag -a deploy/$(date +%F) HEAD -m "deploy: <一句话说明本次内容>"
git push origin deploy/$(date +%F)
```

> 有了部署 tag,「上一版」永远是具体可指的(`git tag -l 'deploy/*'`),回滚(§5)直接 checkout 即可;并在 §9 部署记录登一行。

---

## 4. 验证（公网三连，必跑）

> ⚠️ **mTLS enforce 开启后**,以下所有 `curl` 必须带 `--cert ~/.config/oddfi-mtls/client.pem`,否则一律 403(不是部署坏了)。`deploy.sh` 的 `pubcurl` 已自动带。无证书先按 [`mtls-runbook.md`](./mtls-runbook.md) §4 发证。

```bash
CERT="--cert $HOME/.config/oddfi-mtls/client.pem"   # 观察模式下可省略

# (1) SPA 已上线（应出现新 bundle + id="root"，不再是占位页）
curl $CERT -s https://admin.oddfi.io/ | grep -oE 'assets/[^"]+\.js|id="root"|SPA 尚未部署'

# (2) JS bundle 可取（200）
curl $CERT -s -o /dev/null -w "bundle HTTP %{http_code}\n" \
  https://admin.oddfi.io/$(curl $CERT -s https://admin.oddfi.io/ | grep -oE 'assets/[^"]+\.js' | head -1)

# (3) 深链刷新不 404（SPA fallback）+ 后端反代仍正常（无 token 应 401）
curl $CERT -s -o /dev/null -w "/rounds HTTP %{http_code}\n" https://admin.oddfi.io/rounds
curl $CERT -s https://admin.oddfi.io/admin/presale/rounds   # 期望 {"code":"UNAUTHORIZED",...}
```

通过标准:① 出现新 bundle hash(与 `dist/index.html` 一致)② bundle 200 ③ 深链 200 + 后端 401。

> 缓存已治理(2026-05-27)：nginx 给 `index.html` 设了 `Cache-Control: no-cache`(发版浏览器自动拿新版,不用再 hard-refresh)、`/assets/` 设了 `max-age=31536000`(长缓存)。**唯一例外**:在该头上线"之前"就缓存过旧页的浏览器,需再 hard-refresh 一次(`Cmd+Shift+R`),之后永久生效。

---

## 5. 回滚

**首选 · 重部署上一版（最稳）**：

```bash
cd ~/work/oddfi-admin-frontend
git tag -l 'deploy/*'             # 看历史部署 tag，挑上一个
git checkout deploy/<上一个日期>   # 切到上一版被部署的 commit
pnpm build
# 重跑 §3.2，把旧版本重新装上去
git checkout main                # 回滚完切回（注意此时线上是旧版、本地是 main）
```

**应急 · 用本次备份快照**（`--backup-dir` 里是被本次替换/删除的旧文件）：

```bash
ssh oddfi-admin 'ls -dt /var/www/oddfi-admin.bak.* | head'   # 找最近一次备份
ssh oddfi-admin 'sudo rsync -a /var/www/oddfi-admin.bak.<ts>/ /var/www/oddfi-admin/ && sudo chown -R www-data:www-data /var/www/oddfi-admin'
```

> 备份快照是「差异快照」(只含变更/删除的文件),不是全量;能救急但首选还是按 git 重部署。备份目录会累积,定期清:`ssh oddfi-admin 'sudo rm -rf /var/www/oddfi-admin.bak.*'`。

---

## 6. 注意事项 / 坑

- **日常部署零 nginx 改动**:vhost 已配好 SPA 托管 + 后端反代。改 nginx = 单独变更,`sudo nginx -t` 通过再 `sudo systemctl reload nginx`。
- **mTLS 与部署互不干扰**:部署走 SSH/rsync,不过 443,enforce 开关不影响发版本身;只影响 §4 的公网验证 curl(要带 `--cert`)。换电脑/新同事先发证,见 [`mtls-runbook.md`](./mtls-runbook.md)。
- **同源**:生产前端与 `/auth` `/admin` 同域,无 CORS;别把 `admin.oddfi.io` 的请求指到别的域。
- **构建环境**:`pnpm build` 默认 `VITE_API_BASE=/`,正确;不要为生产塞 `VITE_PROXY_TARGET`(那是 dev proxy)。
- **当前部署内容是 M1(只读)**:登录 / 总览 / 轮次 / 配置出真数据;入账/异常/审计受后端 [ISSUE-004](../issues/ISSUE-004-hmac-query-string-sig-mismatch.md) 影响会报错(已优雅降级、不登出)。M2+ 写功能上线前另行评估。
- **chunk 体积告警**:`vite build` 会提示 bundle > 500KB,目前是单 chunk,**非错误**;后续做路由级 code-splitting 优化(待办)。

---

## 7. 待办（部署侧改进，非阻塞）

> 已落地:✅ `deploy/deploy.sh` 一键脚本(§0)、✅ nginx 缓存策略(§4 注)、✅ CI workflow(`.github/workflows/ci.yml`)、✅ vitest 测试基建(P0 覆盖 443 用例)、✅ pnpm 版本固定(`packageManager: pnpm@10.32.1`)
>
> 剩余:

- [x] ~~nginx 给 `index.html` 加 `Cache-Control: no-cache`、`/assets/` 加长缓存~~ **已做(2026-05-27,用 `expires` 实现,见 §1)**。
- [ ] nginx 加 CSP 头(localStorage 存 JWT 的补偿控制,见 spec `05-deploy.md`)。
- [x] ~~把 §3 固化成 `deploy/deploy.sh` 一键脚本~~ **已做**:`./deploy/deploy.sh [-y]`(前置检查 + 失败即停 + 公网验证 + 自动打 tag)。
- [ ] 路由级 code-splitting 降首包体积。
- [ ] 加 CI:PR 跑 `tsc + lint + build`。

---

## 8. 一次完整部署的命令速查（copy-paste）

> **首选直接跑 `./deploy/deploy.sh`**（= 下面这串 + 自动打 tag + 失败即停 + 公网验证）。以下手动命令供脚本不可用时降级/排查用。

```bash
cd ~/work/oddfi-admin-frontend
git checkout main && git pull --ff-only origin main && git status --short
pnpm install --frozen-lockfile && pnpm build
rsync -az --delete dist/ oddfi-admin:/tmp/oddfi-admin-dist/
ssh oddfi-admin 'sudo rsync -a --delete --backup --backup-dir=/var/www/oddfi-admin.bak.$(date +%s) /tmp/oddfi-admin-dist/ /var/www/oddfi-admin/ && sudo chown -R www-data:www-data /var/www/oddfi-admin && rm -rf /tmp/oddfi-admin-dist && echo DEPLOYED'
curl -s https://admin.oddfi.io/ | grep -oE 'assets/[^"]+\.js|id="root"'
curl -s -o /dev/null -w "/rounds %{http_code}\n" https://admin.oddfi.io/rounds
git tag -a deploy/$(date +%F) HEAD -m "deploy" && git push origin deploy/$(date +%F)   # 记录线上版本 → §9 登一行
```

---

## 9. 部署记录（每次部署登一行）

| 日期 | tag | commit | 内容 | 操作人 |
|---|---|---|---|---|
| 2026-05-27 | `deploy/2026-05-27` | `e18730c` | 首次生产部署:M1 只读后台上线(登录/总览/轮次/配置真数据;入账/异常/审计待后端 ISSUE-004) | — |
| 2026-05-28 | `deploy/2026-05-28` | `8647968` | M2-M5 写操作全闭环上线(轮次状态机+编辑/config PATCH/deposits migrate-round/anomaly resolve/admin-users CRUD + 自删保护/RoundStatusFlow/AuditDiff 5s 轮询/CutoverBanner)+ 测试基建(vitest 443 用例)+ CI workflow + deploy.sh test guard。bundle `index-BhCi2h6g.js`;旧版备份 `/var/www/oddfi-admin.bak.1779944359`。 | hank |
| 2026-06-06 | `deploy/2026-06-06` | `38d1a63` | DD002 赛事风险信号灯上线(风险列表页四色 KPI+两级展开/审批中心红灯决策闭环/铃铛 badge 降级/SignalTag 语义色;vitest 527 用例;双轮双代理 review + 联调 A 25 项浏览器实测)。⚠️ events 上游联调期指 C 端 dev(双上游分流,RUNBOOK-dd002-ops),C 端生产发版后切换合流。bundle `index-CzU109Ax.js`;旧版备份 `/var/www/oddfi-admin.bak.1780728491`。 | hank |
| 2026-06-08 | `deploy/2026-06-08` | `07e9876` | DD003 赛事管理走查 6/5 四项修复(Sider 去默认 logout/时间高亮纯 status 驱动 pending→开赛·active→锁盘·settled→结算/按时间排序 Tab 语境默认方向/开盘赔率列头 Tooltip 消歧;vitest 533 用例;simplify 四视角 + 双代理 review 双 APPROVE)。bundle `index-B65aVgqc.js`;旧版备份 `/var/www/oddfi-admin.bak.1780888215`。 | hank |
| 2026-06-08 | `deploy/2026-06-08-2` | `321578a` | DD004 走查 6/8 前端三项(进页默认按开赛时间升序=距今最近在前/按赛事类型 league 筛选下拉/KPI 卡片等高;vitest 536 用例;双代理 review 双 APPROVE)。⚠️ #2 league 下拉选项依赖 web-api `summary.leagues`(后端 `feat/events-league-filter` 上线前下拉为空,#1/#3 不受影响)。bundle `index-DiV2PZkI.js`;旧版备份 `/var/www/oddfi-admin.bak.1780892270`。 | hank |
| 2026-06-12 | `deploy/2026-06-12` | `4d9ebdf` | ENH-008 前端两项(KPI 新增「在售可下注」卡=on_sale_event_count+盘数副行、原副文案钉死「比赛进行中」live 口径;「显示测试盘/显示已归档」Checkbox 经 filters 进 URL 单一真值源,summary 与 list 同参;测试盘行打「测试」Tag;vitest 540 用例)。⚠️ web-api dev 部署 ENH-008 前在售卡显示「—」(字段缺失兜底,预期);默认列表仍全量,过滤待后端上线。bundle `index-Bga5niJP.js`;旧版备份 `/var/www/oddfi-admin.bak.1781233592`。 | hank |

---

## 附录 A · 本地直连线上后端（只读联调，慎用）

本地想看线上真数据时,让 dev server 的 proxy 指向生产后端(不复制任何密钥):

```bash
VITE_PROXY_TARGET=https://admin.oddfi.io pnpm dev   # 本地 :5173 的 /auth /admin 转发到 prod
```

登录:线上 OAuth 回调落 `admin.oddfi.io`,在那登一次 → 把 URL 里 `#token=` 后的 JWT 贴进本地 `localStorage.oddfi_admin_jwt` → 刷新。

> 🚨 **只用于只读查看**。此时本地操作直达**生产**——任何写操作(M2+ 的 pause/migrate/改配置)都会真打到 prod。做写功能联调前**必须**改回本地后端或 staging,别拿生产当试验场。
> 另:线上回调域名是 `admin.oddfi.io`,本地点登录不会自动跳回 localhost(所以要手动贴 token);要本地完整 OAuth 闭环只能用本地后端(其 redirect_uri 配的是 `localhost:5173`)。
