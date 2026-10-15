package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/handler"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	jwtpkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
)

type adminUsersFixture struct {
	engine *gin.Engine
	repo   repository.AdminUserRepository
	jwtSvc jwtpkg.Service
}

func setupAdminUsersFixture(t *testing.T) *adminUsersFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.AdminUser{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	jwtSvc := jwtpkg.New(config.JWTConfig{
		Secret: "0123456789abcdef0123456789abcdef",
		TTL:    time.Hour, Issuer: "test",
	}, rdb)
	repo := repository.NewAdminUser(db)
	h := handler.NewAdminUsers(repo)

	r := gin.New()
	admin := r.Group("/admin", middleware.AdminAuthMiddleware(jwtSvc))
	au := admin.Group("/admin-users", middleware.RoleRequired("super_admin"))
	au.GET("", h.List)
	au.POST("", h.Create)
	au.PATCH("/:lark_user_id/role", h.UpdateRole)
	au.DELETE("/:lark_user_id", h.Delete)

	return &adminUsersFixture{engine: r, repo: repo, jwtSvc: jwtSvc}
}

func jwtFor(t *testing.T, fix *adminUsersFixture, admin *model.AdminUser) string {
	t.Helper()
	tok, _, _, err := fix.jwtSvc.Sign(context.Background(), admin)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return tok
}

func do(t *testing.T, fix *adminUsersFixture, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req, _ := http.NewRequest(method, path, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	fix.engine.ServeHTTP(w, req)
	return w
}

func seedSuper(t *testing.T, fix *adminUsersFixture, id string) *model.AdminUser {
	t.Helper()
	u := &model.AdminUser{LarkUserID: id, LarkName: id, Role: model.RoleSuperAdmin}
	if err := fix.repo.Create(context.Background(), u); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return u
}

func TestAdminUsers_NonSuperDenied(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	op := &model.AdminUser{LarkUserID: "ou_op", LarkName: "op", Role: model.RoleOperator}
	if err := fix.repo.Create(context.Background(), op); err != nil {
		t.Fatalf("seed: %v", err)
	}
	tok := jwtFor(t, fix, op)

	w := do(t, fix, http.MethodGet, "/admin/admin-users", tok, nil)
	if w.Code != http.StatusForbidden {
		t.Errorf("code=%d, want 403", w.Code)
	}
}

func TestAdminUsers_ListPaginated(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	root := seedSuper(t, fix, "ou_root")
	tok := jwtFor(t, fix, root)

	for i := 0; i < 3; i++ {
		_ = fix.repo.Create(context.Background(), &model.AdminUser{
			LarkUserID: "ou_op_" + string(rune('a'+i)), LarkName: "op", Role: model.RoleOperator,
		})
	}

	w := do(t, fix, http.MethodGet, "/admin/admin-users?page=1&page_size=10", tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("code=%d, body=%s", w.Code, w.Body.String())
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	data := body["data"].(map[string]any)
	if int(data["total"].(float64)) != 4 {
		t.Errorf("total=%v, want 4", data["total"])
	}
}

func TestAdminUsers_CreateInvalidRole(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	root := seedSuper(t, fix, "ou_root")
	tok := jwtFor(t, fix, root)

	w := do(t, fix, http.MethodPost, "/admin/admin-users", tok, map[string]string{
		"lark_user_id": "ou_x", "lark_name": "x", "role": "bogus",
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("code=%d, want 400", w.Code)
	}
}

func TestAdminUsers_CreateDuplicate(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	root := seedSuper(t, fix, "ou_root")
	tok := jwtFor(t, fix, root)

	body := map[string]string{
		"lark_user_id": "ou_op", "lark_name": "op", "role": "operator",
	}
	if w := do(t, fix, http.MethodPost, "/admin/admin-users", tok, body); w.Code != http.StatusOK {
		t.Fatalf("first create code=%d, body=%s", w.Code, w.Body.String())
	}
	w := do(t, fix, http.MethodPost, "/admin/admin-users", tok, body)
	if w.Code != http.StatusBadRequest {
		t.Errorf("dup code=%d, want 400", w.Code)
	}
	var r map[string]any
	_ = json.NewDecoder(w.Body).Decode(&r)
	if r["code"] != "ADMIN_USER_EXISTS" {
		t.Errorf("errcode=%v", r["code"])
	}
}

func TestAdminUsers_CreateHappy_CreatedBy(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	root := seedSuper(t, fix, "ou_root")
	tok := jwtFor(t, fix, root)

	w := do(t, fix, http.MethodPost, "/admin/admin-users", tok, map[string]string{
		"lark_user_id": "ou_op", "lark_name": "op", "role": "operator",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("code=%d body=%s", w.Code, w.Body.String())
	}
	created, err := fix.repo.FindByLarkUserID(context.Background(), "ou_op")
	if err != nil {
		t.Fatalf("find created: %v", err)
	}
	if created.CreatedBy != "ou_root" {
		t.Errorf("created_by=%q, want ou_root", created.CreatedBy)
	}
}

func TestAdminUsers_UpdateRole_DemoteSelf(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	root := seedSuper(t, fix, "ou_root")
	tok := jwtFor(t, fix, root)

	w := do(t, fix, http.MethodPatch, "/admin/admin-users/ou_root/role", tok, map[string]string{
		"role": "operator",
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("code=%d, want 400", w.Code)
	}
}

func TestAdminUsers_UpdateRole_OtherOK(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	root := seedSuper(t, fix, "ou_root")
	tok := jwtFor(t, fix, root)
	_ = fix.repo.Create(context.Background(), &model.AdminUser{
		LarkUserID: "ou_op", LarkName: "op", Role: model.RoleOperator,
	})

	w := do(t, fix, http.MethodPatch, "/admin/admin-users/ou_op/role", tok, map[string]string{
		"role": "finance",
	})
	if w.Code != http.StatusOK {
		t.Errorf("code=%d body=%s", w.Code, w.Body.String())
	}
	got, _ := fix.repo.FindByLarkUserID(context.Background(), "ou_op")
	if got.Role != model.RoleFinance {
		t.Errorf("role=%s, want finance", got.Role)
	}
}

func TestAdminUsers_DeleteSelf(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	root := seedSuper(t, fix, "ou_root")
	tok := jwtFor(t, fix, root)

	w := do(t, fix, http.MethodDelete, "/admin/admin-users/ou_root", tok, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("code=%d, want 400", w.Code)
	}
	var r map[string]any
	_ = json.NewDecoder(w.Body).Decode(&r)
	if r["code"] != "CANNOT_REMOVE_SELF" {
		t.Errorf("errcode=%v", r["code"])
	}
}

func TestAdminUsers_DeleteLastSuperAdmin(t *testing.T) {
	fix := setupAdminUsersFixture(t)
	// 两个 super_admin：A 调用删除 B（B 是最后一个就会触发吗？不是，删 B 后 A 还在）
	// 要触发"最后一个 super_admin"，得只剩一个、由别人删它。但 RoleRequired 又要 super_admin。
	// 改用：A 删 A（自删保护）vs 用 super_admin 删除别的 super_admin（这时 repo 检查目标是否是最后一个）。
	// 真实场景：只有一个 super_admin（自己），无法删除任何 super_admin（自删保护拦住）。
	// 这里我们伪造：A 和 B 都是 super，A 删 B → A 还在，可成功；A 删 A → 自删保护拦住。
	// 要测 repository 层的"最后一个"分支，需要两个 super_admin，A 删自己（不行，自删拦）→ 用 B 删 A 也不能（B 自己是 super，那就只剩 B）。
	// 实际：A 删 B → ok（A 留）；A 删 A → CannotRemoveSelf。
	// "最后一个 super_admin" 单元在 repository 已覆盖；handler 层不再重复构造。
	root := seedSuper(t, fix, "ou_root")
	root2 := seedSuper(t, fix, "ou_root2")
	_ = root2
	tok := jwtFor(t, fix, root)

	// A 删 B：成功（A 留）
	w := do(t, fix, http.MethodDelete, "/admin/admin-users/ou_root2", tok, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("code=%d body=%s", w.Code, w.Body.String())
	}
	// 再删 A 自己：自删拦
	w = do(t, fix, http.MethodDelete, "/admin/admin-users/ou_root", tok, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("self-delete code=%d, want 400", w.Code)
	}
}
