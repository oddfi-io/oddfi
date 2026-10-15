package repository

import (
	"context"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
)

func setupAuditDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.PresaleAdminAudit{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestPresaleAdminAudit_Create(t *testing.T) {
	db := setupAuditDB(t)
	repo := NewPresaleAdminAuditRepository(db)

	tx := db.Begin()
	defer tx.Commit()

	entry := &model.PresaleAdminAudit{
		Operator:     "ou_abc",
		OperatorRole: "operator",
		Action:       "pause",
		TargetType:   "round",
		TargetID:     "seed",
		Note:         "test pause for seed round",
		Source:       "api",
		CreatedAt:    time.Now().UnixMilli(),
	}
	if err := repo.Create(tx, entry); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if entry.ID == 0 {
		t.Fatal("ID not assigned")
	}
}

func TestPresaleAdminAudit_List_FilterAndPagination(t *testing.T) {
	db := setupAuditDB(t)
	repo := NewPresaleAdminAuditRepository(db)

	// seed 10 行：5 operator A, 5 operator B
	now := time.Now().UnixMilli()
	for i := 0; i < 10; i++ {
		op := "ou_A"
		if i%2 == 0 {
			op = "ou_B"
		}
		db.Create(&model.PresaleAdminAudit{
			Operator:   op,
			Action:     "pause",
			TargetType: "round",
			TargetID:   "seed",
			Note:       "test",
			Source:     "api",
			CreatedAt:  now - int64(i),
		})
	}

	// 按 operator 过滤
	items, total, err := repo.List(context.Background(), PresaleAdminAuditFilter{Operator: "ou_A"})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 5 {
		t.Errorf("operator A total = %d, want 5", total)
	}
	if len(items) != 5 {
		t.Errorf("operator A items = %d, want 5", len(items))
	}

	// 分页
	items, total, err = repo.List(context.Background(), PresaleAdminAuditFilter{Limit: 3, Offset: 0})
	if err != nil {
		t.Fatalf("List paginated: %v", err)
	}
	if total != 10 {
		t.Errorf("total = %d, want 10", total)
	}
	if len(items) != 3 {
		t.Errorf("page items = %d, want 3", len(items))
	}
}

func TestPresaleAdminAudit_CountByTargetAndAction(t *testing.T) {
	db := setupAuditDB(t)
	repo := NewPresaleAdminAuditRepository(db)

	now := time.Now().UnixMilli()
	for _, act := range []string{"migrate_round", "migrate_round", "migrate_round", "pause"} {
		db.Create(&model.PresaleAdminAudit{
			Operator:   "ou_X",
			Action:     act,
			TargetType: "deposit",
			TargetID:   "tx-abc",
			Note:       "n",
			Source:     "api",
			CreatedAt:  now,
		})
	}

	n, err := repo.CountByTargetAndAction(context.Background(), "deposit", "tx-abc", "migrate_round")
	if err != nil {
		t.Fatalf("CountByTargetAndAction: %v", err)
	}
	if n != 3 {
		t.Errorf("count = %d, want 3", n)
	}
}

func TestPresaleAdminAudit_NilTxFailsFast(t *testing.T) {
	db := setupAuditDB(t)
	repo := NewPresaleAdminAuditRepository(db)

	if err := repo.Create(nil, &model.PresaleAdminAudit{}); err == nil {
		t.Error("Create with nil tx should error")
	}
	if err := repo.Create(db, nil); err == nil {
		t.Error("Create with nil entry should error")
	}
}
