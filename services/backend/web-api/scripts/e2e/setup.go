//go:build ignore

// Phase 5 e2e setup: AutoMigrate 所有相关表到本地 docker MySQL（env=dev → _dev 后缀），
// seed presale_round 6 行 + presale_config 1 行（min_subscribe_usd 调小到 0.5）+
// 一个测试 user（user_id=1001，signing_address=测试 EOA）+ 各 vault 的 event_cursor 初始游标
package main

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"time"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/model"
	mypkg "everything_finance/org/web-api/internal/pkg/mysql"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"
)

const (
	testEOAAddress = "0x9d9bcdfee0ca1701cbb161a583241ee8c4656490" // lowercase
	testUserID     = 1001
	vaultAddress   = "0xf4b6036d2423b1254f273272929364a120a50c7c" // lowercase
)

func main() {
	cfg := config.LoadDefault()
	mypkg.Init(cfg.Database)
	mypkg.InitGORM(cfg.Database)
	db := mypkg.GetGORM()

	fmt.Println("AutoMigrate user_dev / presale_*_dev / user_referral_*_dev ...")
	if err := db.AutoMigrate(
		&model.User{},
		&model.PresaleRound{},
		&model.PresaleDeposit{},
		&model.PresaleConfig{},
		&model.PresaleHolding{},
		&model.PresaleEventCursor{},
		&model.PresaleOpsEvent{},
		&model.UserReferralCode{},
		&model.UserReferralBind{},
	); err != nil {
		fmt.Fprintf(os.Stderr, "AutoMigrate failed: %v\n", err)
		os.Exit(1)
	}

	// 清空现有数据（重跑 setup）
	fmt.Println("Truncating data...")
	for _, t := range []string{"user_dev", "presale_round_dev", "presale_deposit_dev", "presale_config_dev",
		"presale_holding_dev", "presale_event_cursor_dev", "presale_ops_event_dev",
		"user_referral_code_dev", "user_referral_bind_dev"} {
		_ = db.Exec(fmt.Sprintf("TRUNCATE TABLE `%s`", t)).Error
	}

	// 1) 测试 user
	now := time.Now().UnixMilli()
	if err := db.Exec(`INSERT INTO user_dev (user_id, signing_address, nickname, status, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())`,
		testUserID, testEOAAddress, "e2e-tester").Error; err != nil {
		fmt.Fprintf(os.Stderr, "INSERT user_dev failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("  inserted user_dev user_id=%d signing_address=%s\n", testUserID, testEOAAddress)

	// 2) presale_config：min_subscribe_usd=0.5 让 1 USDT 测试通过
	tgeTs := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC).UnixMilli()
	if err := db.Exec(`INSERT INTO presale_config_dev
		(id, tge_ts, tge_open_price_usd, vault_address, min_subscribe_usd, boundary_tolerance_min, total_target_usd, audit_label, lark_webhook_url, updated_at)
		VALUES (1, ?, 0.10, ?, 0.5, 5, 20000000, NULL, NULL, ?)`,
		tgeTs, vaultAddress, now).Error; err != nil {
		fmt.Fprintf(os.Stderr, "INSERT presale_config_dev failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("  inserted presale_config_dev (min_subscribe_usd=0.5)")

	// 3) 6 个 presale_round（active 第一个 seed 轮，剩下 upcoming）
	// seed 轮 active：start_ts=now-1h, end_ts=now+24h；supply_odd=1000（小供给方便测超额）
	hourMs := int64(3600 * 1000)
	dayMs := int64(86400 * 1000)
	rounds := []struct {
		ID        string
		Name      string
		RoundType string
		Price     string
		Supply    string
		Target    string
		Tge       string
		LinDays   int
		RefPct    string
		Start     int64
		End       int64
		Status    string
		Sort      int
	}{
		{"seed", "种子轮", "private", "1.0", "1000", "1000", "10", 90, "10.0000", now - hourMs, now + dayMs, "active", 1},
		{"strategic", "战略轮", "private", "1.0", "1000", "1000", "10", 90, "10.0000", now + dayMs, now + 2*dayMs, "upcoming", 2},
		{"ecosystem", "生态轮", "private", "1.0", "1000", "1000", "15", 60, "10.0000", now + 2*dayMs, now + 3*dayMs, "upcoming", 3},
		{"public_a", "公募A轮", "public", "1.0", "1000", "1000", "20", 30, "10.0000", now + 3*dayMs, now + 4*dayMs, "upcoming", 4},
		{"public_b", "公募B轮", "public", "1.0", "1000", "1000", "25", 30, "10.0000", now + 4*dayMs, now + 5*dayMs, "upcoming", 5},
		{"public_c", "公募C轮", "public", "1.0", "1000", "1000", "30", 0, "10.0000", now + 5*dayMs, now + 6*dayMs, "upcoming", 6},
	}
	for _, r := range rounds {
		if err := db.Exec(`INSERT INTO presale_round_dev
			(id, name, round_type, price_usd, supply_odd, sold_odd, raised_usd, target_raise_usd,
			 tge_release_pct, linear_release_days, referral_reward_pct, referral_release_pct, referral_linear_days,
			 start_ts, end_ts, status, manual_override, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 100, 0, ?, ?, ?, 0, ?, ?, ?)`,
			r.ID, r.Name, r.RoundType, r.Price, r.Supply, r.Target, r.Tge, r.LinDays, r.RefPct,
			r.Start, r.End, r.Status, r.Sort, now, now).Error; err != nil {
			fmt.Fprintf(os.Stderr, "INSERT presale_round_dev[%s] failed: %v\n", r.ID, err)
			os.Exit(1)
		}
	}
	fmt.Printf("  inserted 6 presale_round_dev (price=1.0 USD, supply=1000 ODD each, seed=active)\n")

	// 4) event_cursor：每个金库地址一行，初始化为当前 BSC 区块高度
	rpcURL := os.Getenv("PRESALE_BSC_RPC_URL")
	if rpcURL == "" {
		fmt.Fprintln(os.Stderr, "PRESALE_BSC_RPC_URL env required")
		os.Exit(1)
	}
	ec, err := ethclient.Dial(rpcURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ethclient.Dial: %v\n", err)
		os.Exit(1)
	}
	defer ec.Close()
	head, err := ec.BlockNumber(context.Background())
	if err != nil {
		fmt.Fprintf(os.Stderr, "BlockNumber: %v\n", err)
		os.Exit(1)
	}
	if err := db.Exec(`INSERT INTO presale_event_cursor_dev (vault_address, last_block_number, last_log_index, updated_at)
		VALUES (?, ?, 0, ?)`,
		vaultAddress, head, now).Error; err != nil {
		fmt.Fprintf(os.Stderr, "INSERT cursor failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("  inserted presale_event_cursor_dev vault=%s start_block=%d\n", vaultAddress, head)

	// 5) 验证 USDT 余额（sanity check）
	balanceWei := decimal.NewFromBigInt(big.NewInt(0), 0) // placeholder; not actually used
	_ = balanceWei
	fmt.Println("\nSetup complete. Next steps:")
	fmt.Println("  1) Start web-api:        go run ./cmd/server")
	fmt.Println("  2) Start presale-worker: go run ./cmd/presale-worker")
	fmt.Println("  3) Run E2E-01:           go run ./scripts/e2e/send_e2e01.go")
	fmt.Println("  4) Watch listener log + check presale_deposit_dev table")
}
