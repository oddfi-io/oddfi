# 设计 · BetCashedOut 回写 onchain_tx_orders 结算态（支撑 History「已取消」）

> 日期：2026-06-10 · 状态：已确认口径，待编码
> 关联仓库：`web-api`（History 展示侧，见其 `docs/2026-06-10-ENH-onchain-cashout-history-cancelled-design.md`）

---

## 1. 背景

用户对自己 Pending 的链上注单调 `cashOut(...)` 提前兑现/撤单，合约成功后发 `BetCashedOut` 事件并把 cashOutAmount（已扣 fee）转回用户 magic 钱包。

本项目（chain_consumer）**已经**索引该事件：
- `handle_user_action.go:108` `ParseBetCashedOut` → 写一条 `BET_CASHED_OUT` 进 `user_onchain_action`（审计）；
- `classifyBalance`（:467）→ 给中心化 `user_balance` 加 `cashOutAmount`（`bet_cashed_out`）。

**缺口**：没有任何地方把这笔兑现回写到 `onchain_tx_orders` 的原 `place_bet` 行。而 web-api 的 History 用 `onchain_tx_orders.settlement_status` 决定注单 tab（进行中/已结算）。结果：取消成功后注单永远卡在「进行中」。

## 2. 目标

索引 `BetCashedOut` 时，**额外 UPDATE 原 place_bet 行**为终态，让 web-api History 能把注单流转到「已结算 / 已取消」。

> 与现有「审计行 + 加余额」逻辑**并存、互不影响**：余额加减保持原有的 `InsertUserActionWithTx` 唯一键幂等；本次回写是独立的一条 UPDATE。

## 3. 事件字段（已实证）

`BetCashedOut`（`contract/bettingPool.json`）：

| 字段 | 类型 | indexed | 用途 |
|---|---|---|---|
| `betId` | bytes32 | ✓ | = `onchain_tx_orders.onchain_bet_id`，匹配键 |
| `marketId` | bytes32 | ✓ | （已用于审计行回填 match_id） |
| `user` | address | ✓ | （已用于审计/余额） |
| `remainingStake` | uint256 | | 释放的剩余本金（审计） |
| `cashOutAmount` | uint256 | | 用户实收 → 写 `actual_payout_wei` |
| `currentOdds` / `feeBps` / `quoteVersion` | | | （审计 extra） |

`betId` 与 web-api 写入的 `onchain_bet_id` 同口径（均为 `common.Hash(...).Hex()` 小写 0x），可精确匹配。

## 4. 详细设计

### 4.1 新增 repo 方法（`internal/mysql/onchain_tx_order.go`）

```go
// UpdateCashOutSettlementByBetID 把 BetCashedOut 回写到原 place_bet 行：标记已取消终态。
// 守卫 settlement_status 为空：① 幂等（重投不重复写）；② 绝不覆盖已由 spider 写入的 WON/LOST/PUSH/VOID。
// 返回受影响行数：0 表示注单尚未回填 betId 或已是终态，调用方记日志即可（最终一致靠重扫/重投）。
func UpdateCashOutSettlementByBetID(ctx context.Context, betID, actualPayoutWei string, settledAt time.Time) (int64, error) {
    db := GetDB()
    res := db.WithContext(ctx).Model(&OnchainTxOrder{}).
        Where("onchain_bet_id = ? AND op = ? AND (settlement_status IS NULL OR settlement_status = '')",
            betID, "place_bet").
        Updates(map[string]any{
            "settlement_status": "CASHED_OUT",
            "actual_payout_wei": actualPayoutWei,
            "settled_at":        settledAt,
            "updated_at":        settledAt,
        })
    return res.RowsAffected, res.Error
}
```

> `op='place_bet'` 是 web-api relay 写入的常量字面值（`model.OnchainTxOpPlaceBet`），与本项目 `handle_market_settlement.go` 里 `op` 字面值同源约定，硬编码字符串即可（本项目对 onchain_tx_orders 只声明自用列，不引 web-api 包）。

### 4.2 批次内收集（`service/evm/oddfi_action.go`）

`oddfiBatch` 增字段：

```go
// cashOuts BetCashedOut → UPDATE 原 place_bet 行的结算回写（与 settlementOrders 的 INSERT 不同，这是 UPDATE）。
cashOuts []*cashOutUpdate
```

```go
type cashOutUpdate struct {
    betID           string
    actualPayoutWei string    // cashOutAmount 原始 wei
    settledAt       time.Time // 区块时间
}
```

`empty()` 也把 `cashOuts` 纳入判断。

### 4.3 解析时 append（`service/evm/handle_user_action.go`）

在已有 `BET_CASHED_OUT` 分支（:108）里，写完审计行 userEvent 后顺手 append 一条 cashOutUpdate（事件已解析，零额外 RPC）：

```go
// 既要审计行/加余额（原有），也要回写原 place_bet 行结算态（新增）。
batch.cashOuts = append(batch.cashOuts, &cashOutUpdate{
    betID:           hashHex(e.BetId),
    actualPayoutWei: bigStr(e.CashOutAmount),
    settledAt:       meta.blockTime,
})
```

### 4.4 落库（`service/evm/evm.go`）

在现有并行 `eg.Go` 组里加一支（与 admin/user/settlement 并行）：

```go
eg.Go(func() error {
    if oddBatch != nil && len(oddBatch.cashOuts) > 0 {
        if err := s.handleCashOutSettlements(ctx, oddBatch.cashOuts); err != nil {
            return fmt.Errorf("failed to handle cash-out settlements: %w", err)
        }
    }
    return nil
})
```

handler（新增到 handle_user_action.go 或新文件 handle_cash_out.go）：

```go
func (s *EVMService) handleCashOutSettlements(ctx context.Context, items []*cashOutUpdate) error {
    tl := tracelog.NewWithContext(ctx)
    for _, it := range items {
        rows, err := mysql.UpdateCashOutSettlementByBetID(ctx, it.betID, it.actualPayoutWei, it.settledAt)
        if err != nil {
            tl.Errorf("cash-out settlement update failed, betId:%s, err:%v", it.betID, err)
            continue // 单条失败不阻断其余
        }
        if rows == 0 {
            // 注单还没回填 onchain_bet_id（BetPlaced 滞后）或已是终态 → 记一条 info，靠重扫/重投最终一致
            tl.Infof("cash-out settlement no row matched, betId:%s", it.betID)
            continue
        }
        tl.Infof("cash-out settlement written, betId:%s, payout_wei:%s, rows:%d", it.betID, it.actualPayoutWei, rows)
    }
    return nil
}
```

> **顺序无关性**：同一区块里若 BetPlaced 与 BetCashedOut 不会同块；betId 回填（`handleEvmBetPlaced`）与本回写在不同消息处理。若 cash-out 先于 betId 回填被处理（理论上不会，cash-out 必在下注之后若干区块），`rows==0` 不报错，等下一轮重扫/重投补上（守卫 settlement_status 为空保证可重入）。

## 5. 影响文件清单

| 文件 | 改动 |
|---|---|
| `internal/mysql/onchain_tx_order.go` | 加 `UpdateCashOutSettlementByBetID` |
| `service/evm/oddfi_action.go` | `oddfiBatch` 加 `cashOuts` + `cashOutUpdate` 类型 + `empty()` 纳入 |
| `service/evm/handle_user_action.go` | BET_CASHED_OUT 分支 append；加 `handleCashOutSettlements` |
| `service/evm/evm.go` | 并行组加一支调用 |

## 6. 测试方法

### 单元测试（`service/evm/oddfi_cashout_test.go`，新增）

沿用现有 `oddfi_balance_test.go` 的 DB 测试夹具（同一套 `GetDB()` + 测试库）：

| 用例 | 准备 | 断言 |
|---|---|---|
| `TestCashOut_WritesSettlement` | 预置一条 place_bet 行（onchain_bet_id=X, settlement_status 空）；构造含 BetCashedOut 的 batch | 处理后该行 `settlement_status='CASHED_OUT'`、`actual_payout_wei`=cashOutAmount、`settled_at` 非空 |
| `TestCashOut_Idempotent` | 同上，连续处理两次（重投） | 行仍为 CASHED_OUT，金额不变；第二次 RowsAffected=0 |
| `TestCashOut_DoesNotOverwriteSettled` | 预置 place_bet 行 settlement_status='WON' | 处理 BetCashedOut 后仍为 'WON'（守卫生效，RowsAffected=0） |
| `TestCashOut_NoRowWhenBetIdMissing` | 不预置 place_bet 行 | RowsAffected=0，不报错 |
| `TestCashOut_StillCreditsBalanceAndAudit` | 走 `handleUserActions` + cashOut handler | 审计行 BET_CASHED_OUT 存在、余额加 cashOutAmount（验证回写不破坏原有链路） |

### 手动联调（与 web-api 串）

见 web-api 文档 §7「手动验证」：dev 发起 cash_out → 看本服务日志 `cash-out settlement written` → web-api History 注单变「已取消」。

## 7. 回滚

纯增量，无 schema 变更（`settlement_status`/`actual_payout_wei`/`settled_at` 均为现有列）。回滚=回退本次提交，cash-out 仍会被审计+加余额（原有行为），只是不再回写 place_bet 行。
