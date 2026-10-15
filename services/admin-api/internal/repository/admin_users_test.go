package repository_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
)

// newTestDB 用 sqlite in-memory 起一个隔离的 DB，自动迁移 admin_users。
// 不用真 MySQL：CI 不依赖外部服务；CHECK 约束行为差异由应用层 Role.Valid() 兜底。
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.AdminUser{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedAdmin(t *testing.T, db *gorm.DB, larkID, name string, role model.Role) *model.AdminUser {
	t.Helper()
	u := &model.AdminUser{
		LarkUserID: larkID,
		LarkName:   name,
		LarkEmail:  larkID + "@oddfi.io",
		Role:       role,
	}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("seed: %v", err)
	}
	return u
}

func TestAdminUser_CreateFind(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	u := &model.AdminUser{
		LarkUserID: "ou_001",
		LarkName:   "张三",
		LarkEmail:  "zs@oddfi.io",
		Role:       model.RoleOperator,
	}
	if err := repo.Create(ctx, u); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := repo.FindByLarkUserID(ctx, "ou_001")
	if err != nil {
		t.Fatalf("Find: %v", err)
	}
	if got.LarkUserID != u.LarkUserID || got.Role != u.Role || got.LarkName != u.LarkName {
		t.Errorf("mismatch: %+v", got)
	}
}

func TestAdminUser_CreateDuplicate(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_001", "张三", model.RoleOperator)

	err := repo.Create(ctx, &model.AdminUser{
		LarkUserID: "ou_001", LarkName: "x", Role: model.RoleOperator,
	})
	e := repository.AsError(err)
	if e == nil || e.Code != errcode.AdminUserExists {
		t.Errorf("want AdminUserExists, got %v", err)
	}
}

func TestAdminUser_CreateInvalidRole(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	err := repo.Create(ctx, &model.AdminUser{
		LarkUserID: "ou_x", LarkName: "y", Role: model.Role("bogus"),
	})
	e := repository.AsError(err)
	if e == nil || e.Code != errcode.InvalidParam {
		t.Errorf("want InvalidParam, got %v", err)
	}
}

func TestAdminUser_FindNotFound(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	_, err := repo.FindByLarkUserID(ctx, "ou_missing")
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Errorf("want ErrRecordNotFound, got %v", err)
	}
}

func TestAdminUser_UpdateRole(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_001", "张三", model.RoleOperator)

	if err := repo.UpdateRole(ctx, "ou_001", model.RoleFinance); err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
	got, _ := repo.FindByLarkUserID(ctx, "ou_001")
	if got.Role != model.RoleFinance {
		t.Errorf("role = %s, want finance", got.Role)
	}
}

func TestAdminUser_UpdateRoleDemoteLastSuperAdmin(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_root", "Root", model.RoleSuperAdmin)
	// 唯一 super_admin 被改成 operator → 应拒绝
	err := repo.UpdateRole(ctx, "ou_root", model.RoleOperator)
	e := repository.AsError(err)
	if e == nil || e.Code != errcode.LastSuperAdmin {
		t.Errorf("want LastSuperAdmin, got %v", err)
	}
}

func TestAdminUser_UpdateRoleDemoteSuperAdminWhenMultiple(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_root1", "Root1", model.RoleSuperAdmin)
	seedAdmin(t, db, "ou_root2", "Root2", model.RoleSuperAdmin)

	if err := repo.UpdateRole(ctx, "ou_root2", model.RoleFinance); err != nil {
		t.Fatalf("UpdateRole demote (not last) should succeed: %v", err)
	}
}

func TestAdminUser_UpdateRoleInvalid(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_001", "张三", model.RoleOperator)

	err := repo.UpdateRole(ctx, "ou_001", model.Role("bogus"))
	e := repository.AsError(err)
	if e == nil || e.Code != errcode.InvalidParam {
		t.Errorf("want InvalidParam, got %v", err)
	}
}

func TestAdminUser_DeleteOrdinary(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_001", "张三", model.RoleOperator)

	if err := repo.Delete(ctx, "ou_001"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	_, err := repo.FindByLarkUserID(ctx, "ou_001")
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Errorf("expected gone")
	}
}

func TestAdminUser_DeleteLastSuperAdmin(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_root", "Root", model.RoleSuperAdmin)

	err := repo.Delete(ctx, "ou_root")
	e := repository.AsError(err)
	if e == nil || e.Code != errcode.LastSuperAdmin {
		t.Errorf("want LastSuperAdmin, got %v", err)
	}
}

func TestAdminUser_DeleteSuperAdminWhenMultiple(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_root1", "Root1", model.RoleSuperAdmin)
	seedAdmin(t, db, "ou_root2", "Root2", model.RoleSuperAdmin)

	if err := repo.Delete(ctx, "ou_root1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
}

func TestAdminUser_ListPagination(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	for i := 0; i < 25; i++ {
		seedAdmin(t, db, "ou_"+itoa(i), "n"+itoa(i), model.RoleOperator)
	}
	seedAdmin(t, db, "ou_fin", "fin", model.RoleFinance)

	items, total, err := repo.List(ctx, 1, 10, "", "")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 26 {
		t.Errorf("total = %d, want 26", total)
	}
	if len(items) != 10 {
		t.Errorf("page1 len = %d, want 10", len(items))
	}

	// roleFilter
	items, total, err = repo.List(ctx, 1, 10, "finance", "")
	if err != nil {
		t.Fatalf("List role: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].LarkUserID != "ou_fin" {
		t.Errorf("role filter wrong: total=%d items=%+v", total, items)
	}

	// invalid role filter
	_, _, err = repo.List(ctx, 1, 10, "bogus", "")
	if e := repository.AsError(err); e == nil || e.Code != errcode.InvalidParam {
		t.Errorf("want InvalidParam, got %v", err)
	}
}

func TestAdminUser_CountSuperAdmin(t *testing.T) {
	db := newTestDB(t)
	repo := repository.NewAdminUser(db)
	ctx := context.Background()

	seedAdmin(t, db, "ou_root", "Root", model.RoleSuperAdmin)
	seedAdmin(t, db, "ou_op", "Op", model.RoleOperator)

	cnt, err := repo.CountSuperAdmin(ctx)
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if cnt != 1 {
		t.Errorf("cnt = %d, want 1", cnt)
	}
}

// 不引入 strconv 仅为这个测试，简单整数转字符串
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
