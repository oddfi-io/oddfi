package mysql

import (
	"database/sql"
	"fmt"
	"sync"
	"time"

	"everything_finance/org/web-api/internal/config"

	_ "github.com/go-sql-driver/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Client struct {
	db  *sql.DB
	gdb *gorm.DB
}

var (
	client   *Client
	initOnce sync.Once
	gormOnce sync.Once
	gormDB   *gorm.DB
)

func Init(cfg config.DatabaseConfig) *Client {
	initOnce.Do(func() {
		db, err := sql.Open("mysql", cfg.DSN())
		if err != nil {
			panic(fmt.Sprintf("failed to open database: %v", err))
		}

		db.SetMaxOpenConns(cfg.MaxOpenConns)
		db.SetMaxIdleConns(cfg.MaxIdleConns)
		db.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

		if err := db.Ping(); err != nil {
			panic(fmt.Sprintf("failed to ping database: %v", err))
		}

		client = &Client{db: db}
	})
	return client
}

func InitGORM(cfg config.DatabaseConfig) *gorm.DB {
	gormOnce.Do(func() {
		gdb, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
		if err != nil {
			panic(fmt.Sprintf("failed to open gorm database: %v", err))
		}

		sqlDB, err := gdb.DB()
		if err != nil {
			panic(fmt.Sprintf("failed to get underlying sql.DB: %v", err))
		}

		sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
		sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
		sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

		gormDB = gdb
	})
	return gormDB
}

func GetMySQL() *Client {
	if client == nil {
		panic("mysql not initialized, call Init() first")
	}
	return client
}

func GetGORM() *gorm.DB {
	if gormDB == nil {
		panic("gorm not initialized, call InitGORM() first")
	}
	return gormDB
}

func (c *Client) Ping() error {
	return c.db.Ping()
}

func (c *Client) Close() error {
	return c.db.Close()
}

func (c *Client) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return c.db.Query(query, args...)
}

func (c *Client) QueryRow(query string, args ...interface{}) *sql.Row {
	return c.db.QueryRow(query, args...)
}

func (c *Client) Exec(query string, args ...interface{}) (sql.Result, error) {
	return c.db.Exec(query, args...)
}

func (c *Client) Begin() (*sql.Tx, error) {
	return c.db.Begin()
}

func (c *Client) Prepare(query string) (*sql.Stmt, error) {
	return c.db.Prepare(query)
}

func (c *Client) GetDB() *sql.DB {
	return c.db
}
