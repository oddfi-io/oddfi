# Migrations · 部署清单（DD-003 后强制）

> **每次 prod 部署都必须**：先列清单 → apply pending → 跑 `scripts/verify-migration.sh` 验证 → 才能进自检。
> 漏跑后果见 [INC-002](../docs/incidents/INC-002-2026-05-27-prod-migration-missed-on-cutover.md)。

## 当前 manifest（按 apply 顺序）

| Seq | 文件 | 创建的表 | 业务模块 | 单行 seed |
|-----|------|---------|---------|-----------|
| 0001 | `0001_create_presale_round.sql` | `presale_round` | DD-INVEST V3 | — |
| 0002 | `0002_create_presale_deposit.sql` | `presale_deposit` | DD-INVEST V3 | — |
| 0003 | `0003_create_presale_config.sql` | `presale_config` | DD-INVEST V3 | ✅ `INSERT IGNORE id=1` |
| 0004 | `0004_create_presale_holding.sql` | `presale_holding` | DD-INVEST V3 | — |
| 0005 | `0005_create_presale_event_cursor.sql` | `presale_event_cursor` | DD-INVEST V3 worker | — |
| 0006 | `0006_create_presale_ops_event.sql` | `presale_ops_event` | DD-INVEST V3 异常 | — |
| 0007 | `0007_create_user_referral_code.sql` | `user_referral_code` | 邀请码站点级 | — |
| 0008 | `0008_create_user_referral_bind.sql` | `user_referral_bind` | 邀请绑定 | — |
| 0009 | `0009_create_presale_admin_audit.sql` | `presale_admin_audit` | DD-003 admin RPC | — |
| 0010 | `0010_create_admin_idempotency.sql` | `admin_idempotency` | DD-003 admin RPC | — |
| 0011 | `0011_create_inv6_backfill_applied.sql` | `inv6_backfill_applied` | BUG-001 回填工具去重表 | — |
| 0012 | `0012_create_presale_kol_referral_pct.sql` | `presale_kol_referral_pct` | REQ-004 KOL 自定义返佣 | — |

**期望表数**：12 张（presale_* 8 张 + user_referral_* 2 张 + admin_idempotency + inv6_backfill_applied）

**期望 seed**：`presale_config` 必须有且仅有 1 行（PK=1），`vault_address` 长度 = 42。

## 添加新 migration 时

1. 新文件命名 `NNNN_<verb>_<entity>.sql`，编号紧接上一个
2. **同步更新本表** + `scripts/verify-migration.sh` 的 `EXPECTED_TABLES` 数组
3. 改 model 层 GORM struct（`internal/model/*.go`）
4. 跑 dev → verify-migration.sh 通过 → 进 PR

## 应用方式

### Dev / Test（本地或测试库）

```bash
export MYSQL_PWD=<dev_pwd>
for f in web-api/migrations/00*_*.sql; do
  echo "apply $f"
  mysql -h 127.0.0.1 -u root project_oddfi_dev < "$f"
done
```

### Prod（必须，cutover 流程的一部分）

见 [`docs/dd-invest/ops/cutover-dd003.md` §2.1](../docs/dd-invest/ops/cutover-dd003.md#21-跑-migration-含验证)。

**永远不要**手动跑一部分 migration 就标 "verify migration" 完成 — 必须跑 `verify-migration.sh` 拿到全绿 exit 0 才算。

## 自动化（计划中）

ENH-003 跟踪「cmd/server 启动时自动 apply pending migration」— 当前手工，未来下沉到代码侧。
