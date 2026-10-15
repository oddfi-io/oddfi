# Moneyline 测试环境建表部署说明

本文档用于在测试环境真实 MySQL 库创建 Moneyline 历史快照表和采集状态表。当前代码也会在 `oddfi-web-spider` 启动时通过 GORM `AutoMigrate` 尝试创建表，但测试环境部署建议先执行本文档的显式 DDL，确保字段类型、索引和表注释与 PRD 一致。

## 目标环境

- 服务：`oddfi-web-spider` 写入，`oddfi-web-api` 读取。
- 测试库：`project_oddfi_dev`。
- 表：
  - `oddfi_moneyline_snapshots`
  - `oddfi_moneyline_collection_status`
- DDL 文件：[moneyline_tables_dev.sql](moneyline_tables_dev.sql)

## 部署前检查

1. 确认当前要操作的是测试环境 MySQL，不要在生产库执行。
2. 确认 `oddfi-web-spider/config/config_dev.yaml` 和 `oddfi-web-api/config/config_dev.yaml` 指向同一个测试库。
3. 确认配置里的 `mysql.tables.moneyline_snapshots`、`mysql.tables.moneyline_collection_status` 如果未配置，会使用默认表名：
   - `oddfi_moneyline_snapshots`
   - `oddfi_moneyline_collection_status`
4. 建议先保存现有表结构快照：

```bash
mysql --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  -e "SHOW TABLES LIKE 'oddfi_moneyline%';"
```

## 执行建表

在仓库根目录执行：

```bash
mysql --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  < oddfi-web-spider/docs/moneyline_tables_dev.sql
```

不要把密码写进命令行或提交到仓库；交互式输入密码即可。

如果需要在 AWS 测试机上执行，先进入代码目录，再运行同一条命令：

```bash
cd /path/to/oddfi-backend
mysql --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  < oddfi-web-spider/docs/moneyline_tables_dev.sql
```

## 建表后校验

执行：

```bash
mysql --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  -e "SHOW CREATE TABLE oddfi_moneyline_snapshots\G"

mysql --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  -e "SHOW CREATE TABLE oddfi_moneyline_collection_status\G"
```

重点确认：

- `oddfi_moneyline_snapshots` 有索引：
  - `idx_fid_label_time (fixture_id, label, captured_at)`
  - `idx_captured_at (captured_at)`
  - `idx_fid_time (fixture_id, captured_at)`
- `oddfi_moneyline_collection_status` 有索引：
  - `idx_status_next (status, next_poll_at)`
- `captured_at`、`next_poll_at`、`updated_at` 都是 `DATETIME(3)`，保留毫秒精度。

## 部署服务

1. 部署包含 Moneyline 代码的 `oddfi-web-spider`。
2. 使用 `api` 模式启动 spider。该模式会同时启动原全量 fixture 同步和 Moneyline runner。
3. 部署包含 Moneyline history endpoint 的 `oddfi-web-api`。

## 运行状态验证

spider 启动后，先检查状态表是否开始生成记录：

```bash
mysql --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  -e "SELECT status, COUNT(*) AS cnt FROM oddfi_moneyline_collection_status GROUP BY status;"
```

检查是否有快照写入：

```bash
mysql --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  -e "SELECT fixture_id, label, COUNT(*) AS cnt, MIN(captured_at) AS first_at, MAX(captured_at) AS last_at FROM oddfi_moneyline_snapshots GROUP BY fixture_id, label ORDER BY last_at DESC LIMIT 20;"
```

验证三方快照是否成组写入：

```bash
mysql --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  -e "SELECT fixture_id, captured_at, COUNT(DISTINCT label) AS labels FROM oddfi_moneyline_snapshots GROUP BY fixture_id, captured_at HAVING labels <> 3 LIMIT 20;"
```

正常情况下，新写入的完整快照不会出现在最后一条查询结果中。

## API 验证

选择一个已有快照的 `fixture_id`：

```bash
FIXTURE_ID=$(mysql --batch --skip-column-names --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  -e "SELECT fixture_id FROM oddfi_moneyline_snapshots ORDER BY captured_at DESC LIMIT 1;")

curl "http://<dev-market-api-host>:8080/api/v1/moneyline/history/${FIXTURE_ID}"
curl "http://<dev-market-api-host>:8080/api/v1/moneyline/history/${FIXTURE_ID}?downsample=none"
```

响应中应包含：

- `data.home`
- `data.draw`
- `data.away`
- `data.fixture`

## 回滚说明

Moneyline 两张表只承载新增历史曲线能力，不影响原有赛事、下注、赔率表。测试环境如需回滚表结构：

```sql
DROP TABLE IF EXISTS oddfi_moneyline_collection_status;
DROP TABLE IF EXISTS oddfi_moneyline_snapshots;
```

回滚前如果需要保留历史快照，先导出：

```bash
mysqldump --protocol=tcp -h <dev-mysql-host> -u <dev-user> -p project_oddfi_dev \
  oddfi_moneyline_snapshots oddfi_moneyline_collection_status \
  > moneyline_backup_$(date +%Y%m%d_%H%M%S).sql
```
