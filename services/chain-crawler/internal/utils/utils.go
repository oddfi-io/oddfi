package utils

import "strings"

// IsOutsideHistoricalState 判断错误是否表示跑到剪枝节点外
func IsOutsideHistoricalState(err error) bool {
	return strings.Contains(err.Error(), "not available") || strings.Contains(err.Error(), "not found")
}
