package evm

import (
	"chain-consumer/internal/mysql"
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 这些用例验证 BetCashedOut 回写原 place_bet 行（settlement_status='CASHED_OUT'）的语义：
// 写入、幂等、不覆盖已结算、betId 未回填时不报错，以及经 handleCashOutSettlements 的落库路径。
// 与现有 oddfi_balance_test 同套：依赖本地 chain_consumer 测试库，short 模式跳过。

const cashOutTestBetID = "0xc0de000000000000000000000000000000000000000000000000000000000001"

func cleanupCashOutRow(betID string) {
	if testEvmDB == nil {
		return
	}
	testEvmDB.Exec("DELETE FROM onchain_tx_orders WHERE onchain_bet_id = ?", betID)
}

// insertPlaceBetRow 预置一条 op='place_bet' 行，settlementStatus 传 "" 表示未结算。
func insertPlaceBetRow(t *testing.T, betID, settlementStatus string) {
	row := &mysql.OnchainTxOrder{
		UserID:           900001,
		Chain:            testEvmChain.String(),
		Op:               "place_bet",
		IdempotencyKey:   "test:cashout:" + betID,
		TxHash:           "0xbet11110000000000000000000000000000000000000000000000000000cafe1",
		Status:           "confirmed",
		RequestJSON:      "{}",
		OnchainBetID:     &betID,
		SettlementStatus: settlementStatus,
	}
	require.NoError(t, testEvmDB.Create(row).Error)
}

func getOnchainOrderByBetID(t *testing.T, betID string) mysql.OnchainTxOrder {
	var o mysql.OnchainTxOrder
	require.NoError(t, testEvmDB.Where("onchain_bet_id = ?", betID).First(&o).Error)
	return o
}

func TestCashOutSettlement(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	setupTestEvmDB(t)
	ctx := context.Background()
	settledAt := time.Date(2026, 6, 10, 12, 0, 0, 0, time.UTC)

	t.Run("TC01-写入CASHED_OUT", func(t *testing.T) {
		cleanupCashOutRow(cashOutTestBetID)
		defer cleanupCashOutRow(cashOutTestBetID)
		insertPlaceBetRow(t, cashOutTestBetID, "")

		rows, err := mysql.UpdateCashOutSettlementByBetID(ctx, cashOutTestBetID, "12500000000000000000", settledAt)
		require.NoError(t, err)
		assert.EqualValues(t, 1, rows)

		o := getOnchainOrderByBetID(t, cashOutTestBetID)
		assert.Equal(t, "CASHED_OUT", o.SettlementStatus)
		assert.Equal(t, "12500000000000000000", o.ActualPayoutWei)
		require.NotNil(t, o.SettledAt)
		assert.WithinDuration(t, settledAt, o.SettledAt.UTC(), time.Second)
	})

	t.Run("TC02-幂等重投不重复写", func(t *testing.T) {
		cleanupCashOutRow(cashOutTestBetID)
		defer cleanupCashOutRow(cashOutTestBetID)
		insertPlaceBetRow(t, cashOutTestBetID, "")

		rows1, err := mysql.UpdateCashOutSettlementByBetID(ctx, cashOutTestBetID, "10000000000000000000", settledAt)
		require.NoError(t, err)
		assert.EqualValues(t, 1, rows1)

		// 第二次：守卫 settlement_status 已非空 → 不再命中，金额保持第一次的值
		rows2, err := mysql.UpdateCashOutSettlementByBetID(ctx, cashOutTestBetID, "99999999999999999999", settledAt)
		require.NoError(t, err)
		assert.EqualValues(t, 0, rows2)

		o := getOnchainOrderByBetID(t, cashOutTestBetID)
		assert.Equal(t, "CASHED_OUT", o.SettlementStatus)
		assert.Equal(t, "10000000000000000000", o.ActualPayoutWei)
	})

	t.Run("TC03-不覆盖已结算WON", func(t *testing.T) {
		cleanupCashOutRow(cashOutTestBetID)
		defer cleanupCashOutRow(cashOutTestBetID)
		insertPlaceBetRow(t, cashOutTestBetID, "WON")

		rows, err := mysql.UpdateCashOutSettlementByBetID(ctx, cashOutTestBetID, "10000000000000000000", settledAt)
		require.NoError(t, err)
		assert.EqualValues(t, 0, rows)

		o := getOnchainOrderByBetID(t, cashOutTestBetID)
		assert.Equal(t, "WON", o.SettlementStatus, "已结算注单不能被 cash-out 覆盖")
	})

	t.Run("TC04-betId未回填时不报错", func(t *testing.T) {
		missing := "0xdead000000000000000000000000000000000000000000000000000000000099"
		cleanupCashOutRow(missing)
		rows, err := mysql.UpdateCashOutSettlementByBetID(ctx, missing, "10000000000000000000", settledAt)
		require.NoError(t, err)
		assert.EqualValues(t, 0, rows)
	})

	t.Run("TC05-经handleCashOutSettlements落库", func(t *testing.T) {
		cleanupCashOutRow(cashOutTestBetID)
		defer cleanupCashOutRow(cashOutTestBetID)
		insertPlaceBetRow(t, cashOutTestBetID, "")

		svc := &EVMService{ctx: ctx, Chain: testEvmChain, db: testEvmDB}
		err := svc.handleCashOutSettlements(ctx, []*cashOutUpdate{
			{betID: cashOutTestBetID, actualPayoutWei: "8000000000000000000", settledAt: settledAt},
		})
		require.NoError(t, err)

		o := getOnchainOrderByBetID(t, cashOutTestBetID)
		assert.Equal(t, "CASHED_OUT", o.SettlementStatus)
		assert.Equal(t, "8000000000000000000", o.ActualPayoutWei)
	})
}
