package db

import (
	"log"
	"time"

	"oddfi-bet-settle/internal/model"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// DBStorage 封装 GORM 连接，避免业务层直接关心数据库初始化细节。
type DBStorage struct {
	db *gorm.DB
}

// GetDB 返回内部的 GORM 实例
func (s *DBStorage) GetDB() *gorm.DB {
	return s.db
}

// InitMySQL 初始化数据库连接并自动迁移表结构
func NewDBStorage(dsn string) *DBStorage {
	// 1. 使用配置中的 DSN 连接
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		SkipDefaultTransaction: true,
	})
	if err != nil {
		log.Fatalf("[NewDBStorage] 数据库连接失败: %v", err)
	}

	// 2. 配置连接池 (Connection Pool)
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("[NewDBStorage] ❌ 获取 sql.DB 失败: %v", err)
	}

	// 设置最大空闲连接数
	sqlDB.SetMaxIdleConns(10)
	// 设置最大打开连接数（根据你的 MySQL 配置调整）
	sqlDB.SetMaxOpenConns(100)
	// 设置连接可复用的最大时间
	sqlDB.SetConnMaxLifetime(time.Hour)

	// 2. 自动迁移 (此时 GORM 会调用 model 中的 TableName() 方法)
	err = db.AutoMigrate(
		&model.OddDB{},
		&model.FixtureDB{},
		&model.FixtureResult{},
	)
	if err != nil {
		log.Fatalf("表结构同步失败: %v", err)
	}
	log.Println("✅ 数据库表结构同步完成，使用自定义表名")
	return &DBStorage{db: db}
}
