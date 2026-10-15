package repository

import (
	"context"

	"chain_crawler/internal/config"
	"chain_crawler/internal/pkg/database"
	"chain_crawler/pkg/redis"
	"chain_crawler/pkg/tracelog"

	"gorm.io/gorm"
)

type Repository interface {
	GetRedisClient() redis.RedisClient

	// mysql schedule_task
	CreateTask(ctx context.Context, task ScheduleTask) (uint, error)
	UpdateTask(ctx context.Context, task ScheduleTask) (int64, error)
	UpdateTaskWithSelect(ctx context.Context, task ScheduleTask) (int64, error)
	QueryTask(ctx context.Context, params QueryTaskParams) ([]ScheduleTask, error)
	UpdateTaskWithState(ctx context.Context, task ScheduleTask, taskState TaskState) (int64, error)
}

func NewRepository(ctx context.Context, cfg config.Config) Repository {
	r := &repositoryImpl{
		cfg: cfg,
	}
	r.init(ctx)
	return r
}

type repositoryImpl struct {
	cfg       config.Config
	hotParams map[string]any

	db          *gorm.DB
	redisClient redis.RedisClient
}

func (r *repositoryImpl) init(ctx context.Context) {
	InitRepositorySpanCtx, InitRepositorySpan := tracelog.StartSpan(ctx, "database", "InitRepository")
	defer InitRepositorySpan.End()
	tl := tracelog.NewWithContext(InitRepositorySpanCtx)
	var err error
	if r.cfg.MySQL.Mock {
		r.db, err = database.InitSqliteEngine(ctx)
		if err != nil {
			panic(err)
		}
	} else {
		r.db, err = database.InitMySQLEngine(ctx, r.cfg.MySQL.DSN, "")
		if err != nil {
			panic(err)
		}
	}
	if err := r.db.AutoMigrate(&ScheduleTask{}); err != nil {
		panic(err)
	}

	r.redisClient = redis.NewRedisClient(r.cfg.Redis)
	tl.Infow("InitRepository success")
}

func (r *repositoryImpl) GetRedisClient() redis.RedisClient {
	return r.redisClient
}
