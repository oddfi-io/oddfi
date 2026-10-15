package repository

import (
	"testing"
)

// TestEnsureAll_IdempotencyContract 验证 EnsureAll 幂等语义
// 空 vault 列表时不应报错（边界条件）
func TestEnsureAll_EmptyVaultList(t *testing.T) {
	// EnsureAll(ctx, []) 应该直接返回 nil，不做任何 DB 操作
	// 通过检查函数接口约定（无 DB 时无法实际测试 INSERT IGNORE 幂等，需集成测试）
	repo := &presaleEventCursorRepo{db: nil}
	// 调用 nil db repo 的 EnsureAll（空列表时在 DB 调用前 return nil）
	err := repo.EnsureAll(nil, []string{}, 0)
	if err != nil {
		t.Errorf("EnsureAll with empty list should return nil, got %v", err)
	}
}

// TestEnsureAll_IdempotencySemantics 验证 EnsureAll 的幂等设计文档
// 说明：EnsureAll 使用 clause.OnConflict{DoNothing: true}（INSERT IGNORE 语义），
// 重复调用不覆盖已有游标进度，保证 Worker 重启后从上次位置继续扫块。
// 完整幂等验证（含 MySQL INSERT IGNORE）需要集成测试（连接真实 DB）覆盖。
func TestEnsureAll_DesignDocumentation(t *testing.T) {
	// 设计约定验证：
	// 1. EnsureAll 不应覆盖已有游标（DoNothing 语义）
	// 2. Worker 重启后 Load 的 last_block_number 应等于上次 Save 的值
	// 3. 新增金库地址时 EnsureAll 只插入新行，不碰老行
	//
	// 以上约定由 ON DUPLICATE KEY DO NOTHING（clause.OnConflict{DoNothing: true}）保证，
	// 此测试作为设计文档，集成测试（需 MySQL）验证实际行为。
	t.Log("EnsureAll idempotency is guaranteed by clause.OnConflict{DoNothing:true} — see integration tests for full DB verification")
}

// TestPresaleEventCursorRepo_ConstructorNotNil 验证构造函数返回非 nil 接口
func TestPresaleEventCursorRepo_ConstructorNotNil(t *testing.T) {
	var repo PresaleEventCursorRepository
	repo = NewPresaleEventCursorRepo(nil)
	if repo == nil {
		t.Fatal("NewPresaleEventCursorRepo should return non-nil interface")
	}
}
