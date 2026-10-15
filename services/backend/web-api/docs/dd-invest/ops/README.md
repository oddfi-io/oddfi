# DD-INVEST V3 Ops 文档地图

> 本目录收录 DD-INVEST V3 预售模块**所有运维 / 部署文档**：上线策略、cutover SOP、监控告警、应急 runbook。
> 已过时的文档在 [`archive/`](archive/)，保留可读以备追溯。

---

## 当前在用（active）

| 文件 | 用途 | 何时读 |
|---|---|---|
| [release-rollout-plan.md](release-rollout-plan.md) | V3 整体上线策略与命令模板（5 步：web-api / admin / 真链联调 / 前端 / dev 同步）| 准备上线 / 跨阶段策略决策 |
| [tasks.md](tasks.md) | V3 上线**真实执行进度看板**（任务清单 + 风险登记 + 决策记录）。release-rollout 是 SOP，本文是真实状态 | 想知道 V3 哪步走完了 / 哪里卡住了 |
| [cutover-dd003.md](cutover-dd003.md) | DD-003（admin RPC 改造）cutover runbook — 2026-05-26 已执行，§5 reconcile / §6 DROP 仍 BLOCKED（等真实流量积累 72h） | 跑 DD-003 §5/§6 收尾时 / 查 admin RPC cutover 历史细节 |
| [reset-and-vault-switch-runbook.md](reset-and-vault-switch-runbook.md) | 重置流程 + 测试金库 → 正式金库切换 SOP（10 节完整步骤 + 双层回滚） | 正式上线前需要清干净 prod DB + 切到正式金库时 |
| [monitoring-alerts.md](monitoring-alerts.md) | 监控指标设计（监听器游标 / Worker leader / anomaly 告警的指标定义 + Lark webhook 集成） | 配 Grafana 阈值 / 排查告警噪音 / 改告警规则 |

---

## 历史归档（archive/）

[`archive/`](archive/) 下的文档不再维护，但有外部链接和决策追溯价值，**不要删**。

| 文件 | 何时弃用 / 被谁替代 |
|---|---|
| [archive/deploy-cutover.md](archive/deploy-cutover.md) | 2026-05-26 早期版 V3 部署稿。被 `cutover-dd003.md`（admin RPC cutover 实战 SOP）+ `reset-and-vault-switch-runbook.md`（金库切换 SOP）联合替代 |
| [archive/dd003-secrets-checklist.md](archive/dd003-secrets-checklist.md) | DD-003 cutover 前的密钥配置 checklist。2026-05-26 cutover 完成后密钥已配齐，本文不再需要新配 |
| [archive/deploy-state-audit-2026-05-27.md](archive/deploy-state-audit-2026-05-27.md) | 2026-05-27 一次性架构审计（发现 presale-worker 在 prod 没真部署 + INC-002 migration 漏跑根因）。问题已 close，审计本身作为决策快照保留 |

---

## 常见任务 → 该读哪个

| 你想做的事 | 入口文档 |
|---|---|
| "我要上线预售模块" | [release-rollout-plan.md](release-rollout-plan.md) → [tasks.md](tasks.md) 看当前进度 |
| "切到正式金库 + 清干净测试数据" | [reset-and-vault-switch-runbook.md](reset-and-vault-switch-runbook.md) |
| "改 admin DB schema / DROP 旧 audit 表" | [cutover-dd003.md §6](cutover-dd003.md) |
| "改告警阈值 / 增加新监控指标" | [monitoring-alerts.md](monitoring-alerts.md) |
| "查 INC-002 怎么发生的" | [archive/deploy-state-audit-2026-05-27.md](archive/deploy-state-audit-2026-05-27.md) §3 |
| "看 V3 实施全过程的决策记录" | [tasks.md §8](tasks.md) 决策记录章节 |

---

## 关联（本目录之外）

- [`../`](../) — DD-INVEST V3 设计文档根目录（架构 / 数据模型 / API 契约 / 测试报告）
- [`../adr/`](../adr/) — 长期 ADR（架构决策记录）
- [`../testing/`](../testing/) — 测试方案 + 真链 e2e 报告
- [`../../incidents/`](../../incidents/) — 上线后的 INC 复盘（INC-001 / INC-002 等）
- [`../../design/`](../../design/) — 待 APPROVE 的 ENH 增强需求（ENH-002/003/004）
- [`../../../scripts/`](../../../scripts/) — 部署相关 shell 脚本（redeploy / standard-deploy / verify-* / backup）
