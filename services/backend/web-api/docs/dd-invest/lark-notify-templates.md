# Lark 推送模板规范（DD-INVEST 认购）

> **真值源**：`web-api/internal/service/lark_webhook.go`
> 修改本表前必须先改源码 + 跑 `lark_webhook_test.go` — 文档永远跟随实现。

## 1. 颜色 / Emoji / 用途分类

| 颜色 | header template | 用途 | 触发场景示例 |
|---|---|---|---|
| 🔴 红 | `red` | 致命异常，需立即处理 | overflow 超额到账 |
| 🟠 橙 | `orange` | 运营介入异常，需客服跟进 | unclaimed / round_mismatch |
| 🔵 蓝 | `blue` | 信息流，已正常处理仅告知 | paused_arrival |
| 🟢 绿 | `green` | 正向 / 审计事件 | deposit_confirmed（认购成功）/ admin_op / script_op |

## 2. EventType 全表

| EventType | 颜色 | 标题 | 触发点（源码） | CTA 按钮 |
|---|---|---|---|---|
| `overflow` | red | `⚠️ 预售异常：overflow 超额到账` | `presale_deposit_impl.go` ConfirmDeposit step3 ErrCapacityExceeded | 「查看详情」→ admin 后台 anomaly 详情 |
| `unclaimed` | orange | `⚠️ 认购异常：unclaimed 无主转账` | `recordAnomaly()`（AnomalyUnclaimed） | 「查看详情」→ admin 后台 |
| `round_mismatch` | orange | `⚠️ 预售异常：round_mismatch 边界切轮` | `recordAnomaly()` | 「查看详情」→ admin 后台 |
| `paused_arrival` | blue | `ℹ️ 预售信息：paused_arrival 暂停期入账` | `recordAnomaly()` | 「查看详情」→ admin 后台 |
| **`deposit_confirmed`** | **green** | `🎉 认购到账：用户成功入金` | `ConfirmDeposit()` step7（成功路径末尾） | **「查看链上交易」→ BscScan** |
| `admin_op` | green | `📋 预售审计：admin 操作通知` | admin HTTP handler（高敏路由） | 无 |
| `script_op` | green | `✅ 预售脚本：操作执行完成` | 预案脚本 `scripts/presale-ops/shared/lark.go` | 无 |

## 3. LarkEvent 字段使用约定

| 字段 | 适用 EventType | 说明 |
|---|---|---|
| `TxHash` | 全部带链上记录的事件 | 决定是否渲染 CTA 按钮；`deposit_confirmed` 时跳 BscScan，其他跳 admin 后台 |
| `EOA` | 全部 deposit 相关事件 | tx.from 地址 |
| `AmountUsdt` | 全部 deposit 相关事件 | 字符串 decimal |
| `RoundID` | overflow / paused_arrival / deposit_confirmed | 所属轮次 |
| `SharesOdd` | **deposit_confirmed 专用** | 用户获得 ODD 数量 |
| `Referrer` | **deposit_confirmed 专用** | 邀请人信息形如 `"uid=1024"`，无则空 |
| `Reason` | anomaly 系列 | anomaly_reason 枚举值 |
| `Suggestion` | round_mismatch | 处理建议（覆盖默认） |
| `Operator` | admin_op / script_op | admin user_id 或 `script:filename` |
| `Note` | admin_op / script_op | 操作原因 / 补充说明 |

## 4. 异步推送 + 失败处理

- `LarkWebhookService.Notify()` 内部用 `go func()` + `recover panic` 异步发，**不阻塞**业务事务
- webhook POST 5s 超时；失败仅 `logger.Warnf` 不抛错（推送是观测增强，不能反过来影响主流程）
- `webhookURL` 未配置时由 `NewNoopAnomalyAlerter()` 兜底，零开销静默

## 5. Race 窗口（已知 trade-off）

`deposit_confirmed` 通知点在事务的 `doConfirm` 闭包末尾，与 anomaly 的 `recordAnomaly()` 同源。

如果外层事务（worker 路径）在 `ConfirmDeposit` 返回后才 commit，存在「通知已发但事务被外层回滚」的窗口。MVP 接受此 trade-off — 后续如要严格 once-on-commit，可改用 outbox 模式或回调闭包。

## 6. 测试

`internal/service/lark_webhook_test.go` 为每个 EventType 覆盖 buildPayload + header template + 关键字段透出。新增 EventType 必须同 PR 加单测。

## 7. 触发样卡（人工预演）

需要在群里看实际效果时，可用 `web-api/scripts/lark-template-preview/` 下的 Python 脚本（如存在）或直接 curl Lark webhook 推 raw payload。webhook URL 存于 `presale_config.lark_webhook_url`，**禁止 echo 到日志或 commit**。
