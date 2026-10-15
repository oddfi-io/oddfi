package main

// cmd/inv6-backfill/main_test.go
//
// B7 关键测试：验证幂等性 — 同一笔 deposit 跑两次 apply 不会让 holding 累加翻倍。
// 这是 BUG-001 v1 round code-reviewer C1 / security C3+C4 阻断项的回归保护。
//
// 测试策略：sqlite in-memory + 真实事务，跑真实的 INSERT IGNORE + 乐观锁 UPDATE，
// 不用 mock，确保 DB 层的去重防线真实工作。

import (
	"context"
	"testing"
	"time"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"

	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// captureHoldingRepo：mock holding repo，记录 UpsertReferral 调用次数 + 累加 totalOdd。
// sqlite 不支持 MySQL ON DUPLICATE KEY UPDATE，所以 holding 部分用 mock 模拟累加语义。
type captureHoldingRepo struct {
	calls      int
	lastUserID uint64
	lastRound  string
	totalOdd   decimal.Decimal // 模拟累加效果
}

func (c *captureHoldingRepo) UpsertInvest(_ context.Context, _ *gorm.DB, _ uint64, _ string, _, _, _ decimal.Decimal) error {
	return nil
}

func (c *captureHoldingRepo) UpsertReferral(_ context.Context, _ *gorm.DB, referrerUserID uint64, roundID string, deltaOdd decimal.Decimal) error {
	c.calls++
	c.lastUserID = referrerUserID
	c.lastRound = roundID
	c.totalOdd = c.totalOdd.Add(deltaOdd)
	return nil
}

func (c *captureHoldingRepo) ListByUser(_ context.Context, _ uint64) ([]*model.PresaleHolding, error) {
	return nil, nil
}

func (c *captureHoldingRepo) SumReferralOdd(_ context.Context, _ uint64) (decimal.Decimal, error) {
	return c.totalOdd, nil
}

var _ repository.PresaleHoldingRepository = (*captureHoldingRepo)(nil)

// setupBackfillTestDB 建 sqlite in-memory + AutoMigrate 所有相关表
func setupBackfillTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	// config.InitForTest 是 model.TableName() 内 config.Get() 调用的前置条件
	config.InitForTest()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.PresaleDeposit{},
		&model.PresaleHolding{},
		&model.PresaleAdminAudit{},
		&model.Inv6BackfillApplied{},
		&model.PresaleRound{},
		&model.UserReferralBind{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

// seedBackfillFixture 注入一笔典型"假阴性 deposit"：referrer_user_id IS NULL 但有 bind
func seedBackfillFixture(t *testing.T, db *gorm.DB) (depositID uint64, candidate Candidate) {
	t.Helper()
	// 1. round
	round := &model.PresaleRound{
		ID:                "r1",
		Status:            model.RoundStatusActive,
		PriceUsd:          decimal.NewFromFloat(0.05),
		SupplyOdd:         decimal.NewFromInt(1_000_000),
		ReferralRewardPct: decimal.NewFromInt(10), // 10%
		StartTs:           time.Now().Add(-24 * time.Hour).UnixMilli(),
		EndTs:             time.Now().Add(24 * time.Hour).UnixMilli(),
	}
	if err := db.Create(round).Error; err != nil {
		t.Fatalf("seed round: %v", err)
	}

	// 2. bind: bound_at = blockTs + 800ms（同秒 ms 反超，主 bug 场景）
	blockTs := int64(1_700_000_000_000)
	bind := &model.UserReferralBind{
		UserID:         1001,
		EoaAddress:     "0xuser",
		ReferrerUserID: 999,
		ReferrerEoa:    "0xreferrer",
		ReferrerCode:   "0xMVEKMP",
		Source:         "manual",
		Business:       "presale",
		BoundAt:        blockTs + 800,
	}
	if err := db.Create(bind).Error; err != nil {
		t.Fatalf("seed bind: %v", err)
	}

	// 3. deposit: referrer_user_id IS NULL（假阴性）
	dep := &model.PresaleDeposit{
		TxHash:            "0xtest",
		LogIndex:          0,
		BlockNumber:       100,
		BlockTimestamp:    blockTs,
		UserID:            1001,
		EoaAddress:        "0xuser",
		VaultAddress:      "0xvault",
		RoundID:           "r1",
		AmountUsdt:        decimal.NewFromInt(100),
		PriceUsd:          decimal.NewFromFloat(0.05),
		SharesOdd:         decimal.NewFromInt(2000),
		ReferrerUserID:    nil, // ← 假阴性
		ReferralRewardOdd: decimal.Zero,
		Status:            model.PresaleDepositStatusConfirmed,
		Source:            model.PresaleDepositSourceFrontend,
	}
	if err := db.Create(dep).Error; err != nil {
		t.Fatalf("seed deposit: %v", err)
	}

	return dep.ID, Candidate{
		Deposit: dep,
		Bind:    bind,
		DiffMs:  bind.BoundAt - dep.BlockTimestamp,
	}
}

// buildDeps 装配真实 repo + sqlite；holdingRepo 用 mock（sqlite 不支持 ON DUPLICATE KEY UPDATE）
func buildDeps(db *gorm.DB, holding *captureHoldingRepo) Deps {
	return Deps{
		DB:           db,
		DepositRepo:  repository.NewPresaleDepositRepo(db),
		HoldingRepo:  holding,
		BindRepo:     repository.NewUserReferralBindRepo(db),
		AuditRepo:    repository.NewPresaleAdminAuditRepository(db),
		BackfillRepo: repository.NewInv6BackfillAppliedRepo(db),
		RoundRepo:    repository.NewPresaleRoundRepo(db),
	}
}

// TestApplyOne_FirstRun_Succeeds：首次回填 → deposit UPDATE + holding +200 ODD + audit + applied 表 +1 行
func TestApplyOne_FirstRun_Succeeds(t *testing.T) {
	db := setupBackfillTestDB(t)
	depID, cand := seedBackfillFixture(t, db)
	holding := &captureHoldingRepo{}
	deps := buildDeps(db, holding)
	opts := Opts{Actor: "test-runner", Reason: "test"}

	applied, err := applyOne(context.Background(), deps, opts, cand)
	if err != nil {
		t.Fatalf("first applyOne err: %v", err)
	}
	if !applied {
		t.Fatalf("first applyOne should apply, got skip")
	}

	// 验证 deposit 已挂 referrer
	var dep model.PresaleDeposit
	if err := db.First(&dep, depID).Error; err != nil {
		t.Fatalf("query deposit: %v", err)
	}
	if dep.ReferrerUserID == nil || *dep.ReferrerUserID != 999 {
		t.Errorf("deposit referrer not set: %+v", dep.ReferrerUserID)
	}
	// INV-7: reward = 2000 × 10% = 200
	if !dep.ReferralRewardOdd.Equal(decimal.NewFromInt(200)) {
		t.Errorf("reward = %s, want 200", dep.ReferralRewardOdd)
	}

	// 验证 holdingRepo.UpsertReferral 被调 1 次 + delta = 200 ODD
	if holding.calls != 1 {
		t.Errorf("UpsertReferral calls = %d, want 1", holding.calls)
	}
	if !holding.totalOdd.Equal(decimal.NewFromInt(200)) {
		t.Errorf("holding totalOdd = %s, want 200", holding.totalOdd)
	}
	if holding.lastUserID != 999 {
		t.Errorf("UpsertReferral userID = %d, want 999", holding.lastUserID)
	}

	// 验证 inv6_backfill_applied 有 1 行
	var n int64
	db.Model(&model.Inv6BackfillApplied{}).Count(&n)
	if n != 1 {
		t.Errorf("applied count = %d, want 1", n)
	}

	// 验证 audit 有 1 行 + action=inv6_backfill
	var auditN int64
	db.Model(&model.PresaleAdminAudit{}).Where("action = ?", "inv6_backfill").Count(&auditN)
	if auditN != 1 {
		t.Errorf("audit count = %d, want 1", auditN)
	}
}

// TestApplyOne_SecondRun_Idempotent：相同 deposit 跑第 2 次 → skip + holding 不变 + audit/applied 都不增加
// 这是 BUG-001 v1 round code C1 / sec C3+C4 的关键回归保护。
func TestApplyOne_SecondRun_Idempotent(t *testing.T) {
	db := setupBackfillTestDB(t)
	_, cand := seedBackfillFixture(t, db)
	holding := &captureHoldingRepo{}
	deps := buildDeps(db, holding)
	opts := Opts{Actor: "test-runner", Reason: "test"}

	// 第 1 次：成功
	applied1, err := applyOne(context.Background(), deps, opts, cand)
	if err != nil || !applied1 {
		t.Fatalf("first applyOne should succeed, applied=%v err=%v", applied1, err)
	}

	// 第 2 次：MarkApplied 返回 false（PK 冲突）→ 整条事务回滚后 commit
	applied2, err := applyOne(context.Background(), deps, opts, cand)
	if err != nil {
		t.Fatalf("second applyOne err: %v", err)
	}
	if applied2 {
		t.Errorf("second applyOne MUST NOT apply (idempotent), but got applied=true")
	}

	// 关键断言：UpsertReferral 仍只被调 1 次（第 2 次因 MarkApplied=false 整条事务 skip）
	if holding.calls != 1 {
		t.Errorf("UpsertReferral calls after 2 runs = %d, want still 1 (not invoked twice)", holding.calls)
	}
	if !holding.totalOdd.Equal(decimal.NewFromInt(200)) {
		t.Errorf("holding totalOdd after 2 runs = %s, want still 200 (not 翻倍)", holding.totalOdd)
	}

	// applied 表仍只有 1 行
	var n int64
	db.Model(&model.Inv6BackfillApplied{}).Count(&n)
	if n != 1 {
		t.Errorf("applied count after 2 runs = %d, want 1", n)
	}

	// audit 也仍只有 1 行（第 2 次不写）
	var auditN int64
	db.Model(&model.PresaleAdminAudit{}).Where("action = ?", "inv6_backfill").Count(&auditN)
	if auditN != 1 {
		t.Errorf("audit count after 2 runs = %d, want 1", auditN)
	}
}

// TestApplyOne_OptimisticLock_Skips：deposit 在 inv6_backfill_applied INSERT 后但 UPDATE 前
// 被并发占用（人为 UPDATE referrer_user_id 非 NULL）→ UPDATE rows=0 → 整条事务回滚 → 报错但不污染数据
func TestApplyOne_OptimisticLock_Skips(t *testing.T) {
	db := setupBackfillTestDB(t)
	depID, cand := seedBackfillFixture(t, db)
	holding := &captureHoldingRepo{}
	deps := buildDeps(db, holding)
	opts := Opts{Actor: "test-runner", Reason: "test"}

	// 人为预先 UPDATE deposit 加上 referrer（模拟并发占用）
	otherReferrer := uint64(123)
	if err := db.Model(&model.PresaleDeposit{}).
		Where("id = ?", depID).
		Update("referrer_user_id", otherReferrer).Error; err != nil {
		t.Fatalf("pre-update: %v", err)
	}

	applied, err := applyOne(context.Background(), deps, opts, cand)
	if err == nil {
		t.Errorf("expected optimistic lock error, got nil")
	}
	if applied {
		t.Errorf("expected applied=false, got true")
	}

	// 关键：事务回滚后 inv6_backfill_applied 不应有行（不污染去重表）
	var n int64
	db.Model(&model.Inv6BackfillApplied{}).Count(&n)
	if n != 0 {
		t.Errorf("applied count after race = %d, want 0 (transaction must rollback)", n)
	}

	// holding mock 应该没被调（整条事务回滚前不会触发到 UpsertReferral）
	// 注：UpsertReferral 在 UPDATE 失败 return error 之前，但同事务回滚后副作用应被丢弃
	// captureHoldingRepo 是 mock 不参与事务，故 calls 计数体现"应用层是否调到"
	if holding.calls != 0 {
		t.Errorf("UpsertReferral calls after race = %d, want 0 (UPDATE 失败应在调 holding 之前 return)", holding.calls)
	}
}
