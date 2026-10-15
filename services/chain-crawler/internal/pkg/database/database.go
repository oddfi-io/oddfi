package database

import (
	"context"
	"log"
	"os"
	"time"

	"chain_crawler/pkg/tracelog"

	"github.com/prometheus/client_golang/prometheus"
	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/plugin/dbresolver"
)

var loggerIns logger.Interface

var (
	DatabaseRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "database",
		Name:      "request_duration",
		Help:      "Request duration",
	}, []string{
		"method",
	})

	DatabaseRequestCount = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "database",
		Name:      "request_count",
		Help:      "request_count",
	}, []string{
		"method",
		"chain",
	})
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

func InitMySQLEngine(ctx context.Context, dsn, replicasDSN string) (*gorm.DB, error) {

	InitMySQLEngineSpanCtx, InitMySQLEngineSpan := tracelog.StartSpan(ctx, "database", "InitMySQLEngine")
	defer InitMySQLEngineSpan.End()
	tl := tracelog.NewWithContext(InitMySQLEngineSpanCtx)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: loggerIns,
	})
	if err != nil {
		tl.Infow("gorm.Open failed", "err", err.Error())
		return nil, err
	}

	maxOpenConns := 800
	maxIdleConns := 800
	maxLifeTime := time.Minute

	if replicasDSN != "" {
		dbResolver := dbresolver.Register(dbresolver.Config{
			Sources:  []gorm.Dialector{mysql.Open(dsn)},
			Replicas: []gorm.Dialector{mysql.Open(replicasDSN)},
			Policy:   dbresolver.RandomPolicy{},
		}).SetMaxOpenConns(maxOpenConns).SetMaxIdleConns(maxIdleConns).SetConnMaxLifetime(maxLifeTime)
		err = db.Use(dbResolver)
		if err != nil {
			tl.Infow("gorm use resolver failed", "err", err.Error())
			return nil, err
		}
		return db, nil
	} else {
		sqlDB, err := db.DB()
		if err != nil {
			return nil, err
		}
		sqlDB.SetMaxOpenConns(maxOpenConns)
		sqlDB.SetMaxIdleConns(maxIdleConns)
		sqlDB.SetConnMaxLifetime(maxLifeTime)
		return db, nil
	}
}

func InitSqliteEngine(ctx context.Context) (*gorm.DB, error) {
	InitSqliteEngineSpanCtx, InitSqliteEngineSpan := tracelog.StartSpan(ctx, "database", "InitSqliteEngine")
	defer InitSqliteEngineSpan.End()
	tl := tracelog.NewWithContext(InitSqliteEngineSpanCtx)
	db, err := gorm.Open(sqlite.Open("file:testdatabase?mode=memory&cache=shared"), &gorm.Config{
		Logger: loggerIns,
	})
	if err != nil {
		tl.Infow("gorm.Open failed", "err", err.Error())
		return nil, err
	}
	return db, nil
}
