package storage

import (
	"log"
	"time"

	"oddfi-odds-engine/internal/model"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DBStorage struct {
	db *gorm.DB
}

func NewDBStorage(dsn string) *DBStorage {
	// 配置 GORM 日志级别，生产环境建议用 Warn
	newLogger := logger.Default.LogMode(logger.Info)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger:      newLogger,
		PrepareStmt: true, // 开启预编译，提升批量更新性能
	})
	if err != nil {
		log.Fatalf("❌ 无法连接到 RDS MySQL: %v", err)
	}

	// 获取底层 sql.DB 以配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("❌ 获取 sql.DB 失败: %v", err)
	}

	// 针对 RDS 的优化配置
	sqlDB.SetMaxIdleConns(10)           // 空闲连接池大小
	sqlDB.SetMaxOpenConns(100)          // 最大打开连接数
	sqlDB.SetConnMaxLifetime(time.Hour) // 连接最长存活时间，防止长时间不用被 RDS 主动断开

	// --- 自动同步表结构 ---
	// 1. model.Odd: 赔率 + 选项 + 风控数据 (核心表)
	// 2. model.Bet: 真实的注单记录 (用于查账和结算)
	// 自动同步表结构
	err = db.AutoMigrate(
		&model.Odd{},
		&model.Bet{},
	)
	if err != nil {
		log.Printf("⚠️ 自动迁移表结构失败: %v", err)
	}

	return &DBStorage{db: db}
}

func (s *DBStorage) GetDB() *gorm.DB {
	return s.db
}
