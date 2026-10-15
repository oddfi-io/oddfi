# oddfi-admin-backend ↔ Lark 应用绑定

> 本文记录后端服务依赖的 Lark 开放平台应用及其配置。**每次 Lark 后台改动**（权限申请、回调白名单、版本发布、Secret 轮换）都要同步更新这份文档。
>
> 维护人：后端 owner。变更必须 commit 到本仓库，方便审计、新人接手、安全 review。

---

## 1. Lark 应用基本信息

| 字段 | 值 |
|---|---|
| 应用名 | `oddfi-admin` |
| **App ID** | `<LARK_APP_ID>`（OAuth public client ID 语义，**非机密**，可入库） |
| 应用类型 | 企业自建应用（仅 Everything.Finance tenant 内可见） |
| Tenant | Everything.Finance |
| Lark Region | SG (Singapore，accounts-sg.larksuite.com) |
| 开发者后台 | https://open.larksuite.com/app → `oddfi-admin` |
| 管理后台（tenant 级审核） | https://admin.larksuite.com |
| 应用 owner | Hank（@ops@example.com） |
| 应用图标 | 默认橙色立方体 |
| 应用首页（工作台入口） | `https://admin.oddfi.io/`（生产；仅工作台显示用，不参与 OAuth） |
| 打开方式 | 浏览器打开（不在 Lark webview 内嵌） |
| 创建日期 | 2026-05-18 |

**凭据存放位置**：macOS 系统「密码」app，搜索 `Lark OAuth · oddfi-admin`。

> ❌ 禁止把 App ID / App Secret 写进本文档、`config.example.yaml`、commit message、Slack/飞书消息、shell history。

---

## 2. 启用的应用能力

| 能力 | 状态 | 用途 |
|---|---|---|
| 网页应用 | ✅ 启用 | OAuth Web 流程必需。桌面端/移动端首页都填 `https://admin.oddfi.io/` |
| 机器人 | ❌ 未启用 | 后续如需消息卡片/告警通知，**单独**建 `oddfi-admin-bot` 应用，不在本应用上叠加（权限隔离 / Secret 爆炸半径隔离） |
| 工作台小组件 / 云文档 / 多维表格插件 / 链接预览 / 移动应用登录 | ❌ 未启用 | 无需求 |

---

## 3. 权限清单（最小特权）

| 权限码 | 类型 | 用途 | 申请状态 |
|---|---|---|---|
| `contact:user.base:readonly` | 用户身份 `user_access_token` | OAuth 回调后调 `/authen/v1/user_info` 获取 `open_id / name / email / avatar` 用于本地 `admin_users` 表白名单匹配 | ✅ 已开通 |

**审核机制**：免审核权限。

**任何新增权限**必须满足：
1. 写明业务用途
2. 修改本表 + 在 `.progress/design/<topic>/` 起对应 DD/ENH 文档
3. 提交新版本（版本号递增）→ 通过 tenant 内审核
4. 同步代码侧调用与中间件改动

---

## 4. 重定向 URL 白名单

Lark 后台 → 安全设置 → 重定向 URL（字符串字面量匹配，**任何字符差异都会被拒**）：

- `https://admin.oddfi.io/auth/lark/callback`（生产，TLS 必须）
- `http://localhost:5173/auth/lark/callback`（本地开发，Vite 默认端口）

**变更协议**：
- 加新环境（staging / preview）→ 把对应 URL 加进 Lark 白名单 **AND** 本表 **AND** 后端 `config.yaml` 的 `lark.redirect_uri`（不同 env 一份）
- 删除环境时反向操作

---

## 5. IP 白名单 / 可信域名

| 设置 | 状态 | 说明 |
|---|---|---|
| API 调用 IP 白名单 | 未启用（暂留空） | 启用后只有白名单 IP 能调 Lark API。本地开发出口 IP 动态，加了会卡测试。生产部署稳定后可加 EC2 IP `<SERVER_IP>` 作为 Secret 泄漏后的二重防护 |
| H5 可信域名 | 未配置 | 不使用 Lark JSAPI |

---

## 6. 可用范围（应用可见性）

部分成员模式：

- Hank

每加一个同事都要在 Lark 后台「版本管理与发布」→ 「可用范围」→ 「编辑」追加，同步更新本表。**禁止**改为"全部成员"（攻击面控制）。

---

## 7. 版本历史

| 版本 | 发布时间 | 审核结果 | 变更摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-18 | 通过 | 首次发布。启用网页应用 + `contact:user.base:readonly` 权限 + 两条重定向 URL |

后续版本号约定（semver）：

- patch（1.0.x）：更新说明、可用范围微调、不影响 OAuth 流程
- minor（1.x.0）：新增权限、新增重定向 URL、新增能力
- major（x.0.0）：撤销已发布权限、变更 App ID 配套机制等破坏性改动

---

## 8. 后端代码侧配置入口

| 后端配置项 | 文件 | 注入方式 |
|---|---|---|
| `lark.app_id` | `config.yaml` | 环境变量 `ADMIN_LARK_APP_ID` 覆盖（OPS-02） |
| `lark.app_secret` | `config.yaml` | 环境变量 `ADMIN_LARK_APP_SECRET` 覆盖（OPS-02） |
| `lark.redirect_uri` | `config.yaml` | env 不同：prod = `https://...`，dev = `http://localhost:5173/...` |
| `lark.authorize_url` | `config.yaml` | `https://open.larksuite.com/open-apis/authen/v1/authorize` |
| `lark.token_url` | `config.yaml` | `https://open.larksuite.com/open-apis/authen/v2/oauth/token`（v1 OIDC 已弃用；v2 用 `client_id`/`client_secret`/`redirect_uri` 三参数） |
| `lark.user_info_url` | `config.yaml` | `https://open.larksuite.com/open-apis/authen/v1/user_info` |
| `lark.scope` | `config.yaml` | `contact:user.base:readonly` |
| `cors.allowed_origins` | `config.yaml` | 含 `https://admin.oddfi.io` 和 `http://localhost:5173` |
| `frontend.callback_url` | `config.yaml` | 后端 OAuth 成功后 302 回跳目标 |

模板：`config.example.yaml`（仓库内可读）。生产实际值通过 systemd `EnvironmentFile=/etc/oddfi-admin/admin-backend.env` 注入（详见 [OPS-02](`../.progress/design/oauth/tasks/DD001-OPS-02-ec2-systemd-env.md`)，本地不入库）。

---

## 9. 凭据轮换（Secret rotation）协议

**触发条件**：
- App Secret 泄漏（任何怀疑都按泄漏处理）
- owner 离职 / 交接
- 例行轮换（建议 6 个月一次）

**步骤**：
1. Lark 后台 → 凭证与基础信息 → 「重置 App Secret」→ 拿到新 Secret
2. 立刻更新 macOS 「密码」app 中 `Lark OAuth · oddfi-admin` 的密码字段
3. 在 EC2 上更新 systemd EnvironmentFile：
   ```bash
   sudo $EDITOR /etc/oddfi-admin/admin-backend.env
   # 改 ADMIN_LARK_APP_SECRET=<new_secret>
   sudo systemctl restart oddfi-admin-backend
   ```
4. 验证 `journalctl -u oddfi-admin-backend -n 50` 无启动错误
5. 走一次完整 OAuth 流程验证
6. 在本文档 §7 加一条 patch 版本记录（不必发新 Lark 版本，Secret 轮换不需要重发）

**注意**：旧 Secret 在重置瞬间即失效，不存在并存窗口；所以**先准备好**新 Secret 的注入路径，再点重置。

---

## 10. 健康检查 / 接入验收

### 10.0 本地开发：跳过 OAuth 流程直接拿 admin JWT

`cmd/dev-token` 工具用同样的 jwt service + config.yaml 给指定 `lark_user_id` 签 token，避开浏览器交互，便于 curl / Postman 联调：

```bash
go run ./cmd/dev-token -user ou_12d3776bcf5f20c5289d3cd0767aade1
# stdout 输出 JWT；stderr 输出元信息（不进管道）
TOKEN=$(go run ./cmd/dev-token -user ou_xxx 2>/dev/null)
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8081/auth/me
```

**仅本地 dev 用**，生产 build 应排除（依赖 config.yaml 里的 JWT secret 与 DB 真实凭据）。

### 10.1 快速跳转测试（任何时候都可以执行）

替换 `<APP_ID>` 后浏览器打开：

```
https://open.larksuite.com/open-apis/authen/v1/authorize?app_id=<APP_ID>&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Flark%2Fcallback&scope=contact%3Auser.base%3Areadonly&state=test
```

期望：跳到 Lark 授权页，显示 "oddfi-admin 申请获取你的基本信息"。

常见错误：
- "应用不存在" → App ID 错
- "redirect_uri 不在白名单" → 字符串字面量不一致（核对协议、端口、路径、末尾斜杠）
- "应用未发布" → 走完 §7 发布流程
- "无权访问" → 当前用户不在 §6 可用范围内

### 10.2 全链路 e2e（后端启起来之后）

参考 OPS-04 nginx 配置 + OPS-03 数据库 bootstrap 完成后，浏览器访问 `https://admin.oddfi.io` → 点 "用 Lark 登录" → 完成授权 → 落回前端 `#token=<JWT>`。

---

## 11. 增量维护 checklist

每次 Lark 后台改动 / 应用版本发布后，过一遍：

- [ ] §1 基本信息（owner / 版本归属）有变化？
- [ ] §2 启用能力增减？
- [ ] §3 权限新增 / 移除？
- [ ] §4 重定向 URL 增减？
- [ ] §6 可用范围调整？
- [ ] §7 加一行版本记录
- [ ] §8 配置项有新增（含环境变量 key）？
- [ ] §9 是否触发了一次 Secret 轮换？
- [ ] §10.1 跑一遍快速跳转测试，确认配置一致

改完 `git diff docs/lark-app-binding.md` 看着没问题就一起提交。

---

## 关联文档

- `.progress/design/oauth/lark-oauth-flow.md` — OAuth 三步流程图（本地 working memory，不入库）
- `.progress/design/oauth/tasks/DD001-OPS-01-lark-app-config.md` — 本次创建应用的步骤记录
- `.progress/design/oauth/tasks/DD001-OPS-02-ec2-systemd-env.md` — App ID/Secret 注入 EC2
- `.claude/rules/lark-oauth.md` — 后端实现硬规则（state CSRF / redirect_uri 固定 / token 不入日志）
- `ARCHITECTURE.md` — 接手指南
