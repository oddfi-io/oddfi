# ADR-0001: admin-backend 不直连 prod business DB

**状态**：Accepted
**日期**：2026-05-26
**关联**：[DD-002（被废弃）](../../../../../oddfi-admin-backend/.claude/worktrees/presale-admin-impl/docs/presale-admin/DD-002-admin-dual-dsn.md) · [DD-003 v3](../DD-003-admin-rpc-rework.md)

## 背景

DD-002 方案 A 尝试让 admin-backend 跨主机直连 web-api 的 prod MySQL（双 DSN）。两轮 critic 审查后判定该方案是"分布式单体反模式"：
1. Schema-coupling 双向锁定（web-api 改字段 admin 必须同步）
2. GORM model 漂移风险
3. WAL 兜底是 over-engineering + 明文 PII 落盘新合规风险
4. `:3306` 公网暴露不可上 prod

DD-003 选择 RPC 方案：admin-backend 退化为薄壳，所有业务读写通过 web-api 暴露的 internal endpoint 完成。

## 决策

**永久禁止 admin-backend 直接连接 prod business DB（`oddfi` 库）**。

任何「admin 后台需要访问/操作新业务表」的需求，**必须**通过以下路径满足：
1. 在 web-api 仓库新增 internal endpoint（路径前缀 `/internal/admin/*`）
2. 在 web-api 进程内完成 business + audit 同事务写入
3. admin-backend 通过 HTTP client 调用，不直接 GORM 操作业务表

## 后果

### 正面
- audit 与 business 强一致（同事务原子性，无 WAL / 两阶段需求）
- prod MySQL 永远只绑定 127.0.0.1，无公网攻击面
- admin-backend 退化为「Lark OAuth + RBAC + HTTP forward」薄壳，schema 责任完全归 web-api
- web-api 升级 schema 时不需要协调 admin-backend 同步

### 负面
- admin-backend → web-api 多一次 HTTP 调用 RTT（admin 流量 < 5 QPS，~10ms 无感知）
- web-api 进程需新增 17 个 internal endpoint + service-to-service 鉴权（HMAC）+ 共享 admin JWT secret
- admin-backend 故障对 admin 操作可用性的隔离消失（admin EC2 挂了 admin 操作也挂）—— 这本来就是事实

### 长期
- TGE+30 天复评是否升级到 mTLS / gRPC（见 ADR-0002）
- 任何新增 admin 业务功能默认走 RPC，不接受"小功能直接加 admin DB 表"的捷径

## 替代方案（已否决）

| 方案 | 否决理由 |
|---|---|
| 双 DSN（DD-002 方案 A） | critic 两轮 STRATEGY_QUESTIONABLE |
| 同机部署（方案 D） | 失去故障域隔离；admin 资源争抢 web-api；当前部署沉没成本 |
| 完全裁掉 admin-backend（Lark OAuth 搬到 web-api） | admin EC2 / Nginx / TLS / Lark App redirect_uri 沉没成本太大；admin 前端需重写 |
| gRPC + service mesh | 团队规模 < 5 人，复杂度不抵收益 |

## 例外

无。任何例外需新写 ADR 覆盖。
