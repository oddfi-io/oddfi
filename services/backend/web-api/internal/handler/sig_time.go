package handler

// sig_time.go: 提现签名 SigTime 窗口校验
//
// BUG-001 B3 抽出独立可测纯函数。完整重放保护（DB schema 改动 + nonce 改造）见 TODO-010。

const (
	// SigTimeFutureToleranceSec 未来侧容差：吸收手机端 NTP 漂移
	// 修复前为 0，导致客户端钟超前 1s 即拒签。15s 是手机端漂移的合理上限。
	SigTimeFutureToleranceSec = uint64(15)

	// SigTimePastWindowSec 过去侧窗口：提现签名有效期 3 分钟
	SigTimePastWindowSec = uint64(3 * 60)
)

// isSigTimeValid 判定提现请求中的 sig_time 是否在容忍窗口内。
//
// 通过条件：sigTime ∈ [now - SigTimePastWindowSec, now + SigTimeFutureToleranceSec]
func isSigTimeValid(sigTime, nowSec uint64) bool {
	if sigTime > nowSec+SigTimeFutureToleranceSec {
		return false // 超过未来容差
	}
	if sigTime+SigTimePastWindowSec < nowSec {
		return false // 超过过去窗口
	}
	return true
}
