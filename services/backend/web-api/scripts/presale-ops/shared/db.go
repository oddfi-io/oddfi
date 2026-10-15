package shared

import (
	"fmt"
	"os"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitDB 从环境变量或默认 DSN 初始化 GORM 连接。
// 脚本启动时调用；连接失败立即 Fatal，避免脚本带错误状态继续运行。
//
// 查找顺序：
//  1. 环境变量 PRESALE_OPS_DB_DSN（最高优先级，统一覆盖）
//  2. env="prod" 时读 ADMIN_DB_DSN（共享 MySQL 生产连接串）
//  3. 默认 dev DSN（本地开发，无需额外配置）
func InitDB(env string) *gorm.DB {
	dsn := os.Getenv("PRESALE_OPS_DB_DSN")
	if dsn == "" {
		if env == "prod" {
			// 生产环境使用共享 MySQL（与 admin-backend 同库，presale_admin_audit 在此）
			dsn = os.Getenv("ADMIN_DB_DSN")
		}
		if dsn == "" {
			// 默认 dev DSN（本地开发 docker-compose 环境）
			dsn = "root:root@tcp(127.0.0.1:3306)/oddfi_dev?parseTime=true&loc=UTC&charset=utf8mb4"
		}
	}

	logLevel := logger.Info
	if env == "prod" {
		// 生产环境仅记录 warn 以上，避免 SQL 语句泄露
		logLevel = logger.Warn
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "[ops-script] DB 连接失败（env=%s）: %v\n", env, err)
		os.Exit(1)
	}
	return db
}

// CloseDB 释放连接池，脚本退出前调用（defer 使用）
func CloseDB(db *gorm.DB) {
	sqlDB, err := db.DB()
	if err != nil {
		return
	}
	_ = sqlDB.Close()
}
