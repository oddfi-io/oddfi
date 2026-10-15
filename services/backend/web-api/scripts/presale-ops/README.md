# presale-ops 预案手册

预售异常处理预案脚本集合。当 admin 后台不可用、或需要通过 SSH 直接操作数据库时使用。

---

## 快速定位表

从 Lark 告警收到通知后，按 `anomaly_reason` 定位脚本：

| Lark 告警 anomaly_reason | 对应脚本 | 关键参数 |
|---|---|---|
| `unclaimed` | `unclaimed-credit.go` | `--event-id` `--resolution` `--target-round` |
| `overflow` | `overflow-handle.go` | `--event-id` `--mode` |
| `round_mismatch` / `late_arrival` | `late-arrival.go` | `--tx-hash` `--target-round` |
| 任意 confirmed deposit 需改轮次 | `migrate-round.go` | `--tx-hash` `--target-round` |
| 紧急暂停轮次（admin 不可用） | `round-pause.go` | `--round-id` |

---

## 环境配置

所有脚本从以下环境变量读取连接信息：

```bash
# 统一覆盖（最高优先级）
export PRESALE_OPS_DB_DSN="user:pass@tcp(host:3306)/oddfi?parseTime=true&loc=UTC&charset=utf8mb4"

# 或按环境分开配置
export ADMIN_DB_DSN="..."     # prod 环境（--env prod 时读此变量）

# Lark 告警推送（可选，不配置则脚本执行后不推 Lark 消息）
export PRESALE_LARK_WEBHOOK_URL="https://open.larksuite.com/open-apis/bot/v2/hook/..."
```

---

## 通用执行步骤

1. SSH 登录生产服务器
2. 进入项目目录：`cd /opt/oddfi-backend/web-api`
3. 按快速定位表选择脚本，先跑 dry-run：
   ```bash
   go run scripts/presale-ops/<script>.go [参数] --env prod
   ```
   脚本默认 `--dry-run=true`，只输出 before/after diff，不执行。

4. 确认 diff 输出无误（检查 round_id / amount / shares_odd 是否符合预期）

5. 加 `--dry-run=false` 重新运行，在提示处输入 `yes` 确认执行：
   ```bash
   go run scripts/presale-ops/<script>.go [参数] --dry-run=false --env prod
   ```

6. 检查返回 "执行成功" 消息

7. 验证 DB 变更和 Lark 消息推送到运营群

---

## 各脚本使用示例

### unclaimed-credit.go — 无主转账确认转单

```bash
# 演练
go run scripts/presale-ops/unclaimed-credit.go \
  --event-id 42 \
  --target-round seed \
  --resolution convert_to_deposit \
  --note "用户 0xUSR... 联系客服确认，归属种子轮" \
  --env prod

# 执行
go run scripts/presale-ops/unclaimed-credit.go \
  --event-id 42 \
  --target-round seed \
  --resolution convert_to_deposit \
  --note "用户 0xUSR... 联系客服确认，归属种子轮" \
  --dry-run=false --env prod
```

resolution 选项：
- `convert_to_deposit`：按目标轮次价格落 presale_deposit（confirmed）
- `reject`：关闭 ops_event（用户已退款）

### overflow-handle.go — 超额到账

```bash
go run scripts/presale-ops/overflow-handle.go \
  --event-id 55 \
  --mode partial_fill \
  --note "公轮A已售罄，按剩余容量部分入账，余额挂起" \
  --dry-run=false --env prod
```

mode 选项：
- `partial_fill`：按本轮剩余容量入账，超出部分记为新 overflow_remainder 事件
- `next_round`：全额标记进下轮（需后续联动确认入账）
- `hold`：挂账，等运营决策

### late-arrival.go — 跨轮次兜底

```bash
go run scripts/presale-ops/late-arrival.go \
  --tx-hash 0xabc123... \
  --target-round seed \
  --note "用户在种子轮 end_ts 前30s 付款，被错分到战略轮" \
  --dry-run=false --env prod
```

适用：`anomaly_reason = round_mismatch / late_arrival`，deposit 被分配到错误轮次。

### migrate-round.go — 通用轮次迁移

```bash
go run scripts/presale-ops/migrate-round.go \
  --tx-hash 0xdef456... \
  --target-round strategic \
  --note "运营确认该笔 deposit 应归属战略轮，手动迁移" \
  --dry-run=false --env prod
```

适用：任意 confirmed deposit 需要修改 round_id 的场景。

### round-pause.go — 紧急暂停轮次

```bash
go run scripts/presale-ops/round-pause.go \
  --round-id strategic \
  --note "临时暂停战略轮，等待大客户补单确认" \
  --dry-run=false --env prod
```

执行后设置 `manual_override=1`，cron 不再自动推进该轮次。

---

## 回滚说明

所有脚本操作均有 `presale_admin_audit` 记录，可查询操作前后状态：

```sql
-- 查看最近 10 条脚本操作记录
SELECT id, operator, action, target_type, target_id, note, created_at
FROM presale_admin_audit
WHERE source = 'script'
ORDER BY id DESC
LIMIT 10;

-- 查看某笔 deposit 的完整操作历史
SELECT * FROM presale_admin_audit
WHERE target_type = 'deposit' AND target_id = '<tx_hash>'
ORDER BY id;
```

**无自动回滚脚本**（链上数据已确认，数据库只能补偿操作）：

若需回滚 migrate-round 操作，根据 `before_json` 字段构造反向 migrate-round 命令，把 `round_id / price_usd / shares_odd` 改回原值。

---

## 注意事项

1. **--note 必填且 ≥ 10 字符**：少于 10 字符脚本直接 exit(1)，不执行任何 DB 操作
2. **默认 dry-run**：脚本默认 `--dry-run=true`，不传参数只输出 diff，不实际执行
3. **事务保证**：所有变更在单一事务内执行（包括 audit 写入），失败自动回滚
4. **幂等性**：`unclaimed-credit.go` 的 convert_to_deposit 使用 `ON DUPLICATE KEY UPDATE id=id`，重复执行安全
5. **Lark 推送异步**：脚本 Commit 后异步推送 Lark 通知，不影响主流程退出码

---

## Claude Code Skill 集成

安装了 `.claude/skills/presale-ops/SKILL.md` 后，可通过自然语言描述触发脚本生成：

```
用户：「有用户的 50000U 转账没入账」
Claude：识别为 unclaimed 场景，询问缺失参数，生成 dry-run 命令
```

详见 `.claude/skills/presale-ops/SKILL.md`。
