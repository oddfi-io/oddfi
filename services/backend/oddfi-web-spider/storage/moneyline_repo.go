package storage

import (
	"context"
	"errors"
	"time"

	"oddfi-web-spider/model"
	"oddfi-web-spider/utils"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type MoneylineRepo struct {
	db *gorm.DB
}

func NewMoneylineRepo(s *DBStorage) *MoneylineRepo {
	return &MoneylineRepo{db: s.db}
}

// GetStatus 返回单场采集状态。
// 未找到时返回 nil 而不是错误，是为了让状态机能把首次出现的 fixture 当作 PENDING 初始化。
func (r *MoneylineRepo) GetStatus(ctx context.Context, fixtureID int64) (*model.MoneylineCollectionStatus, error) {
	var status model.MoneylineCollectionStatus
	err := r.db.WithContext(ctx).Where("fixture_id = ?", fixtureID).First(&status).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &status, nil
}

// FindStatuses 批量读取状态。
// RefreshActiveSet 每次会扫描一批白名单 fixture，批量读取可以避免 N+1 查询放大数据库压力。
func (r *MoneylineRepo) FindStatuses(ctx context.Context, fixtureIDs []int64) (map[int64]model.MoneylineCollectionStatus, error) {
	if len(fixtureIDs) == 0 {
		return map[int64]model.MoneylineCollectionStatus{}, nil
	}
	var statuses []model.MoneylineCollectionStatus
	if err := r.db.WithContext(ctx).Where("fixture_id IN ?", fixtureIDs).Find(&statuses).Error; err != nil {
		return nil, err
	}
	result := make(map[int64]model.MoneylineCollectionStatus, len(statuses))
	for _, status := range statuses {
		result[status.FixtureID] = status
	}
	return result, nil
}

// UpsertStatus 以 fixture_id 为唯一状态机主键做幂等写入。
// runner 和全量 spider 都可能推进同一场比赛，使用 upsert 可以降低重复初始化导致的冲突。
func (r *MoneylineRepo) UpsertStatus(ctx context.Context, status model.MoneylineCollectionStatus) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "fixture_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"status",
			"first_captured_at",
			"last_captured_at",
			"last_state_id",
			"capture_count",
			"next_poll_at",
			"notes",
			"updated_at",
		}),
	}).Create(&status).Error
}

// UpsertStatuses 批量初始化/纠偏状态。
// 批量 upsert 用于启动活跃集合，避免 1600+ 白名单在服务重启时逐条写库造成慢启动。
func (r *MoneylineRepo) UpsertStatuses(ctx context.Context, statuses []model.MoneylineCollectionStatus) error {
	if len(statuses) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "fixture_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"status",
			"first_captured_at",
			"last_captured_at",
			"last_state_id",
			"capture_count",
			"next_poll_at",
			"notes",
			"updated_at",
		}),
	}).CreateInBatches(&statuses, 500).Error
}

// InsertSnapshots 批量写入三方快照。
// 快照表是历史事实表，不做 upsert 覆盖；同一 fixture 每次采集都应保留时间序列点。
func (r *MoneylineRepo) InsertSnapshots(ctx context.Context, snapshots []model.MoneylineSnapshot) error {
	if len(snapshots) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(&snapshots, 300).Error
}

// FindDueFixtures 查询当前应采集的 fixture。
// 只读 POLLING/ANOMALY 是为了让 COMPLETED/STOPPED 永久停采，避免历史赛事继续消耗 SportMonks 配额。
func (r *MoneylineRepo) FindDueFixtures(ctx context.Context, now time.Time, limit int) ([]int64, error) {
	if limit <= 0 {
		limit = 100
	}
	type row struct {
		FixtureID int64
	}
	var rows []row
	// ANOMALY 也依赖 next_poll_at 做低频探测；否则一旦进入异常态就不会再被 runner 捞起恢复。
	err := r.db.WithContext(ctx).
		Model(&model.MoneylineCollectionStatus{}).
		Select("fixture_id").
		Where("status IN ? AND next_poll_at <= ?", []string{utils.MoneylineStatusPolling, utils.MoneylineStatusAnomaly}, now).
		Order("next_poll_at ASC").
		Limit(limit).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	fixtureIDs := make([]int64, 0, len(rows))
	for _, row := range rows {
		fixtureIDs = append(fixtureIDs, row.FixtureID)
	}
	return fixtureIDs, nil
}

// FindWhitelistFixturesInWindow 从本地 fixture 表挑选可能启动采集的比赛。
// RefreshActiveSet 只依赖本地已同步的 fixture，避免为了发现活跃集合再额外全量调用 SportMonks。
func (r *MoneylineRepo) FindWhitelistFixturesInWindow(ctx context.Context, fixtureIDs []int64, windowStart, windowEnd time.Time) ([]model.Fixture, error) {
	if len(fixtureIDs) == 0 {
		return nil, nil
	}
	var fixtures []model.Fixture
	err := r.db.WithContext(ctx).
		Where("id IN ? AND starting_at >= ? AND starting_at < ?", fixtureIDs, windowStart, windowEnd).
		Find(&fixtures).Error
	return fixtures, err
}
