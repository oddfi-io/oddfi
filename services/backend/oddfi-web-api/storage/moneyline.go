package storage

import (
	"context"
	"errors"
	"oddfi-web-api/model"

	"gorm.io/gorm"
)

type MoneylineRepo struct {
	db *gorm.DB
}

func NewMoneylineRepo(s *DBStorage) *MoneylineRepo {
	return &MoneylineRepo{db: s.db}
}

// GetHistory 读取单场 Moneyline 快照和 fixture 元信息。
// 快照是接口主数据源；fixture 元信息缺失时仍返回曲线，避免历史表已有数据但基础赛事行被清理时接口整体失败。
func (r *MoneylineRepo) GetHistory(ctx context.Context, fixtureID int64) ([]model.MoneylineSnapshotDB, *model.FixtureDB, error) {
	var snapshots []model.MoneylineSnapshotDB
	err := r.db.WithContext(ctx).
		Where("fixture_id = ? AND market_id = ? AND bookmaker_id = ?", fixtureID, 1, 20).
		Order("captured_at ASC").
		Find(&snapshots).Error
	if err != nil {
		return nil, nil, err
	}

	var fixture model.FixtureDB
	err = r.db.WithContext(ctx).Where("id = ?", fixtureID).First(&fixture).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 历史快照表是主数据源；fixture 行缺失时仍返回曲线，前端可降级隐藏 fixture 元信息。
		return snapshots, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	return snapshots, &fixture, nil
}
