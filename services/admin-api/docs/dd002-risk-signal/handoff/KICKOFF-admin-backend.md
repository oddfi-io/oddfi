# 🚀 KICKOFF · 管理后台后端（admin-backend，轨道 A：T01-T05）

> 角色一句话：在本仓实现信号灯模块的 proxy 层 —— 6 条 `/admin/events|approval` 路由 + RBAC + 限流 + mock 上游 + 契约文档。**不做判级逻辑**（判级唯一实现点在 web-api，见 OPS-01c）。

## 1. 方案与任务在哪

| 文件 | 用途 |
|---|---|
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/DD.md` | 方案 v2（唯一权威；§3.2 路由/RBAC、§3.3 契约、§3.6 D1-D7 已拍板） |
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/process/README.md` | 任务索引 + 依赖图 + 执行波次 + 三段联调方案 |
| 同目录 `process/DD002-T01-errcode-dto.md` → `T02-events-proxy` → `T03-approval-counts` → `T04-router-rbac` → `T05-api-docs` | 你的 5 个 task，按编号顺序（T02∥T03 可并行） |
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/prd/` | PRD 源文件（一般不用看，契约以方案 §3.3 为准） |

## 2. 文件夹地图（你要动的 / 参照的）

```
/Users/hang/work/oddfi-admin-backend/
├── internal/
│   ├── handler/
│   │   ├── presale_audit.go        ← ★参照：RawQuery 透传 proxy 模式（照抄结构）
│   │   ├── events_risk.go          ← T02 新建
│   │   └── approval_counts.go      ← T03 新建
│   ├── client/webapi.go            ← 复用：HMAC client（Get/Post/Patch，不要改签名算法）
│   ├── router/
│   │   ├── presale_routes.go       ← ★参照：路由组+RBAC+限流声明模式
│   │   ├── events_routes.go        ← T04 新建
│   │   └── router.go               ← T04 修改：装配
│   ├── middleware/{rbac,auth,ratelimit}.go  ← 只用不改
│   ├── model/events_risk.go        ← T01 新建：DTO + upstream 路径常量
│   └── pkg/errcode/errcode.go      ← T01 修改：+4 错误码
├── cmd/
│   ├── server/main.go              ← 不改
│   └── mock-webapi/                ← T02 新建：联调 A 的 mock 上游（:9090）
├── docs/api.md                     ← T05 修改：§1.2/§1.6/§3.12（commit-msg hook 强制同步）
└── .claude/rules/rbac.md           ← T04 修改：矩阵 +6 行
```

## 3. 必守硬规则（违反会被 hook/review 打回）

- 中文注释（关键逻辑必须）、zerolog 结构化（禁 fmt.Println）、`RoleRequired` 路由级声明（禁 handler 内判 role）、super_admin 显式进每行 allow
- uint64/int64 ID 序列化一律 `,string`（项目记忆：audit 500 根因）
- 改 handler/router/errcode 必须同 commit 更新 docs/api.md（commit-msg hook 阻断）
- table-driven 测试强制；每波次单 commit（中文 message 列 task 号）；分支 `feat/risk-signal`

## 4. 出口与依赖

- 你不等任何人：T02 自带 mock 上游，全程不被 C 端阻塞
- **等你的人**：前端（T06 等 T05 契约草稿——可在 T04 前先出草稿版 §3.12）、联调 A（等 T02 mock + T04 路由）
- 完成定义：`go vet && go test ./... && go build` 全绿 + 联调 A checklist（process/README.md §4）后端侧条目全过
