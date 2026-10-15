package mysql

import (
	"context"
	"time"

	"github.com/samber/lo"
)

// UserDepositAddress 用户充值地址映射表
type UserDepositAddress struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID       uint64    `gorm:"column:user_id;not null;index:idx_user_id" json:"user_id"`
	Chain        string    `gorm:"column:chain;type:varchar(20);not null;uniqueIndex:uk_address_chain" json:"chain"`      // 所属链, 如 bsc/tron/...
	TokenAddress string    `gorm:"column:token_address;type:varchar(20);not null;default:''" json:"token_address"`        // 充值代币的地址 (注: 原SQL长度20可能略短，建议检查)
	Address      string    `gorm:"column:address;type:varchar(128);not null;uniqueIndex:uk_address_chain" json:"address"` // 充值地址
	CreatedAt    time.Time `gorm:"column:created_at;default:CURRENT_TIMESTAMP" json:"created_at"`
}

// TableName 指定 GORM 映射的表名
func (UserDepositAddress) TableName() string {
	return "user_deposit_address"
}

func GetUserIdByDepositAddresses(ctx context.Context, addr []string) ([]*UserDepositAddress, error) {
	addr = lo.Uniq(addr)
	users := make([]*UserDepositAddress, 0)
	db := GetDB()

	err := db.WithContext(ctx).Table(new(UserDepositAddress).TableName()).Where("address IN (?)", addr).Scan(&users).Error
	if err != nil {
		return nil, err
	}
	return users, nil
}
