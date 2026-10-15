# 设计文档（Design Docs）

本目录存放**非业务模块**的设计方案 — 基建、协作流程、安全策略、CI/CD 改造等跨场景的 ENH/DD。

业务专属 DD（如 DD-INVEST V3 那种）继续放在 `docs/dd-invest/` 之类的业务目录下。

## 命名规范

`{DD|ENH}-NNN-短描述.md`

- DD = Design Doc，新功能/新模块
- ENH = Enhancement，对现有基建/流程的改进
- 编号在「类型内」独立递增，不跳号、不重用
- 短描述用 kebab-case

## 模板必填章节

参考 `web-api/.claude/rules/dd-enh-workflow.md`。每篇 ENH 至少含：

1. **状态**（DRAFT / REVIEW / APPROVED / IN-PROGRESS / DONE）
2. **背景与触发**
3. **目标 / 非目标**
4. **设计方案**（含 ASCII 图、伪代码、数据流）
5. **实施计划**（P0/P1/P2 分阶段，每阶段含验收标准）
6. **验收标准**（可机查的 checklist）
7. **拒绝清单**（明确说哪些方案被否决 + 理由）
8. **关联资料**（事故、其他文档、外部信源）

## 索引

| 编号 | 标题 | 状态 | 关联事故 / 触发原因 |
|------|------|------|-------------------|
| [ENH-002](ENH-002-ai-ops-safety-guardrails.md) | AI 操作 prod 的轻量级护栏 | DRAFT | [INC-001](../incidents/INC-001-2026-05-26-rds-admin-password-rotation-broke-testnet.md) |
| [ENH-003](ENH-003-cmd-server-auto-migrate.md) | cmd/server 启动时自动 apply migration | DRAFT | [INC-002](../incidents/INC-002-2026-05-27-prod-migration-missed-on-cutover.md) |

> ENH-001 历史上是 nginx 反代设计，落在 OMC wiki 而非本目录。
