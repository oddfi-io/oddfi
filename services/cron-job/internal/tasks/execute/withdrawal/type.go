package withdrawal

import "github.com/samber/lo"

const (
	//1:待审核, 2:审核通过(处理中), 3:已完成, 4:审核驳回, 5:提现失败(打款失败), 6:用户取消
	WithdrawalStatusPending   = 1
	WithdrawalStatusAudited   = 2
	WithdrawalStatusFinished  = 3
	WithdrawalStatusRejected  = 4
	WithdrawalStatusFailed    = 5
	WithdrawalStatusCancelled = 6
)

const (
	NullAddress  = "0x0000000000000000000000000000000000000000"
	DeadAddress1 = "0x000000000000000000000000000000000000dead"
	DeadAddress2 = "0x1111111111111111111111111111111111111111"
)

func NullAddresses() []string {
	return []string{
		NullAddress, DeadAddress1, DeadAddress2,
	}
}

func IsNullAddresses(address string) bool {
	return lo.Contains(NullAddresses(), address)
}
