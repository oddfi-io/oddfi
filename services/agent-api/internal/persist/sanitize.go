package persist

import (
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

// 严格的 AiAnalysis allow-list：仅保留 <b class="delta-up"> / <b class="delta-down">。
// 其余 HTML 标签全部剥光，防止前端 dangerouslySetInnerHTML 引入的 XSS。
//
// 作用范围：persist 写入 SQLite 前 + bus.Publish 前。SSE fan-out 后再无机会清洗。
var aiAnalysisPolicy = func() *bluemonday.Policy {
	p := bluemonday.NewPolicy()
	p.AllowElements("b")
	p.AllowAttrs("class").Matching(regexp.MustCompile(`^delta-(up|down)$`)).OnElements("b")
	return p
}()

// SanitizeAiAnalysis 就地清洗 AiAnalysis 三个 HTML 字段。
// nil-safe；空字段不动。
func SanitizeAiAnalysis(ai *pushtypes.AiAnalysis) {
	if ai == nil {
		return
	}
	ai.Change = aiAnalysisPolicy.Sanitize(ai.Change)
	ai.PriceImpact = aiAnalysisPolicy.Sanitize(ai.PriceImpact)
	ai.ProbImpact = aiAnalysisPolicy.Sanitize(ai.ProbImpact)
}

// 错误信息脱敏：剥 URL、API key 痕迹、绝对路径、provider 内部 token。
// 保留错误类型/原因短语供运维 grep 定位。
var (
	reURL       = regexp.MustCompile(`https?://[^\s"]+`)
	reAbsPath   = regexp.MustCompile(`/[A-Za-z0-9_./-]+\.go(:\d+)?`)
	reAPIKey    = regexp.MustCompile(`(?i)(sk-[A-Za-z0-9]+|api[_-]?key[=:][^\s]+|Bearer\s+[A-Za-z0-9._-]+)`)
	// 阈值 40 字符：避免误伤合法 request_id（典型 32 字符）和短 hash。
	// 实际的 secret（API key、JWT、access token）通常 ≥ 40 字符。
	reTokenLike = regexp.MustCompile(`(?i)\b[A-Za-z0-9]{40,}\b`)
)

// SanitizeEnrichError 把 kimi 返回的 error.Error() 脱敏。
// 输出长度限制 256 字节，溢出截断。
func SanitizeEnrichError(err error) string {
	if err == nil {
		return ""
	}
	s := err.Error()
	s = reURL.ReplaceAllString(s, "[url]")
	s = reAbsPath.ReplaceAllString(s, "[path]")
	s = reAPIKey.ReplaceAllString(s, "[key]")
	s = reTokenLike.ReplaceAllString(s, "[token]")
	s = strings.TrimSpace(s)
	if len(s) > 256 {
		s = s[:256]
	}
	return s
}
