# ISSUE-005 · `deposit_confirmed` Lark 推送从未触发 — worker confirm 路径漏调 service 层

- **状态**：**Resolved**（代码 ✅ + 部署 ✅；首笔真链上入金触发后即可观察到 Lark 卡片）— 2026-05-28
- **严重度**：**Medium**（运营感知缺失：入金确认后运营 Lark 群收不到卡片，但资金入账、份额记账均正确，不阻断业务）
- **类型**：Lark 通知 / worker confirm 路径漏发推
- **主要仓库**：`oddfi-backend/web-api`（`internal/chain/` + `internal/service/`）；前端 `oddfi-admin-frontend` **无需改动**
- **发现日期**：2026-05-28
- **基于 web-api commit**：`0a8d62a`

## 修复进展（2026-05-28 代码级核验）

**修复 commit**：`9af6440`（`fix(presale): ISSUE-005 worker confirm 路径补发 deposit_confirmed Lark 推送`），已合入 web-api `main`。代码级验证 **正确且彻底**：

- ✅ **事务外发推**：`internal/chain/presale_listener.go` 在 `processLog` 的 `l.db.Transaction(...)` 返回 nil **之后**调 `l.depositSvc.NotifyDepositConfirmed(notifyDeposit)`（约 491–494 行）；`notifyDeposit` 仅在 tx 闭包最末一行（约 483 行）赋值 → rollback / 早退路径自然不发推，规避了 race。
- ✅ **两条路径都覆盖**：isNew=true（链上首见直接 INSERT confirmed）与 isNew=false（pending→confirmed）确认后都会发推。
- ✅ **无重复推送**：service 层 `doConfirm` 改为复用 `NotifyDepositConfirmed`（DRY）；ReportTx 与 worker 两条入口互斥 + DB `uk_(tx_hash, log_index)` 唯一约束，正常运行不重复推。
- ✅ **测试**：新增 4 条 ISSUE-005 用例（isNew 两路发推 / 幂等重确认不推 / tx rollback 不推）全 PASS；`go build ./...` + `go test ./...` 全绿。

**部署已闭环（2026-05-28 02:07 prod）**：

- ✅ **镜像**：`hankdong/account-web-api:prod_issue005_v1`（web-api 02:07:21、presale-worker 02:07:39 启动）。
- ✅ **二进制符号**：`NotifyDepositConfirmed`（修复新增函数）在 web-api/worker 各命中 2 处（接口 + 实现），旧版镜像不可能有此符号 → 部署生效。
- ⏳ **运行时**：等首笔真链上 USDT→vault 入金触发,worker 30s 内扫到 → 运营 Lark 群应出现 `deposit_confirmed` 卡片。**纯等输入,与部署是否生效无关。**
- 现象里那 2 笔 `block_timestamp=0` 的历史数据疑似脚本写入、不走 listener，**不会补推**；是否手动补由运营定（需单独脚本，本修复不覆盖）。

---

## 现象

运营后台「入账记录」页可见至少 2 笔 `status=confirmed` 入金（EOA `0x75ec…f579`，金额 0.05/0.1 USDT，`createdAt≈1779867959957`），但运营 Lark 群**从未收到** `deposit_confirmed` 卡片推送。

| 字段 | 值 | 备注 |
|---|---|---|
| `status` | `confirmed` | 入账正常 |
| `block_timestamp` | `0`（UI 显示 1970-01-01 08:00） | 疑似脚本/手工写入 |
| `block_number` | `0` | 同上 |
| `round_id` | `seed` | 非链上轮次 |
| `source` | 待 prod 查（预期 `script`） | 见验证命令 §4 |

---

## 根因（逐行确认）

### 发推代码的位置

发推代码**仅存在于** `service.ConfirmDeposit` 的内部闭包 `doConfirm`：

```
web-api/internal/service/presale_deposit_impl.go:714-715
  s.larkAlerter.SendAnomalyAlert(LarkEvent{EventType: "deposit_confirmed", ...})
```

该 `SendAnomalyAlert` 调用位于 `doConfirm` 末尾（step 7），只有通过 `service.ConfirmDeposit` 入口才会执行。

### worker 实际调用链（不发推）

`chain/presale_listener.go` 的 `processLog` 大事务（`l.db.Transaction`，第 342 行）走的是：

**路径 A — `isNew=true`（链上首见，Worker 直接 INSERT confirmed）**

```
presale_listener.go:343-369  deposit.Status = model.PresaleDepositStatusConfirmed  (INSERT 直接 confirmed)
presale_listener.go:372      existing, isNew, err := l.depositRepo.CreateOrGet(ctx, tx, deposit)
→ isNew=true，跳过 !isNew 分支
→ 事务在 presale_listener.go:472 return nil 结束，无任何 SendAnomalyAlert 调用
```

**路径 B — `isNew=false`（前端先上报 pending，worker 推进）**

```
presale_listener.go:378-384
  if !isNew {
      if existing.Status == model.PresaleDepositStatusPending {
          l.depositRepo.ConfirmDeposit(ctx, tx, existing.ID, confirmedAt)  // repository 层，仅 UPDATE status
      }
  }
→ 调用的是 depositRepo.ConfirmDeposit（repository 层），只执行 UPDATE，无 SendAnomalyAlert
→ 事务在 presale_listener.go:472 return nil 结束，无任何 SendAnomalyAlert 调用
```

### 命名撞车

`ConfirmDeposit` 同时存在于：
- `repository.PresaleDepositRepo.ConfirmDeposit`：仅 `UPDATE status=confirmed`，无发推
- `service.PresaleDepositService.ConfirmDeposit`：含完整 step 1-7，step 7 发推

`presale_listener.go:366` 的注释写"两条路径会师点：… ConfirmDeposit（pending→confirmed）"，但实际调用的是 **repository 层**，而非 service 层。命名一致性导致意图与实现脱节，发推代码从未执行。

### 正确 vs 实际调用链对比

```
应有（发推）:
  processLog → depositSvc.ConfirmDeposit → doConfirm
    → depositRepo.ConfirmDeposit (UPDATE)
    → IncrSoldAndRaised
    → holdingRepo.UpsertInvest
    → larkAlerter.SendAnomalyAlert("deposit_confirmed") ✅

实际（不发推）:
  processLog → depositRepo.CreateOrGet
    → (isNew=true)  INSERT status=confirmed → IncrSoldAndRaised → UpsertInvest → return nil ❌
    → (isNew=false) depositRepo.ConfirmDeposit (仅 UPDATE) → IncrSoldAndRaised → UpsertInvest → return nil ❌
```

---

## 为何这 2 笔历史数据不会补推

这 2 笔 `block_timestamp=0`、`block_number=0`、`round_id=seed`，强烈指向**脚本/手工 SQL 写入**，从未经过 `processLog` 链路。即使上述 bug 已修复，这 2 笔也不会触发新推送。是否补推由运营手动决定（见 §历史数据）。

---

## 修复方向

在 `processLog` 事务 **commit 成功之后**（`l.db.Transaction` 返回 nil 后、事务外）补发推送。

**必须事务外**：`SendAnomalyAlert` 本身是异步 goroutine，但若在事务内调用，外层 rollback 时已发出的推送无法撤回（race），与 `presale_deposit_impl.go:704` 注释的已知风险一致。

推荐做法：给 `PresaleDepositService` 接口暴露 `NotifyDepositConfirmed(dep *model.PresaleDeposit)`，内部复用现有 `larkAlerter.SendAnomalyAlert`；`processLog` 在事务返回 nil 后调用一次。详见交接工单 `.progress/stash/ISSUE-005-webapi-deposit-confirmed-fix-spec.md`。

---

## Prod 验证命令

```sql
-- 1. 确认这 2 笔的写入来源
SELECT id, tx_hash, source, status, block_timestamp, block_number, round_id, created_at
FROM presale_deposit WHERE eoa_address='0x75ec…f579' ORDER BY created_at DESC LIMIT 10;
-- 期望：source='script' 或手工，block_timestamp=0，block_number=0

-- 2. webhook 是否已配置
SELECT id, lark_webhook_url IS NOT NULL AS has_webhook FROM presale_config WHERE id=1;
```

```bash
# 3. 确认发推代码从未执行（应无 deposit_confirmed 日志行）
docker logs <web-api> 2>&1 | grep -E "deposit_confirmed|\[LarkWebhookService\]"

# 4. presale-worker（chain listener）是否正常扫块
docker logs <presale-worker> 2>&1 | grep "\[PresaleListener\]" | tail -20
```

---

## 次级问题（不阻断修复）

`lark_webhook.go` webhook 失败时仅 `logger.Warnf`，不上报错误。修复主因后可酌情加监控，但不是本次 P0。

---

## 前端侧

**无需改动。** 前端「入账记录」展示数据来自 `/admin/presale/deposits`（直接查 DB），入账记账均正确；Lark 推送纯后端链路，前端无感知也无法补救。
