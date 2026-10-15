package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
)

func setupKolDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.PresaleKolReferralPct{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func makeKol(eoa, pctStr string, note *string) *model.PresaleKolReferralPct {
	return &model.PresaleKolReferralPct{
		ReferrerEoa: eoa,
		ReferralPct: decimal.RequireFromString(pctStr),
		Note:        note,
		CreatedBy:   "ou_test",
		CreatedAt:   1_700_000_000_000,
		UpdatedAt:   1_700_000_000_000,
	}
}

// TestKolReferralPct_Upsert_InsertThenOverride 验证 Upsert 对新 EOA 插入、对已有 EOA 覆盖
func TestKolReferralPct_Upsert_InsertThenOverride(t *testing.T) {
	db := setupKolDB(t)
	repo := NewKolReferralPctRepository(db)
	ctx := context.Background()

	eoa := "0x" + "ab"[:1] + "0000000000000000000000000000000000000000"
	// 1) 新增
	if err := repo.Upsert(ctx, makeKol(eoa, "8.0000", nil)); err != nil {
		t.Fatalf("first upsert: %v", err)
	}
	got, err := repo.GetByEoa(ctx, eoa)
	if err != nil {
		t.Fatalf("get after first upsert: %v", err)
	}
	if !got.ReferralPct.Equal(decimal.RequireFromString("8")) {
		t.Errorf("want pct=8, got %s", got.ReferralPct.String())
	}

	// 2) 覆盖
	note := "vip kol"
	if err := repo.Upsert(ctx, makeKol(eoa, "12.5", &note)); err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	got2, err := repo.GetByEoa(ctx, eoa)
	if err != nil {
		t.Fatalf("get after override: %v", err)
	}
	if !got2.ReferralPct.Equal(decimal.RequireFromString("12.5")) {
		t.Errorf("want pct=12.5, got %s", got2.ReferralPct.String())
	}
	if got2.Note == nil || *got2.Note != note {
		t.Errorf("want note=%q, got %v", note, got2.Note)
	}
}

// TestKolReferralPct_GetByEoa_NotFound 验证未配置 EOA 返 ErrKolNotFound
func TestKolReferralPct_GetByEoa_NotFound(t *testing.T) {
	db := setupKolDB(t)
	repo := NewKolReferralPctRepository(db)
	ctx := context.Background()

	_, err := repo.GetByEoa(ctx, "0x1111111111111111111111111111111111111111")
	if !errors.Is(err, ErrKolNotFound) {
		t.Errorf("want ErrKolNotFound, got %v", err)
	}
}

// TestKolReferralPct_Update_Found 验证 PATCH 成功路径
func TestKolReferralPct_Update_Found(t *testing.T) {
	db := setupKolDB(t)
	repo := NewKolReferralPctRepository(db)
	ctx := context.Background()

	eoa := "0x2222222222222222222222222222222222222222"
	if err := repo.Upsert(ctx, makeKol(eoa, "5.0000", nil)); err != nil {
		t.Fatalf("seed: %v", err)
	}

	newNote := "patched note"
	if err := repo.Update(ctx, eoa, decimal.RequireFromString("7.25"), &newNote, 1_700_000_500_000); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ := repo.GetByEoa(ctx, eoa)
	if !got.ReferralPct.Equal(decimal.RequireFromString("7.25")) {
		t.Errorf("want pct=7.25, got %s", got.ReferralPct.String())
	}
	if got.Note == nil || *got.Note != newNote {
		t.Errorf("want note=%q, got %v", newNote, got.Note)
	}
}

// TestKolReferralPct_Update_NotFound 验证 PATCH 不存在 EOA 返 ErrKolNotFound
func TestKolReferralPct_Update_NotFound(t *testing.T) {
	db := setupKolDB(t)
	repo := NewKolReferralPctRepository(db)
	ctx := context.Background()

	err := repo.Update(ctx, "0x3333333333333333333333333333333333333333",
		decimal.RequireFromString("1"), nil, 1_700_000_000_000)
	if !errors.Is(err, ErrKolNotFound) {
		t.Errorf("want ErrKolNotFound, got %v", err)
	}
}

// TestKolReferralPct_Delete 验证 found=true/false 两种情况
func TestKolReferralPct_Delete(t *testing.T) {
	db := setupKolDB(t)
	repo := NewKolReferralPctRepository(db)
	ctx := context.Background()

	eoa := "0x4444444444444444444444444444444444444444"
	if err := repo.Upsert(ctx, makeKol(eoa, "1.0", nil)); err != nil {
		t.Fatalf("seed: %v", err)
	}
	found, err := repo.Delete(ctx, eoa)
	if err != nil {
		t.Fatalf("delete existing: %v", err)
	}
	if !found {
		t.Error("want found=true for existing eoa")
	}

	// 再删一次 → 不存在
	found2, err := repo.Delete(ctx, eoa)
	if err != nil {
		t.Fatalf("delete missing: %v", err)
	}
	if found2 {
		t.Error("want found=false for non-existing eoa")
	}
}

// TestKolReferralPct_List_Pagination 验证 List 分页与 EOA filter 模糊匹配
func TestKolReferralPct_List_Pagination(t *testing.T) {
	db := setupKolDB(t)
	repo := NewKolReferralPctRepository(db)
	ctx := context.Background()

	// seed 5 行：3 个以 0xa 开头，2 个以 0xb 开头
	eoas := []string{
		"0xaaaa000000000000000000000000000000000001",
		"0xaaaa000000000000000000000000000000000002",
		"0xaaaa000000000000000000000000000000000003",
		"0xbbbb000000000000000000000000000000000001",
		"0xbbbb000000000000000000000000000000000002",
	}
	for i, e := range eoas {
		k := makeKol(e, "1.0", nil)
		k.UpdatedAt = int64(1_700_000_000_000 + i) // 保证 order by 稳定
		if err := repo.Upsert(ctx, k); err != nil {
			t.Fatalf("seed %d: %v", i, err)
		}
	}

	// 全量
	items, total, err := repo.List(ctx, "", 1, 20)
	if err != nil {
		t.Fatalf("list all: %v", err)
	}
	if total != 5 {
		t.Errorf("want total=5, got %d", total)
	}
	if len(items) != 5 {
		t.Errorf("want 5 items, got %d", len(items))
	}

	// EOA filter 命中 3 个
	items2, total2, err := repo.List(ctx, "aaaa", 1, 20)
	if err != nil {
		t.Fatalf("list filtered: %v", err)
	}
	if total2 != 3 {
		t.Errorf("want total=3 (filter aaaa), got %d", total2)
	}
	if len(items2) != 3 {
		t.Errorf("want 3 items (filter aaaa), got %d", len(items2))
	}

	// 分页 size=2
	items3, total3, err := repo.List(ctx, "", 1, 2)
	if err != nil {
		t.Fatalf("list page1: %v", err)
	}
	if total3 != 5 {
		t.Errorf("want total=5, got %d", total3)
	}
	if len(items3) != 2 {
		t.Errorf("want 2 items page1, got %d", len(items3))
	}
}
