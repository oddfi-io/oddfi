//go:build ignore
// +build ignore

// round-pause.go — 轮次紧急暂停脚本
//
// 场景：admin 前端不可用时，通过脚本紧急暂停指定轮次。
//       等同于 admin HTTP 接口 POST /rounds/:id/pause。
//
// 状态机约束：只有 active 状态的轮次可以 pause；
//             执行后设置 manual_override=1，cron 不再自动推进该轮次。
//
// 使用示例：
//
//	go run scripts/presale-ops/round-pause.go \
//	  --round-id strategic \
//	  --note "临时暂停战略轮，插入种子轮大客户回补" \
//	  --env prod
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"everything_finance/org/web-api/scripts/presale-ops/shared"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// rpRoundRow presale_round 精简模型（round-pause 专用）
type rpRoundRow struct {
	ID             string `gorm:"column:id"`
	Name           string `gorm:"column:name"`
	Status         string `gorm:"column:status"`
	ManualOverride bool   `gorm:"column:manual_override"`
}

func (rpRoundRow) TableName() string { return "presale_round" }

func main() {
	flags := shared.ParseCommonFlags()
	shared.ValidateNote(flags.Note)

	if flags.RoundID == "" {
		fmt.Fprintln(os.Stderr, "[round-pause] error: --round-id 必填")
		os.Exit(1)
	}

	db := shared.InitDB(flags.Env)
	defer shared.CloseDB(db)

	// 1. SELECT FOR UPDATE 查询轮次（加锁防并发）
	var round rpRoundRow
	if err := db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", flags.RoundID).
		First(&round).Error; err != nil {
		fmt.Fprintf(os.Stderr, "[round-pause] 查询轮次失败 round_id=%s: %v\n",
			flags.RoundID, err)
		os.Exit(1)
	}

	// 2. 校验状态合法转换：只有 active 可以 pause
	if round.Status != "active" {
		fmt.Fprintf(os.Stderr,
			"[round-pause] 轮次 %s 当前 status=%s，只有 active 状态可以 pause\n",
			flags.RoundID, round.Status)
		os.Exit(1)
	}

	beforeMap := map[string]interface{}{
		"id":              round.ID,
		"name":            round.Name,
		"status":          round.Status,
		"manual_override": round.ManualOverride,
	}
	afterMap := map[string]interface{}{
		"id":              round.ID,
		"name":            round.Name,
		"status":          "paused",
		"manual_override": true,
	}

	beforeJSON, _ := json.MarshalIndent(beforeMap, "", "  ")
	afterJSON, _ := json.MarshalIndent(afterMap, "", "  ")

	fmt.Printf("[round-pause] === BEFORE ===\n%s\n", string(beforeJSON))
	fmt.Printf("[round-pause] === AFTER  ===\n%s\n", string(afterJSON))
	fmt.Printf("[round-pause] 轮次 %s (%s) active → paused\n", round.ID, round.Name)

	if flags.DryRun {
		fmt.Println("\n[round-pause] dry-run 模式，不执行。去掉 --dry-run=false 并输入 yes 确认执行。")
		return
	}

	shared.ConfirmOrExit()

	// 3. 事务内执行：UPDATE status + manual_override + INSERT audit
	err := db.Transaction(func(tx *gorm.DB) error {
		nowMillis := time.Now().UnixMilli()

		if err := tx.Exec(`
			UPDATE presale_round
			SET status='paused', manual_override=1, updated_at=?
			WHERE id=? AND status='active'`,
			nowMillis, flags.RoundID,
		).Error; err != nil {
			return fmt.Errorf("[round-pause] UPDATE 失败: %w", err)
		}

		if err := shared.WriteAudit(tx, shared.AuditEntry{
			ScriptName: "round-pause",
			Action:     "pause",
			TargetType: "round",
			TargetID:   flags.RoundID,
			BeforeJSON: string(beforeJSON),
			AfterJSON:  string(afterJSON),
			Note:       flags.Note,
		}); err != nil {
			return fmt.Errorf("[round-pause] 写 audit 失败: %w", err)
		}

		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "[round-pause] 执行失败，已回滚: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("[round-pause] 执行成功。轮次已暂停，cron 不再自动推进（manual_override=1）。")

	lark := shared.NewLarkFromEnv()
	shared.NotifyScript(lark, "round-pause",
		fmt.Sprintf("round_id=%s", flags.RoundID), flags.Note)
}
