// Package gormtx 提供 GORM 事务跨函数传递的 context helper。
//
// 设计动机（DD-003 v3.1 §4.4 + ADR-0003）：
//
//   - admin internal endpoint 要求「business + audit + idempotency 同 tx 原子写入」
//   - middleware 开 tx 后注入 ctx，handler / service / repo 全程从 ctx 提取，避免传 *gorm.DB 参数污染签名
//   - 仅供 /internal/admin/* 路径使用；用户路径（/api/v1/*）仍用 db.Transaction(fn) 旧范式
//   - ADR-0003 记录双范式 debt，TGE+30 天评估统一化
//
// 严格 fail-fast：
//
//   - WithTx 必须在 middleware 顶层调用一次，否则 service 层 From 返 nil 触发崩溃
//   - service 调用时若 From(ctx) == nil → 代码 bug，立即 panic 暴露问题
package gormtx

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// txKey 是 ctx value 的私有 key，防止外部包伪造 ctx 注入伪 tx。
type txKey struct{}

// ErrNoTx 表示 ctx 中没有 tx — 调用方约定违反，fail-fast。
var ErrNoTx = errors.New("gormtx: no transaction in context (caller must wrap with WithTx)")

// WithTx 在 db 上开启新事务并返回携带 tx 的 ctx。
// caller 必须在请求 lifecycle 末尾调用 Commit 或 Rollback，否则连接泄漏。
//
// 典型 admin_audit middleware 用法：
//
//	ctx := gormtx.WithTx(c.Request.Context(), db)
//	c.Request = c.Request.WithContext(ctx)
//	c.Next()
//	if c.IsAborted() { gormtx.Rollback(ctx); return }
//	// ...
//	gormtx.Commit(ctx)
func WithTx(ctx context.Context, db *gorm.DB) context.Context {
	tx := db.WithContext(ctx).Begin()
	return context.WithValue(ctx, txKey{}, tx)
}

// InjectTx 将已存在的 tx 注入 ctx（不开新事务）。
// 供测试或已有 tx 需要跨层传递时使用，避免重复 Begin。
func InjectTx(ctx context.Context, tx *gorm.DB) context.Context {
	return context.WithValue(ctx, txKey{}, tx)
}

// From 提取 ctx 中的 tx。返回 nil 表示 caller 违反约定。
// service / repo 层调用时建议立即 nil 检查并 fail-fast。
func From(ctx context.Context) *gorm.DB {
	tx, _ := ctx.Value(txKey{}).(*gorm.DB)
	return tx
}

// MustFrom 提取 tx，nil 时 panic。用于必须有 tx 才能跑的业务函数。
func MustFrom(ctx context.Context) *gorm.DB {
	tx := From(ctx)
	if tx == nil {
		panic(fmt.Sprintf("gormtx.MustFrom: %v", ErrNoTx))
	}
	return tx
}

// Commit 提交 ctx 中的 tx。无 tx 返 ErrNoTx；commit 错误向上传。
func Commit(ctx context.Context) error {
	tx := From(ctx)
	if tx == nil {
		return ErrNoTx
	}
	return tx.Commit().Error
}

// Rollback 回滚 ctx 中的 tx。无 tx 时静默返回（rollback 是 best-effort）。
// 失败时返回 error 给 caller 决定是否记 log。
func Rollback(ctx context.Context) error {
	tx := From(ctx)
	if tx == nil {
		return nil
	}
	return tx.Rollback().Error
}
