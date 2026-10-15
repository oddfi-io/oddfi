package shared

import (
	"fmt"
	"os"

	"everything_finance/org/web-api/internal/service"
)

// NewLarkFromEnv 从环境变量 PRESALE_LARK_WEBHOOK_URL 构造 LarkWebhookService。
// 若 URL 为空则返回 nil；调用方需检查 nil（nil 时跳过推送，不报错）。
// 脚本 main 函数中可选调用：若未配置 Lark 告警，脚本正常执行但不推送通知。
func NewLarkFromEnv() *service.LarkWebhookService {
	url := os.Getenv("PRESALE_LARK_WEBHOOK_URL")
	if url == "" {
		url = os.Getenv("PRESALE_OPS_LARK_URL")
	}
	if url == "" {
		return nil
	}
	return service.NewLarkWebhookService(url)
}

// NotifyScript 脚本执行完成后向 Lark 推送操作通知。
// 异步推送（goroutine，内部由 LarkWebhookService.Notify 管理），不阻塞脚本主流程；
// 失败仅在 LarkWebhookService 内部 stderr warn，不阻断脚本退出。
//
// svc 为 nil 时静默跳过（未配置 Lark URL 场景）。
func NotifyScript(svc *service.LarkWebhookService, scriptName, target, note string) {
	if svc == nil {
		return
	}
	svc.Notify(service.LarkEvent{
		EventType: "script_op",
		Operator:  "script:" + scriptName,
		Note:      fmt.Sprintf("[%s] target=%s note=%s", scriptName, target, note),
	})
}
