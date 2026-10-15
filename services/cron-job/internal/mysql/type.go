package mysql

import (
	"oddfi-cron-job/internal/config"
	"time"

	"github.com/shopspring/decimal"
)

type WithdrawRecord struct {
	ID          uint64          `gorm:"column:id" json:"id"`
	UserID      uint64          `gorm:"column:user_id" json:"user_id"`                      //用户ID
	OrderSn     string          `gorm:"column:order_sn" json:"order_sn"`                    //业务流水号
	CoinSymbol  string          `gorm:"column:coin_symbol" json:"coin_symbol"`              //提币币种
	Chain       string          `gorm:"column:chain" json:"chain"`                          //提现链名称
	Amount      decimal.Decimal `gorm:"column:amount" json:"amount"`                        //提现数量
	Fee         decimal.Decimal `gorm:"column:fee" json:"fee"`                              //手续费
	RealAmount  decimal.Decimal `gorm:"column:real_amount" json:"real_amount"`              //实际到账数量
	ToAddress   string          `gorm:"column:to_address" json:"to_address"`                //提现地址
	TxHash      string          `gorm:"column:tx_hash" json:"tx_hash"`                      //区块链交易哈希
	Status      int8            `gorm:"column:status" json:"status"`                        //提现状态 1:待审核, 2:审核通过(处理中), 3:已完成, 4:审核驳回, 5:提现失败(打款失败), 6:用户取消
	RiskLevel   int8            `gorm:"column:risk_level" json:"risk_level"`                //风险等级 0:正常, 1:高风险需人工
	AdminID     string          `gorm:"column:admin_id" json:"admin_id"`                    //审核管理员ID
	Remark      string          `gorm:"column:remark" json:"remark"`                        //审核备注或失败原因
	CreatedAt   time.Time       `gorm:"column:created_at;autoCreateTime" json:"created_at"` //申请时间
	AuditAt     *time.Time      `gorm:"column:audit_at" json:"audit_at"`                    //审核时间
	FinishedAt  *time.Time      `gorm:"column:finished_at" json:"finished_at"`              //完成时间
	UpdatedAt   *time.Time      `gorm:"column:updated_at" json:"updated_at"`                //更新时间
	SendSuccess bool            `json:"-"`
}

func (WithdrawRecord) TableName() string {
	if config.GetConfig().Env != "prod" {
		return "withdraw_record_dev"
	}

	return "withdraw_record"
}
