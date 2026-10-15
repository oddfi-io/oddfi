package gormtx

import (
	"context"
	"errors"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.Exec("CREATE TABLE t(id INT)").Error; err != nil {
		t.Fatalf("create table: %v", err)
	}
	return db
}

func TestWithTx_FromCommit(t *testing.T) {
	db := setupDB(t)
	ctx := WithTx(context.Background(), db)

	tx := From(ctx)
	if tx == nil {
		t.Fatal("From returned nil after WithTx")
	}
	if err := tx.Exec("INSERT INTO t(id) VALUES (1)").Error; err != nil {
		t.Fatalf("insert in tx: %v", err)
	}
	if err := Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}

	// commit 后数据可见
	var count int
	db.Raw("SELECT COUNT(*) FROM t").Scan(&count)
	if count != 1 {
		t.Errorf("after commit, count = %d, want 1", count)
	}
}

func TestWithTx_Rollback(t *testing.T) {
	db := setupDB(t)
	ctx := WithTx(context.Background(), db)
	tx := From(ctx)
	_ = tx.Exec("INSERT INTO t(id) VALUES (1)").Error
	if err := Rollback(ctx); err != nil {
		t.Fatalf("rollback: %v", err)
	}

	var count int
	db.Raw("SELECT COUNT(*) FROM t").Scan(&count)
	if count != 0 {
		t.Errorf("after rollback, count = %d, want 0", count)
	}
}

func TestFrom_NoTx(t *testing.T) {
	if From(context.Background()) != nil {
		t.Fatal("From on empty ctx should return nil")
	}
}

func TestMustFrom_Panic(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("MustFrom on empty ctx should panic")
		}
	}()
	MustFrom(context.Background())
}

func TestCommit_NoTx(t *testing.T) {
	err := Commit(context.Background())
	if !errors.Is(err, ErrNoTx) {
		t.Errorf("Commit on empty ctx err = %v, want ErrNoTx", err)
	}
}

func TestRollback_NoTx_Silent(t *testing.T) {
	// 无 tx 的 Rollback 应静默返回 nil（best-effort）
	if err := Rollback(context.Background()); err != nil {
		t.Errorf("Rollback on empty ctx err = %v, want nil", err)
	}
}

// TestWithTx_NestedFails 验证嵌套 WithTx 会用最内层 tx（外层被覆盖）。
// 这是 caller 责任的约束，helper 不防御；本测固化此行为防误用扩散。
func TestWithTx_NestedFails(t *testing.T) {
	db := setupDB(t)
	outer := WithTx(context.Background(), db)
	outerTx := From(outer)

	inner := WithTx(outer, db)
	innerTx := From(inner)
	if outerTx == innerTx {
		t.Fatal("nested WithTx should produce a different tx")
	}
	_ = Rollback(outer)
	_ = Rollback(inner)
}
