package mysql

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	loggerIns logger.Interface
	db        *gorm.DB
)

func init() {
	loggerIns = logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags), // io writer
		logger.Config{
			SlowThreshold:             time.Second, // Slow SQL threshold
			LogLevel:                  logger.Warn, // Log level
			IgnoreRecordNotFoundError: true,        // Ignore ErrRecordNotFound error for logger
			ParameterizedQueries:      false,       // Don't include params in the SQL log
			Colorful:                  false,       // Disable color
		},
	)
}

// InitMysql 初始化 MySQL 连接
func InitMysql(dsn string) error {
	if dsn == "" {
		return fmt.Errorf("mysql dsn is empty")
	}

	var err error
	db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: loggerIns,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to mysql: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(800)
	sqlDB.SetMaxOpenConns(800)
	sqlDB.SetConnMaxLifetime(time.Minute)

	return nil
}

// GetDB 获取数据库句柄
func GetDB() *gorm.DB {
	return db
}

// IsEmpty 检查数据库句柄是否为空
func IsEmpty() bool {
	return db == nil
}
