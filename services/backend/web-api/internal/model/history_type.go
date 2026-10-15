package model

import "strings"

const (
	HistoryTypeAll       = "all"
	HistoryTypeBet       = "bet"
	HistoryTypeBetCancel = "bet_cancel"
	HistoryTypeBetWon    = "bet_won"
	HistoryTypeBetLost   = "bet_lost"
	HistoryTypeBetBanner = "bet_banner"
)

// NormalizeBetHistoryType 将对外查询枚举统一成服务端内部使用的值。
// 这里保留少量历史别名，是为了兼容旧前端已经发出的 claim/addlp/removelp/cancel_bet 等参数，
// 同时把新需求里的 bet_cancel 作为唯一的撤单筛选入口，避免对外暴露数据库流水类型命名。
func NormalizeBetHistoryType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "":
		return ""
	case HistoryTypeAll:
		return HistoryTypeAll
	case HistoryTypeBet, HistoryTypeBetCancel, HistoryTypeBetWon, HistoryTypeBetLost, HistoryTypeBetBanner:
		return strings.ToLower(strings.TrimSpace(raw))
	case AssetTypeCancelBet:
		return HistoryTypeBetCancel
	case "claim":
		return AssetTypeClaimPrize
	case "addlp":
		return AssetTypeAddLp
	case "removelp":
		return AssetTypeRemoveLp
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

// NormalizeBetHistoryTypes 解析逗号分隔的 History type 参数。
// 前端会把多个筛选项放在同一个 query 参数里，因此这里统一去重和归一化，避免 service 层反复处理字符串边界。
func NormalizeBetHistoryTypes(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	seen := make(map[string]struct{})
	types := make([]string, 0)
	for _, part := range strings.Split(raw, ",") {
		typ := NormalizeBetHistoryType(part)
		if typ == "" {
			continue
		}
		if typ == HistoryTypeAll {
			// all 和其它类型同时出现时没有必要继续保留细分条件，否则语义会变成“全部中的部分”。
			return []string{HistoryTypeAll}
		}
		if _, ok := seen[typ]; ok {
			continue
		}
		seen[typ] = struct{}{}
		types = append(types, typ)
	}
	return types
}

// NormalizeBetHistoryTypeCSV 返回标准化后的 CSV 字符串，便于 handler 传给后续 service。
func NormalizeBetHistoryTypeCSV(raw string) string {
	return strings.Join(NormalizeBetHistoryTypes(raw), ",")
}

// IsValidBetHistoryType 限制 GetHistory 的 type 枚举范围。
// type=bet 是前端“全部下注”的稳定入口，必须保留所有下注状态，避免刚下注未结算或 PUSH/VOID 的流水被输赢筛选漏掉。
func IsValidBetHistoryType(raw string) bool {
	if strings.TrimSpace(raw) == "" {
		return true
	}
	for _, part := range strings.Split(raw, ",") {
		if strings.TrimSpace(part) == "" {
			return false
		}
		if !isValidSingleBetHistoryType(part) {
			return false
		}
	}
	return true
}

func isValidSingleBetHistoryType(raw string) bool {
	switch NormalizeBetHistoryType(raw) {
	case "",
		HistoryTypeAll,
		HistoryTypeBet,
		HistoryTypeBetCancel,
		HistoryTypeBetWon,
		HistoryTypeBetLost,
		HistoryTypeBetBanner,
		AssetTypeClaimPrize,
		AssetTypeWithDraw,
		AssetTypeDeposit,
		AssetTypeStake,
		AssetTypeUnstake,
		AssetTypeAddLp,
		AssetTypeRemoveLp,
		string(BusinessTypeCancelWithdraw):
		return true
	default:
		return false
	}
}
