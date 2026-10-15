# ADR-0003: web-api 内部事务约定（admin 路径 tx-in-context 双范式）

**状态**：Accepted（已知 debt）
**日期**：2026-05-26
**关联**：[ADR-0001](ADR-0001-admin-rpc-not-shared-db.md) · [DD-003 v3](../DD-003-admin-rpc-rework.md)

## 背景

DD-003 v3 为 admin internal endpoint 引入 `internal/pkg/gormtx` helper，让 middleware 开 tx 注入 `context.Context`、service / repo 从 ctx 提取 tx 复用——满足「business + audit + idempotency 同事务原子」的合规需求。

但 web-api 现有 8 个用户接口（`/api/v1/presale/*`）和其他业务模块**未使用** tx-in-context 模式。这意味着 web-api 内部将并存两套事务约定：

1. **admin 路径**（新增）：middleware 开 tx 进 ctx → handler/service 从 ctx 拿 tx → middleware 提交
2. **用户路径**（沿用）：handler 直接调 `db.Transaction(fn)` 或 service 内自己开 tx

## 决策

**TGE 前接受双范式**：
- 新增 `/internal/admin/*` 路径强制用 `gormtx` 范式
- 现有 `/api/v1/*` 路径**不动**，沿用原有事务模式
- 在 `gormtx` package 文档头部明确：「本 helper 仅给 admin 路径用；用户路径请用 `db.Transaction(fn)`」
- 在 admin service 注释明确：「本 service 必须在 admin internal endpoint context 中调用，否则 `gormtx.From(ctx)` 返 nil 会崩」

## 后果

### 正面
- admin 合规需求（同 tx 原子）立即满足
- 用户接口零改动，不引入新 bug 风险
- TGE 前实施时间锁定

### 负面
- 同一 codebase 两套范式，新开发者上手成本翻倍
- service 层方法签名混乱：admin service 用 `(ctx context.Context)` 隐含 tx；用户 service 显式 `(tx *gorm.DB)`
- 跨范式重用（admin service 调用用户 service / vice versa）需做转换层

## 统一化计划

**TGE+30 天评估，TGE+60 天执行（如 ROI 划算）**：

将所有 web-api 业务统一到 `gormtx` 范式：
- handler / service 全部 `(ctx context.Context)` 签名
- repo 层保留 `(db *gorm.DB, ...)` 接收 tx 或裸 db（caller 责任决定传哪个）
- 跑 `go test ./...` 全过 + 现有 e2e 通过
- 工时估算：~20-30h（取决于用户路径事务复杂度）

**统一化触发条件**：
- 跨范式 bug 出现 ≥ 1 次
- 团队规模 ≥ 3 人（new joiner 上手成本可量化）

**不统一化的接受条件**：
- 双范式在 6 个月内未产生具体 bug
- admin 路径维护成本可接受（< 5h/月）

## 替代方案（已否决）

| 方案 | 否决理由 |
|---|---|
| 用户接口同步改造 tx-in-context | TGE 前工时不允许；改用户接口风险扩散 |
| admin 路径不用 ctx，handler 显式传 tx 进 service | service 签名变化大，多 service 调链层层加 tx 参数；中间件无法注入 |
| 完全靠 GORM 默认 transaction propagation | GORM 没有这个内置功能 |
