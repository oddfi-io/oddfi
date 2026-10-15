package evm

import (
	"chain-consumer/internal/mysql"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testBettingPool = "0x7baa77cff4ea502f7fff554ad422dfbd957bf291"
	testStakingPool = "0x05e971c8283c1da923b07d2812c9c1af7aa8080a"
	testLiqPool     = "0x0f7a2dc0666578e7f6456a287a50f95e40e6a3fa"
	testOddToken    = "0x4655079a3b35a68443ffa90a54a4ab89e34d04d0"
)

// makeBalanceTestService 构造带 OddFi 余额相关字段的测试服务。
func makeBalanceTestService() *EVMService {
	return &EVMService{
		ctx:             testEvmCtx,
		Chain:           testEvmChain,
		db:              testEvmDB,
		redis:           testEvmRedis,
		bettingPoolAddr: testBettingPool,
		poolAddrs: map[string]struct{}{
			testBettingPool: {},
			testStakingPool: {},
			testLiqPool:     {},
		},
		betTaxBps:  100, // 1%
		checkToken: testOddToken,
	}
}

// rawODD 把人类单位金额(字符串)转成链上原始 wei 的 NullDecimal(ODD 18 位)。
func rawODD(human string) decimal.NullDecimal {
	return decimal.NullDecimal{Decimal: decimal.RequireFromString(human).Shift(18), Valid: true}
}

// uoaRow 构造一条 user_onchain_action 行(填满 NOT NULL 列)。
func uoaRow(userAddr, actionType, txHash string, logIndex uint, amount, amount2 decimal.NullDecimal) *mysql.UserOnchainAction {
	return &mysql.UserOnchainAction{
		UserAddress:     strings.ToLower(userAddr),
		ActionType:      actionType,
		Amount:          amount,
		AmountSecondary: amount2,
		ChainID:         97,
		ContractAddress: testBettingPool,
		BlockNumber:     1,
		BlockTime:       time.Now(),
		TxHash:          strings.ToLower(txHash),
		LogIndex:        logIndex,
		BlockHash:       "0x00000000000000000000000000000000000000000000000000000000000000ab",
	}
}

func cleanupBalanceTestData(userID uint64, userAddr string) {
	if testEvmDB == nil {
		return
	}
	testEvmDB.Exec("DELETE FROM asset_ledger WHERE user_id = ?", userID)
	testEvmDB.Exec("DELETE FROM user_balance WHERE user_id = ?", userID)
	testEvmDB.Exec("DELETE FROM user_deposit_address WHERE user_id = ?", userID)
	testEvmDB.Exec("DELETE FROM user_onchain_action WHERE user_address = ?", strings.ToLower(userAddr))
}

// setupBalanceUser 建用户充值地址映射 + 初始余额。
func setupBalanceUser(t *testing.T, userID uint64, magicAddr string, available decimal.Decimal) {
	cleanupBalanceTestData(userID, magicAddr)
	require.NoError(t, testEvmDB.Create(&mysql.UserDepositAddress{
		UserID:  userID,
		Address: strings.ToLower(magicAddr),
		Chain:   testEvmChain.String(),
	}).Error)
	require.NoError(t, testEvmDB.Create(&mysql.UserBalance{
		UserID:           userID,
		AvailableBalance: available,
		FrozenBalance:    decimal.Zero,
		StakeLockBalance: decimal.Zero,
		LiqLockBalance:   decimal.Zero,
		UpdateTime:       time.Now(),
	}).Error)
}

func getBalance(t *testing.T, userID uint64) mysql.UserBalance {
	var ub mysql.UserBalance
	require.NoError(t, testEvmDB.Where("user_id = ?", userID).First(&ub).Error)
	return ub
}

func TestHandleUserActionsBalance(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	setupTestEvmDB(t)
	setupTestEvmRedis(t)
	svc := makeBalanceTestService()
	ctx := context.Background()

	t.Run("TC01-下注扣含税(C:同tx Transfer)", func(t *testing.T) {
		userID := uint64(400001)
		magic := "0x1000000000000000000000000000000000000001"
		setupBalanceUser(t, userID, magic, decimal.RequireFromString("100"))
		defer cleanupBalanceTestData(userID, magic)

		tx := "0xbet0000000000000000000000000000000000000000000000000000000000001"
		// 同 tx：magic -> betting_pool 转出 50.5 ODD(含税)
		betDebits := svc.buildBetDebits([]*evmtxInfo{
			{From: magic, to: testBettingPool, Value: decimal.RequireFromString("50.5").Shift(18), TxId: tx},
		})
		batch := &oddfiBatch{userEvents: []*userEvent{
			{row: uoaRow(magic, "BET_PLACED", tx, 0, rawODD("50"), decimal.NullDecimal{})}, // acceptedAmount=50
		}}

		require.NoError(t, svc.handleUserActions(ctx, batch, betDebits))

		ub := getBalance(t, userID)
		// 100 - 50.5 = 49.5；不进 bet 锁定
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("49.5")),
			"available want 49.5 got %s", ub.AvailableBalance)

		var lg mysql.AssetLedger
		require.NoError(t, testEvmDB.Where("user_id = ? AND business_type = ?", userID, "bet_placed").First(&lg).Error)
		assert.True(t, lg.Amount.Equal(decimal.RequireFromString("-50.5")), "ledger amount want -50.5 got %s", lg.Amount)
	})

	t.Run("TC02-下注扣含税(D:配置税率兜底)", func(t *testing.T) {
		userID := uint64(400002)
		magic := "0x1000000000000000000000000000000000000002"
		setupBalanceUser(t, userID, magic, decimal.RequireFromString("100"))
		defer cleanupBalanceTestData(userID, magic)

		tx := "0xbet0000000000000000000000000000000000000000000000000000000000002"
		// 无匹配 transfer → 兜底：50 * (1+100/10000) = 50.5
		batch := &oddfiBatch{userEvents: []*userEvent{
			{row: uoaRow(magic, "BET_PLACED", tx, 0, rawODD("50"), decimal.NullDecimal{})},
		}}
		require.NoError(t, svc.handleUserActions(ctx, batch, map[string]*betDebit{}))

		ub := getBalance(t, userID)
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("49.5")),
			"available want 49.5 (fallback) got %s", ub.AvailableBalance)
	})

	t.Run("TC03-领奖/退款加余额", func(t *testing.T) {
		userID := uint64(400003)
		magic := "0x1000000000000000000000000000000000000003"
		setupBalanceUser(t, userID, magic, decimal.RequireFromString("10"))
		defer cleanupBalanceTestData(userID, magic)

		batch := &oddfiBatch{userEvents: []*userEvent{
			{row: uoaRow(magic, "BET_CLAIMED", "0xclaim00000000000000000000000000000000000000000000000000000000003", 0, rawODD("90"), decimal.NullDecimal{})},
			{row: uoaRow(magic, "BET_REFUNDED", "0xrefund0000000000000000000000000000000000000000000000000000000003", 1, rawODD("5"), decimal.NullDecimal{})},
		}}
		require.NoError(t, svc.handleUserActions(ctx, batch, nil))

		ub := getBalance(t, userID)
		// 10 + 90 + 5 = 105
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("105")),
			"available want 105 got %s", ub.AvailableBalance)
	})

	t.Run("TC04-质押 available<->stake_lock", func(t *testing.T) {
		userID := uint64(400004)
		magic := "0x1000000000000000000000000000000000000004"
		setupBalanceUser(t, userID, magic, decimal.RequireFromString("100"))
		defer cleanupBalanceTestData(userID, magic)

		// 质押 30：available 100->70, stake_lock 0->30
		batch1 := &oddfiBatch{userEvents: []*userEvent{
			{row: uoaRow(magic, "STAKE_CREATED", "0xstk000000000000000000000000000000000000000000000000000000000004", 0, rawODD("30"), decimal.NullDecimal{})},
		}}
		require.NoError(t, svc.handleUserActions(ctx, batch1, nil))
		ub := getBalance(t, userID)
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("70")), "available want 70 got %s", ub.AvailableBalance)
		assert.True(t, ub.StakeLockBalance.Equal(decimal.RequireFromString("30")), "stake_lock want 30 got %s", ub.StakeLockBalance)

		// 解质押：本金30 + 收益3 → available 70->103, stake_lock 30->0
		batch2 := &oddfiBatch{userEvents: []*userEvent{
			{row: uoaRow(magic, "STAKE_WITHDRAWN", "0xunstk00000000000000000000000000000000000000000000000000000000004", 1, rawODD("30"), rawODD("3"))},
		}}
		require.NoError(t, svc.handleUserActions(ctx, batch2, nil))
		ub = getBalance(t, userID)
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("103")), "available want 103 got %s", ub.AvailableBalance)
		assert.True(t, ub.StakeLockBalance.Equal(decimal.Zero), "stake_lock want 0 got %s", ub.StakeLockBalance)
	})

	t.Run("TC05-流动性 available<->liq_lock(含盈亏)", func(t *testing.T) {
		userID := uint64(400005)
		magic := "0x1000000000000000000000000000000000000005"
		setupBalanceUser(t, userID, magic, decimal.RequireFromString("100"))
		defer cleanupBalanceTestData(userID, magic)

		// 存入 40：available 100->60, liq_lock 0->40
		b1 := &oddfiBatch{userEvents: []*userEvent{
			{row: uoaRow(magic, "LIQUIDITY_DEPOSITED", "0xliq000000000000000000000000000000000000000000000000000000000005", 0, rawODD("40"), decimal.NullDecimal{})},
		}}
		require.NoError(t, svc.handleUserActions(ctx, b1, nil))
		ub := getBalance(t, userID)
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("60")), "available want 60 got %s", ub.AvailableBalance)
		assert.True(t, ub.LiqLockBalance.Equal(decimal.RequireFromString("40")), "liq_lock want 40 got %s", ub.LiqLockBalance)

		// 提取：withdrawAmount=45, netPnl=5 → 本金=40。available 60->105, liq_lock 40->0
		b2 := &oddfiBatch{userEvents: []*userEvent{
			{row: uoaRow(magic, "LIQUIDITY_WITHDRAWN", "0xliqw00000000000000000000000000000000000000000000000000000000005", 1, rawODD("45"), rawODD("5"))},
		}}
		require.NoError(t, svc.handleUserActions(ctx, b2, nil))
		ub = getBalance(t, userID)
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("105")), "available want 105 got %s", ub.AvailableBalance)
		assert.True(t, ub.LiqLockBalance.Equal(decimal.Zero), "liq_lock want 0 got %s", ub.LiqLockBalance)
	})

	t.Run("TC06-返佣ODD加余额, USDT不动余额", func(t *testing.T) {
		userID := uint64(400006)
		magic := "0x1000000000000000000000000000000000000006"
		setupBalanceUser(t, userID, magic, decimal.RequireFromString("0"))
		defer cleanupBalanceTestData(userID, magic)

		batch := &oddfiBatch{userEvents: []*userEvent{
			{row: uoaRow(magic, "REFERRAL_CLAIMED", "0xref000000000000000000000000000000000000000000000000000000000006", 0, rawODD("7"), decimal.NullDecimal{})},
			{row: uoaRow(magic, "REFERRAL_CLAIMED_USDT", "0xrefu00000000000000000000000000000000000000000000000000000000006", 1, rawODD("3"), rawODD("12"))},
		}}
		require.NoError(t, svc.handleUserActions(ctx, batch, nil))

		ub := getBalance(t, userID)
		// 仅 +7(ODD)，USDT 不计
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("7")), "available want 7 got %s", ub.AvailableBalance)
		// USDT 那条仍写审计行
		var cnt int64
		testEvmDB.Model(&mysql.UserOnchainAction{}).Where("action_type = ? AND user_address = ?", "REFERRAL_CLAIMED_USDT", magic).Count(&cnt)
		assert.Equal(t, int64(1), cnt, "USDT referral should still be audited")
	})

	t.Run("TC07-幂等:重投同一批余额只加一次", func(t *testing.T) {
		userID := uint64(400007)
		magic := "0x1000000000000000000000000000000000000007"
		setupBalanceUser(t, userID, magic, decimal.RequireFromString("100"))
		defer cleanupBalanceTestData(userID, magic)

		mkBatch := func() *oddfiBatch {
			return &oddfiBatch{userEvents: []*userEvent{
				{row: uoaRow(magic, "BET_CLAIMED", "0xidem00000000000000000000000000000000000000000000000000000000007", 0, rawODD("20"), decimal.NullDecimal{})},
			}}
		}
		require.NoError(t, svc.handleUserActions(ctx, mkBatch(), nil))
		require.NoError(t, svc.handleUserActions(ctx, mkBatch(), nil)) // 重投

		ub := getBalance(t, userID)
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("120")),
			"available want 120 (credited once) got %s", ub.AvailableBalance)

		var lgCount int64
		testEvmDB.Model(&mysql.AssetLedger{}).Where("user_id = ? AND business_type = ?", userID, "bet_claimed").Count(&lgCount)
		assert.Equal(t, int64(1), lgCount, "ledger should have exactly one bet_claimed row")
	})

	t.Run("TC08-派彩转入不被当充值(双计修复)", func(t *testing.T) {
		userID := uint64(400008)
		magic := "0x1000000000000000000000000000000000000008"
		setupBalanceUser(t, userID, magic, decimal.RequireFromString("100"))
		defer cleanupBalanceTestData(userID, magic)
		defer cleanupEvmRedisAddresses(t, []string{magic})
		addDepositAddressToRedis(t, []string{magic})

		// betting_pool -> magic 的转入(派彩)，from 是 Pool 合约 → 不应被当充值
		txInfos := []*evmtxInfo{
			newEvmtxInfo(testBettingPool, magic, decimal.RequireFromString("88"), 200, "0xpayout0000000000000000000000000000000000000000000000000000000008"),
		}
		require.NoError(t, svc.handleEvmTxInfos(ctx, txInfos))

		ub := getBalance(t, userID)
		assert.True(t, ub.AvailableBalance.Equal(decimal.RequireFromString("100")),
			"available should stay 100 (payout not credited as deposit) got %s", ub.AvailableBalance)
	})
}
