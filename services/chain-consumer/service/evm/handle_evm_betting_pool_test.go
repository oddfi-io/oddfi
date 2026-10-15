package evm

import (
	"chain-consumer/internal/mysql"
	"context"
	"fmt"
	"testing"

	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// MySQL 连接参数（如需调整，改这里）
// ============================================================
const (
	testBetPlacedMysqlDSN = "root:admin888@tcp(127.0.0.1:3306)/chain_consumer?charset=utf8mb4&parseTime=True&loc=Local"

	// 测试用 onchain_tx_orders 行的默认字段值（避开 NOT NULL 校验，仅 tx_hash / onchain_bet_id 是测试关心字段）
	testBetPlacedUserID      = uint64(900001)
	testBetPlacedChain       = "bsc"
	testBetPlacedOp          = "place_bet"
	testBetPlacedRequestJSON = "{}"
	testBetPlacedIdemKeyTpl  = "test-bp-%s" // 拼具体用例后缀
)

func setupBetPlacedTestDB(t *testing.T) {
	err := mysql.InitMysql(testBetPlacedMysqlDSN)
	require.NoError(t, err, "failed to init mysql")
	require.NotNil(t, mysql.GetDB(), "mysql db should not be nil")
}

// 用最小字段插入 onchain_tx_orders（其它 NOT NULL 字段用默认值/占位值）
func insertTestOnchainTxOrder(t *testing.T, idemKey, txHash string) {
	err := mysql.GetDB().Exec(`
		INSERT INTO onchain_tx_orders
			(user_id, chain, op, idempotency_key, tx_hash, request_json)
		VALUES
			(?, ?, ?, ?, ?, ?)`,
		testBetPlacedUserID,
		testBetPlacedChain,
		testBetPlacedOp,
		idemKey,
		txHash,
		testBetPlacedRequestJSON,
	).Error
	require.NoError(t, err, "failed to insert onchain_tx_orders")
}

func cleanupOnchainTxOrdersByTxHash(t *testing.T, txHashes ...string) {
	if len(txHashes) == 0 {
		return
	}
	err := mysql.GetDB().Exec("DELETE FROM onchain_tx_orders WHERE tx_hash IN ?", txHashes).Error
	require.NoError(t, err)
}

func queryOnchainBetID(t *testing.T, txHash string) string {
	var got *string
	err := mysql.GetDB().
		Raw("SELECT onchain_bet_id FROM onchain_tx_orders WHERE tx_hash = ? LIMIT 1", txHash).
		Scan(&got).Error
	require.NoError(t, err)
	if got == nil {
		return ""
	}
	return *got
}

func countOnchainTxOrdersByTxHash(t *testing.T, txHash string) int64 {
	var count int64
	err := mysql.GetDB().
		Raw("SELECT COUNT(*) FROM onchain_tx_orders WHERE tx_hash = ?", txHash).
		Scan(&count).Error
	require.NoError(t, err)
	return count
}

// 构造一个填充为 seed 的 [32]byte，便于检查回写值是否正确
func makeBetIDBytes(seed byte) [32]byte {
	var b [32]byte
	for i := range b {
		b[i] = seed
	}
	return b
}

// 构造一个测试用的 tx_hash（0x + 64 字符），seed 决定填充
func makeTestTxHash(seed byte) string {
	return "0x" + fmt.Sprintf("%064x", []byte{seed})
}

func TestHandleEvmBettingPool(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	setupBetPlacedTestDB(t)

	svc := &EVMService{
		ctx:   context.Background(),
		Chain: testEvmChain,
		db:    mysql.GetDB(),
	}
	ctx := context.Background()

	t.Run("TC01-单条命中-onchain_bet_id被回填为 common.Hash.Hex()", func(t *testing.T) {
		txHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

		// idemKey := fmt.Sprintf(testBetPlacedIdemKeyTpl, "tc01")

		// defer cleanupOnchainTxOrdersByTxHash(t, txHash)
		// insertTestOnchainTxOrder(t, idemKey, txHash)

		betIdBytes := makeBetIDBytes(0xaa)
		expectedBetID := eth_common.Hash(betIdBytes).Hex()

		err := svc.handleEvmBetPlaced(ctx, []*betPlacedInfo{
			{
				Txid:  txHash,
				BetId: betIdBytes,
			},
		})
		assert.NoError(t, err)

		got := queryOnchainBetID(t, txHash)
		assert.Equal(t, expectedBetID, got, "onchain_bet_id should be filled with common.Hash(BetId).Hex()")
		assert.Len(t, got, 66, "bet id should be 0x + 64 hex chars")
	})

	t.Run("TC02-tx_hash未命中-不报错且无写入", func(t *testing.T) {
		txHash := makeTestTxHash(0x22)
		// 不插入数据

		betIdBytes := makeBetIDBytes(0xbb)

		err := svc.handleEvmBetPlaced(ctx, []*betPlacedInfo{
			{Txid: txHash, BetId: betIdBytes},
		})
		assert.NoError(t, err, "missing tx_hash should not error")

		assert.Equal(t, int64(0), countOnchainTxOrdersByTxHash(t, txHash), "no row should exist for unmatched tx_hash")
	})

	t.Run("TC03-批量混合-命中行被更新-未命中不影响整体", func(t *testing.T) {
		hitTx := makeTestTxHash(0x33)
		missTx := makeTestTxHash(0x44)
		idemKey := fmt.Sprintf(testBetPlacedIdemKeyTpl, "tc03")

		defer cleanupOnchainTxOrdersByTxHash(t, hitTx, missTx)
		insertTestOnchainTxOrder(t, idemKey, hitTx)

		hitBetIdBytes := makeBetIDBytes(0xcc)
		missBetIdBytes := makeBetIDBytes(0xdd)
		expectedHitBetID := eth_common.Hash(hitBetIdBytes).Hex()

		err := svc.handleEvmBetPlaced(ctx, []*betPlacedInfo{
			{Txid: hitTx, BetId: hitBetIdBytes},
			{Txid: missTx, BetId: missBetIdBytes},
		})
		assert.NoError(t, err)

		assert.Equal(t, expectedHitBetID, queryOnchainBetID(t, hitTx))
		assert.Equal(t, int64(0), countOnchainTxOrdersByTxHash(t, missTx))
	})

	t.Run("TC04-同tx_hash多行-应全部被更新", func(t *testing.T) {
		txHash := makeTestTxHash(0x55)

		defer cleanupOnchainTxOrdersByTxHash(t, txHash)
		insertTestOnchainTxOrder(t, fmt.Sprintf(testBetPlacedIdemKeyTpl, "tc04-a"), txHash)
		insertTestOnchainTxOrder(t, fmt.Sprintf(testBetPlacedIdemKeyTpl, "tc04-b"), txHash)

		betIdBytes := makeBetIDBytes(0xee)
		expectedBetID := eth_common.Hash(betIdBytes).Hex()

		err := svc.handleEvmBetPlaced(ctx, []*betPlacedInfo{
			{Txid: txHash, BetId: betIdBytes},
		})
		assert.NoError(t, err)

		var betIDs []string
		require.NoError(t,
			mysql.GetDB().
				Raw("SELECT onchain_bet_id FROM onchain_tx_orders WHERE tx_hash = ?", txHash).
				Scan(&betIDs).Error,
		)
		require.Equal(t, 2, len(betIDs), "should match 2 rows for the same tx_hash")
		for _, v := range betIDs {
			assert.Equal(t, expectedBetID, v, "every row sharing the tx_hash should be updated")
		}
	})

	t.Run("TC05-空入参-直接返回", func(t *testing.T) {
		err := svc.handleEvmBetPlaced(ctx, []*betPlacedInfo{})
		assert.NoError(t, err)
	})
}
