package report_generation

import (
	"context"
	"time"

	"oddfi-cron-job/internal/logger"
)

// ReportGenerationTask 报表生成任务（每天上午9点）
type ReportGenerationTask struct{}

// NewReportGenerationTask 创建报表生成任务
func NewReportGenerationTask() *ReportGenerationTask {
	return &ReportGenerationTask{}
}

func (t *ReportGenerationTask) Name() string {
	return "report_generation"
}

func (t *ReportGenerationTask) Schedule() string {
	return "0 9 * * *" // 每天上午9点
}

func (t *ReportGenerationTask) Execute(ctx context.Context) error {
	logger.Infof("[%s] Generating daily reports...", t.Name())

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(3 * time.Second):
		logger.Infof("[%s] Generated: sales_report.pdf, user_activity.pdf, financial_summary.pdf",
			t.Name())
		return nil
	}
}
