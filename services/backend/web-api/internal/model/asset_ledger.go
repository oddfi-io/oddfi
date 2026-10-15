package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"

	"github.com/shopspring/decimal"
)

const (
	AssetTypeParlay       = "parlay"
	AssetTypeSingle       = "single"
	AssetTypeBannerSingle = "banner_single"
	AssetTypeCancelBet    = "cancel_bet"
	AssetTypeClaimPrize   = "claim_prize"
	AssetTypeWithDraw     = "withdraw"
	AssetTypeDeposit      = "deposit"
	AssetTypeStake        = "stake"
	AssetTypeUnstake      = "unstake"
	AssetTypeAddLp        = "add_lp"
	AssetTypeRemoveLp     = "remove_lp"
)

// 添加行级注释
// 添加表注释
type AssetLedger struct {
	ID              uint64          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID          uint64          `gorm:"column:user_id;index" json:"user_id"`
	BusinessType    string          `gorm:"column:business_type;size:32" json:"business_type"`
	Amount          decimal.Decimal `gorm:"column:amount;type:decimal(40,18)" json:"amount"`
	BalanceBefore   decimal.Decimal `gorm:"column:balance_before;type:decimal(40,18)" json:"balance_before"`
	BalanceAfter    decimal.Decimal `gorm:"column:balance_after;type:decimal(40,18)" json:"balance_after"`
	FrozenBefore    decimal.Decimal `gorm:"column:frozen_before;type:decimal(40,18)" json:"frozen_before"`
	FrozenAfter     decimal.Decimal `gorm:"column:frozen_after;type:decimal(40,18)" json:"frozen_after"`
	BetLockBefore   decimal.Decimal `gorm:"column:bet_lock_before;type:decimal(40,18)" json:"bet_lock_before"`
	BetLockAfter    decimal.Decimal `gorm:"column:bet_lock_after;type:decimal(40,18)" json:"bet_lock_after"`
	StakeLockBefore decimal.Decimal `gorm:"column:stake_lock_before;type:decimal(40,18)" json:"stake_lock_before"`
	StakeLockAfter  decimal.Decimal `gorm:"column:stake_lock_after;type:decimal(40,18)" json:"stake_lock_after"`
	LiqLockBefore   decimal.Decimal `gorm:"column:liq_lock_before;type:decimal(40,18)" json:"liq_lock_before"`
	LiqLockAfter    decimal.Decimal `gorm:"column:liq_lock_after;type:decimal(40,18)" json:"liq_lock_after"`
	RefID           string          `gorm:"column:ref_id;size:64" json:"ref_id,omitempty"`
	TokenAddress    string          `gorm:"column:token_address;size:20" json:"token_address,omitempty"`
	CreatedAt       time.Time       `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (AssetLedger) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "asset_ledger_dev"
	}
	return "asset_ledger"
}

type BusinessType string

const (
	BusinessTypeDeposit        BusinessType = "deposit"
	BusinessTypeWithdraw       BusinessType = "withdraw"
	BusinessTypeFreeze         BusinessType = "freeze"
	BusinessTypeCancelWithdraw BusinessType = "cancel_withdraw"
)
