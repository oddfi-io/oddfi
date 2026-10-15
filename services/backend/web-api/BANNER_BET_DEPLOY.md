# Banner 下注接口上线说明

本文档覆盖 `POST /account/banner_bet_place` 和 `GET /account/banner_bet_holding` 两个新增接口的建表、发布和验收。

## 1. 功能范围

- `banner_bet_place`：首页 Banner 的真钱单注接口，落库同时真实扣减 `available_balance`、增加 `bet_lock_balance`，并写入 `asset_ledger`。
- `banner_bet_holding`：查询当前用户最近 50 条 Banner 下注记录。
- Banner 玩法限定为 `B1~B5`，分别对应 PRD 中的冠军盘、球员进球数、MVP、金靴、金手套。

## 2. 数据库变更

生产库执行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS banner_bet_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  client_ref_id VARCHAR(64) NOT NULL,
  banner_code VARCHAR(8) NOT NULL,
  market_id BIGINT NOT NULL,
  selection_id BIGINT NOT NULL,
  market VARCHAR(64) NOT NULL,
  selection VARCHAR(128) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'banner_single',
  status VARCHAR(20) NOT NULL DEFAULT 'live',
  stake DECIMAL(16,2) NOT NULL,
  odds DECIMAL(8,4) NOT NULL,
  payout DECIMAL(16,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_banner_bet_user_ref (user_id, client_ref_id),
  KEY idx_banner_bet_user_created (user_id, created_at),
  KEY idx_banner_bet_banner_code (banner_code),
  KEY idx_banner_bet_market_id (market_id),
  KEY idx_banner_bet_selection_id (selection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

开发环境如果使用 `dev` 配置，请同步创建 `banner_bet_order_dev`，表结构一致。

## 3. 发布步骤

1. 合并代码并确认应用配置使用的数据库账号有 `CREATE/ALTER/INSERT/SELECT/UPDATE` 权限。
2. 先在目标环境执行建表 SQL。
3. 如果 `banner_bet_order` 已经按旧版本 SQL 建过表，请补充执行：

```sql
ALTER TABLE banner_bet_order
  MODIFY COLUMN type VARCHAR(20) NOT NULL DEFAULT 'banner_single';

UPDATE banner_bet_order
SET type = 'banner_single'
WHERE type = 'single';
```

开发环境如果存在 `banner_bet_order_dev` 旧表，也请同步执行同样的变更。
4. 执行 `go test ./internal/service ./internal/handler`，确认新增自测通过。
5. 构建并发布服务镜像。
6. 发布完成后检查应用日志，确认没有 `BannerBetPlace`、`CreateBannerBetOrder` 或 `BannerBetHolding` 相关报错。

## 4. 接口验收

示例下注请求：

```bash
curl -X POST 'http://{host}/account/banner_bet_place' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "banner_code": "B1",
    "market_id": 10001,
    "selection_id": 20001,
    "market": "champion_winner",
    "selection": "Argentina",
    "stake": "20",
    "odds": "3.25",
    "ref_id": "banner-b1-arg-20260424-01"
  }'
```

示例查询请求：

```bash
curl 'http://{host}/account/banner_bet_holding' \
  -H 'Authorization: Bearer {token}'
```

可选 SQL 验证：

```sql
SELECT id, user_id, banner_code, market_id, selection_id, market, selection, stake, odds, payout, status
FROM banner_bet_order
WHERE user_id = {user_id}
ORDER BY created_at DESC
LIMIT 20;
```

```sql
SELECT business_type, amount, balance_before, balance_after, bet_lock_before, bet_lock_after, ref_id, created_at
FROM asset_ledger
WHERE user_id = {user_id} AND business_type = 'banner_single'
ORDER BY created_at DESC
LIMIT 20;
```

```sql
SELECT available_balance, bet_lock_balance
FROM user_balance
WHERE user_id = {user_id};
```

## 5. 回滚方案

- 应用回滚：直接回滚到旧版本镜像即可，新增表不会影响旧接口。
- 数据回滚：如需清理测试数据，可按 `client_ref_id` 或 `created_at` 删除对应记录。
