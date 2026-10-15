# DD002 · admin-backend 侧开发报告（轨道 A：T01-T05）

**日期**：2026-06-05
**分支**：`feat/risk-signal`（基于 main `1eddc27`，待 squash merge）
**范围**：管理后台后端 proxy 层全部 5 个 task + team:2 review + 修复
**结论**：✅ 轨道 A 完工。`vet / build / test` 全绿，双 reviewer 均 **APPROVE**（0 Critical / 0 High），review 修复已应用并回归。

---

## 1. 完工 commit 列表（按波次）

| 波次 | commit | 内容 |
|---|---|---|
| W1 | `3929950` | T01 地基：errcode +4、`RiskSummary` DTO、upstream 路径常量 |
| W2 | `fa1dd09` | T02/T03：events proxy 五端点 + approval/counts 聚合 + mock 上游（8 事件夹具） |
| W3 | `797a8e9` | T04：路由注册 + RBAC 矩阵 + events_sensitive 限流 + rbac.md/api.md §1.6 同步 |
| W4 | `18eadf6` | T05：docs/api.md §3.12 契约定稿 + `docs/risk-signal-curl.md` 实跑 curl 集 |
| 阶段5 | `be35dc8` | review 修复：长度上限三件套 / 4xx 补日志 / mock 回环绑定 / action 抽常量 |

每波次出口标准（`go vet && go test ./... && go build` 全绿）均满足后才 commit。

## 2. 交付物清单

**代码**（均含中文注释 + table-driven 测试）：

| 文件 | 说明 |
|---|---|
| `internal/handler/events_risk.go` | Summary / List / Detail / AdjustHistory / RiskDecision 透传薄壳；RawQuery 原样透传；错误三态翻译（业务错透传 / 5xx→503 / 4xx 透传+Warn / 网络错→503） |
| `internal/handler/approval_counts.go` | 铃铛 badge 聚合：`event_count = red_pending_count`（D4），claim/withdraw 占位 0，上游任何失败 → 503 降级 |
| `internal/model/events_risk.go` | upstream 路径常量 + action 协议枚举 + `RiskSummary` 镜像 DTO（仅 1 字段，防双仓漂移） |
| `internal/router/events_routes.go` | 6 路由声明式 RBAC（super_admin 显式 allow）+ 高敏限流 |
| `cmd/mock-webapi/` | 联调 A 专用 mock 上游（默认 127.0.0.1:9090）：8 事件夹具覆盖全形态，risk-decision 内存有状态（决策闭环 / CONFLICT / 重升态） |
| `internal/pkg/errcode/errcode.go` | +EVENT_NOT_FOUND / EVENT_NOT_RED_SIGNAL / RISK_DECISION_CONFLICT / UPSTREAM_UNAVAILABLE |

**文档**：`docs/api.md` §1.2/§1.4.2/§1.6/§3.12 · `docs/risk-signal-curl.md`（8 节全实跑）· `.claude/rules/rbac.md` 矩阵 +6 行 · `ARCHITECTURE.md` 回写

**测试**：新增 5 个测试文件，覆盖透传形态 ×5、入参门卫 ×12、错误翻译 ×5、counts 四态、RBAC 6 路由 × 6 角色全矩阵、路由形状锁定（`risk` 静态段 vs `:event_id`）、RBAC 先于限流顺序。

## 3. 实测验证记录（真实 server :8081 → mock :9090 链路）

- ✅ 四角色 dev-token 读矩阵全 200；finance/customer_service POST risk-decision 403
- ✅ `?signal=red,orange` 逗号多值透传 → 命中 3/5/7 三事件（含已决策红灯展示 orange）
- ✅ 决策闭环：决策前 `event_count=1` → operator 决策成功（`decided_by=lark:ou_dev_operator` 真实 JWT 身份）→ `event_count=0`，重复决策 → `RISK_DECISION_CONFLICT`，橙灯决策 → `EVENT_NOT_RED_SIGNAL`
- ✅ 停 mock → counts 503 `UPSTREAM_UNAVAILABLE`（badge 降级语义）
- ✅ null 组字段（lp_pool/yield/score/settle_pl/times.settle）全 null；未开盘行 signal/金额全 null
- ✅ 结算态明细：`settle` 块 + 方向名「✓ 胜出 / 未中 / 走盘」标注
- ✅ 限流：risk-decision 12 连发尾部 429
- ✅ 无 token 401；非数字/超长 event_id、缺/超长幂等 key、非法 action、空白/超长 remark 均 400 且不打上游

## 4. team:2 review 结论与处理

并行双 agent（code-reviewer / security-reviewer）均 **APPROVE**：

| 编号 | 发现 | 处理 |
|---|---|---|
| M-2 + Sec-M2 | event_id / 幂等 key / remark 无长度上限 | ✅ 已修（20 / 128 / 500，+3 测试用例） |
| M-3 | 上游 4xx 透传无本侧日志 | ✅ 已修（Warn 记状态码不记 body） |
| M-1 | 错误透传绕 response 包 | ✅ 补注释（刻意取舍：透传上游 any 类型 code） |
| Sec-M1 | mock 默认绑 0.0.0.0 误部署风险 | ✅ 已修（默认 127.0.0.1） |
| L | action 枚举散落字面量 | ✅ 抽 model 常量 |
| L（夹具 e6 负 MaxExposure） | reviewer 认为量纲混淆 | ❌ 拒绝：DD §3.1 明确 adjMaxL 负=平台盈利绿显示，夹具是刻意覆盖该形态 |
| L1（presale_helpers 上游 message 透传） | 信息泄漏面 | ⏭ 留 ENH：动 presale 共享 helper 超 DD002 范围；上游是自家 web-api，message 受控 |
| Open-Q（client GET 重试 3× 放大） | 上游故障期轮询放大 | ⏭ 留联调 B：压测后决定是否给只读端点降 MaxRetries |

修复后全套 `vet + test + build` 重跑通过（commit `be35dc8`）。

## 5. 联调 A checklist 后端侧状态

| 条目 | 状态 |
|---|---|
| 信封拆包 `{code:0,data:{list,total,page,page_size}}`；ID 字符串 | ✅ 实测过 |
| 分页 / 多值筛选逗号单 key 透传 | ✅ 实测过 |
| 四角色 RBAC（finance/客服 403 决策） | ✅ 实测过 |
| risk-decision 幂等 key / CONFLICT / NOT_RED | ✅ 实测过 |
| counts 上游挂降级 503 | ✅ 实测过 |
| null 组字段 / 未开盘行 | ✅ 实测过 |
| 决策乐观更新 / KPI 联动 / 时间线 hover | ⏳ 前端侧条目（T07/T08 后联调） |

## 6. 给三方的衔接信息

- **前端（T06-T08）**：契约定稿在 `docs/api.md` §3.12；本地联调起 `go run ./cmd/mock-webapi` + server 指 `WEBAPI_INTERNAL_URL=http://127.0.0.1:9090`；本地 dev 库已 seed 三个测试角色账号（`ou_dev_operator` / `ou_dev_finance` / `ou_dev_cs`）
- **C 端（OPS-01c）**：web-api internal 五端点的响应 schema 以 mock 夹具为契约真值（`cmd/mock-webapi/fixtures.go` 字段注释齐全）；联调 B 用 `docs/risk-signal-curl.md` 逐条打真上游做 schema diff
- **联调 B 前人工事项**：dev 环境 HMAC secret 两侧 yaml 对齐（`webapi.service_token`）

## 7. 可选 ENH（不阻断）

1. `presale_helpers.proxyErrBody` 上游 message 改为本地固定文案（双模块统一处理）
2. 只读端点 client 重试策略压测后调优（MaxRetries 1 vs 3）
3. WS 实时推送替代 30s 轮询（badge 时效，DD 既有 ENH 项）
