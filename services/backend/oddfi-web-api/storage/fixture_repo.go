package storage

// import (
// 	"context"
// 	"oddfi-web-api/model"

// 	"gorm.io/gorm"
// )

// // // 单条详情：MySQL 拿 fixture 行，再批量拉 odds / statistics / league，组装为 model.Fixture
// // func (r *FixtureRepo) GetFixtureByID(ctx context.Context, id int64) (*model.Fixture, error)

// // // 按日期（starting_at ∈ [date 00:00:00, date+1 00:00:00)，按 starting_at_timestamp ASC 排序）
// // func (r *FixtureRepo) GetFixturesByDate(ctx context.Context, date string) ([]model.Fixture, error)

// // // 按区间（闭区间；包内做最多 31 天 span 校验；按 league 权重/time 排序）
// // func (r *FixtureRepo) GetFixturesByRange(ctx context.Context, start, end string) ([]model.Fixture, error)

// // // 按联赛ID查询所有比赛
// // // leagueID = 732  or  2
// // func (r *FixtureRepo) GetFixturesByLeagueID(ctx context.Context, leagueID int) ([]model.Fixture, error)

// // 私有批量关联：均接受 ctx、fixtureIDs []int64、leagueIDs []int
// func (r *FixtureRepo) loadOddsByFixtureIDs(ctx context.Context, ids []int64) (map[int64][]model.APIOdd, error)
// func (r *FixtureRepo) loadStatisticsByFixtureIDs(ctx context.Context, ids []int64) (map[int64][]model.APIStatistics, error)
// func (r *FixtureRepo) loadLeaguesByIDs(ctx context.Context, ids []int) (map[int]model.APILeague, error)

// // 单行行 → 响应体（把 HomeTeam*/AwayTeam* 展开为 Participants[2]）
// func assembleFixture(row model.FixtureDB, odds []model.APIOdd, stats []model.APIStatistics, lg model.APILeague) model.Fixture
