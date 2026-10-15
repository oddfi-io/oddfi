package handler

import (
	"fmt"
	"oddfi-web-api/model"
	"strings"
)

func GetMockOddsByTeam(team string, fID int64) []model.APIOdd {
	var odds []model.APIOdd

	// 1. 适配：使用封装后的缓存读取函数
	match, ok := GetOddsMockCachedData(team)
	if !ok {
		fmt.Printf("[⚠️⚠️⚠️]match_mock_odds_falied\n")
		return odds // 缓存未命中直接返回空列表
	}
	fmt.Printf("[🍃🍃🍃]match_mock_odds_succ\n")
	// 遍历市场（逻辑同前）
	for _, bm := range match.Bookmakers {
		for _, m := range bm.Markets {
			for _, o := range m.Outcomes {
				newOdd := model.APIOdd{
					FixtureID:         fID,
					Value:             fmt.Sprintf("%.2f", o.Price),
					MarketDescription: getMarketDesc(m.Key),
				}
				// 处理 Label 和 盘口值
				mapOutcomeToOdd(m.Key, o, match.HomeTeam, match.AwayTeam, &newOdd)
				if newOdd.Label != "" {
					newOdd.ID = int64(o.OddID)
					odds = append(odds, newOdd)
				}
			}
		}
	}
	return odds
}

// getMarketDesc 将市场 Key 转换为前端显示的描述
func getMarketDesc(marketKey string) string {
	switch marketKey {
	case "h2h":
		return "Fulltime Result"
	case "spreads":
		return "Asian Handicap"
	case "totals":
		return "Asian Total"
	default:
		return "Unknown Market"
	}
}

// mapOutcomeToOdd 处理不同盘口的 Label 和 动态字段(Handicap/Total)
func mapOutcomeToOdd(marketKey string, o model.ApiOutcome, homeTeam, awayTeam string, newOdd *model.APIOdd) {
	switch marketKey {
	case "h2h":
		newOdd.MarketID = 1
		if strings.EqualFold(o.Name, "draw") {
			newOdd.Label = "Draw"
		} else if o.Name == homeTeam {
			newOdd.Label = "Home"
		} else if o.Name == awayTeam {
			newOdd.Label = "Away"
		}

	case "spreads":
		newOdd.MarketID = 6
		if o.Name == homeTeam {
			newOdd.Label = "Home"
		} else if o.Name == awayTeam {
			newOdd.Label = "Away"
		}
		newOdd.Handicap = fmt.Sprintf("%.1f", o.Point)

	case "totals":
		newOdd.MarketID = 7
		newOdd.Label = o.Name // Over 或 Under
		newOdd.Total = fmt.Sprintf("%.1f", o.Point)
	}
}
