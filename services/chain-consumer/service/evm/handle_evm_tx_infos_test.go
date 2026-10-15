package evm

import (
	"chain-consumer/global"
	"chain-consumer/internal"
	"chain-consumer/internal/mysql"
	redispkg "chain-consumer/internal/redis"
	"chain-consumer/internal/tracelog"
	"chain-consumer/utils"
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var (
	testEvmDB      *gorm.DB
	testEvmRedis   *redis.Client
	testEvmService *EVMService
	testEvmCtx     context.Context
	testEvmCancel  context.CancelFunc
)

const (
	testEvmChain = internal.ChainBsc
)

func setupEvmLogger() {
	tracelog.InitLogger("test")
	tracelog.InitTrace("test", "evm-service-test")
}

func setupTestEvmDB(t *testing.T) {
	dsn := "root:admin888@tcp(127.0.0.1:3306)/chain_consumer?charset=utf8mb4&parseTime=True&loc=Local"
	err := mysql.InitMysql(dsn)
	require.NoError(t, err, "failed to init mysql")

	testEvmDB = mysql.GetDB()
	require.NotNil(t, testEvmDB, "mysql db should not be nil")
}

func setupTestEvmRedis(t *testing.T) {
	redisCfg := global.RedisConfig{
		Addr:     "127.0.0.1:6379",
		Password: "",
		DB:       1,
		PoolSize: 10,
	}

	err := redispkg.InitRedis(redisCfg)
	require.NoError(t, err, "failed to init redis")

	testEvmRedis = redispkg.GetClient()
	require.NotNil(t, testEvmRedis, "redis client should not be nil")
}

func setupTestEvmService(t *testing.T) {
	testEvmService = &EVMService{
		ctx:   testEvmCtx,
		Chain: testEvmChain,
		db:    testEvmDB,
		redis: testEvmRedis,
	}
}

func cleanupEvmTestData(t *testing.T, userID uint64) {
	if testEvmDB != nil {
		testEvmDB.Exec("DELETE FROM asset_ledger WHERE user_id = ?", userID)
		testEvmDB.Exec("DELETE FROM deposit_record WHERE user_id = ?", userID)
		testEvmDB.Exec("DELETE FROM user_balance WHERE user_id = ?", userID)
		testEvmDB.Exec("DELETE FROM user_deposit_address WHERE user_id = ?", userID)
	}
}

func cleanupEvmRedisAddresses(t *testing.T, addresses []string) {
	if testEvmRedis != nil {
		redisKey := utils.GetRedisDepositAddressesKey(testEvmChain.String())
		testEvmRedis.SRem(context.Background(), redisKey, addresses).Result()
	}
}

func addressesToInterface(addresses []string) []interface{} {
	result := make([]interface{}, len(addresses))
	for i, addr := range addresses {
		result[i] = addr
	}
	return result
}

func createEvmTestUser(t *testing.T, userID uint64, depositAddress string) {
	err := testEvmDB.Exec("DELETE FROM user_deposit_address WHERE address = ?", depositAddress).Error
	require.NoError(t, err)

	depositAddr := mysql.UserDepositAddress{
		UserID:  userID,
		Address: depositAddress,
		Chain:   testEvmChain.String(),
	}
	err = testEvmDB.Create(&depositAddr).Error
	require.NoError(t, err, "failed to create user deposit address")
}

func createEvmTestUserBalance(t *testing.T, userID uint64, initialBalance decimal.Decimal) {
	err := testEvmDB.Exec("DELETE FROM user_balance WHERE user_id = ?", userID).Error
	require.NoError(t, err)

	balance := mysql.UserBalance{
		UserID:           userID,
		AvailableBalance: initialBalance,
		FrozenBalance:    decimal.Zero,
		StakeLockBalance: decimal.Zero,
		LiqLockBalance:   decimal.Zero,
		UpdateTime:       time.Now(),
	}
	err = testEvmDB.Create(&balance).Error
	require.NoError(t, err, "failed to create test user balance")
}

func addDepositAddressToRedis(t *testing.T, addresses []string) {
	redisKey := utils.GetRedisDepositAddressesKey(testEvmChain.String())
	if testEvmRedis == nil {
		panic("testEvmRedis is nil")
	}
	t.Logf("redisKey:%s, addresses:%v", redisKey, addresses)
	_, err := testEvmRedis.SAdd(context.Background(), redisKey, addresses).Result()
	if err != nil {
		panic(err)
	}
	// require.NoError(t, err, "failed to add deposit addresses to redis")
}

// newEvmtxInfo 构造一条 evmtxInfo。入参 value 用人类单位(便于阅读)，内部 Shift(18) 转成链上原始 wei，
// 与真实 checkBscReceipts 产出的 evmtxInfo 一致(handleEvmTxInfos 会再 formatTxValue 回人类单位)。
func newEvmtxInfo(from, to string, value decimal.Decimal, blockNumber uint64, txId string) *evmtxInfo {
	return &evmtxInfo{
		Token:       "0xtoken",
		From:        from,
		to:          to,
		Value:       value.Shift(bscCheckToken1Decimal),
		BlockNumber: blockNumber,
		TxId:        txId,
	}
}

func TestHandleEvmTxInfos(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	setupTestEvmDB(t)
	setupTestEvmRedis(t)
	setupTestEvmService(t)

	t.Run("TC01-无充值地址直接返回", func(t *testing.T) {
		txInfos := []*evmtxInfo{
			newEvmtxInfo("0xaaa", "0xbbb", decimal.NewFromFloat(100), 1, "tx001"),
			newEvmtxInfo("0xccc", "0xddd", decimal.NewFromFloat(200), 1, "tx002"),
		}

		err := testEvmService.handleEvmTxInfos(testEvmCtx, txInfos)
		assert.NoError(t, err, "should return nil when no deposit addresses")

		// 验证没有写入任何数据
		var ledgerCount int64
		testEvmDB.Model(&mysql.AssetLedger{}).Count(&ledgerCount)
		assert.Equal(t, int64(0), ledgerCount)
	})

	t.Run("TC02-单笔充值正常处理", func(t *testing.T) {
		userID := uint64(300001)
		depositAddr := "0x1111111111111111111111111111111111111111"
		fromAddr := "0x2222222222222222222222222222222222222222"

		defer cleanupEvmTestData(t, userID)
		defer cleanupEvmRedisAddresses(t, []string{depositAddr})

		// 准备测试数据
		// 初始化userId映射表，user_id 对应 depositAddr存在 user_deposit_address
		createEvmTestUser(t, userID, depositAddr)
		// 初始化资金100
		createEvmTestUserBalance(t, userID, decimal.NewFromFloat(100.0))
		// 初始化redis充值地址记录
		addDepositAddressToRedis(t, []string{depositAddr})

		depositAmount := decimal.NewFromFloat(50.5)
		txInfos := []*evmtxInfo{
			newEvmtxInfo(fromAddr, depositAddr, depositAmount, 100, "tx_deposit_001"),
		}

		err := testEvmService.handleEvmTxInfos(testEvmCtx, txInfos)
		assert.NoError(t, err, "deposit should be processed successfully")

		// 验证 deposit_record
		var depositRecord mysql.DepositRecord
		err = testEvmDB.Where("tx_id = ?", "tx_deposit_001").First(&depositRecord).Error
		assert.NoError(t, err, "should find deposit record")
		assert.Equal(t, userID, depositRecord.UserID)
		assert.True(t, depositRecord.Amount.Equal(depositAmount))

		// 验证 user_balance 更新
		var userBalance mysql.UserBalance
		err = testEvmDB.Where("user_id = ?", userID).First(&userBalance).Error
		assert.NoError(t, err)
		expectedBalance := decimal.NewFromFloat(150.5)
		assert.True(t, userBalance.AvailableBalance.Equal(expectedBalance),
			"balance should be %s, got %s", expectedBalance.String(), userBalance.AvailableBalance.String())

		// 验证 asset_ledger
		var ledger mysql.AssetLedger
		err = testEvmDB.Where("ref_id = ?", "tx_deposit_001").First(&ledger).Error
		assert.NoError(t, err)
		assert.Equal(t, userID, ledger.UserID)
		assert.Equal(t, "deposit", ledger.BusinessType)
		assert.True(t, ledger.Amount.Equal(depositAmount))
	})

	t.Run("TC03-单笔归集正常处理", func(t *testing.T) {
		userID := uint64(300002)
		depositAddr := "0x3333333333333333333333333333333333333333"
		toAddr := "0x4444444444444444444444444444444444444444"

		defer cleanupEvmTestData(t, userID)
		defer cleanupEvmRedisAddresses(t, []string{depositAddr})

		// 准备测试数据
		createEvmTestUser(t, userID, depositAddr)
		createEvmTestUserBalance(t, userID, decimal.NewFromFloat(200.0))
		addDepositAddressToRedis(t, []string{depositAddr})

		transferAmount := decimal.NewFromFloat(30.0)
		txInfos := []*evmtxInfo{
			newEvmtxInfo(depositAddr, toAddr, transferAmount, 101, "tx_collect_001"),
		}

		err := testEvmService.handleEvmTxInfos(testEvmCtx, txInfos)
		assert.NoError(t, err, "collect transfer should be processed successfully")

		// 验证 deposit_record (归集也写入 deposit_record)
		var depositRecord mysql.DepositRecord
		err = testEvmDB.Where("tx_id = ?", "tx_collect_001").First(&depositRecord).Error
		assert.NoError(t, err, "should find deposit record for collect transfer")
		assert.Equal(t, userID, depositRecord.UserID)

		// 验证 user_balance 未更新（归集不更新余额）
		var userBalance mysql.UserBalance
		err = testEvmDB.Where("user_id = ?", userID).First(&userBalance).Error
		assert.NoError(t, err)
		assert.True(t, userBalance.AvailableBalance.Equal(decimal.NewFromFloat(200.0)),
			"balance should remain unchanged after collect transfer")

		// 验证无 asset_ledger（归集不记录流水）
		var ledgerCount int64
		testEvmDB.Model(&mysql.AssetLedger{}).Where("ref_id = ?", "tx_collect_001").Count(&ledgerCount)
		assert.Equal(t, int64(0), ledgerCount)
	})

	t.Run("TC04-混合交易同时有充值和归集", func(t *testing.T) {
		userID1 := uint64(300003)
		userID2 := uint64(300004)
		depositAddr1 := "0x5555555555555555555555555555555555555555"
		depositAddr2 := "0x6666666666666666666666666666666666666666"
		externalAddr := "0x7777777777777777777777777777777777777777"

		defer cleanupEvmTestData(t, userID1)
		defer cleanupEvmTestData(t, userID2)
		defer cleanupEvmRedisAddresses(t, []string{depositAddr1, depositAddr2})

		// 准备测试数据 - 用户1
		createEvmTestUser(t, userID1, depositAddr1)
		createEvmTestUserBalance(t, userID1, decimal.NewFromFloat(100.0))

		// 准备测试数据 - 用户2
		createEvmTestUser(t, userID2, depositAddr2)
		createEvmTestUserBalance(t, userID2, decimal.NewFromFloat(200.0))

		// 添加到 Redis
		addDepositAddressToRedis(t, []string{depositAddr1, depositAddr2})

		txInfos := []*evmtxInfo{
			// 用户1充值
			newEvmtxInfo(externalAddr, depositAddr1, decimal.NewFromFloat(50.0), 102, "tx_mixed_001"),
			// 用户2归集
			newEvmtxInfo(depositAddr2, externalAddr, decimal.NewFromFloat(80.0), 103, "tx_mixed_002"),
		}

		err := testEvmService.handleEvmTxInfos(testEvmCtx, txInfos)
		assert.NoError(t, err, "mixed transactions should be processed successfully")

		// 验证用户1余额增加
		var user1Balance mysql.UserBalance
		err = testEvmDB.Where("user_id = ?", userID1).First(&user1Balance).Error
		assert.NoError(t, err)
		assert.True(t, user1Balance.AvailableBalance.Equal(decimal.NewFromFloat(150.0)))

		// 验证用户2余额不变
		var user2Balance mysql.UserBalance
		err = testEvmDB.Where("user_id = ?", userID2).First(&user2Balance).Error
		assert.NoError(t, err)
		assert.True(t, user2Balance.AvailableBalance.Equal(decimal.NewFromFloat(200.0)))

		// 验证都有 deposit_record
		var record1, record2 mysql.DepositRecord
		assert.NoError(t, testEvmDB.Where("tx_id = ?", "tx_mixed_001").First(&record1).Error)
		assert.NoError(t, testEvmDB.Where("tx_id = ?", "tx_mixed_002").First(&record2).Error)
	})

	t.Run("TC05-地址不在Redis但在DB中", func(t *testing.T) {
		userID := uint64(300005)
		depositAddr := "0x8888888888888888888888888888888888888888"
		fromAddr := "0x9999999999999999999999999999999999999999"

		defer cleanupEvmTestData(t, userID)

		// 准备 MySQL 数据但不添加到 Redis
		createEvmTestUser(t, userID, depositAddr)
		createEvmTestUserBalance(t, userID, decimal.NewFromFloat(100.0))

		txInfos := []*evmtxInfo{
			newEvmtxInfo(fromAddr, depositAddr, decimal.NewFromFloat(50.0), 104, "tx_noredis"),
		}

		err := testEvmService.handleEvmTxInfos(testEvmCtx, txInfos)
		assert.NoError(t, err, "should return nil when address not in redis")

		// 验证没有写入任何数据
		var ledgerCount int64
		testEvmDB.Model(&mysql.AssetLedger{}).Where("ref_id = ?", "tx_noredis").Count(&ledgerCount)
		assert.Equal(t, int64(0), ledgerCount)
	})

	t.Run("TC06-部分to地址有效", func(t *testing.T) {
		userID := uint64(300006)
		validDepositAddr := "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
		invalidDepositAddr := "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
		fromAddr := "0xcccccccccccccccccccccccccccccccccccccccccccc"

		defer cleanupEvmTestData(t, userID)
		defer cleanupEvmRedisAddresses(t, []string{validDepositAddr})

		// 准备测试数据
		createEvmTestUser(t, userID, validDepositAddr)
		createEvmTestUserBalance(t, userID, decimal.NewFromFloat(100.0))
		addDepositAddressToRedis(t, []string{validDepositAddr})

		txInfos := []*evmtxInfo{
			// 有效的充值
			newEvmtxInfo(fromAddr, validDepositAddr, decimal.NewFromFloat(30.0), 105, "tx_valid"),
			// 无效的充值（地址不在 Redis）
			newEvmtxInfo(fromAddr, invalidDepositAddr, decimal.NewFromFloat(40.0), 106, "tx_invalid"),
		}

		err := testEvmService.handleEvmTxInfos(testEvmCtx, txInfos)
		assert.NoError(t, err, "should process valid transactions")

		// 验证只有有效交易被处理
		var validRecord mysql.DepositRecord
		err = testEvmDB.Where("tx_id = ?", "tx_valid").First(&validRecord).Error
		assert.NoError(t, err, "valid deposit should be processed")

		var invalidRecordCount int64
		testEvmDB.Model(&mysql.DepositRecord{}).Where("tx_id = ?", "tx_invalid").Count(&invalidRecordCount)
		assert.Equal(t, int64(0), invalidRecordCount, "invalid deposit should not be processed")

		// 验证余额只增加有效部分
		var userBalance mysql.UserBalance
		err = testEvmDB.Where("user_id = ?", userID).First(&userBalance).Error
		assert.NoError(t, err)
		assert.True(t, userBalance.AvailableBalance.Equal(decimal.NewFromFloat(130.0)))
	})

	t.Run("TC07-用户ID为0的异常处理", func(t *testing.T) {
		depositAddr := "0xdddddddddddddddddddddddddddddddddddddddd"

		defer cleanupEvmRedisAddresses(t, []string{depositAddr})

		// 只添加到 Redis，不添加到 MySQL user_deposit_address 表
		addDepositAddressToRedis(t, []string{depositAddr})

		txInfos := []*evmtxInfo{
			newEvmtxInfo("0xeeee", depositAddr, decimal.NewFromFloat(50.0), 107, "tx_zero_user"),
		}

		// 方法应该正常返回，不报错（因为内部会跳过 userID=0 的记录）
		err := testEvmService.handleEvmTxInfos(testEvmCtx, txInfos)
		assert.NoError(t, err, "should handle zero userID gracefully")

		// 验证没有写入数据
		var ledgerCount int64
		testEvmDB.Model(&mysql.AssetLedger{}).Where("ref_id = ?", "tx_zero_user").Count(&ledgerCount)
		assert.Equal(t, int64(0), ledgerCount)
	})
}
