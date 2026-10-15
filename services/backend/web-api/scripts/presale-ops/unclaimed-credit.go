//go:build ignore
// +build ignore

// unclaimed-credit.go — 无主转账确认转单脚本
//
// 场景：用户绕前端直接向金库转 USDT，EOA 在系统中无 user 记录
//       （anomaly_reason = unclaimed）。
//       客服联系用户确认归属后，把异常事件落成正式 deposit 或关闭。
//
// 支持两种 resolution：
//   - convert_to_deposit：将 ops_event 中的金额按目标轮次价格落 presale_deposit（confirmed）
//   - reject：仅关闭 ops_event（用户已退款或拒绝认领）
//
// 使用示例：
//
//	# 演练（默认 dry-run=true）
//	go run scripts/presale-ops/unclaimed-credit.go \
//	  --event-id 42 \
//	  --target-round seed \
//	  --resolution convert_to_deposit \
//	  --note "用户 0xUSR... 联系客服确认，转种子轮" \
//	  --env prod
//
//	# 执行（--dry-run=false）
//	go run scripts/presale-ops/unclaimed-credit.go \
//	  --event-id 42 --target-round seed \
//	  --resolution convert_to_deposit \
//	  --note "用户 0xUSR... 联系客服确认，转种子轮" \
//	  --dry-run=false --env prod
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"

	"everything_finance/org/web-api/scripts/presale-ops/shared"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// opsEventRow presale_ops_event 精简模型（脚本只查需要的字段）
type opsEventRow struct {
	ID         uint64           `gorm:"column:id"`
	EventType  string           `gorm:"column:event_type"`
	TxHash     *string          `gorm:"column:tx_hash"`
	EoaAddress *string          `gorm:"column:eoa_address"`
	AmountUsdt *decimal.Decimal `gorm:"column:amount_usdt"`
	Status     string           `gorm:"column:status"`
}

func (opsEventRow) TableName() string { return "presale_ops_event" }

// ucRoundRow presale_round 精简模型（unclaimed-credit 脚本专用）
type ucRoundRow struct {
	ID       string          `gorm:"column:id"`
	PriceUsd decimal.Decimal `gorm:"column:price_usd"`
	StartTs  int64           `gorm:"column:start_ts"`
	EndTs    int64           `gorm:"column:end_ts"`
	Status   string          `gorm:"column:status"`
}

func (ucRoundRow) TableName() string { return "presale_round" }

func main() {
	flags := shared.ParseCommonFlags()
	shared.ValidateNote(flags.Note)

	if flags.EventID == 0 {
		fmt.Fprintln(os.Stderr, "[unclaimed-credit] error: --event-id 必填")
		os.Exit(1)
	}

	resolution := flags.Resolution
	if resolution == "" {
		resolution = "convert_to_deposit"
	}
	if resolution != "convert_to_deposit" && resolution != "reject" {
		fmt.Fprintf(os.Stderr,
			"[unclaimed-credit] error: --resolution 必须是 convert_to_deposit 或 reject（当前: %s）\n",
			resolution)
		os.Exit(1)
	}

	if resolution == "convert_to_deposit" && flags.TargetRound == "" {
		fmt.Fprintln(os.Stderr,
			"[unclaimed-credit] error: --resolution convert_to_deposit 时必须传 --target-round")
		os.Exit(1)
	}

	db := shared.InitDB(flags.Env)
	defer shared.CloseDB(db)

	// 1. 查询 ops_event，校验 event_type = unclaimed
	var event opsEventRow
	if err := db.Where("id = ?", flags.EventID).First(&event).Error; err != nil {
		fmt.Fprintf(os.Stderr, "[unclaimed-credit] 查询 ops_event 失败 id=%d: %v\n",
			flags.EventID, err)
		os.Exit(1)
	}

	if event.EventType != "unclaimed" {
		fmt.Fprintf(os.Stderr,
			"[unclaimed-credit] event_type=%s，此脚本仅处理 unclaimed 类型\n", event.EventType)
		os.Exit(1)
	}

	if event.Status != "pending" && event.Status != "notified" {
		fmt.Fprintf(os.Stderr,
			"[unclaimed-credit] ops_event status=%s，只有 pending/notified 状态可处理\n",
			event.Status)
		os.Exit(1)
	}

	// 2. 构造 before/after JSON
	beforeMap := map[string]interface{}{
		"id":          event.ID,
		"event_type":  event.EventType,
		"status":      event.Status,
		"tx_hash":     ptrStr(event.TxHash),
		"eoa_address": ptrStr(event.EoaAddress),
		"amount_usdt": decStr(event.AmountUsdt),
	}

	afterStatus := "resolved"
	if resolution == "reject" {
		afterStatus = "rejected"
	}
	afterMap := map[string]interface{}{
		"id":          event.ID,
		"event_type":  event.EventType,
		"status":      afterStatus,
		"tx_hash":     ptrStr(event.TxHash),
		"eoa_address": ptrStr(event.EoaAddress),
		"amount_usdt": decStr(event.AmountUsdt),
		"resolution":  resolution,
	}
	if resolution == "convert_to_deposit" {
		afterMap["target_round"] = flags.TargetRound
	}

	beforeJSON, _ := json.MarshalIndent(beforeMap, "", "  ")
	afterJSON, _ := json.MarshalIndent(afterMap, "", "  ")

	fmt.Printf("[unclaimed-credit] === BEFORE ===\n%s\n", string(beforeJSON))
	fmt.Printf("[unclaimed-credit] === AFTER  ===\n%s\n", string(afterJSON))
	fmt.Printf("[unclaimed-credit] resolution=%s ops_event=%d\n", resolution, event.ID)

	if flags.DryRun {
		fmt.Println("\n[unclaimed-credit] dry-run 模式，不执行。去掉 --dry-run=false 并输入 yes 确认执行。")
		return
	}

	shared.ConfirmOrExit()

	// 3. 事务内执行变更
	err := db.Transaction(func(tx *gorm.DB) error {
		if resolution == "convert_to_deposit" {
			// 查询目标轮次价格，落 presale_deposit（confirmed 状态）
			var targetRound ucRoundRow
			if err := tx.Where("id = ?", flags.TargetRound).First(&targetRound).Error; err != nil {
				return fmt.Errorf("[unclaimed-credit] 查询目标轮次失败 round_id=%s: %w",
					flags.TargetRound, err)
			}

			if event.AmountUsdt == nil || event.TxHash == nil || event.EoaAddress == nil {
				return fmt.Errorf("[unclaimed-credit] ops_event 缺少必要字段（amount/tx_hash/eoa）")
			}

			// 金额除以轮次价格得到 ODD 份额，全程使用 decimal 精度
			sharesOdd := event.AmountUsdt.Div(targetRound.PriceUsd)
			nowMillis := time.Now().UnixMilli()

			// 落 presale_deposit（user_id=0 表示无主转账，后续可由运营关联真实用户）
			// ON DUPLICATE KEY UPDATE id=id 保证幂等（重复执行不报错）
			if err := tx.Exec(`
				INSERT INTO presale_deposit
					(tx_hash, log_index, block_number, block_timestamp,
					 user_id, eoa_address, vault_address, round_id,
					 amount_usdt, price_usd, shares_odd,
					 referral_reward_odd, status, source, created_at, updated_at)
				VALUES (?, 0, 0, ?,
				        0, ?, '', ?,
				        ?, ?, ?,
				        0, 'confirmed', 'script', ?, ?)
				ON DUPLICATE KEY UPDATE id=id`,
				*event.TxHash, nowMillis,
				*event.EoaAddress, flags.TargetRound,
				event.AmountUsdt.String(), targetRound.PriceUsd.String(), sharesOdd.String(),
				nowMillis, nowMillis,
			).Error; err != nil {
				return fmt.Errorf("[unclaimed-credit] 落 presale_deposit 失败: %w", err)
			}
		}

		// 更新 ops_event status → resolved/rejected
		nowMillis := time.Now().UnixMilli()
		if err := tx.Exec(`
			UPDATE presale_ops_event
			SET status=?, resolved_by=?, resolve_note=?, resolved_at=?, updated_at=?
			WHERE id=?`,
			afterStatus, "script:unclaimed-credit", flags.Note,
			nowMillis, nowMillis, event.ID,
		).Error; err != nil {
			return fmt.Errorf("[unclaimed-credit] 更新 ops_event 状态失败: %w", err)
		}

		// 写 presale_admin_audit
		if err := shared.WriteAudit(tx, shared.AuditEntry{
			ScriptName: "unclaimed-credit",
			Action:     "anomaly_resolve",
			TargetType: "anomaly",
			TargetID:   strconv.FormatUint(event.ID, 10),
			BeforeJSON: string(beforeJSON),
			AfterJSON:  string(afterJSON),
			Note:       flags.Note,
		}); err != nil {
			return fmt.Errorf("[unclaimed-credit] 写 audit 失败: %w", err)
		}

		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "[unclaimed-credit] 执行失败，已回滚: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("[unclaimed-credit] 执行成功。")

	// 异步推送 Lark 通知（Commit 后，不阻塞退出）
	lark := shared.NewLarkFromEnv()
	shared.NotifyScript(lark, "unclaimed-credit",
		fmt.Sprintf("ops_event=%d resolution=%s", event.ID, resolution), flags.Note)
}

// ptrStr 安全解引用 *string，nil 时返回空字符串
func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// decStr 安全解引用 *decimal.Decimal，nil 时返回 "0"
func decStr(d *decimal.Decimal) string {
	if d == nil {
		return "0"
	}
	return d.String()
}
