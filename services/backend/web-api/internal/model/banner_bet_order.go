package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"

	"github.com/shopspring/decimal"
)

// BannerBetOrder 首页 Banner 玩法的轻量下注记录表。
// 这张表只承载 banner 直达下注的记录与查询，不影响原有 bet_place 主链路。
type BannerBetOrder struct {
	ID          uint64 `gorm:"primaryKey;autoIncrement" json:"id"`                                                    // 注单主键
	UserID      uint64 `gorm:"index:idx_banner_bet_user_created;uniqueIndex:idx_banner_bet_user_ref" json:"user_id"`  // 用户 ID
	ClientRefID string `gorm:"column:client_ref_id;size:64;uniqueIndex:idx_banner_bet_user_ref" json:"client_ref_id"` // 客户端幂等键

	BannerCode  string `gorm:"column:banner_code;size:8;index" json:"banner_code"` // Banner 槽位编码，限定 B1~B5
	MarketID    int64  `gorm:"column:market_id;index" json:"market_id"`            // 前端透传的 market_id
	SelectionID int64  `gorm:"column:selection_id;index" json:"selection_id"`      // 前端透传的 selection_id

	Market    string          `gorm:"column:market;size:64" json:"market"`                     // 玩法名称，如 champion_winner
	Selection string          `gorm:"column:selection;size:128" json:"selection"`              // 用户下注对象，如 Argentina / Messi
	Type      string          `gorm:"column:type;size:20;default:'banner_single'" json:"type"` // Banner 单注类型
	Status    string          `gorm:"column:status;size:20;default:'live'" json:"status"`      // Banner 注单原始状态；当前下单固定 live，History 响应会统一转大写
	Stake     decimal.Decimal `gorm:"column:stake;type:decimal(16,2)" json:"stake"`            // 下注金额
	Odds      decimal.Decimal `gorm:"column:odds;type:decimal(8,4)" json:"odds"`               // 下注时赔率快照
	Payout    decimal.Decimal `gorm:"column:payout;type:decimal(16,2)" json:"payout"`          // 预计派彩

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"` // 创建时间
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"` // 更新时间
}

// TableName 根据环境路由到不同表名，避免开发环境污染正式数据。
func (BannerBetOrder) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "banner_bet_order_dev"
	}
	return "banner_bet_order"
}
