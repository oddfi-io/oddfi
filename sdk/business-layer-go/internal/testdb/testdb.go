// Package testdb spins up a MySQL instance for tests and runs the library's
// migrations against it. By default it uses testcontainers (requires Docker);
// if E2E_MYSQL_DSN is set, it uses a local MySQL server instead and creates
// a unique database per test run.
package testdb

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql" // database/sql driver
	"github.com/golang-migrate/migrate/v4"
	migmysql "github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	tcmysql "github.com/testcontainers/testcontainers-go/modules/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/Crypto-Barrett/contracts-business-layer/migrations"
)

// NewMySQL returns a *gorm.DB and cleanup func.
//
// If E2E_MYSQL_DSN is set (server DSN ending in `/`, e.g.
// "root:root@tcp(127.0.0.1:3306)/"), the function creates a unique database
// on that server, runs migrations, and DROPs the database on cleanup. This
// path needs no Docker but does need the DSN's user to have CREATE DATABASE
// privileges.
//
// Otherwise the function falls back to testcontainers-go (requires Docker).
// Skips the test if neither path is available.
func NewMySQL(t *testing.T) (*gorm.DB, func()) {
	t.Helper()
	if dsn := os.Getenv("E2E_MYSQL_DSN"); dsn != "" {
		return newLocalMySQL(t, dsn)
	}
	return newContainerMySQL(t)
}

// newLocalMySQL connects to an already-running MySQL via dsnTemplate, creates
// a unique database, runs migrations, and returns a gorm handle bound to it.
func newLocalMySQL(t *testing.T, dsnTemplate string) (*gorm.DB, func()) {
	t.Helper()
	if !strings.HasSuffix(dsnTemplate, "/") {
		t.Fatalf(`E2E_MYSQL_DSN must be a server DSN ending in "/" (no database name); got %q. Example: "root:root@tcp(127.0.0.1:3306)/"`, dsnTemplate)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rootDSN := dsnTemplate + "?parseTime=true&multiStatements=true"
	rootDB, err := sql.Open("mysql", rootDSN)
	if err != nil {
		t.Skipf("local mysql open failed: %v", err)
	}
	if err := rootDB.PingContext(ctx); err != nil {
		_ = rootDB.Close()
		t.Skipf("local mysql ping failed (set E2E_MYSQL_DSN to a reachable server, or unset to use testcontainers): %v", err)
	}

	dbName := fmt.Sprintf("oddfi_e2e_%d", time.Now().UnixNano())
	if _, err := rootDB.ExecContext(ctx, "CREATE DATABASE `"+dbName+"`"); err != nil {
		_ = rootDB.Close()
		t.Fatalf("CREATE DATABASE %s: %v (does the DSN user have CREATE privilege?)", dbName, err)
	}

	fullDSN := dsnTemplate + dbName + "?parseTime=true&multiStatements=true"
	gdb, err := gorm.Open(mysql.Open(fullDSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		_, _ = rootDB.ExecContext(context.Background(), "DROP DATABASE IF EXISTS `"+dbName+"`")
		_ = rootDB.Close()
		t.Fatalf("gorm.Open against %s: %v", dbName, err)
	}

	sqlDB, err := gdb.DB()
	if err != nil {
		_, _ = rootDB.ExecContext(context.Background(), "DROP DATABASE IF EXISTS `"+dbName+"`")
		_ = rootDB.Close()
		t.Fatalf("DB(): %v", err)
	}
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	if err := runMigrations(sqlDB); err != nil {
		_ = sqlDB.Close()
		_, _ = rootDB.ExecContext(context.Background(), "DROP DATABASE IF EXISTS `"+dbName+"`")
		_ = rootDB.Close()
		t.Fatalf("migrate: %v", err)
	}

	cleanup := func() {
		if db, err := gdb.DB(); err == nil && db != nil {
			_ = db.Close()
		}
		_, _ = rootDB.ExecContext(context.Background(), "DROP DATABASE IF EXISTS `"+dbName+"`")
		_ = rootDB.Close()
	}
	return gdb, cleanup
}

// newContainerMySQL is the original testcontainers-based path (Docker required).
func newContainerMySQL(t *testing.T) (*gorm.DB, func()) {
	t.Helper()
	ctx := context.Background()

	var (
		c   *tcmysql.MySQLContainer
		err error
	)
	func() {
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("testcontainers panic: %v", r)
			}
		}()
		c, err = tcmysql.Run(ctx, "mysql:8.4.7",
			tcmysql.WithDatabase("oddfi"),
			tcmysql.WithUsername("root"),
			tcmysql.WithPassword("root"),
		)
	}()
	if err != nil || c == nil {
		t.Skipf("mysql container unavailable (set E2E_MYSQL_DSN to use a local server): %v", err)
	}

	dsn, err := c.ConnectionString(ctx, "parseTime=true&multiStatements=true")
	if err != nil {
		t.Fatalf("conn string: %v", err)
	}

	gdb, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}

	sqlDB, err := gdb.DB()
	if err != nil {
		t.Fatalf("DB: %v", err)
	}
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	if err := runMigrations(sqlDB); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	cleanup := func() {
		_ = c.Terminate(context.Background())
	}
	return gdb, cleanup
}

// runMigrations applies migrations/*.sql against the given sql.DB.
func runMigrations(sqlDB *sql.DB) error {
	driver, err := migmysql.WithInstance(sqlDB, &migmysql.Config{})
	if err != nil {
		return fmt.Errorf("migrate driver: %w", err)
	}
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("migrate source: %w", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "mysql", driver)
	if err != nil {
		return fmt.Errorf("migrate new: %w", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}
