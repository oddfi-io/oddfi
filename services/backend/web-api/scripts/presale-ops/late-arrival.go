//go:build ignore
// +build ignore

// late-arrival.go — 跨轮次到账兜底脚本
//
// 场景：用户在轮次边界 5min 容差内付款，被分配到错误轮次
//       （anomaly_reason = round_mismatch 或 late_arrival）。
//       按原始 deposit 的 block_timestamp 对应的轮次补单。
//
// 本质是调用与 migrate-round.go 相同的 round_id 迁移逻辑，
// 区别是入口为 tx_hash + target-round，而非单独的迁移命令。
//
// 使用示例：
//
//	go run scripts/presale-ops/late-arrival.go \
//	  --tx-hash 0xabc... \
//	  --target-round seed \
//	  --note "用户 0xUSR 在种子轮 end_ts 前30s 付款，被错分到战略轮" \
//	  --env prod
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"everything_finance/org/web-api/scripts/presale-ops/shared"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// laDepositRow presale_deposit 精简模型（late-arrival 专用）
type laDepositRow struct {
	ID             uint64          `gorm:"column:id"`
	TxHash         string          `gorm:"column:tx_hash"`
	Status         string          `gorm:"column:status"`
	RoundID        string          `gorm:"column:round_id"`
	AmountUsdt     decimal.Decimal `gorm:"column:amount_usdt"`
	PriceUsd       decimal.Decimal `gorm:"column:price_usd"`
	SharesOdd      decimal.Decimal `gorm:"column:shares_odd"`
	BlockTimestamp int64           `gorm:"column:block_timestamp"`
	EoaAddress     string          `gorm:"column:eoa_address"`
}

func (laDepositRow) TableName() string { return "presale_deposit" }

// laRoundRow presale_round 精简模型（late-arrival 专用）
type laRoundRow struct {
	ID       string          `gorm:"column:id"`
	PriceUsd decimal.Decimal `gorm:"column:price_usd"`
	StartTs  int64           `gorm:"column:start_ts"`
	EndTs    int64           `gorm:"column:end_ts"`
	Status   string          `gorm:"column:status"`
}

func (laRoundRow) TableName() string { return "presale_round" }

// toleranceMillis 边界容差（5 分钟），与 presale_config 表默认值一致
const toleranceMillis = int64(5 * 60 * 1000)

func main() {
	flags := shared.ParseCommonFlags()
	shared.ValidateNote(flags.Note)

	if flags.TxHash == "" {
		fmt.Fprintln(os.Stderr, "[late-arrival] error: --tx-hash 必填")
		os.Exit(1)
	}
	if flags.TargetRound == "" {
		fmt.Fprintln(os.Stderr, "[late-arrival] error: --target-round 必填")
		os.Exit(1)
	}

	db := shared.InitDB(flags.Env)
	defer shared.CloseDB(db)

	txHashLower := strings.ToLower(flags.TxHash)

	// 1. 查询 deposit
	var dep laDepositRow
	if err := db.Where("tx_hash = ?", txHashLower).First(&dep).Error; err != nil {
		fmt.Fprintf(os.Stderr, "[late-arrival] 查询 deposit 失败 tx_hash=%s: %v\n",
			txHashLower, err)
		os.Exit(1)
	}

	// 只有 confirmed 或 anomaly 状态的 deposit 才允许迁移
	if dep.Status != "confirmed" && dep.Status != "anomaly" {
		fmt.Fprintf(os.Stderr,
			"[late-arrival] deposit status=%s，只有 confirmed/anomaly 状态的 deposit 允许迁移\n",
			dep.Status)
		os.Exit(1)
	}

	// 2. 查询目标轮次
	var targetRound laRoundRow
	if err := db.Where("id = ?", flags.TargetRound).First(&targetRound).Error; err != nil {
		fmt.Fprintf(os.Stderr, "[late-arrival] 查询目标轮次失败 round_id=%s: %v\n",
			flags.TargetRound, err)
		os.Exit(1)
	}

	// 3. 校验 block_timestamp 在目标轮次容差范围内
	// late-arrival 场景专门处理边界切轮，允许 block_timestamp 在容差窗口
	low := targetRound.StartTs - toleranceMillis
	high := targetRound.EndTs + toleranceMillis
	if dep.BlockTimestamp < low || dep.BlockTimestamp > high {
		fmt.Fprintf(os.Stderr,
			"[late-arrival] block_timestamp=%d 超出目标轮次 %s 容差范围 [%d, %d]\n"+
				"  block_timestamp 对应时间距目标轮次太远，请确认 --target-round 是否正确\n",
			dep.BlockTimestamp, flags.TargetRound, low, high)
		os.Exit(1)
	}

	// 4. 计算变更后字段（重新按目标轮次价格计算 shares_odd）
	newSharesOdd := dep.AmountUsdt.Div(targetRound.PriceUsd)

	beforeMap := map[string]interface{}{
		"id":              dep.ID,
		"tx_hash":         dep.TxHash,
		"status":          dep.Status,
		"round_id":        dep.RoundID,
		"amount_usdt":     dep.AmountUsdt.String(),
		"price_usd":       dep.PriceUsd.String(),
		"shares_odd":      dep.SharesOdd.String(),
		"block_timestamp": dep.BlockTimestamp,
		"eoa_address":     dep.EoaAddress,
	}
	afterMap := map[string]interface{}{
		"id":              dep.ID,
		"tx_hash":         dep.TxHash,
		"status":          "confirmed",
		"round_id":        flags.TargetRound,
		"amount_usdt":     dep.AmountUsdt.String(),
		"price_usd":       targetRound.PriceUsd.String(),
		"shares_odd":      newSharesOdd.String(),
		"block_timestamp": dep.BlockTimestamp,
		"eoa_address":     dep.EoaAddress,
	}

	beforeJSON, _ := json.MarshalIndent(beforeMap, "", "  ")
	afterJSON, _ := json.MarshalIndent(afterMap, "", "  ")

	fmt.Printf("[late-arrival] === BEFORE ===\n%s\n", string(beforeJSON))
	fmt.Printf("[late-arrival] === AFTER  ===\n%s\n", string(afterJSON))
	fmt.Printf("[late-arrival] 迁移摘要：round_id %s → %s，shares_odd %s → %s\n",
		dep.RoundID, flags.TargetRound,
		dep.SharesOdd.String(), newSharesOdd.String())

	if flags.DryRun {
		fmt.Println("\n[late-arrival] dry-run 模式，不执行。去掉 --dry-run=false 并输入 yes 确认执行。")
		return
	}

	shared.ConfirmOrExit()

	// 5. 事务内执行迁移
	err := db.Transaction(func(tx *gorm.DB) error {
		nowMillis := time.Now().UnixMilli()

		// UPDATE presale_deposit
		if err := tx.Exec(`
			UPDATE presale_deposit
			SET round_id=?, price_usd=?, shares_odd=?, status='confirmed', updated_at=?
			WHERE id=?`,
			flags.TargetRound, targetRound.PriceUsd.String(), newSharesOdd.String(),
			nowMillis, dep.ID,
		).Error; err != nil {
			return fmt.Errorf("[late-arrival] UPDATE deposit 失败: %w", err)
		}

		// 若原 deposit 有关联的 anomaly ops_event（round_mismatch/late_arrival），标记为 resolved
		if err := tx.Exec(`
			UPDATE presale_ops_event
			SET status='resolved', resolved_by='script:late-arrival',
			    resolve_note=?, resolved_at=?, updated_at=?
			WHERE deposit_id=? AND event_type IN ('round_mismatch','late_arrival')
			  AND status IN ('pending','notified')`,
			flags.Note, nowMillis, nowMillis, dep.ID,
		).Error; err != nil {
			// 无关联 ops_event 时 RowsAffected=0，不报错
			return fmt.Errorf("[late-arrival] 更新关联 ops_event 失败: %w", err)
		}

		// 写 audit
		if err := shared.WriteAudit(tx, shared.AuditEntry{
			ScriptName: "late-arrival",
			Action:     "migrate_round_id",
			TargetType: "deposit",
			TargetID:   dep.TxHash,
			BeforeJSON: string(beforeJSON),
			AfterJSON:  string(afterJSON),
			Note:       flags.Note,
		}); err != nil {
			return fmt.Errorf("[late-arrival] 写 audit 失败: %w", err)
		}

		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "[late-arrival] 执行失败，已回滚: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("[late-arrival] 执行成功。")

	lark := shared.NewLarkFromEnv()
	shared.NotifyScript(lark, "late-arrival",
		fmt.Sprintf("deposit tx_hash=%s → round=%s", dep.TxHash, flags.TargetRound), flags.Note)
}
