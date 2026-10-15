package repository

import (
	"testing"
)

// TestUserReferralCodeRepo_Constructor 验证构造函数接口约定
func TestUserReferralCodeRepo_Constructor(t *testing.T) {
	var repo UserReferralCodeRepository
	repo = NewUserReferralCodeRepo(nil)
	if repo == nil {
		t.Fatal("NewUserReferralCodeRepo should return non-nil interface")
	}
}

// TestErrCodeConflict_NotNil 验证 ErrCodeConflict 哨兵错误已定义
// 调用方通过 errors.Is(err, ErrCodeConflict) 判断是否需要重试生成 code
func TestErrCodeConflict_NotNil(t *testing.T) {
	if ErrCodeConflict == nil {
		t.Fatal("ErrCodeConflict must be non-nil sentinel error")
	}
	if ErrCodeConflict.Error() == "" {
		t.Fatal("ErrCodeConflict must have non-empty message")
	}
}
