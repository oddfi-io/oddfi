//go:build ignore
// +build ignore

// overflow-handle.go — 超额到账处理脚本
//
// 场景：用户到账金额超过本轮剩余容量（anomaly_reason = overflow）。
//
// 支持 3 种 mode：
//   - partial_fill：按本轮剩余容量部分入账，超出部分记录为新 ops_event（overflow_remainder）
//   - next_round：全部按下一轮价格入账
//   - hold：超出部分挂账，等运营后续决策
//
// 使用示例：
//
//	go run scripts/presale-ops/overflow-handle.go \
//	  --event-id 42 \
//	  --mode partial_fill \
//	  --note "公轮A已售罄，部分按本轮价格入账，余额进下轮队列" \
//	  --env prod
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

// ofOpsEventRow presale_ops_event 精简模型（overflow-handle 专用）
type ofOpsEventRow struct {
	ID         uint64           `gorm:"column:id"`
	EventType  string           `gorm:"column:event_type"`
	DepositID  *uint64          `gorm:"column:deposit_id"`
	TxHash     *string          `gorm:"column:tx_hash"`
	EoaAddress *string          `gorm:"column:eoa_address"`
	AmountUsdt *decimal.Decimal `gorm:"column:amount_usdt"`
	PayloadJson *string          `gorm:"column:payload_json"`
	Status     string           `gorm:"column:status"`
}

func (ofOpsEventRow) TableName() string { return "presale_ops_event" }

// ofRoundRow presale_round 精简模型（overflow-handle 专用）
type ofRoundRow struct {
	ID         string          `gorm:"column:id"`
	PriceUsd   decimal.Decimal `gorm:"column:price_usd"`
	SupplyOdd  decimal.Decimal `gorm:"column:supply_odd"`
	SoldOdd    decimal.Decimal `gorm:"column:sold_odd"`
	Status     string          `gorm:"column:status"`
	SortOrder  int             `gorm:"column:sort_order"`
}

func (ofRoundRow) TableName() string { return "presale_round" }

func main() {
	flags := shared.ParseCommonFlags()
	shared.ValidateNote(flags.Note)

	if flags.EventID == 0 {
		fmt.Fprintln(os.Stderr, "[overflow-handle] error: --event-id 必填")
		os.Exit(1)
	}

	mode := flags.Mode
	if mode == "" {
		fmt.Fprintln(os.Stderr,
			"[overflow-handle] error: --mode 必填（partial_fill / next_round / hold）")
		os.Exit(1)
	}
	if mode != "partial_fill" && mode != "next_round" && mode != "hold" {
		fmt.Fprintf(os.Stderr,
			"[overflow-handle] error: --mode 必须是 partial_fill / next_round / hold（当前: %s）\n",
			mode)
		os.Exit(1)
	}

	db := shared.InitDB(flags.Env)
	defer shared.CloseDB(db)

	// 1. 查询 ops_event，校验 event_type = overflow
	var event ofOpsEventRow
	if err := db.Where("id = ?", flags.EventID).First(&event).Error; err != nil {
		fmt.Fprintf(os.Stderr, "[overflow-handle] 查询 ops_event 失败 id=%d: %v\n",
			flags.EventID, err)
		os.Exit(1)
	}

	if event.EventType != "overflow" {
		fmt.Fprintf(os.Stderr,
			"[overflow-handle] event_type=%s，此脚本仅处理 overflow 类型\n", event.EventType)
		os.Exit(1)
	}

	if event.Status != "pending" && event.Status != "notified" {
		fmt.Fprintf(os.Stderr,
			"[overflow-handle] ops_event status=%s，只有 pending/notified 状态可处理\n",
			event.Status)
		os.Exit(1)
	}

	if event.AmountUsdt == nil {
		fmt.Fprintln(os.Stderr, "[overflow-handle] ops_event 缺少 amount_usdt 字段")
		os.Exit(1)
	}

	// 2. 从 payload_json 取关联轮次信息
	var payloadData map[string]string
	if event.PayloadJson != nil {
		_ = json.Unmarshal([]byte(*event.PayloadJson), &payloadData)
	}
	roundID := payloadData["round_id"]

	var currentRound ofRoundRow
	if roundID != "" {
		if err := db.Where("id = ?", roundID).First(&currentRound).Error; err != nil {
			fmt.Fprintf(os.Stderr, "[overflow-handle] 查询当前轮次失败 round_id=%s: %v\n",
				roundID, err)
			os.Exit(1)
		}
	}

	// 3. 计算 before/after
	remainingOdd := currentRound.SupplyOdd.Sub(currentRound.SoldOdd)
	// 剩余容量对应的 USDT 金额（remaining_usdt = remaining_odd * price）
	remainingUsdt := remainingOdd.Mul(currentRound.PriceUsd)

	beforeMap := map[string]interface{}{
		"ops_event_id": event.ID,
		"event_type":   event.EventType,
		"status":       event.Status,
		"amount_usdt":  ofPtrDecStr(event.AmountUsdt),
		"round_id":     roundID,
		"sold_odd":     currentRound.SoldOdd.String(),
		"supply_odd":   currentRound.SupplyOdd.String(),
		"remaining_usdt": remainingUsdt.String(),
	}

	afterMap := map[string]interface{}{
		"ops_event_id": event.ID,
		"status":       "resolved",
		"mode":         mode,
	}
	switch mode {
	case "partial_fill":
		overflowUsdt := event.AmountUsdt.Sub(remainingUsdt)
		afterMap["fill_usdt"] = remainingUsdt.String()
		afterMap["overflow_remainder_usdt"] = overflowUsdt.String()
		afterMap["note"] = "按本轮剩余容量部分入账，超出部分记录新 overflow_remainder ops_event"
	case "next_round":
		afterMap["fill_usdt"] = ofPtrDecStr(event.AmountUsdt)
		afterMap["note"] = "全额按下一轮价格入账"
	case "hold":
		afterMap["fill_usdt"] = "0"
		afterMap["note"] = "超出部分挂账，等运营后续决策"
	}

	beforeJSON, _ := json.MarshalIndent(beforeMap, "", "  ")
	afterJSON, _ := json.MarshalIndent(afterMap, "", "  ")

	fmt.Printf("[overflow-handle] === BEFORE ===\n%s\n", string(beforeJSON))
	fmt.Printf("[overflow-handle] === AFTER  ===\n%s\n", string(afterJSON))
	fmt.Printf("[overflow-handle] mode=%s ops_event=%d amount=%s\n",
		mode, event.ID, ofPtrDecStr(event.AmountUsdt))

	if flags.DryRun {
		fmt.Println("\n[overflow-handle] dry-run 模式，不执行。去掉 --dry-run=false 并输入 yes 确认执行。")
		return
	}

	shared.ConfirmOrExit()

	// 4. 事务内执行
	err := db.Transaction(func(tx *gorm.DB) error {
		nowMillis := time.Now().UnixMilli()

		switch mode {
		case "partial_fill":
			// 部分入账：超出部分记为新 ops_event（overflow_remainder）
			overflowUsdt := event.AmountUsdt.Sub(remainingUsdt)
			if overflowUsdt.IsPositive() {
				overflowPayload := fmt.Sprintf(
					`{"original_event_id":%d,"overflow_usdt":"%s","mode":"partial_fill"}`,
					event.ID, overflowUsdt.String())
				if err := tx.Exec(`
					INSERT INTO presale_ops_event
						(event_type, deposit_id, tx_hash, eoa_address, amount_usdt,
						 payload_json, status, created_at, updated_at)
					VALUES ('overflow_remainder', ?, ?, ?, ?, ?, 'pending', ?, ?)`,
					event.DepositID, event.TxHash, event.EoaAddress,
					overflowUsdt.String(), overflowPayload,
					nowMillis, nowMillis,
				).Error; err != nil {
					return fmt.Errorf("[overflow-handle] 创建 overflow_remainder 事件失败: %w", err)
				}
			}

		case "next_round":
			// 全额按下一轮处理，此处仅标记；实际入账需联动 migrate-round 或另行处理
			// 脚本只更新 ops_event status，具体入账操作由运营确认后单独执行
			// 这里不自动 INSERT presale_deposit，避免下一轮价格尚未确定时误操作

		case "hold":
			// 挂账：仅更新 ops_event 状态，不做任何入账操作
		}

		// 更新原 ops_event status → resolved
		if err := tx.Exec(`
			UPDATE presale_ops_event
			SET status='resolved', resolved_by=?, resolve_note=?, resolved_at=?, updated_at=?
			WHERE id=?`,
			"script:overflow-handle", flags.Note, nowMillis, nowMillis, event.ID,
		).Error; err != nil {
			return fmt.Errorf("[overflow-handle] 更新 ops_event 状态失败: %w", err)
		}

		// 写 audit
		if err := shared.WriteAudit(tx, shared.AuditEntry{
			ScriptName: "overflow-handle",
			Action:     "anomaly_resolve",
			TargetType: "anomaly",
			TargetID:   strconv.FormatUint(event.ID, 10),
			BeforeJSON: string(beforeJSON),
			AfterJSON:  string(afterJSON),
			Note:       flags.Note,
		}); err != nil {
			return fmt.Errorf("[overflow-handle] 写 audit 失败: %w", err)
		}

		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "[overflow-handle] 执行失败，已回滚: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("[overflow-handle] 执行成功。")

	lark := shared.NewLarkFromEnv()
	shared.NotifyScript(lark, "overflow-handle",
		fmt.Sprintf("ops_event=%d mode=%s", event.ID, mode), flags.Note)
}

// ofPtrDecStr 安全解引用 *decimal.Decimal，nil 返回 "0"
func ofPtrDecStr(d *decimal.Decimal) string {
	if d == nil {
		return "0"
	}
	return d.String()
}
