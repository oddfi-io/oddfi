package model

// 比赛结果态是业务层对 SportMonks state_id 的归一化结果，避免结算层直接依赖第三方枚举。
const (
	MatchResultScheduled = "scheduled" // scheduled 表示赛事尚未真正进入可结算阶段，worker 不应该处理资金。
	MatchResultLive      = "live"      // live 表示赛事进行中或阶段间未结束，比分仍可能变化，必须继续等待。
	MatchResultFinal     = "final"     // final 表示存在可信终局比分，可以进入正常盘口输赢结算。
	MatchResultPending   = "pending"   // pending 表示第三方状态还需后续更新，先挂起可避免误结算。
	MatchResultCanceled  = "canceled"  // canceled 表示赛事取消，业务上不再等待比分，注单需要退款。
	MatchResultVoid      = "void"      // void 表示赛事结果不适合作为盘口判定依据，注单按作废退款处理。
)

// 比赛动作态决定结算 worker 的下一步行为；动作与结果拆开，便于展示状态和资金处理独立演进。
const (
	MatchActionNone   = "none"   // none 表示当前状态不需要 worker 触发资金变更，通常是未开赛或进行中。
	MatchActionSettle = "settle" // settle 表示可以使用赛果比分判定 WON/LOST/PUSH，并更新用户资金。
	MatchActionHold   = "hold"   // hold 表示暂不处理资金，等待数据源补全或人工确认，降低错误赔付风险。
	MatchActionRefund = "refund" // refund 表示赛事无法正常结算，需要将注单统一置为 VOID 并退回本金。
)

// 进入正常结算的 SportMonks 终局状态；这些状态都有可用于全场盘口的最终比分。
const (
	StateIDFT    = 5 // FT：常规时间结束，直接用全场比分结算常规盘口。
	StateIDAET   = 7 // AET：加时结束，但全场常规盘口仍按约定比分字段读取，避免混用加时比分。
	StateIDFTPEN = 8 // FT_PEN：点球结束，常规盘口通常不把点球大战计入全场进球。
)

// MatchStateRule 保存单个 SportMonks 状态的业务归一化规则。
type MatchStateRule struct {
	StateID int    // StateID 保留 SportMonks 原始状态 ID，方便日志、测试和运营排查回溯第三方枚举。
	Code    string // Code 保留 SportMonks 状态短码，便于人读和与 spider 原始数据对账。
	Result  string // Result 是业务归一化后的赛事结果态，用于接口展示和上层状态判断。
	Action  string // Action 是结算 worker 的执行指令，直接决定是否结算、挂起或退款。
}

// matchStateRules 是 state_id 映射唯一真源；未知状态会降级为 pending/hold，避免多处 switch 产生资金语义分叉。
var matchStateRules = map[int]MatchStateRule{
	1:  {StateID: 1, Code: "NS", Result: MatchResultScheduled, Action: MatchActionNone},              // NS 未开赛，没有比分和资金动作。
	2:  {StateID: 2, Code: "INPLAY_1ST_HALF", Result: MatchResultLive, Action: MatchActionNone},      // 上半场进行中，比分会继续变化，禁止提前结算。
	3:  {StateID: 3, Code: "HT", Result: MatchResultLive, Action: MatchActionNone},                   // 半场休息只代表阶段暂停，全场盘口仍需等待终局。
	4:  {StateID: 4, Code: "BREAK", Result: MatchResultLive, Action: MatchActionNone},                // 阶段间休息不等同终场，继续等待可避免误把临时比分当赛果。
	5:  {StateID: 5, Code: "FT", Result: MatchResultFinal, Action: MatchActionSettle},                // 常规终场已有可信全场比分，可以进入正常结算。
	6:  {StateID: 6, Code: "INPLAY_ET", Result: MatchResultLive, Action: MatchActionNone},            // 加时进行中仍可能影响展示比分，但结算必须等最终状态落库。
	7:  {StateID: 7, Code: "AET", Result: MatchResultFinal, Action: MatchActionSettle},               // 加时结束后数据源已给出终局状态，按赛果快照进入结算。
	8:  {StateID: 8, Code: "FT_PEN", Result: MatchResultFinal, Action: MatchActionSettle},            // 点球结束代表比赛最终完成，结算引擎再按盘口规则取对应比分。
	9:  {StateID: 9, Code: "INPLAY_PENALTIES", Result: MatchResultLive, Action: MatchActionNone},     // 点球大战进行中还未终局，避免用未完成结果触发资金。
	10: {StateID: 10, Code: "POSTPONED", Result: MatchResultPending, Action: MatchActionHold},        // 延期赛事可能补赛，先 hold 保留注单状态等待后续官方更新。
	11: {StateID: 11, Code: "SUSPENDED", Result: MatchResultPending, Action: MatchActionHold},        // 暂停赛事可能恢复或改判，挂起能避免过早退款或赔付。
	12: {StateID: 12, Code: "CANCELLED", Result: MatchResultCanceled, Action: MatchActionRefund},     // 取消赛事没有可结算赛果，统一 VOID 退款。
	13: {StateID: 13, Code: "TBA", Result: MatchResultScheduled, Action: MatchActionNone},            // 时间待定仍属于赛前状态，不触发 worker 资金处理。
	14: {StateID: 14, Code: "WO", Result: MatchResultVoid, Action: MatchActionRefund},                // Walkover 不是正常比赛比分，按作废退款避免争议结算。
	15: {StateID: 15, Code: "ABANDONED", Result: MatchResultVoid, Action: MatchActionRefund},         // 腰斩赛事结果不可直接用于盘口判定，按 VOID 保护资金一致性。
	16: {StateID: 16, Code: "DELAYED", Result: MatchResultPending, Action: MatchActionHold},          // 延迟开赛仍可能恢复，先挂起而不是退款。
	17: {StateID: 17, Code: "AWARDED", Result: MatchResultVoid, Action: MatchActionRefund},           // 官方判定胜负不一定对应可结算比分，按作废退款处理。
	18: {StateID: 18, Code: "INTERRUPTED", Result: MatchResultPending, Action: MatchActionHold},      // 比赛中断后的官方结论不确定，等待后续状态降低资金风险。
	19: {StateID: 19, Code: "AWAITING_UPDATES", Result: MatchResultPending, Action: MatchActionHold}, // 数据源明确等待更新时不处理资金，防止读取到半成品赛果。
	20: {StateID: 20, Code: "DELETED", Result: MatchResultVoid, Action: MatchActionRefund},           // 数据源删除赛事时无法再验证赛果，注单只能按 VOID 退回本金。
	21: {StateID: 21, Code: "EXTRA_TIME_BREAK", Result: MatchResultLive, Action: MatchActionNone},    // 加时阶段间休息仍未完赛，不能触发终局结算。
	22: {StateID: 22, Code: "INPLAY_2ND_HALF", Result: MatchResultLive, Action: MatchActionNone},     // 下半场进行中比分仍在变化，继续等待 FT/AET/FT_PEN。
	25: {StateID: 25, Code: "PEN_BREAK", Result: MatchResultLive, Action: MatchActionNone},           // 点球阶段间休息不是最终状态，避免提前处理注单。
	26: {StateID: 26, Code: "PENDING", Result: MatchResultPending, Action: MatchActionHold},          // 数据源未给明确状态时挂起，等待 spider 后续同步修正。
}

// MatchStateFor 根据 SportMonks state_id 返回业务规则，未知枚举统一 hold 等人工或后续修复。
func MatchStateFor(stateID int) MatchStateRule {
	// 已知枚举必须走统一映射，确保 worker、service 和测试对同一 state_id 有一致资金语义。
	if rule, ok := matchStateRules[stateID]; ok {
		// 命中规则时直接返回副本，调用方不能意外修改全局映射。
		return rule
	}

	// 未知状态宁可挂起也不自动退款或赔付，因为第三方新增枚举可能代表临时状态或特殊赛制。
	return MatchStateRule{
		StateID: stateID,            // 保留原始未知 ID，方便日志定位 SportMonks 新增或异常枚举。
		Code:    "UNKNOWN",          // UNKNOWN 明确提示运营和开发需要补充映射，而不是误认为正常状态。
		Result:  MatchResultPending, // pending 让上层展示为待确认状态，避免给用户错误的最终结论。
		Action:  MatchActionHold,    // hold 是资金侧最保守动作，避免未知状态造成误赔或误退。
	}
}

// IsSettleState 判断该状态是否可以进入正常比分结算。
func IsSettleState(stateID int) bool {
	// 统一复用 MatchStateFor，避免新增状态时遗漏 settle 判断。
	return MatchStateFor(stateID).Action == MatchActionSettle
}

// IsRefundState 判断该状态是否需要全单 VOID 退款。
func IsRefundState(stateID int) bool {
	// 退款状态同样从统一规则读取，确保 worker 分派和外部判断保持一致。
	return MatchStateFor(stateID).Action == MatchActionRefund
}
