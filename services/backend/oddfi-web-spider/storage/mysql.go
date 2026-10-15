package storage

import (
	"context"
	"log"
	"time"

	"oddfi-web-spider/model"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

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
		&model.League{},
		&model.Fixture{},
		&model.OddDB{},
		&model.StatisticDB{},
		&model.FixtureResultDB{},
		&model.MoneylineSnapshot{},
		&model.MoneylineCollectionStatus{},
	)
	if err != nil {
		log.Fatalf("表结构同步失败: %v", err)
	}
	log.Println("✅ 数据库表结构同步完成，使用自定义表名")
	return &DBStorage{db: db}
}

// UpsertOdds 批量插入或更新赔率数据
func (s *DBStorage) UpsertOdds(odds []model.OddDB) error {
	if len(odds) == 0 {
		return nil
	}
	// 核心点 1：使用 CreateInBatches。
	// 假设 50 场比赛，每场 3 个 Market，每个 Market 2-3 个 Label，数据量轻松破百。
	// 分批插入能有效防止 MySQL 的 "max_allowed_packet" 报错。
	err := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "odd_id"}}, // 关键修复
		UpdateAll: true,
	}).CreateInBatches(&odds, 500).Error

	if err != nil {
		log.Printf("❌ 批量 Upsert Odds 失败: %v", err)
		return err
	}
	log.Printf("✅ 批量 Upsert Odds 成功：%d 条赔率已更新/插入", len(odds))
	return nil
}

// 补充更新 statistic 表逻辑
func (s *DBStorage) UpsertStatistics(statistics []model.StatisticDB) error {
	if len(statistics) == 0 {
		return nil
	}

	err := s.db.Clauses(clause.OnConflict{
		UpdateAll: true,
	}).CreateInBatches(&statistics, 500).Error

	if err != nil {
		log.Printf("❌ 批量 Upsert Statistics 失败: %v", err)
		return err
	}
	log.Printf("✅ 批量 Upsert Statistics 成功：%d 条已更新/插入", len(statistics))
	return nil
}

// 原先旧逻辑函数
func (s *DBStorage) UpsertFixtures(ctx context.Context, fixtures []model.Fixture) error {
	if len(fixtures) == 0 {
		return nil
	}

	// 使用 CreateInBatches 替代 Create，每批处理 500 条
	// 使用 UpdateAll 替代长长的字段列表，提升后期可维护性
	err := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		UpdateAll: true,
	}).CreateInBatches(&fixtures, 500).Error

	if err != nil {
		log.Printf("❌ 批量 Upsert Fixtures 失败: %v", err)
		return err
	}
	log.Printf("✅ 批量 Upsert Fixtures 成功：%d 条已更新/插入", len(fixtures))
	return nil
}

// FixtureResultDB 更新数据
func (s *DBStorage) UpsertFixtureResults(ctx context.Context, fixtureResults []model.FixtureResultDB) error {
	if len(fixtureResults) == 0 {
		return nil
	}

	err := s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "fixture_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"state_id",
			"state_code",
			"state_name",
			"home_score_full",
			"away_score_full",
			"home_score_half",
			"away_score_half",
			"home_score_extra",
			"away_score_extra",
			"home_score_penalty",
			"away_score_penalty",
			"raw_score_data",
			"raw_state_date",
			"updated_at",
		}),
	}).CreateInBatches(&fixtureResults, 500).Error

	if err != nil {
		log.Printf("❌ 批量 Upsert FixtureResults 失败: %v", err)
		return err
	}
	log.Printf("✅ 批量 Upsert FixtureResults 成功：%d 条已更新/插入", len(fixtureResults))
	return nil
}

func (s *DBStorage) UpsertFixturesPro(ctx context.Context, fixtures []model.Fixture) error {
	if len(fixtures) == 0 {
		return nil
	}

	// 【步骤 1: 提取所有待更新的 Fixture ID】
	var fixtureIDs []int64
	for _, f := range fixtures {
		fixtureIDs = append(fixtureIDs, f.ID)
	}

	// 【步骤 2: 批量拉取旧状态，用于对比跃迁】
	// 优化：只 Select id 和 state_id 两个字段，绝对不要 SELECT *，避免撑爆内存
	type OldState struct {
		ID      int64
		StateID int
	}
	var oldStates []OldState
	// 【关键修改点】：使用 Model(&model.Fixture{}) 替代 Table("...")
	// GORM 会自动调用 model.Fixture 的 TableName() 方法获取正确的表名
	if err := s.db.Model(&model.Fixture{}).
		Select("id, state_id").
		Where("id IN ?", fixtureIDs).
		Find(&oldStates).Error; err != nil {
		log.Printf("⚠️ 拉取旧赛事状态失败，但不阻断流程: %v", err)
		// 注意：如果这里失败，依然可以继续 Upsert，只是这一轮不会触发结算
	}

	// 转化为 O(1) 复杂度的 Map
	oldStateMap := make(map[int64]int)
	for _, os := range oldStates {
		oldStateMap[os.ID] = os.StateID
	}

	// 【步骤 3: 执行高效的批量 Upsert】
	err := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		UpdateAll: true,
	}).CreateInBatches(&fixtures, 500).Error

	if err != nil {
		log.Printf("[UpsertFixturesPro] ❌ 批量 Upsert Fixtures 失败: %v", err)
		return err
	}
	log.Printf("[UpsertFixturesPro] ✅ 批量 Upsert Fixtures 成功：%d 条已更新/插入", len(fixtures))

	// 【步骤 4: 对比状态，触发结算里程碑】
	for _, f := range fixtures {
		oldStateID, exists := oldStateMap[f.ID]
		// 场景 A: 比赛已存在，且状态发生了跃迁
		if exists && oldStateID != f.StateID {
			if isSettlementMilestone(oldStateID, f.StateID) {
				log.Printf("[UpsertFixturesPro] 🔔 触发结算里程碑 [FixtureID: %d] 状态跃迁: %d -> %d", f.ID, oldStateID, f.StateID)
				// 异步触发：千万不要阻塞当前的 Upsert 主流程
				// go triggerSettlementFlow(ctx, f.ID, f.StateID)
			}
		} else if !exists {
			// 场景 B: 这是一场新插入的比赛
			// 极端情况防御：如果系统宕机很久，刚恢复启动，拉取到的新比赛已经是 FT 状态了，也需要触发结算
			// 此时旧状态假设为 0 (未定义)
			if isSettlementMilestone(0, f.StateID) {
				log.Printf("🔔 触发新比赛直接结算 [FixtureID: %d] 初始状态即为完赛: %d", f.ID, f.StateID)
				// go triggerSettlementFlow(ctx, f.ID, f.StateID)
			}
		}
	}

	return nil
}

// isSettlementMilestone 判断是否需要触发赛果拉取和派彩流程
func isSettlementMilestone(oldStateID, newStateID int) bool {
	// 如果状态没变，直接返回
	if oldStateID == newStateID {
		return false
	}
	// Sportmonks 核心完赛/异常状态 ID 字典 (参考你之前调研的数据)
	// 5: FT, 7: AET, 8: FT_PEN, 12: CANCELLED, 10: POSTPONED, 15: ABANDONED, 14: WO (弃权), 17: AWARDED (判胜)
	settlementStates := map[int]bool{
		5:  true, // 正常全场结束
		7:  true, // 加时赛后结束
		8:  true, // 点球大战后结束
		10: true, // 延期 (需退本金)
		12: true, // 取消 (需退本金)
		14: true, // 弃权
		15: true, // 中止
		17: true, // 行政判决
	}

	// 只要新状态属于“结算终态”，且老状态不是，就触发
	// 这样可以防止：本来是 FT，后来 API 临时变回 FT，导致重复触发
	return settlementStates[newStateID]
}

// triggerSettlementFlow 独立协程执行，绝不阻塞主轮询
// func triggerSettlementFlow(fixtureID int64, finalStateID int) {
// 	// 1. 【安全气囊设计】延迟 3-5 分钟，防止 VAR 赛后改判比分
// 	// 提示：如果是 CANCELLED 等异常状态，可以不延迟，此处根据 finalStateID 做判断优化
// 	if finalStateID == 5 || finalStateID == 7 || finalStateID == 8 {
// 		time.Sleep(3 * time.Minute)
// 	}
// 	// 2. 向 Sportmonks API 发起带 `include=scores,events` 的高精度查询
// 	// 伪代码:
// 	// fixtureDetail, err := apiClient.GetFixtureByID(fixtureID, "scores,events")

// 	// 3. 将最终赛果落库到 FixtureResult 表 (这里需要处理唯一索引防重，防止多协程重复写入)
// 	// 伪代码:
// 	// db.Clauses(clause.Insert{Modifier: "IGNORE"}).Create(&FixtureResult{...})

// 	// 4. 将结算指令发送到消息队列 (Kafka / Redis Stream)
// 	// 伪代码:
// 	// mqClient.Publish("SETTLEMENT_READY", payload{FixtureID: fixtureID})

// 	log.Printf("[UpsertFixturesPro] 🏁 [FixtureID: %d] 赛果已就绪，已投递结算消息", fixtureID)
// }

// triggerSettlementFlow 独立协程运行，拉取赛果并触发派彩
// func triggerSettlementFlow(ctx context.Context, s *DBStorage, fixtureID int64, finalStateID int) {
// 	// 【1. 安全气囊设计】：防 VAR 赛后改判
// 	// 5: FT, 7: AET, 8: FT_PEN
// 	if finalStateID == 5 || finalStateID == 7 || finalStateID == 8 {
// 		log.Printf("⏳ [FixtureID: %d] 完赛状态，触发 3 分钟安全缓冲期...", fixtureID)
// 		time.Sleep(3 * time.Minute)
// 	}

// 	// 【2. 请求 API 获取最终精准赛果】
// 	// 这里假设你有一个 apiClient 可以通过 ID 请求数据
// 	apiRes, err := s.restClient.GetFixtureScoresByID(ctx, fixtureID)
// 	// 模拟 API 返回的结构
// 	var apiRes APIFixtureDetailResponse
// 	/* if err != nil {
// 	       log.Printf("❌ 获取赛果详情失败: %v", err)
// 	       // TODO: 考虑加入重试队列
// 	       return
// 	   }
// 	*/

// 	// 【3. 数据清洗：提取主客队半全场比分】
// 	var homeFull, awayFull, homeHalf, awayHalf int
// 	for _, scoreItem := range apiRes.Data.Scores {
// 		// CURRENT 通常代表比赛结束时的总比分 (包含上下半场)
// 		if scoreItem.Description == "CURRENT" {
// 			if scoreItem.Score.Participant == "home" {
// 				homeFull = scoreItem.Score.Goals
// 			} else if scoreItem.Score.Participant == "away" {
// 				awayFull = scoreItem.Score.Goals
// 			}
// 		} else if scoreItem.Description == "1ST_HALF" {
// 			// 1ST_HALF 仅代表上半场的比分
// 			if scoreItem.Score.Participant == "home" {
// 				homeHalf = scoreItem.Score.Goals
// 			} else if scoreItem.Score.Participant == "away" {
// 				awayHalf = scoreItem.Score.Goals
// 			}
// 		}
// 	}

// 	// 将原始 scores 序列化为 JSON 作为兜底防撕逼记录
// 	rawScoresJSON, _ := json.Marshal(apiRes.Data.Scores)

// 	// 构建要入库的底表数据
// 	resultData := model.FixtureResult{
// 		FixtureID:        fixtureID,
// 		StateID:          apiRes.Data.State.ID,
// 		StateCode:        apiRes.Data.State.State,
// 		HomeScoreFull:    homeFull,
// 		AwayScoreFull:    awayFull,
// 		HomeScoreHalf:    homeHalf,
// 		AwayScoreHalf:    awayHalf,
// 		RawScoreData:     datatypes.JSON(rawScoresJSON),
// 		SettlementStatus: "PENDING", // 初始状态为待结算
// 	}

// 	// 【4. 幂等性落库 (Upsert)】
// 	// 使用 OnConflict 保证多协程并发触发时不会报 Duplicate Key 错误
// 	err := s.db.Model(&model.FixtureResult{}).Clauses(clause.OnConflict{
// 		Columns: []clause.Column{{Name: "fixture_id"}}, // 冲突键
// 		// 如果记录已经存在，更新赛果数据，但绝不能盲目覆盖 settlement_status！
// 		// 假如该比赛已经被派彩 (PROCESSED)，我们更新了比分，状态依然保留，方便风控后续比对
// 		DoUpdates: clause.AssignmentColumns([]string{
// 			"state_id", "state_code",
// 			"home_score_full", "away_score_full",
// 			"home_score_half", "away_score_half",
// 			"raw_score_data", "updated_at",
// 		}),
// 	}).Create(&resultData).Error

// 	if err != nil {
// 		log.Printf("❌ [FixtureID: %d] 赛果落库失败: %v", fixtureID, err)
// 		return
// 	}

// 	log.Printf("✅ [FixtureID: %d] 赛果已落库: 全场 %d:%d, 半场 %d:%d",
// 		fixtureID, homeFull, awayFull, homeHalf, awayHalf)

// 	// 【5. 投递结算消息】
// 	// 既然赛果事实已经存入 DB，现在可以大胆地通知 Worker 去算钱了
// 	// mqClient.Publish("SETTLEMENT_READY", map[string]interface{}{"fixture_id": fixtureID})
// 	log.Printf("🏁 [FixtureID: %d] 结算事件已投递 MQ", fixtureID)
// }
