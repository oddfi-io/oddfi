//go:build ignore
// +build ignore

// backfill-referral-codes.go
// 既有用户邀请码一次性补齐脚本（B1 部署后执行一次）
//
// 用途：扫描 user 表中没有 user_referral_code 记录的用户，批量生成邀请码。
// 必要性：老用户不会重新登录，不会触发 JWT middleware 的自动生成 hook，需一次性补齐。
//
// 执行方式（从项目根目录）：
//
//	go run scripts/presale-ops/backfill-referral-codes.go --dry-run   # 演练：只统计，不写 DB
//	go run scripts/presale-ops/backfill-referral-codes.go              # 实际执行
//
// 注意：
//   - 生产执行前必须先 --dry-run 确认数量
//   - 与 GenerateCodeForUser 使用完全相同的逻辑（共用 repository），保证一致性
//   - B3 才建 presale_admin_audit 表，本期脚本仅 log 不写 audit；
//     TODO(B3): 接入 presale_admin_audit，operator="script:backfill-referral-codes"
package main

import (
	"context"
	"crypto/rand"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// 与 service/referral.go 保持一致的字符集和参数
const (
	referralCodeChars   = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
	referralCodeLen     = 6
	referralCodeMaxRetry = 5
	batchSize           = 100 // 每批处理用户数，避免大事务超时
)

func main() {
	dryRun := flag.Bool("dry-run", false, "演练模式：只统计需要补齐的用户数，不写 DB")
	dsn := flag.String("dsn", os.Getenv("MYSQL_DSN"), "MySQL DSN（默认读 MYSQL_DSN 环境变量）")
	flag.Parse()

	if *dsn == "" {
		log.Fatal("[backfill] MYSQL_DSN is required (set env or use --dsn flag)")
	}

	// 初始化 GORM（直接使用 DSN，不依赖 config.yaml）
	db, err := gorm.Open(mysql.Open(*dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("[backfill] failed to connect to database: %v", err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	codeRepo := repository.NewUserReferralCodeRepo(db)

	ctx := context.Background()

	if *dryRun {
		count, err := countUsersWithoutCode(ctx, db)
		if err != nil {
			log.Fatalf("[backfill] dry-run count failed: %v", err)
		}
		log.Printf("[backfill] dry-run: %d users need referral code backfill", count)
		return
	}

	// 实际执行：分批处理
	log.Printf("[backfill] starting referral code backfill (batch_size=%d)...", batchSize)
	total, success, skipped, failed := 0, 0, 0, 0

	err = scanUsersWithoutCode(ctx, db, func(userID uint64, eoa string) {
		total++
		err := generateAndInsert(ctx, codeRepo, userID, eoa)
		if err == nil {
			success++
			log.Printf("[backfill] generated code for user_id=%d eoa=%s", userID, eoa)
		} else if errors.Is(err, errAlreadyHasCode) {
			skipped++
		} else {
			failed++
			log.Printf("[backfill] ERROR: failed to generate code for user_id=%d eoa=%s err=%v", userID, eoa, err)
		}
	})
	if err != nil {
		log.Fatalf("[backfill] scan failed: %v", err)
	}

	// TODO(B3): 写 presale_admin_audit 记录
	// audit := presaleAdminAudit{Operator: "script:backfill-referral-codes", Source: "script", ...}
	log.Printf("[backfill] done. total=%d success=%d skipped=%d failed=%d", total, success, skipped, failed)
	if failed > 0 {
		log.Printf("[backfill] WARNING: %d users failed, re-run script to retry", failed)
		os.Exit(1)
	}
}

var errAlreadyHasCode = errors.New("user already has referral code")

// countUsersWithoutCode 统计没有邀请码的用户数（dry-run 用）
func countUsersWithoutCode(ctx context.Context, db *gorm.DB) (int64, error) {
	var count int64
	// 查 user 表中不在 user_referral_code 表的记录
	err := db.WithContext(ctx).
		Table("user").
		Where("id NOT IN (SELECT user_id FROM user_referral_code)").
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("[backfill] count users without code: %w", err)
	}
	return count, nil
}

// scanUsersWithoutCode 分批扫描没有邀请码的用户，对每个用户调用 callback
func scanUsersWithoutCode(ctx context.Context, db *gorm.DB, callback func(userID uint64, eoa string)) error {
	type userRow struct {
		ID         uint64
		EoaAddress string
	}

	var offset int
	for {
		var rows []userRow
		err := db.WithContext(ctx).
			Table("user").
			Select("id, eoa_address").
			Where("id NOT IN (SELECT user_id FROM user_referral_code)").
			Order("id ASC").
			Offset(offset).
			Limit(batchSize).
			Scan(&rows).Error
		if err != nil {
			return fmt.Errorf("[backfill] scan users at offset %d: %w", offset, err)
		}
		if len(rows) == 0 {
			break
		}
		for _, row := range rows {
			callback(row.ID, row.EoaAddress)
		}
		offset += len(rows)

		// 批次间短暂休眠，避免对 DB 造成突发压力
		time.Sleep(10 * time.Millisecond)
	}
	return nil
}

// generateAndInsert 为单个用户生成邀请码并写入 DB（最多 5 次重试）
func generateAndInsert(ctx context.Context, codeRepo repository.UserReferralCodeRepository, userID uint64, eoa string) error {
	// 先检查是否已有（幂等保护，避免并发重复执行时报错）
	existing, err := codeRepo.GetByUserID(ctx, userID)
	if err == nil && existing != nil {
		return errAlreadyHasCode
	}

	for attempt := 0; attempt < referralCodeMaxRetry; attempt++ {
		code, err := generateCode()
		if err != nil {
			return fmt.Errorf("crypto/rand failure: %w", err)
		}
		inserted, err := codeRepo.InsertIgnore(ctx, userID, eoa, code)
		if err == nil && inserted {
			return nil
		}
		if err == nil && !inserted {
			return errAlreadyHasCode
		}
		if errors.Is(err, repository.ErrCodeConflict) {
			continue // code 碰撞，重试
		}
		return err
	}
	return fmt.Errorf("exhausted %d retries for user %d", referralCodeMaxRetry, userID)
}

// generateCode 与 service/referral.go 完全相同的逻辑（保证一致性）
func generateCode() (string, error) {
	b := make([]byte, referralCodeLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	charset := []byte(referralCodeChars)
	n := len(charset)
	code := make([]byte, referralCodeLen)
	for i, v := range b {
		code[i] = charset[int(v)%n]
	}
	return "0x" + string(code), nil
}

// user 模型（仅 backfill 用，不依赖 internal/model 的完整结构）
type userForBackfill struct {
	ID         uint64 `gorm:"column:id"`
	EoaAddress string `gorm:"column:eoa_address"`
}

// 确保编译时引用 model 包，避免 import cycle 风险的说明
// 实际上 backfill 脚本与 model 包无循环依赖，此注释仅供读者参考
var _ = model.UserReferralCode{}
