// package engine

// import (
// 	"context"
// 	"log"
// 	"math"

// 	"oddfi-odds-engine/internal/model"

// 	"gorm.io/gorm"
// 	"gorm.io/gorm/clause"
// )

// type OddsWorker struct {
// 	DB      *gorm.DB
// 	WSQueue chan<- model.MarketStateUpdate // 推送给 WebSocket 的通道
// }

// func NewOddsWorker(db *gorm.DB, wsQueue chan<- model.MarketStateUpdate) *OddsWorker {
// 	return &OddsWorker{DB: db, WSQueue: wsQueue}
// }

// // ProcessBet 每次用户落单后被异步调用
// func (w *OddsWorker) ProcessBet(ctx context.Context, marketID string) error {
// 	// 开启数据库事务
// 	return w.DB.Transaction(func(tx *gorm.DB) error {
// 		var outcomes []model.Outcome

// 		// 【关键防并发策略】：FOR UPDATE 悲观锁
// 		// 这会锁住属于该 marketID 的所有 Outcome 行，直到事务结束
// 		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
// 			Where("market_id = ?", marketID).
// 			Find(&outcomes).Error; err != nil {
// 			return err
// 		}

// 		// 保存旧赔率用于比对
// 		oldOddsMap := make(map[string]float64)
// 		for _, o := range outcomes {
// 			oldOddsMap[o.ID] = o.CurrentOdds
// 		}

// 		// 调用纯函数进行重算
// 		newOutcomes, newSignal := CalculateNewOdds(outcomes)

// 		needsPush := false
// 		// 批量更新数据库 (只更新 CurrentOdds)
// 		for _, newOut := range newOutcomes {
// 			// 如果赔率发生了变化，执行 Update
// 			if newOut.CurrentOdds != oldOddsMap[newOut.ID] {
// 				tx.Model(&model.Outcome{}).Where("id = ?", newOut.ID).
// 					Update("current_odds", newOut.CurrentOdds)
// 			}

// 			// 检查是否超过推送阈值 0.05
// 			if math.Abs(newOut.CurrentOdds-oldOddsMap[newOut.ID]) > OddsChangedThresh {
// 				needsPush = true
// 			}
// 		}

// 		// 更新市场的信号灯状态
// 		tx.Model(&model.Market{}).Where("id = ?", marketID).Update("signal_color", newSignal)

// 		// 事务提交前，如果需要推送，把最新状态丢进 Channel
// 		if needsPush {
// 			log.Printf("🔔 赔率剧烈变动 (Market:%s), 触发 WebSocket 推送", marketID)
// 			w.WSQueue <- model.MarketStateUpdate{
// 				MarketID: marketID,
// 				Outcomes: newOutcomes,
// 				Signal:   newSignal,
// 			}
// 		}

// 		return nil
// 	})
// }

package engine

import (
	"fmt"
	"math"

	odds "oddfi-odds-engine/internal"  // 你上传的逻辑包
	"oddfi-odds-engine/internal/model" // 修改为你实际的项目名

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OddsWorker struct {
	db      *gorm.DB
	wsQueue chan<- model.MarketStateUpdate
}

func NewOddsWorker(db *gorm.DB, wsQueue chan<- model.MarketStateUpdate) *OddsWorker {
	return &OddsWorker{db: db, wsQueue: wsQueue}
}

// HandleBetEvent 处理下注后的重算逻辑
// 触发场景：API 接收到新注单并写入 bets 表后，异步调用此函数
func (w *OddsWorker) HandleBetEvent(fixtureID int64, marketID int, bookmakerID int) error {
	return w.db.Transaction(func(tx *gorm.DB) error {
		var oddsList []model.Odd

		// 1. 悲观锁锁定 (Pessimistic Locking)
		// 锁定该 Fixture + Market + Bookmaker 下的所有选项 (如 Home, Draw, Away)
		// 确保在计算 L_i 和重算赔率期间，没有其他并发下注干扰数据
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("fixture_id = ? AND market_id = ? AND bookmaker_id = ?",
				fixtureID, marketID, bookmakerID).
			Find(&oddsList).Error; err != nil {
			return err
		}

		if len(oddsList) == 0 {
			return fmt.Errorf("no odds found for fixture:%d market:%d", fixtureID, marketID)
		}

		// 2. 准备计算数据
		// 将 DB 模型转换为逻辑计算所需的切片（复用你上传的 WorstLoss 逻辑）
		// 注意：我们计算时使用 BaseValue 和 CurrentValue (float64)
		losses := odds.WorstLoss(oddsList)  // 返回每个选项对应的 L_i [source: 2]
		heavyIdx := odds.HeavyIndex(losses) // 找到 L_i 最大的索引
		heavyLoss := losses[heavyIdx]       // 当前市场的最大风险敞口

		// 3. 获取信号灯和压缩率 [source: 3]
		newSignal := odds.GetSignal(heavyLoss)
		r := odds.CompressionRate(heavyLoss)

		needsPush := false

		// 4. 执行动态调整逻辑并更新每个选项
		for i := range oddsList {
			oldValue := oddsList[i].CurrentValue

			// A. 计算算法赔率 (基于 BaseValue)
			var computedOdds float64
			base := oddsList[i].BaseValue

			if i == heavyIdx {
				// 重仓方向：执行压缩 (1-r)，最低不低于 88%
				computedOdds = math.Max(base*(1-r), base*0.88)
			} else {
				// 轻仓方向：执行上浮 (1+r*1.0)，最高不超过 108% (防止对冲套利)
				floatRate := math.Min(r*1.0, 0.08)
				computedOdds = math.Min(base*(1+floatRate), base*1.08)
			}

			// B. 应用人工偏移并舍入保留两位小数
			finalValue := odds.RoundOdds(computedOdds + oddsList[i].ManualOffset)

			// C. 更新内存对象
			oddsList[i].CurrentValue = finalValue
			oddsList[i].WorstLoss = losses[i]
			oddsList[i].Signal = int(newSignal)
			oddsList[i].Value = fmt.Sprintf("%.2f", finalValue) // 同步更新展示字符串

			// D. 检查是否变动超过 0.05 [source: 1]
			if odds.ShouldPushWS(oldValue, finalValue) {
				needsPush = true
			}

			// E. 执行数据库更新 (只更新变动的核心风控字段)
			if err := tx.Model(&model.Odd{}).Where("id = ?", oddsList[i].ID).
				Updates(map[string]interface{}{
					"current_value": oddsList[i].CurrentValue,
					"worst_loss":    oddsList[i].WorstLoss,
					"signal":        oddsList[i].Signal,
					"value":         oddsList[i].Value,
				}).Error; err != nil {
				return err
			}
		}

		// 5. 如果有任一选项赔率变动显著，投递到推送队列推送给前端
		if needsPush {
			w.wsQueue <- model.MarketStateUpdate{
				FixtureID:   fixtureID,
				MarketID:    marketID,
				BookmakerID: bookmakerID,
				Signal:      model.SignalColor(newSignal),
				Odds:        oddsList, // 携带更新后的完整赔率列表
			}
		}

		return nil
	})
}
