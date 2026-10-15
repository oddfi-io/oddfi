package repository

import (
	"context"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
)

func setupIdemDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.AdminIdempotency{}, &model.PresaleAdminAudit{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestAdminIdempotency_CreateAndLookup(t *testing.T) {
	db := setupIdemDB(t)
	repo := NewAdminIdempotencyRepository(db)

	tx := db.Begin()
	defer tx.Rollback()

	row := &model.AdminIdempotency{
		IdempotencyKey:  "key-001",
		RequestPath:     "/internal/admin/presale/rounds/seed/pause",
		RequestBodyHash: "deadbeef",
		CreatedAt:       time.Now().UnixMilli(),
		ExpiresAt:       time.Now().Add(90 * 24 * time.Hour).UnixMilli(),
	}
	if err := repo.Create(tx, row); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if row.ID == 0 {
		t.Fatal("ID not assigned after Create")
	}

	found, ok, err := repo.LookupForUpdate(tx, "key-001")
	if err != nil {
		t.Fatalf("LookupForUpdate: %v", err)
	}
	if !ok || found == nil {
		t.Fatal("expected hit, got miss")
	}
	if found.RequestBodyHash != "deadbeef" {
		t.Errorf("body hash mismatch: %s", found.RequestBodyHash)
	}
}

func TestAdminIdempotency_LookupMiss(t *testing.T) {
	db := setupIdemDB(t)
	repo := NewAdminIdempotencyRepository(db)

	tx := db.Begin()
	defer tx.Rollback()

	_, ok, err := repo.LookupForUpdate(tx, "nonexistent")
	if err != nil {
		t.Fatalf("LookupForUpdate: %v", err)
	}
	if ok {
		t.Fatal("expected miss, got hit")
	}
}

func TestAdminIdempotency_UpdateResponse(t *testing.T) {
	db := setupIdemDB(t)
	repo := NewAdminIdempotencyRepository(db)

	tx := db.Begin()
	row := &model.AdminIdempotency{
		IdempotencyKey:  "key-002",
		RequestPath:     "/x",
		RequestBodyHash: "h",
		CreatedAt:       time.Now().UnixMilli(),
		ExpiresAt:       time.Now().Add(time.Hour).UnixMilli(),
	}
	_ = repo.Create(tx, row)

	if err := repo.UpdateResponse(tx, row.ID, 200, `{"data":"ok"}`, 42); err != nil {
		t.Fatalf("UpdateResponse: %v", err)
	}
	tx.Commit()

	var refetch model.AdminIdempotency
	db.First(&refetch, row.ID)
	if refetch.ResponseStatus == nil || *refetch.ResponseStatus != 200 {
		t.Errorf("response_status not updated: %v", refetch.ResponseStatus)
	}
	if refetch.ResponseSnapshot == nil || *refetch.ResponseSnapshot != `{"data":"ok"}` {
		t.Errorf("response_snapshot not updated")
	}
	if refetch.AuditID == nil || *refetch.AuditID != 42 {
		t.Errorf("audit_id not updated: %v", refetch.AuditID)
	}
}

func TestAdminIdempotency_CleanExpired(t *testing.T) {
	db := setupIdemDB(t)
	repo := NewAdminIdempotencyRepository(db)

	now := time.Now().UnixMilli()
	rows := []*model.AdminIdempotency{
		{IdempotencyKey: "old-1", RequestPath: "/x", RequestBodyHash: "h", CreatedAt: now - 100, ExpiresAt: now - 10},
		{IdempotencyKey: "old-2", RequestPath: "/x", RequestBodyHash: "h", CreatedAt: now - 100, ExpiresAt: now - 5},
		{IdempotencyKey: "fresh-1", RequestPath: "/x", RequestBodyHash: "h", CreatedAt: now, ExpiresAt: now + 1000},
	}
	for _, r := range rows {
		db.Create(r)
	}

	n, err := repo.CleanExpired(context.Background(), now)
	if err != nil {
		t.Fatalf("CleanExpired: %v", err)
	}
	if n != 2 {
		t.Errorf("cleaned = %d, want 2", n)
	}

	var remaining int64
	db.Model(&model.AdminIdempotency{}).Count(&remaining)
	if remaining != 1 {
		t.Errorf("remaining = %d, want 1", remaining)
	}
}

func TestAdminIdempotency_NilTxFailsFast(t *testing.T) {
	db := setupIdemDB(t)
	repo := NewAdminIdempotencyRepository(db)

	if err := repo.Create(nil, &model.AdminIdempotency{}); err == nil {
		t.Error("Create with nil tx should error")
	}
	if _, _, err := repo.LookupForUpdate(nil, "k"); err == nil {
		t.Error("LookupForUpdate with nil tx should error")
	}
	if err := repo.UpdateResponse(nil, 1, 200, "", 0); err == nil {
		t.Error("UpdateResponse with nil tx should error")
	}
}
