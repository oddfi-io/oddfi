package mysql

import (
	"context"
	"time"

	"oddfi-cron-job/internal/logger"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

var DB *gorm.DB

// customGormLogger 自定义GORM日志实现，适配项目zap日志
type customGormLogger struct{}

func (l *customGormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	return l
}

func (l *customGormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	logger.Infof(msg, data...)
}

func (l *customGormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	logger.Warnf(msg, data...)
}

func (l *customGormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	logger.Errorf(msg, data...)
}

func (l *customGormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	elapsed := time.Since(begin)
	sql, rows := fc()
	
	if err != nil {
		logger.Errorf("SQL: %s; Rows: %d; Elapsed: %v; Error: %v", sql, rows, elapsed, err)
	} else {
		logger.Debugf("SQL: %s; Rows: %d; Elapsed: %v", sql, rows, elapsed)
	}
}

// Init 初始化MySQL连接，失败则panic
func Init(dsn string, maxOpenConns, maxIdleConns, connMaxLifetime int) {
	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: &customGormLogger{},
		NowFunc: func() time.Time {
			return time.Now().Local()
		},
	})
	if err != nil {
		panic("gorm connection failed: " + err.Error())
	}

	// 获取底层 sql.DB 配置连接池
	sqlDB, err := DB.DB()
	if err != nil {
		panic("failed to get underlying sql.DB: " + err.Error())
	}

	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(connMaxLifetime) * time.Second)

	// 测试连接
	if err = sqlDB.Ping(); err != nil {
		panic("mysql ping failed: " + err.Error())
	}

	logger.Infof("MySQL connected successfully (GORM)")
}

// GetDB 获取全局GORM DB实例
func GetDB() *gorm.DB {
	return DB
}

// Close 关闭连接
func Close() error {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}
