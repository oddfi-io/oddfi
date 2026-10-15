package repository

import (
	"testing"
)

// TestUserReferralBindRepo_Constructor 验证构造函数接口约定
func TestUserReferralBindRepo_Constructor(t *testing.T) {
	var repo UserReferralBindRepository
	repo = NewUserReferralBindRepo(nil)
	if repo == nil {
		t.Fatal("NewUserReferralBindRepo should return non-nil interface")
	}
}
