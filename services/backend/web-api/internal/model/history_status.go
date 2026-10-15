package model

// HistoryLedgerStatus 是 /account/portfolio/history 顶层流水状态枚举。
// 这里使用面向前端展示的统一口径，不直接等同某个业务表的原始状态，
// 例如 withdraw_record.status=1 表示待审核，但 History 需要返回 2=审核中。
type HistoryLedgerStatus int8

const (
	HistoryLedgerStatusProcessing HistoryLedgerStatus = 1 // 进行中
	HistoryLedgerStatusReviewing  HistoryLedgerStatus = 2 // 审核中
	HistoryLedgerStatusCompleted  HistoryLedgerStatus = 3 // 成功
	HistoryLedgerStatusFailed     HistoryLedgerStatus = 4 // 失败
	HistoryLedgerStatusAppealing  HistoryLedgerStatus = 5 // 申诉中
	HistoryLedgerStatusCanceled   HistoryLedgerStatus = 6 // 已取消
)
