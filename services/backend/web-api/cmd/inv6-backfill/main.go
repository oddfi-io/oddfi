// cmd/inv6-backfill/main.go
//
// BUG-001 历史回填工具：扫 presale_deposit 中因 INV-6 跨时钟域假阴性吞掉返佣的行，
// 应用 5s 容差重判，按需把 referrer_user_id / referral_reward_odd 回填，并更新
// holding(source=referral)。
//
// 关键设计（与 BD v2 §3 完整对齐）：
//   1. 默认 --dry-run，必须显式 --apply 才真改
//   2. --apply 模式必须 stdin 输入 "YES-APPLY" 才继续（防误操作）
//   3. 单事务 / 单 deposit：
//        BEGIN
//        INSERT IGNORE inv6_backfill_applied  --rows=0 即 skip 整笔
//        UPDATE presale_deposit ... WHERE id=? AND referrer_user_id IS NULL --乐观锁兜底
//        holdingRepo.UpsertReferral(...)
//        INSERT presale_admin_audit
//        COMMIT
//   4. dry-run 输出分桶直方图 + per-referrer 汇总 + 详细行
//
// 详见 .progress/bug/BUG-001-inv6-cross-clock-domain/BD.md
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/mysql"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func main() {
	var (
		dryRun bool
		apply  bool
		batch  int
		actor  string
		reason string
	)
	flag.BoolVar(&dryRun, "dry-run", true, "dry-run 模式（默认，只 SELECT 输出影响行，不写库）")
	flag.BoolVar(&apply, "apply", false, "真正执行回填（必须配合 stdin 输入 YES-APPLY 二次确认）")
	flag.IntVar(&batch, "batch", 50, "单次最多处理多少笔（防长事务/防失控）")
	flag.StringVar(&actor, "actor", "", "操作员标识（写入 presale_admin_audit.operator，必填）")
	flag.StringVar(&reason, "reason", "BUG-001 INV-6 historical backfill", "运维说明（写入 inv6_backfill_applied.reason）")
	flag.Parse()

	// apply 模式必须显式 actor
	if apply && actor == "" {
		fmt.Fprintln(os.Stderr, "❌ --apply 模式必须指定 --actor=<name>")
		os.Exit(2)
	}
	if apply {
		dryRun = false
	}

	logger.Init("info", false)
	cfg := config.LoadDefault()

	mysql.InitGORM(cfg.Database)
	db := mysql.GetGORM()

	depositRepo := repository.NewPresaleDepositRepo(db)
	holdingRepo := repository.NewPresaleHoldingRepo(db)
	bindRepo := repository.NewUserReferralBindRepo(db)
	auditRepo := repository.NewPresaleAdminAuditRepository(db)
	backfillRepo := repository.NewInv6BackfillAppliedRepo(db)
	roundRepo := repository.NewPresaleRoundRepo(db)

	deps := Deps{
		DB:           db,
		DepositRepo:  depositRepo,
		HoldingRepo:  holdingRepo,
		BindRepo:     bindRepo,
		AuditRepo:    auditRepo,
		BackfillRepo: backfillRepo,
		RoundRepo:    roundRepo,
	}

	opts := Opts{
		DryRun: dryRun,
		Batch:  batch,
		Actor:  actor,
		Reason: reason,
	}

	if err := Run(context.Background(), deps, opts, os.Stdin, os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "❌ backfill failed: %v\n", err)
		os.Exit(1)
	}
}

// Deps 依赖注入（暴露给测试用 fake repo 替换）
type Deps struct {
	DB           *gorm.DB
	DepositRepo  repository.PresaleDepositRepository
	HoldingRepo  repository.PresaleHoldingRepository
	BindRepo     repository.UserReferralBindRepository
	AuditRepo    repository.PresaleAdminAuditRepository
	BackfillRepo repository.Inv6BackfillAppliedRepository
	RoundRepo    repository.PresaleRoundRepository
}

// Opts 运行参数
type Opts struct {
	DryRun bool
	Batch  int
	Actor  string
	Reason string
}

// Candidate 一条候选回填记录（dry-run 输出 + apply 输入）
type Candidate struct {
	Deposit *model.PresaleDeposit
	Bind    *model.UserReferralBind
	DiffMs  int64 // bound_at - block_timestamp（用于桶分布 / 审计）
}

// Run 是主流程，抽出来便于测试。
func Run(ctx context.Context, deps Deps, opts Opts, stdin *os.File, stdout *os.File) error {
	cands, err := findCandidates(ctx, deps, opts.Batch)
	if err != nil {
		return fmt.Errorf("find candidates: %w", err)
	}

	if len(cands) == 0 {
		fmt.Fprintln(stdout, "✅ no candidates found (all historical假阴性 already backfilled or none ever hit)")
		return nil
	}

	printDryRun(stdout, cands)

	if opts.DryRun {
		fmt.Fprintln(stdout, "")
		fmt.Fprintln(stdout, "ℹ️  dry-run 模式，未做任何修改。如需真正回填：")
		fmt.Fprintln(stdout, "    ./inv6-backfill --apply --actor=<name> --batch=50")
		return nil
	}

	// apply 模式：stdin 二次确认
	fmt.Fprintln(stdout, "")
	fmt.Fprintln(stdout, "⚠️  即将对以上 deposit 真正执行回填（写入 deposit + holding + audit）")
	fmt.Fprintln(stdout, "    请输入 YES-APPLY 继续，其他任意输入将中止：")
	scanner := bufio.NewScanner(stdin)
	if !scanner.Scan() || strings.TrimSpace(scanner.Text()) != "YES-APPLY" {
		fmt.Fprintln(stdout, "🛑 用户未确认，中止")
		return nil
	}

	applied, skipped, errs := applyAll(ctx, deps, opts, cands)
	fmt.Fprintln(stdout, "")
	fmt.Fprintf(stdout, "✅ done: applied=%d skipped(已回填或并发占用)=%d errors=%d\n", applied, skipped, errs)
	if errs > 0 {
		return fmt.Errorf("apply 完成但有 %d 笔失败，请看日志", errs)
	}
	return nil
}

// findCandidates 找出"假阴性"候选 deposit：
//   confirmed + referrer_user_id IS NULL + 存在对应 bind + (bind.bound_at - 5000) < block_timestamp
//
// 用一条 JOIN 查询走主键索引，单 batch 上限保护。
func findCandidates(ctx context.Context, deps Deps, limit int) ([]Candidate, error) {
	type row struct {
		DepositID         uint64
		BlockTimestamp    int64
		UserID            uint64
		RoundID           string
		AmountUsdt        decimal.Decimal
		PriceUsd          decimal.Decimal
		SharesOdd         decimal.Decimal
		BindReferrerUserID uint64
		BindReferrerEoa   string
		BindBoundAt       int64
	}
	var rows []row
	// 直接 SQL，避免 ORM 拼出庞大 JOIN
	tolerance := service.Inv6BoundAtClockSkewMs
	sql := `
		SELECT d.id AS deposit_id, d.block_timestamp, d.user_id, d.round_id,
		       d.amount_usdt, d.price_usd, d.shares_odd,
		       b.referrer_user_id AS bind_referrer_user_id,
		       b.referrer_eoa     AS bind_referrer_eoa,
		       b.bound_at         AS bind_bound_at
		FROM presale_deposit d
		JOIN user_referral_bind b ON b.user_id = d.user_id
		WHERE d.status = 'confirmed'
		  AND d.referrer_user_id IS NULL
		  AND (b.bound_at - ?) < d.block_timestamp
		ORDER BY d.id ASC
		LIMIT ?
	`
	if err := deps.DB.WithContext(ctx).Raw(sql, tolerance, limit).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("scan candidates: %w", err)
	}

	cands := make([]Candidate, 0, len(rows))
	for _, r := range rows {
		dep := &model.PresaleDeposit{
			ID:             r.DepositID,
			BlockTimestamp: r.BlockTimestamp,
			UserID:         r.UserID,
			RoundID:        r.RoundID,
			AmountUsdt:     r.AmountUsdt,
			PriceUsd:       r.PriceUsd,
			SharesOdd:      r.SharesOdd,
		}
		bind := &model.UserReferralBind{
			UserID:         r.UserID,
			ReferrerUserID: r.BindReferrerUserID,
			ReferrerEoa:    r.BindReferrerEoa,
			BoundAt:        r.BindBoundAt,
		}
		cands = append(cands, Candidate{
			Deposit: dep,
			Bind:    bind,
			DiffMs:  bind.BoundAt - dep.BlockTimestamp,
		})
	}
	return cands, nil
}

// printDryRun 打印 dry-run 输出：直方图 + per-referrer 汇总 + 详细行
func printDryRun(w *os.File, cands []Candidate) {
	fmt.Fprintln(w, "=== INV-6 BACKFILL DRY-RUN ===")
	fmt.Fprintf(w, "Total affected: %d deposits\n\n", len(cands))

	// 直方图：diff_ms 分桶
	buckets := map[string]int{
		"diff<0 (先绑后买，正常)": 0,
		"[0,1000ms] 同秒边界":    0,
		"[1000,2000ms]":         0,
		"[2000,3000ms]":         0,
		"[3000,4000ms]":         0,
		"[4000,5000ms] 贴边":    0,
	}
	for _, c := range cands {
		switch {
		case c.DiffMs < 0:
			buckets["diff<0 (先绑后买，正常)"]++
		case c.DiffMs < 1000:
			buckets["[0,1000ms] 同秒边界"]++
		case c.DiffMs < 2000:
			buckets["[1000,2000ms]"]++
		case c.DiffMs < 3000:
			buckets["[2000,3000ms]"]++
		case c.DiffMs < 4000:
			buckets["[3000,4000ms]"]++
		default:
			buckets["[4000,5000ms] 贴边"]++
		}
	}
	fmt.Fprintln(w, "Distribution of bound_at - block_timestamp:")
	order := []string{
		"diff<0 (先绑后买，正常)",
		"[0,1000ms] 同秒边界",
		"[1000,2000ms]",
		"[2000,3000ms]",
		"[3000,4000ms]",
		"[4000,5000ms] 贴边",
	}
	for _, k := range order {
		fmt.Fprintf(w, "  %-26s: %d\n", k, buckets[k])
	}

	// per-referrer 汇总
	type rollupKey struct {
		ReferrerUserID uint64
		RoundID        string
	}
	type rollupVal struct {
		Count       int
		TotalReward decimal.Decimal
	}
	rollup := make(map[rollupKey]*rollupVal)
	for _, c := range cands {
		// 假设默认 pct=10%（详细 pct 从 round 取，但 dry-run 只算大致 reward 给运维 review）
		// apply 时按 round 真实 pct 计算
		key := rollupKey{c.Bind.ReferrerUserID, c.Deposit.RoundID}
		if _, ok := rollup[key]; !ok {
			rollup[key] = &rollupVal{}
		}
		rollup[key].Count++
		// 估算 reward = shares × 10% （仅展示用）
		rollup[key].TotalReward = rollup[key].TotalReward.Add(c.Deposit.SharesOdd.Mul(decimal.NewFromInt(10)).Div(decimal.NewFromInt(100)))
	}
	type rollupItem struct {
		Key rollupKey
		Val *rollupVal
	}
	items := make([]rollupItem, 0, len(rollup))
	for k, v := range rollup {
		items = append(items, rollupItem{k, v})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Val.TotalReward.GreaterThan(items[j].Val.TotalReward)
	})
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "Per-referrer rollup (estimated, by referrer × round):")
	for i, it := range items {
		if i >= 10 {
			fmt.Fprintf(w, "  ...(还有 %d 行省略)\n", len(items)-10)
			break
		}
		fmt.Fprintf(w, "  referrer=%d round=%s: %d 笔, sum≈%s ODD（10%% 估算）\n",
			it.Key.ReferrerUserID, it.Key.RoundID, it.Val.Count, it.Val.TotalReward.StringFixed(6))
	}

	// 详细行（最多展示 50 条）
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "Detailed rows:")
	for i, c := range cands {
		if i >= 50 {
			fmt.Fprintf(w, "  ...(剩余 %d 笔省略)\n", len(cands)-50)
			break
		}
		fmt.Fprintf(w, "  dep_id=%d user=%d referrer=%d round=%s diff_ms=%d amount=%s shares=%s\n",
			c.Deposit.ID, c.Deposit.UserID, c.Bind.ReferrerUserID, c.Deposit.RoundID,
			c.DiffMs, c.Deposit.AmountUsdt.String(), c.Deposit.SharesOdd.String())
	}
}

// applyAll 真正执行回填，单事务 / 单 deposit。
// 返回 (applied, skipped, errors)：skipped 包括"已回填"和"乐观锁兜底命中"两种 — 都 OK。
func applyAll(ctx context.Context, deps Deps, opts Opts, cands []Candidate) (applied, skipped, errs int) {
	for _, c := range cands {
		ok, err := applyOne(ctx, deps, opts, c)
		if err != nil {
			logger.Errorf("[inv6-backfill] apply deposit=%d failed: %v", c.Deposit.ID, err)
			errs++
			continue
		}
		if ok {
			applied++
		} else {
			skipped++
		}
	}
	return
}

// applyOne 是单 deposit 事务，返回 (applied, err)：applied=false 是正常 skip（已回填 / 乐观锁命中）。
func applyOne(ctx context.Context, deps Deps, opts Opts, c Candidate) (bool, error) {
	// 获取 round.ReferralRewardPct 用于精确计算 reward
	round, err := deps.RoundRepo.GetByID(ctx, c.Deposit.RoundID)
	if err != nil {
		return false, fmt.Errorf("get round %s: %w", c.Deposit.RoundID, err)
	}
	pct := round.ReferralRewardPct
	rewardOdd := c.Deposit.SharesOdd.Mul(pct).Div(decimal.NewFromInt(100))

	var didApply bool
	err = deps.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 应用层去重：INSERT IGNORE inv6_backfill_applied
		reasonPtr := opts.Reason
		row := &model.Inv6BackfillApplied{
			DepositID:      c.Deposit.ID,
			AppliedAt:      time.Now().UnixMilli(),
			DiffMs:         c.DiffMs,
			ReferrerUserID: c.Bind.ReferrerUserID,
			RewardOdd:      rewardOdd.String(),
			Actor:          opts.Actor,
			Reason:         &reasonPtr,
		}
		inserted, err := deps.BackfillRepo.MarkApplied(ctx, tx, row)
		if err != nil {
			return err
		}
		if !inserted {
			// 已回填过，整条事务静默退出（commit 时无更改）
			return nil
		}

		// 2. DB 行级乐观锁：UPDATE presale_deposit ... WHERE id=? AND referrer_user_id IS NULL
		updated, err := deps.DepositRepo.UpdateReferrerIfNull(
			ctx, tx, c.Deposit.ID, c.Bind.ReferrerUserID, c.Bind.ReferrerEoa, pct, rewardOdd,
		)
		if err != nil {
			return err
		}
		if !updated {
			// 与本笔 inv6_backfill_applied INSERT IGNORE 之间有人 UPDATE 了 referrer_user_id（极罕见）
			// 整条事务回滚（包括 backfill_applied 那条 INSERT），由 caller 当作 skip
			return fmt.Errorf("optimistic lock: deposit %d already has referrer_user_id (race)", c.Deposit.ID)
		}

		// 3. UpsertReferral holding（直接传 delta，不 SELECT current → 避免脏读 + worker 并发安全）
		if err := deps.HoldingRepo.UpsertReferral(ctx, tx, c.Bind.ReferrerUserID, c.Deposit.RoundID, rewardOdd); err != nil {
			return fmt.Errorf("upsert referral holding: %w", err)
		}

		// 4. 写 audit 留痕（同事务，事务回滚时 audit 也不会脏）
		afterJSON := fmt.Sprintf(
			`{"deposit_id":%d,"referrer_user_id":%d,"reward_odd":"%s","diff_ms":%d}`,
			c.Deposit.ID, c.Bind.ReferrerUserID, rewardOdd.String(), c.DiffMs,
		)
		beforeJSON := fmt.Sprintf(`{"deposit_id":%d,"referrer_user_id":null,"reward_odd":"0"}`, c.Deposit.ID)
		entry := &model.PresaleAdminAudit{
			Operator:   opts.Actor,
			Action:     "inv6_backfill",
			TargetType: "presale_deposit",
			TargetID:   fmt.Sprintf("%d", c.Deposit.ID),
			BeforeJSON: &beforeJSON,
			AfterJSON:  &afterJSON,
			Source:     "cli",
			Note:       opts.Reason,
		}
		if err := deps.AuditRepo.Create(tx, entry); err != nil {
			return fmt.Errorf("create audit: %w", err)
		}

		didApply = true
		return nil
	})
	if err != nil {
		return false, err
	}
	return didApply, nil
}
