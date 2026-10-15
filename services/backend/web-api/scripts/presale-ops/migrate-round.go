//go:build ignore
// +build ignore

// migrate-round.go — 通用 round_id 迁移脚本
//
// 与 admin HTTP 接口 POST /deposits/:txHash/migrate-round 功能完全等价。
// 适用于无 admin 前端时的紧急操作，或批量迁移场景。
//
// 使用示例（从项目根目录执行）：
//
//	# 演练（默认 dry-run=true）
//	go run scripts/presale-ops/migrate-round.go \
//	  --tx-hash 0xabc... \
//	  --target-round seed \
//	  --note "用户在种子轮 end_ts 前30s 付款，被错分到战略轮" \
//	  --env prod
//
//	# 确认 diff 无误后，去掉 --dry-run=false 执行
//	go run scripts/presale-ops/migrate-round.go \
//	  --tx-hash 0xabc... \
//	  --target-round seed \
//	  --note "用户在种子轮 end_ts 前30s 付款，被错分到战略轮" \
//	  --dry-run=false --env prod
//
// 执行步骤（与 service/presale_deposit.go MigrateRound 完全一致）：
//  1. 取 deposit，校验 status = confirmed
//  2. 校验 block_timestamp ∈ [target.start_ts - tolerance, target.end_ts + tolerance]
//  3. 重算 shares_odd = amount_usdt / target.price_usd
//  4. UPDATE presale_deposit.round_id / price_usd / shares_odd
//  5. INSERT presale_admin_audit（operator="script:migrate-round"，source="script"）
//  6. 事务提交
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"everything_finance/org/web-api/scripts/presale-ops/shared"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// depositRow presale_deposit 精简模型（脚本只查需要的字段）
type depositRow struct {
	ID             uint64          `gorm:"column:id"`
	TxHash         string          `gorm:"column:tx_hash"`
	Status         string          `gorm:"column:status"`
	RoundID        string          `gorm:"column:round_id"`
	AmountUsdt     decimal.Decimal `gorm:"column:amount_usdt"`
	PriceUsd       decimal.Decimal `gorm:"column:price_usd"`
	SharesOdd      decimal.Decimal `gorm:"column:shares_odd"`
	BlockTimestamp int64           `gorm:"column:block_timestamp"`
}

func (depositRow) TableName() string { return "presale_deposit" }

// roundRow presale_round 精简模型
type roundRow struct {
	ID       string          `gorm:"column:id"`
	PriceUsd decimal.Decimal `gorm:"column:price_usd"`
	StartTs  int64           `gorm:"column:start_ts"`
	EndTs    int64           `gorm:"column:end_ts"`
	Status   string          `gorm:"column:status"`
}

func (roundRow) TableName() string { return "presale_round" }

// toleranceMs 轮次边界容差（5 分钟，与 presale_config 默认值一致）
// 如需使用 DB 配置值，可从 presale_config 表读取 boundary_tolerance_min
const toleranceMs = int64(5 * 60 * 1000)

func main() {
	flags := shared.ParseCommonFlags()
	shared.ValidateNote(flags.Note)

	if flags.TxHash == "" {
		fmt.Fprintln(os.Stderr, "[migrate-round] error: --tx-hash 必填")
		os.Exit(1)
	}
	if flags.TargetRound == "" {
		fmt.Fprintln(os.Stderr, "[migrate-round] error: --target-round 必填")
		os.Exit(1)
	}

	db := shared.InitDB(flags.Env)
	defer shared.CloseDB(db)

	txHashLower := strings.ToLower(flags.TxHash)

	// 1. 查询 deposit（按 tx_hash，不过滤 user 保证脚本权限足够）
	var dep depositRow
	if err := db.Where("tx_hash = ?", txHashLower).First(&dep).Error; err != nil {
		fmt.Fprintf(os.Stderr, "[migrate-round] 查询 deposit 失败 tx_hash=%s: %v\n",
			txHashLower, err)
		os.Exit(1)
	}

	// 校验 status = confirmed（仅 confirmed 的 deposit 允许迁移 round_id）
	if dep.Status != "confirmed" {
		fmt.Fprintf(os.Stderr,
			"[migrate-round] deposit status=%s，只有 confirmed 状态的 deposit 允许迁移轮次\n",
			dep.Status)
		os.Exit(1)
	}

	// 2. 查询目标轮次
	var targetRound roundRow
	if err := db.Where("id = ?", flags.TargetRound).First(&targetRound).Error; err != nil {
		fmt.Fprintf(os.Stderr, "[migrate-round] 查询目标轮次失败 round_id=%s: %v\n",
			flags.TargetRound, err)
		os.Exit(1)
	}

	// 3. 校验 block_timestamp ∈ [target.start_ts - tolerance, target.end_ts + tolerance]
	// 时间戳越界时脚本拒绝执行，防止误操作把 deposit 迁移到完全无关的轮次
	low := targetRound.StartTs - toleranceMs
	high := targetRound.EndTs + toleranceMs
	if dep.BlockTimestamp < low || dep.BlockTimestamp > high {
		fmt.Fprintf(os.Stderr,
			"[migrate-round] block_timestamp=%d 超出目标轮次 %s 容差范围 [%d, %d]\n"+
				"  说明：deposit 的链上时间不在目标轮次 ±5min 范围内，迁移可能错误\n"+
				"  如确认要强制迁移，请修改 --note 并联系技术团队人工处理\n",
			dep.BlockTimestamp, flags.TargetRound, low, high)
		os.Exit(1)
	}

	// 4. 计算变更后字段
	newSharesOdd := dep.AmountUsdt.Div(targetRound.PriceUsd)

	// 构造 before/after JSON 便于 diff 输出和 audit 记录
	beforeMap := map[string]interface{}{
		"id":              dep.ID,
		"tx_hash":         dep.TxHash,
		"status":          dep.Status,
		"round_id":        dep.RoundID,
		"amount_usdt":     dep.AmountUsdt.String(),
		"price_usd":       dep.PriceUsd.String(),
		"shares_odd":      dep.SharesOdd.String(),
		"block_timestamp": dep.BlockTimestamp,
	}
	afterMap := map[string]interface{}{
		"id":              dep.ID,
		"tx_hash":         dep.TxHash,
		"status":          dep.Status,
		"round_id":        flags.TargetRound,
		"amount_usdt":     dep.AmountUsdt.String(),
		"price_usd":       targetRound.PriceUsd.String(),
		"shares_odd":      newSharesOdd.String(),
		"block_timestamp": dep.BlockTimestamp,
	}

	beforeJSON, _ := json.MarshalIndent(beforeMap, "  ", "  ")
	afterJSON, _ := json.MarshalIndent(afterMap, "  ", "  ")

	// 5. 输出 before/after diff
	fmt.Printf("[migrate-round] === BEFORE ===\n  %s\n", string(beforeJSON))
	fmt.Printf("[migrate-round] === AFTER  ===\n  %s\n", string(afterJSON))
	fmt.Printf("[migrate-round] 变更摘要：round_id %s → %s，shares_odd %s → %s\n",
		dep.RoundID, flags.TargetRound,
		dep.SharesOdd.String(), newSharesOdd.String())

	if flags.DryRun {
		fmt.Println("\n[migrate-round] dry-run 模式，不执行。去掉 --dry-run=false 并输入 yes 确认执行。")
		return
	}

	shared.ConfirmOrExit()

	// 6. 事务内执行迁移
	err := db.Transaction(func(tx *gorm.DB) error {
		// UPDATE presale_deposit（只更新关键字段，保留其他字段不变）
		if err := tx.Model(&depositRow{}).
			Where("id = ? AND status = 'confirmed'", dep.ID).
			Updates(map[string]interface{}{
				"round_id":   flags.TargetRound,
				"price_usd":  targetRound.PriceUsd,
				"shares_odd": newSharesOdd,
			}).Error; err != nil {
			return fmt.Errorf("[migrate-round] UPDATE deposit 失败: %w", err)
		}

		// INSERT presale_admin_audit
		if err := shared.WriteAudit(tx, shared.AuditEntry{
			ScriptName: "migrate-round",
			Action:     "migrate_round_id",
			TargetType: "deposit",
			TargetID:   dep.TxHash,
			BeforeJSON: string(beforeJSON),
			AfterJSON:  string(afterJSON),
			Note:       flags.Note,
		}); err != nil {
			return fmt.Errorf("[migrate-round] 写 audit 失败: %w", err)
		}

		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "[migrate-round] 执行失败，已回滚: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("[migrate-round] 执行成功。")

	// 7. 异步推送 Lark 通知（脚本已 Commit，不阻塞退出）
	lark := shared.NewLarkFromEnv()
	shared.NotifyScript(lark, "migrate-round",
		fmt.Sprintf("deposit tx_hash=%s", dep.TxHash), flags.Note)
}
