package evm

import (
	"chain-consumer/global"
	"chain-consumer/internal"
	"chain-consumer/internal/mysql"
	redispkg "chain-consumer/internal/redis"
	"chain-consumer/internal/tracelog"
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var (
	testDB         *gorm.DB
	testRedis      *redis.Client
	testEVMService *EVMService
	testCtx        context.Context
	testCancel     context.CancelFunc
)

const (
	testChain = internal.ChainBsc
	// testCoinSymbol = "USDT"
)

func setupLogger() {
	tracelog.InitLogger("test")
	tracelog.InitTrace("test", "evm-service-test")
}

func setupTestDB(t *testing.T) {
	dsn := "root:admin888@tcp(127.0.0.1:3306)/chain_consumer?charset=utf8mb4&parseTime=True&loc=Local"
	err := mysql.InitMysql(dsn)
	require.NoError(t, err, "failed to init mysql")

	testDB = mysql.GetDB()
	require.NotNil(t, testDB, "mysql db should not be nil")

	err = testDB.Exec("CREATE DATABASE IF NOT EXISTS chain_consumer").Error
	require.NoError(t, err)

	testDB.Exec("USE chain_consumer")

	// err = testDB.AutoMigrate(&mysql.UserBalance{}, &mysql.AssetLedger{}, &mysql.DepositRecord{})
	// require.NoError(t, err, "failed to auto migrate")
}

func setupTestRedis(t *testing.T) {
	redisCfg := global.RedisConfig{
		Addr:     "127.0.0.1:6379",
		Password: "",
		DB:       1,
		PoolSize: 10,
	}

	err := redispkg.InitRedis(redisCfg)
	require.NoError(t, err, "failed to init redis")

	testRedis = redispkg.GetClient()
	require.NotNil(t, testRedis, "redis client should not be nil")
}

func setupTestEVMService(t *testing.T) {
	testEVMService = &EVMService{
		ctx:   testCtx,
		Chain: testChain,
		db:    testDB,
		redis: testRedis,
	}
}

// 清除测试痕迹
func cleanupTestData(t *testing.T, userID uint64) {
	if testDB != nil {
		testDB.Exec("DELETE FROM asset_ledger WHERE user_id = ?", userID)
		testDB.Exec("DELETE FROM user_balance WHERE user_id = ?", userID)
	}
}

func createTestUserBalance(t *testing.T, userID uint64, initialBalance decimal.Decimal) {
	err := testDB.Exec("DELETE FROM user_balance WHERE user_id = ?", userID).Error
	require.NoError(t, err)

	balance := mysql.UserBalance{
		UserID: userID,
		// CoinSymbol:       testCoinSymbol,
		AvailableBalance: initialBalance,
		FrozenBalance:    decimal.Zero,
		StakeLockBalance: decimal.Zero,
		LiqLockBalance:   decimal.Zero,
		UpdateTime:       time.Now(),
	}
	err = testDB.Create(&balance).Error
	require.NoError(t, err, "failed to create test user balance")
}

func TestMain(m *testing.M) {
	setupLogger()
	testCtx, testCancel = context.WithTimeout(context.Background(), 10*time.Minute)
	defer testCancel()
	m.Run()
}

func TestEVMService_UpdateBalanceInTx(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	setupTestDB(t)
	setupTestRedis(t)
	setupTestEVMService(t)

	t.Run("正常充值更新余额", func(t *testing.T) {
		userID := uint64(200001)
		defer cleanupTestData(t, userID)

		initialBalance := decimal.NewFromFloat(100.0)
		createTestUserBalance(t, userID, initialBalance)

		depositAmount := decimal.NewFromFloat(50.5)
		refID := fmt.Sprintf("tx_%d_%d", time.Now().UnixNano(), userID)

		err := testEVMService.updateBalanceInTx(testCtx, userID, depositAmount, refID)
		assert.NoError(t, err, "updateBalanceInTx should not return error")

		var updatedBalance mysql.UserBalance
		err = testDB.Where("user_id = ?", userID).First(&updatedBalance).Error
		assert.NoError(t, err, "should find user balance")

		expectedBalance := decimal.NewFromFloat(150.5)
		assert.True(t, updatedBalance.AvailableBalance.Equal(expectedBalance),
			"balance should be 150.5, got %s", updatedBalance.AvailableBalance.String())

		var ledger mysql.AssetLedger
		err = testDB.Where("ref_id = ?", refID).First(&ledger).Error
		spew.Dump(ledger)

		assert.NoError(t, err, "should find ledger record")
		assert.Equal(t, userID, ledger.UserID)
		assert.Equal(t, "deposit", ledger.BusinessType)
		assert.True(t, ledger.Amount.Equal(depositAmount), "ledger amount should be %s, got %s",
			depositAmount.String(), ledger.Amount.String())
		assert.True(t, ledger.BalanceBefore.Equal(initialBalance))
		assert.True(t, ledger.BalanceAfter.Equal(expectedBalance))
	})

	t.Run("用户不存在返回错误", func(t *testing.T) {
		nonExistentUserID := uint64(999999999)
		depositAmount := decimal.NewFromFloat(10.0)
		refID := "tx_nonexistent"

		err := testEVMService.updateBalanceInTx(testCtx, nonExistentUserID, depositAmount, refID)
		assert.Error(t, err, "should return error for non-existent user")
		assert.Contains(t, err.Error(), "user balance row missing")
	})

	t.Run("小数精度处理", func(t *testing.T) {
		userID := uint64(200002)
		defer cleanupTestData(t, userID)

		initialBalance := decimal.NewFromFloat(99.123456789012345)
		createTestUserBalance(t, userID, initialBalance)

		depositAmount := decimal.NewFromFloat(0.000000000987654)
		refID := "tx_precision_test"

		err := testEVMService.updateBalanceInTx(testCtx, userID, depositAmount, refID)
		assert.NoError(t, err, "precision deposit should succeed")

		var updatedBalance mysql.UserBalance
		err = testDB.Where("user_id = ?", userID).First(&updatedBalance).Error
		assert.NoError(t, err)

		expectedBalance := initialBalance.Add(depositAmount)
		assert.True(t, updatedBalance.AvailableBalance.Equal(expectedBalance),
			"balance should maintain precision, expected %s, got %s",
			expectedBalance.String(), updatedBalance.AvailableBalance.String())
	})

	t.Run("连续多次充值累加", func(t *testing.T) {
		userID := uint64(200003)
		defer cleanupTestData(t, userID)

		initialBalance := decimal.NewFromFloat(0.0)
		createTestUserBalance(t, userID, initialBalance)

		deposits := []decimal.Decimal{
			decimal.NewFromFloat(10.0),
			decimal.NewFromFloat(25.5),
			decimal.NewFromFloat(100.25),
		}
		expectedFinal := decimal.NewFromFloat(135.75)

		for i, amount := range deposits {
			refID := fmt.Sprintf("tx_continuous_%d", i)
			err := testEVMService.updateBalanceInTx(testCtx, userID, amount, refID)
			assert.NoError(t, err, "deposit %d should succeed", i)
		}

		var updatedBalance mysql.UserBalance
		err := testDB.Where("user_id = ?", userID).First(&updatedBalance).Error
		assert.NoError(t, err)
		assert.True(t, updatedBalance.AvailableBalance.Equal(expectedFinal),
			"final balance should be %s, got %s", expectedFinal.String(), updatedBalance.AvailableBalance.String())

		var count int64
		testDB.Model(&mysql.AssetLedger{}).Where("user_id = ?", userID).Count(&count)
		assert.Equal(t, int64(len(deposits)), count, "should have %d ledger records", len(deposits))
	})

	t.Run("零额充值", func(t *testing.T) {
		userID := uint64(200004)
		defer cleanupTestData(t, userID)

		initialBalance := decimal.NewFromFloat(100.0)
		createTestUserBalance(t, userID, initialBalance)

		depositAmount := decimal.Zero
		refID := "tx_zero_deposit"

		err := testEVMService.updateBalanceInTx(testCtx, userID, depositAmount, refID)
		assert.NoError(t, err, "zero deposit should succeed")

		var updatedBalance mysql.UserBalance
		err = testDB.Where("user_id = ?", userID).First(&updatedBalance).Error
		assert.NoError(t, err)
		assert.True(t, updatedBalance.AvailableBalance.Equal(initialBalance),
			"balance should remain unchanged after zero deposit")
	})

	t.Run("大额充值", func(t *testing.T) {
		userID := uint64(200005)
		defer cleanupTestData(t, userID)

		initialBalance := decimal.NewFromFloat(0.0)
		createTestUserBalance(t, userID, initialBalance)

		depositAmount := decimal.NewFromFloat(9999999999.123456789012345678)
		refID := "tx_large_deposit"

		err := testEVMService.updateBalanceInTx(testCtx, userID, depositAmount, refID)
		assert.NoError(t, err, "large deposit should succeed")

		var updatedBalance mysql.UserBalance
		err = testDB.Where("user_id = ?", userID).First(&updatedBalance).Error
		assert.NoError(t, err)
		assert.True(t, updatedBalance.AvailableBalance.Equal(depositAmount),
			"balance should equal large deposit amount")
	})
}

func TestEVMService_UpdateBalanceInTx_TransactionAtomicity(t *testing.T) {
	// if testing.Short() {
	// 	t.Skip("skipping integration test in short mode")
	// }

	setupTestDB(t)
	setupTestEVMService(t)

	t.Run("余额和流水记录在同一事务中更新", func(t *testing.T) {
		userID := uint64(200010)
		defer cleanupTestData(t, userID)

		initialBalance := decimal.NewFromFloat(100.0)
		createTestUserBalance(t, userID, initialBalance)

		depositAmount := decimal.NewFromFloat(50.0)
		refID := "tx_atomicity_test"

		err := testEVMService.updateBalanceInTx(testCtx, userID, depositAmount, refID)
		assert.NoError(t, err, "updateBalanceInTx should succeed")

		var verifyBalance mysql.UserBalance
		err = testDB.Where("user_id = ?", userID).First(&verifyBalance).Error
		assert.NoError(t, err)
		assert.True(t, verifyBalance.AvailableBalance.Equal(decimal.NewFromFloat(150.0)))

		var verifyLedger mysql.AssetLedger
		err = testDB.Where("ref_id = ?", refID).First(&verifyLedger).Error
		assert.NoError(t, err)
		assert.True(t, verifyLedger.BalanceBefore.Equal(initialBalance))
		assert.True(t, verifyLedger.BalanceAfter.Equal(decimal.NewFromFloat(150.0)))
		assert.True(t, verifyLedger.Amount.Equal(depositAmount))
	})
}
