package repository

import (
	"testing"
)

// TestPresaleConfigRepo_Constructor 验证构造函数返回非 nil 接口
func TestPresaleConfigRepo_Constructor(t *testing.T) {
	var repo PresaleConfigRepository
	repo = NewPresaleConfigRepo(nil)
	if repo == nil {
		t.Fatal("NewPresaleConfigRepo should return non-nil interface")
	}
}
