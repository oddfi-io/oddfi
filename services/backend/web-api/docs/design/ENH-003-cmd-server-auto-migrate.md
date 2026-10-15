# ENH-003: cmd/server 启动时自动 apply pending migration

**状态**：DRAFT
**日期**：2026-05-27
**关联**：[INC-002](../incidents/INC-002-2026-05-27-prod-migration-missed-on-cutover.md) action item A1
**作者**：khan（DD-INVEST 总督导） + AI

## 背景与触发

INC-002 暴露：DD-003 cutover 时 8 张 prod 业务表全部漏跑 migration，潜伏 12h 才被发现。

**根因之一**：没有自动化 migration runner，全靠手工 `scp + mysql client` 逐文件 apply。任何一个文件遗漏不会有 build-time / start-time 报错，只会在第一次查询时抛 `Error 1146`。

短期已通过 AI 基建（`.claude/rules/migration-deploy.md` + `scripts/verify-migration.sh`）封住流程口子。

**长期方案**：在 `cmd/server` 启动时自动 apply pending migration，从根上消除「漏跑」可能。

## 目标 / 非目标

### 目标

- `cmd/server` 启动时自动检测 `migrations/` 下未应用的 SQL 文件，按编号顺序 apply
- 提供 `--migrate-only` flag 仅 apply 不启服务（CI / 灰度用）
- 通过 `schema_migrations` 表追踪已应用版本（标准 golang-migrate 表结构）
- 启动失败时清晰报错（哪个 migration 失败 + SQL 内容 + 错误），不让服务以缺表状态对外服务
- 兼容 `presale_worker`（worker 启动时也走同样路径）

### 非目标

- ❌ Schema drift 检测（不验 prod 实际 schema 和 migration 文件一致 — 留给运维 audit）
- ❌ Down migration / rollback DDL（CREATE TABLE 不可逆，rollback 走 RDS snapshot）
- ❌ Migration 内 INSERT/UPDATE 数据迁移的事务保证（目前 migration 都是 DDL，未来扩展再说）

## 设计方案

### 选型

| 候选 | star | 推荐？ |
|---|---|---|
| **golang-migrate/migrate** | 14k | ✅ 推荐 — 业界标准，支持 mysql/postgres/sqlite，CLI + Go API 双接口 |
| pressly/goose | 5.3k | 备选 — 更轻量但社区较小，不支持 .sql 文件之间的 statement-level 拆分 |
| 自研 | — | ❌ 不推荐 — INC-002 已证明手工方案不可靠，重新写一个不会更可靠 |

**决策**：用 `golang-migrate/migrate`，Go API 集成进 `cmd/server`。

### 数据流

```
cmd/server 启动
  ↓
1. 连 DB（用现有 config.Database 凭据）
  ↓
2. m, _ := migrate.NewWithDatabaseInstance("file://migrations", "mysql", driver)
  ↓
3. m.Up()
     ├─ 没有 pending → no-op，log "all migrations applied (current version=NNNN)"
     ├─ 有 N 个 pending → 按序 apply，每个完成 log
     └─ 失败 → log SQL + 错误，os.Exit(1)（不要让服务以缺表状态启动）
  ↓
4. 跑 verify checks（presale_config 单行 seed）
     ├─ 缺 → log warn + os.Exit(1)
     └─ OK → 继续
  ↓
5. 正常启动 HTTP server / worker
```

### 配置项

`config.yaml` 加：

```yaml
migration:
  enabled: true       # 默认 true；ci 跑测试可设 false 用预建 schema
  dir: "migrations"   # 相对 binary 路径
  fail_on_dirty: true # 上次 migration 失败留下的 dirty 状态是否阻止启动（推荐 true）
```

### 兼容性

- migrations 文件命名 `NNNN_<verb>_<entity>.sql` → 改成 golang-migrate 要求的 `NNNN_<name>.up.sql` 格式（无 down 文件）
- 现有 10 个文件需重命名 + 加 `schema_migrations` 表（首次启动自动建）
- 已应用的 prod / dev DB 需要 backfill `schema_migrations` 表（写一次性 SQL：`INSERT INTO schema_migrations VALUES (10, 0);`）

### 风险

| 风险 | 缓解 |
|---|---|
| 启动失败导致服务 down | RDS snapshot 在启动前已备份；回滚 binary 即可 |
| Migration 中途 panic 留 dirty 状态 | golang-migrate 自带 dirty 标记，下次启动会拒绝再次 apply 直到人工 `force` |
| 并发启动多个实例 | 单 EC2 单容器架构，无此问题；未来多实例需要 advisory lock |

## 实施计划

### P0（必做，2026-06-03 前）

- [ ] B0：引入 `github.com/golang-migrate/migrate/v4` 依赖
- [ ] B1：重命名 `migrations/000N_*.sql` → `000N_*.up.sql`
- [ ] B2：写一次性 backfill SQL `migrations/_backfill_schema_migrations.sql`（prod / dev 各跑一次）
- [ ] B3：`cmd/server/main.go` 启动流程加 migration step
- [ ] B4：`cmd/presale-worker/main.go` 同样加（启动顺序：先 migration 再 worker loop）
- [ ] B5：单测覆盖（用 testcontainers 起临时 mysql）
- [ ] B6：dev 环境验证一轮完整 deploy

### P1（建议）

- [ ] `--migrate-only` flag（CLI 单纯应用不启服务）
- [ ] 更新 `cutover-dd003.md`：§2.1 替换为「跑 server binary 一次即可」
- [ ] 更新 `migration-deploy.md` 规则：自动化生效后 `verify-migration.sh` 仅作 belt-and-suspenders

### P2（可选）

- [ ] Schema drift 周期 audit（cron 跑 information_schema 对比）

## 验收标准

- [ ] dev 环境干净库启动一次 → 10 张表全建好 + `schema_migrations` 表 version=10
- [ ] 已 migrated 库二次启动 → no-op，log "all migrations applied"
- [ ] 故意删一张表后启动 → 自动重建
- [ ] migration SQL 故意写错 → 启动失败，log 含 SQL + 错误，dirty=1
- [ ] `verify-migration.sh` 在自动化生效后仍返 PASSED（双保险）

## 拒绝清单

- ❌ **GORM AutoMigrate**：会自动改字段类型，prod schema 漂移不可控
- ❌ **手工跑 migration runner CLI 而不集成进 server 启动**：仍依赖人记得跑，不解决 INC-002 根因
- ❌ **每次 cutover 重新 SCP 文件**：当前临时方案，长期被 ENH-003 替代

## 关联资料

- INC-002 root cause + 5 action items
- `.claude/rules/migration-deploy.md` — 短期 AI 基建（本 ENH 实施后可放宽）
- `web-api/scripts/verify-migration.sh` — 短期手工 verify（本 ENH 实施后仅做 belt-and-suspenders）
- golang-migrate docs: https://github.com/golang-migrate/migrate
