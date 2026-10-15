// Package shared 预案脚本共享工具包
// 所有 presale-ops 脚本均 import 此包，统一 flag 解析、校验逻辑
package shared

import (
	"flag"
	"fmt"
	"os"
	"unicode/utf8"
)

// Flags 所有预案脚本通用参数集合
// 各脚本按需使用字段；不需要的字段留零值即可
type Flags struct {
	// EventID presale_ops_event.id（以 ops_event 为入口的脚本必传）
	EventID uint64
	// TxHash 目标 deposit 的链上 tx hash（migrate-round / late-arrival 必传）
	TxHash string
	// TargetRound 目标轮次 ID（migrate-round / late-arrival / unclaimed-credit 必传）
	TargetRound string
	// RoundID 当前轮次 ID（round 状态机脚本必传）
	RoundID string
	// Resolution 处理方式枚举（unclaimed-credit / overflow-handle 必传）
	Resolution string
	// Mode overflow-handle 的三种模式（partial_fill / next_round / hold）
	Mode string
	// Note 操作原因（所有脚本强制必填，≥10 字符）
	Note string
	// DryRun 默认为 true；去掉 --dry-run=false 才真实执行
	DryRun bool
	// Env 目标环境（dev/prod），默认 dev，避免误操作生产
	Env string
}

// ParseCommonFlags 解析所有预案脚本公共 flag。
// 脚本 main 函数中调用此函数，再根据自身场景决定额外 flag。
// 返回 Flags 前不执行 ValidateNote，调用方手动调用 ValidateNote。
func ParseCommonFlags() *Flags {
	f := &Flags{}
	flag.Uint64Var(&f.EventID, "event-id", 0, "presale_ops_event.id")
	flag.StringVar(&f.TxHash, "tx-hash", "", "链上 tx hash（0x...）")
	flag.StringVar(&f.TargetRound, "target-round", "", "目标轮次 ID（如 seed/strategic/public_a）")
	flag.StringVar(&f.RoundID, "round-id", "", "轮次 ID（round 状态机脚本使用）")
	flag.StringVar(&f.Resolution, "resolution", "", "处理方式（convert_to_deposit/reject）")
	flag.StringVar(&f.Mode, "mode", "", "overflow 处理模式（partial_fill/next_round/hold）")
	flag.StringVar(&f.Note, "note", "", "操作原因（必填，≥10 字符）")
	// 默认 dry-run=true，保证运营误运行时不执行实际操作
	flag.BoolVar(&f.DryRun, "dry-run", true, "演练模式（默认 true）；传 --dry-run=false 才真实执行")
	flag.StringVar(&f.Env, "env", "dev", "目标环境（dev/prod），默认 dev")
	flag.Parse()
	return f
}

// ValidateNote 校验 --note 参数长度 ≥ 10 字符（按 rune 兼容中文）。
// 不满足时向 stderr 输出提示并 os.Exit(1)，避免无注释操作进生产。
func ValidateNote(note string) {
	if utf8.RuneCountInString(note) < 10 {
		fmt.Fprintf(os.Stderr,
			"[ops-script] error: --note 必须 ≥ 10 字符（当前 %d 字符）\n"+
				"  示例：--note \"用户 0xUSR... 联系客服确认，转种子轮\"\n",
			utf8.RuneCountInString(note))
		os.Exit(1)
	}
}

// ConfirmOrExit 等待用户输入 "yes" 确认执行，其他任何输入直接退出。
// 仅在 !dryRun 时调用；dry-run 路径不需要二次确认。
func ConfirmOrExit() {
	fmt.Print("\n[ops-script] 请输入 yes 确认执行（其他任意输入退出）: ")
	var input string
	if _, err := fmt.Scanln(&input); err != nil || input != "yes" {
		fmt.Println("[ops-script] 已取消，退出。")
		os.Exit(0)
	}
}
