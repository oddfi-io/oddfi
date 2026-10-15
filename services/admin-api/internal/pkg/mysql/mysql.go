// Package mysql 封装 GORM MySQL client 的进程级初始化。
//
// 设计取舍：
//   - 启动期 PingContext 校验，失败立即返回错误（main 收到后 Fatal），避免半就绪状态对外服务
//   - SkipDefaultTransaction=true：禁用 GORM 隐式事务，所有写必须显式 tx.Transaction，吞吐更稳
//   - PrepareStmt=true：常用语句预编译复用，长连接场景吃到收益
//   - NowFunc 统一返回 UTC：DB 存 UTC，前端按用户时区展示，避免 DST/时区漂移
//   - GORM 内部日志关闭：本服务统一 zerolog，业务层自己打查询慢日志（后续 ENH）
package mysql

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
)

// New 初始化 GORM MySQL 实例并返回 cleanup 钩子。
//
// log 为 nil 时不输出启动日志（便于单测复用本函数，避免日志噪音）。
func New(ctx context.Context, cfg config.MySQLConfig, log *zerolog.Logger) (*gorm.DB, func() error, error) {
	gormCfg := &gorm.Config{
		SkipDefaultTransaction: true,
		PrepareStmt:            true,
		NowFunc:                func() time.Time { return time.Now().UTC() },
		Logger:                 logger.Default.LogMode(logger.Silent),
	}

	db, err := gorm.Open(mysql.Open(cfg.DSN), gormCfg)
	if err != nil {
		return nil, nil, fmt.Errorf("gorm open: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, nil, fmt.Errorf("get *sql.DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(cfg.MaxOpen)
	sqlDB.SetMaxIdleConns(cfg.MaxIdle)
	sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Ping 失败必须把刚开的连接池关掉，避免泄漏。
	if err := sqlDB.PingContext(ctx); err != nil {
		_ = sqlDB.Close()
		return nil, nil, fmt.Errorf("mysql ping: %w", err)
	}

	if log != nil {
		log.Info().
			Str("module", "pkg_mysql").
			Int("max_open", cfg.MaxOpen).
			Int("max_idle", cfg.MaxIdle).
			Msg("mysql connected")
	}

	// cleanup 必须幂等：sql.DB.Close 在 driver 内部多次调用返回 ErrConnDone，忽略即可。
	cleanup := func() error {
		return sqlDB.Close()
	}
	return db, cleanup, nil
}
