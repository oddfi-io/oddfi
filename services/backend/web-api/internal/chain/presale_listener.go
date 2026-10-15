package chain

// presale_listener.go
//
// PresaleListener 是 presale-worker 的 USDT Transfer 监听器（B2 §6.1～§6.4）。
//
// 设计原则：
//   - HTTP eth_getLogs 轮询（非 WS subscribe）：更简单可靠，支持历史重放
//   - 多金库地址池：每个 vault 维护独立游标（presale_event_cursor 每地址一行）
//   - 重组防御：safeBlock = head - confirmBlocks，只处理 safeBlock 以下的区块
//   - 游标批次更新：scanVault 末尾更新游标，不是每条 log 一次事务；单条 log 失败不阻断游标推进
//   - 幂等保护：uk_(tx_hash, log_index) 保证重放时不重复入账
//
// 关键不变量（测试须覆盖）：
//   - INV-1：sold_odd 超 supply_odd → overflow anomaly，不 upsert holding
//   - INV-3：相同 uk_(tx_hash, log_index) 再次 processLog → 幂等返回
//   - INV-6：bound_at > block_timestamp 的邀请关系 → referral_reward_odd = 0
//   - INV-7：referral_reward_odd = shares_odd × pct / 100

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/redis"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// transferEventSig ERC-20 Transfer 事件签名 hash（与 service 层一致，避免重复定义）
var transferEventSig = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))

// ===========================
// PresaleListener 结构体
// ===========================

// PresaleListener USDT Transfer 监听器
// 多金库地址池：每个 vault 串行扫块，避免游标并发写入
type PresaleListener struct {
	cfg        *config.PresaleConfig
	db         *gorm.DB
	bscClient  service.BscClient
	depositSvc service.PresaleDepositService
	depositRepo repository.PresaleDepositRepository
	roundRepo   repository.PresaleRoundRepository
	holdingRepo repository.PresaleHoldingRepository
	opsRepo     repository.PresaleOpsEventRepository
	cursorRepo  repository.PresaleEventCursorRepository
	bindRepo    repository.UserReferralBindRepository
	userRepo    repository.UserRepo
	// kolRepo 可选；nil 时 worker 路径不查 KOL 自定义比例，沿用 round.ReferralRewardPct（REQ-004）
	kolRepo repository.KolReferralPctRepository
	rdb     *redis.Client
}

// SetKolReferralRepo 注入 KOL 自定义返佣比例 repo（REQ-004 worker 路径）。
// 调用方（presale-worker main.go）在构造 Listener 后立即注入；
// nil 时 worker 路径行为不变。
func (l *PresaleListener) SetKolReferralRepo(kolRepo repository.KolReferralPctRepository) {
	l.kolRepo = kolRepo
}

// NewPresaleListener 构造函数，注入所有依赖
func NewPresaleListener(
	cfg *config.PresaleConfig,
	db *gorm.DB,
	bscClient service.BscClient,
	depositSvc service.PresaleDepositService,
	depositRepo repository.PresaleDepositRepository,
	roundRepo repository.PresaleRoundRepository,
	holdingRepo repository.PresaleHoldingRepository,
	opsRepo repository.PresaleOpsEventRepository,
	cursorRepo repository.PresaleEventCursorRepository,
	bindRepo repository.UserReferralBindRepository,
	userRepo repository.UserRepo,
	rdb *redis.Client,
) *PresaleListener {
	return &PresaleListener{
		cfg:         cfg,
		db:          db,
		bscClient:   bscClient,
		depositSvc:  depositSvc,
		depositRepo: depositRepo,
		roundRepo:   roundRepo,
		holdingRepo: holdingRepo,
		opsRepo:     opsRepo,
		cursorRepo:  cursorRepo,
		bindRepo:    bindRepo,
		userRepo:    userRepo,
		rdb:         rdb,
	}
}

// ===========================
// Run（主循环）
// ===========================

// ScanOnce 对所有金库地址执行一次 scanVault（供测试和按需调用）
// 生产环境通过 Run 的 ticker 触发；测试通过 ScanOnce 直接触发单次扫块
func (l *PresaleListener) ScanOnce(ctx context.Context) error {
	for _, vault := range l.cfg.VaultPool {
		if err := l.scanVault(ctx, vault); err != nil {
			return fmt.Errorf("[PresaleListener] scan vault %s: %w", vault, err)
		}
	}
	return nil
}

// Run 启动监听器主循环（阻塞，由 goroutine 调用）
// 每 PollIntervalSec 秒对所有金库地址串行执行 scanVault
// ctx.Done() 时优雅退出
func (l *PresaleListener) Run(ctx context.Context) {
	interval := time.Duration(l.cfg.PollIntervalSec) * time.Second
	if interval <= 0 {
		interval = 6 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	logger.Infof("[PresaleListener] started, vaults=%v confirm_blocks=%d poll_interval=%s",
		l.cfg.VaultPool, l.cfg.ConfirmBlocks, interval)

	for {
		select {
		case <-ctx.Done():
			logger.Info("[PresaleListener] stopped gracefully")
			return
		case <-ticker.C:
			// 每个金库地址独立串行扫块（串行避免游标并发写入导致状态乱序）
			for _, vault := range l.cfg.VaultPool {
				if err := l.scanVault(ctx, vault); err != nil {
					logger.Errorf("[PresaleListener] scan vault %s failed: %v", vault, err)
					// 单个金库扫块失败不阻断其他金库（继续下一个）
				}
			}
		}
	}
}

// ===========================
// scanVault（单金库扫块）
// ===========================

// scanVault 对指定金库地址执行一次 eth_getLogs 扫块：
//  1. 加载游标，获取 cursor.last_block_number
//  2. 获取链头，计算 safeBlock = head - confirmBlocks（重组防御）
//  3. FromBlock = cursor.last_block_number+1，ToBlock = safeBlock
//  4. eth_getLogs 过滤 USDT Transfer(to=vaultAddr)
//  5. 逐条 processLog（单条失败不阻断整批）
//  6. 游标批次更新（scanVault 末尾，不是每条 log 一次事务）
func (l *PresaleListener) scanVault(ctx context.Context, vaultAddr string) error {
	// 1. 加载游标
	cursor, err := l.cursorRepo.Load(ctx, vaultAddr)
	if err != nil {
		return fmt.Errorf("[PresaleListener] load cursor for vault %s: %w", vaultAddr, err)
	}

	// 2. 获取链头（带简单重试）
	head, err := l.blockNumberWithRetry(ctx)
	if err != nil {
		return fmt.Errorf("[PresaleListener] get block number: %w", err)
	}

	// safeBlock：等待 confirmBlocks 个区块确认，防止重组（BSC ~3s/块，3块≈9s）
	if head < l.cfg.ConfirmBlocks {
		return nil // 链高度不足，等待
	}
	safeBlock := head - l.cfg.ConfirmBlocks

	if cursor.LastBlockNumber >= safeBlock {
		// 尚未到安全块，本轮跳过
		return nil
	}

	fromBlock := cursor.LastBlockNumber + 1

	// 3. eth_getLogs：过滤 USDT Transfer(to=vaultAddr)
	vaultAddrLower := strings.ToLower(vaultAddr)
	logs, err := l.filterLogsWithRetry(ctx, ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(safeBlock),
		Addresses: []common.Address{common.HexToAddress(l.cfg.UsdtAddress)},
		// topics[0]=Transfer签名, topics[1]=任意from, topics[2]=to=vaultAddr（indexed）
		Topics: [][]common.Hash{
			{transferEventSig},
			{}, // from: 任意
			{common.HexToHash(common.HexToAddress(vaultAddr).Hex())},
		},
	})
	if err != nil {
		return fmt.Errorf("[PresaleListener] filter logs vault=%s from=%d to=%d: %w",
			vaultAddrLower, fromBlock, safeBlock, err)
	}

	logger.Infof("[PresaleListener] vault=%s from=%d to=%d logs=%d",
		vaultAddrLower, fromBlock, safeBlock, len(logs))

	// 4. 逐条处理 log（单条失败只记日志，不阻断整批游标推进）
	for _, logEntry := range logs {
		if err := l.processLog(ctx, logEntry, vaultAddr); err != nil {
			logger.Errorf("[PresaleListener] process log tx=%s log_index=%d vault=%s: %v",
				logEntry.TxHash.Hex(), logEntry.Index, vaultAddrLower, err)
			// 继续处理下一条；重组风险由 safeBlock 已降至极低
		}
	}

	// 5. 游标批次更新（scanVault 末尾统一提交，不是每条 log 一次事务）
	// 游标更新独立事务（与 deposit 事务分离），保证游标和 deposit 最终一致
	// 即使部分 log processLog 失败，游标仍推进；下次扫块会重放，uk 幂等保证不重复入账
	if err := l.cursorRepo.Save(ctx, nil, vaultAddr, safeBlock, 0); err != nil {
		return fmt.Errorf("[PresaleListener] save cursor vault=%s block=%d: %w",
			vaultAddrLower, safeBlock, err)
	}

	return nil
}

// ===========================
// processLog（单条 log 处理，大事务边界）
// ===========================

// processLog 处理单条 USDT Transfer log：
//  1. 解析 Transfer（from/to/amount）
//  2. 反查 user（by EOA = from）→ 若无则 unclaimed anomaly
//  3. 获取 block_timestamp
//  4. FindRound（含容差）→ 找归属轮次
//  5. 反查邀请关系（INV-6：bound_at < blockTs 才有效）
//  6. 大事务：INSERT deposit(confirmed, source=worker) + IncrSoldAndRaised + UpsertHolding
//
// 事务设计：deposit INSERT 和 holding upsert 在同一事务；游标在 scanVault 末尾单独更新。
// 幂等：CreateOrGet uk_(tx_hash, log_index) 冲突时取已有记录，再 ConfirmDeposit 推进状态。
func (l *PresaleListener) processLog(ctx context.Context, logEntry types.Log, vaultAddr string) error {
	// 1. 解析 Transfer log
	transfer, err := parseTransferFromLog(logEntry)
	if err != nil {
		return fmt.Errorf("[PresaleListener] parse transfer log tx=%s: %w", logEntry.TxHash.Hex(), err)
	}

	// 2. 反查 user（by EOA = transfer.From，matching signing_address 字段）
	// ErrUserNotFound 或 nil user 均视为 unclaimed（用户绕前端直转金库）
	user, userErr := l.userRepo.GetByWalletAddress(ctx, transfer.From)
	if userErr != nil || user == nil {
		txh := strings.ToLower(logEntry.TxHash.Hex())
		from := transfer.From
		amt := transfer.Amount
		payload := fmt.Sprintf(`{"from":%q,"block_number":%d,"log_index":%d}`,
			from, logEntry.BlockNumber, logEntry.Index)
		logger.Warnf("[PresaleListener] unclaimed transfer tx=%s from=%s amount=%s",
			txh, from, amt.String())
		opsEvent := &model.PresaleOpsEvent{
			EventType:   model.AnomalyUnclaimed,
			TxHash:      &txh,
			EoaAddress:  &from,
			AmountUsdt:  &amt,
			PayloadJson: &payload,
			Status:      model.OpsEventStatusPending,
		}
		if createErr := l.opsRepo.Create(ctx, nil, opsEvent); createErr != nil {
			logger.Warnf("[PresaleListener] record unclaimed anomaly failed tx=%s: %v", txh, createErr)
		}
		return nil // unclaimed 不是 processLog 的硬错误，继续处理下一条
	}

	// 3. 获取 block_timestamp（毫秒）
	blockTs, err := l.getBlockTimestamp(ctx, logEntry.BlockNumber)
	if err != nil {
		return fmt.Errorf("[PresaleListener] get block ts block=%d: %w", logEntry.BlockNumber, err)
	}

	// 4. 找归属轮次（含容差）
	round, err := l.depositSvc.FindRound(ctx, blockTs)
	if err != nil {
		// 找不到轮次：late_arrival anomaly（不阻断其他 log）
		txh := strings.ToLower(logEntry.TxHash.Hex())
		from := transfer.From
		amt := transfer.Amount
		payload := fmt.Sprintf(`{"block_ts":%d,"block_number":%d}`, blockTs, logEntry.BlockNumber)
		logger.Warnf("[PresaleListener] late_arrival tx=%s blockTs=%d: %v", txh, blockTs, err)
		opsEvent := &model.PresaleOpsEvent{
			EventType:   model.AnomalyLateArrival,
			TxHash:      &txh,
			EoaAddress:  &from,
			AmountUsdt:  &amt,
			PayloadJson: &payload,
			Status:      model.OpsEventStatusPending,
		}
		if createErr := l.opsRepo.Create(ctx, nil, opsEvent); createErr != nil {
			logger.Warnf("[PresaleListener] record late_arrival anomaly failed tx=%s: %v", txh, createErr)
		}
		return nil
	}

	// 5. 反查邀请关系（INV-6：bound_at < blockTs 才算有效邀请）
	sharesOdd := transfer.Amount.Div(round.PriceUsd)
	bind, _ := l.bindRepo.GetByUserID(ctx, user.UserID)

	var referrerUserID *uint64
	var referrerEoa *string
	var referralRewardPct *decimal.Decimal
	referralRewardOdd := decimal.Zero

	if bind != nil && bind.BoundAt-service.Inv6BoundAtClockSkewMs < blockTs {
		// INV-6 满足：bound_at - Inv6BoundAtClockSkewMs < block_timestamp
		// 容差吸收"bind.BoundAt(墙钟真 ms) vs blockTs(链端秒粒度填零)"跨时钟域差异
		// 常量定义 + 残留风险说明详见 service/presale_consts.go
		referrerUserID = &bind.ReferrerUserID
		referrerEoa = &bind.ReferrerEoa
		// REQ-004：优先查 KOL 自定义返佣比例；未命中 / repo 未注入 时回退轮次全局比例
		pct := round.ReferralRewardPct
		if l.kolRepo != nil && bind.ReferrerEoa != "" {
			if kol, kerr := l.kolRepo.GetByEoa(ctx, strings.ToLower(bind.ReferrerEoa)); kerr == nil {
				pct = kol.ReferralPct
			} else if !errors.Is(kerr, repository.ErrKolNotFound) {
				logger.Warnf("[PresaleListener] kol lookup failed eoa=%s err=%v - fallback to round pct",
					strings.ToLower(bind.ReferrerEoa), kerr)
			}
		}
		referralRewardPct = &pct
		// INV-7：referral_reward_odd = shares_odd × pct / 100（精确 decimal 计算）
		referralRewardOdd = sharesOdd.Mul(pct).Div(decimal.NewFromInt(100))
		// 监控埋点：容差实际吸收时打 info 日志（bound_at > blockTs 但差距 ≤ Inv6BoundAtClockSkewMs）
		// 部署后 7d 观察 diff_ms 分布，验证容差值是否合适
		// 安全：只打 diff_ms 相对量 + lowercase tx_hash 与 service 路径对齐，不暴露
		// bound_at / block_ts 服务器墙钟绝对值（v2 round security MAJ-2 + code MAJ-3）
		if bind.BoundAt > blockTs {
			logger.Infof("[PresaleListener] inv6 tolerance absorbed tx=%s diff_ms=%d",
				strings.ToLower(logEntry.TxHash.Hex()), bind.BoundAt-blockTs)
		}
	}

	// 5.5 信息流标记：到账时所属轮次处于 paused 状态
	// 仍正常入账（status=confirmed），但在 anomaly_reason 字段标 paused_arrival
	// 供 Lark webhook 推送给运营，同事务额外落 ops_event 便于运营在 admin 后台查询
	// 设计意图：非阻塞资金流，只做信息流告警
	var anomalyReasonPtr *string
	isPausedArrival := round.Status == model.RoundStatusPaused
	if isPausedArrival {
		r := model.AnomalyPausedArrival
		anomalyReasonPtr = &r
	}

	// 6. 大事务：INSERT deposit + IncrSoldAndRaised + UpsertHolding
	txHashLower := strings.ToLower(logEntry.TxHash.Hex())
	eoaLower := strings.ToLower(transfer.From)
	vaultLower := strings.ToLower(vaultAddr)
	confirmedAt := time.Now().UnixMilli()

	// notifyDeposit 在事务最末尾（仅 happy path）赋值，事务 commit 后用于发推（ISSUE-005）。
	// 幂等分支（existing.Status=confirmed 早退）/ overflow 异常分支（MarkAnomaly 后早退）
	// 自然不会赋值，从而不发推。
	// 必须事务外发推：避免 SendAnomalyAlert 已 goroutine 发出后外层 rollback 的 race。
	var notifyDeposit *model.PresaleDeposit

	err = l.db.Transaction(func(tx *gorm.DB) error {
		deposit := &model.PresaleDeposit{
			TxHash:            txHashLower,
			LogIndex:          uint(logEntry.Index),
			BlockNumber:       logEntry.BlockNumber,
			BlockTimestamp:    blockTs,
			UserID:            user.UserID,
			EoaAddress:        eoaLower,
			VaultAddress:      vaultLower,
			AnomalyReason:     anomalyReasonPtr,
			RoundID:           round.ID,
			AmountUsdt:        transfer.Amount,
			PriceUsd:          round.PriceUsd,
			SharesOdd:         sharesOdd,
			ReferrerUserID:    referrerUserID,
			ReferrerEoa:       referrerEoa,
			ReferralRewardPct: referralRewardPct,
			ReferralRewardOdd: referralRewardOdd,
			// Worker 路径直接置 confirmed（已达 safeBlock ≥ confirmBlocks，链上安全确认）。
			// 这与 ReportTx 路径的设计是有意分叉：
			//   - Worker 路径：已过 safeBlock，链上确认充分，INSERT 时直接 confirmed，
			//     若 uk 冲突（前端先 pending），走 ConfirmDeposit 推进状态。
			//   - ReportTx 路径：用户实时上报，区块可能未达 confirmBlocks，
			//     INSERT pending，等 Worker 扫块后推进到 confirmed。
			// 两条路径会师点：CreateOrGet → isNew=false → ConfirmDeposit（pending→confirmed）。
			Status:  model.PresaleDepositStatusConfirmed,
			Source:  model.PresaleDepositSourceWorker,
		}

		// uk_(tx_hash, log_index) 冲突时返回已有记录（前端已先 INSERT pending）
		existing, isNew, err := l.depositRepo.CreateOrGet(ctx, tx, deposit)
		if err != nil {
			return fmt.Errorf("[PresaleListener] create or get deposit tx=%s log=%d: %w",
				txHashLower, logEntry.Index, err)
		}

		if !isNew {
			// 幂等保护：之前已 confirmed → 跳过后续 Incr/Upsert（重复扫块场景）
			// 必须先检查这条，再做 pending→confirmed UPDATE + 内存同步；否则
			// TODO-014 M1 的内存同步会让本分支误触发，跳过后续 Incr/Upsert，引入资金不一致 bug
			if existing.Status == model.PresaleDepositStatusConfirmed {
				return nil
			}
			// 已有 pending 记录（前端先上报），推进到 confirmed
			if existing.Status == model.PresaleDepositStatusPending {
				if err := l.depositRepo.ConfirmDeposit(ctx, tx, existing.ID, confirmedAt); err != nil {
					return fmt.Errorf("[PresaleListener] confirm existing deposit id=%d: %w",
						existing.ID, err)
				}
				// TODO-014 M1：内存同步，防止 notifyDeposit 携带过期 Status
				// 未来若给 LarkEvent 加 Status 字段，本行可保证不发"假 pending"卡片
				existing.Status = model.PresaleDepositStatusConfirmed
			}
			// 使用已有 deposit 的 ID 继续后续操作
			deposit = existing
		}

		depositID := deposit.ID

		// 5.5 信息流 ops_event：到账时所属轮次处于 paused 状态
		// 仍正常入账（继续走 IncrSold + UpsertHolding），但落 ops_event 供运营 admin 查询 + Lark 推送
		// 设计与 overflow 不同：不阻断后续 holding 入账，仅作信息流告警
		if isPausedArrival {
			txh := txHashLower
			eoa := eoaLower
			amt := transfer.Amount
			payload := fmt.Sprintf(`{"round_id":%q,"round_status":"paused","note":"paused arrival info-flow"}`, round.ID)
			opsEvent := &model.PresaleOpsEvent{
				EventType:   model.AnomalyPausedArrival,
				DepositID:   &depositID,
				TxHash:      &txh,
				EoaAddress:  &eoa,
				AmountUsdt:  &amt,
				PayloadJson: &payload,
				Status:      model.OpsEventStatusPending,
			}
			if opsErr := l.opsRepo.Create(ctx, tx, opsEvent); opsErr != nil {
				// 信息流非阻塞：ops_event 失败仅 warn，不回滚 deposit 入账
				logger.Warnf("[PresaleListener] record paused_arrival ops_event deposit=%d: %v",
					depositID, opsErr)
			}
		}

		// IncrSoldAndRaised：乐观条件保护 INV-1（sold_odd ≤ supply_odd）
		if err := l.roundRepo.IncrSoldAndRaised(ctx, tx, round.ID, sharesOdd, transfer.Amount); err != nil {
			if err == repository.ErrCapacityExceeded {
				// overflow anomaly：超出轮次容量，deposit 标 anomaly，不 upsert holding
				if markErr := l.depositRepo.MarkAnomaly(ctx, tx, depositID, model.AnomalyOverflow); markErr != nil {
					return fmt.Errorf("[PresaleListener] mark overflow deposit=%d: %w", depositID, markErr)
				}
				payload := fmt.Sprintf(`{"round_id":%q,"shares_odd":%q}`,
					round.ID, sharesOdd.String())
				txh := txHashLower
				eoa := eoaLower
				amt := transfer.Amount
				opsEvent := &model.PresaleOpsEvent{
					EventType:   model.AnomalyOverflow,
					DepositID:   &depositID,
					TxHash:      &txh,
					EoaAddress:  &eoa,
					AmountUsdt:  &amt,
					PayloadJson: &payload,
					Status:      model.OpsEventStatusPending,
				}
				if opsErr := l.opsRepo.Create(ctx, tx, opsEvent); opsErr != nil {
					logger.Warnf("[PresaleListener] record overflow ops_event deposit=%d: %v",
						depositID, opsErr)
				}
				return nil // overflow 不继续 upsert holding
			}
			return fmt.Errorf("[PresaleListener] incr sold_and_raised round=%s: %w", round.ID, err)
		}

		// UpsertInvest holding（source=invest）
		if err := l.holdingRepo.UpsertInvest(ctx, tx,
			user.UserID, round.ID, sharesOdd, transfer.Amount, round.PriceUsd); err != nil {
			return fmt.Errorf("[PresaleListener] upsert invest holding user=%d: %w", user.UserID, err)
		}

		// UpsertReferral holding（source=referral，INV-6/7 已检查）
		if referrerUserID != nil && referralRewardOdd.IsPositive() {
			if err := l.holdingRepo.UpsertReferral(ctx, tx,
				*referrerUserID, round.ID, referralRewardOdd); err != nil {
				return fmt.Errorf("[PresaleListener] upsert referral holding referrer=%d: %w",
					*referrerUserID, err)
			}
		}

		// DEL Redis config 缓存（sold/raised 已更新）
		if l.rdb != nil {
			if delErr := l.rdb.Del(ctx, "presale:config:v1"); delErr != nil {
				logger.Warnf("[PresaleListener] del config cache failed deposit=%d: %v", depositID, delErr)
			}
		}

		// happy path 抵达：标记事务外补发 deposit_confirmed Lark 推送（ISSUE-005）。
		// 必须是 tx 闭包内的最后一步，确保前面任何 error/早退路径都不会触发推送：
		//   - 幂等分支（existing.Status=confirmed 早退）→ 未赋值 → 不推送 ✅
		//   - overflow（MarkAnomaly 后 return nil）→ 未赋值 → 不推送 ✅
		//   - 任何 step 返回 error → tx rollback → 函数提前 return → 不推送 ✅
		notifyDeposit = deposit

		return nil
	})
	if err != nil {
		return err
	}

	// 事务已 commit，安全发推（SendAnomalyAlert 内部 goroutine + recover panic）
	if notifyDeposit != nil {
		l.depositSvc.NotifyDepositConfirmed(notifyDeposit)
	}
	return nil
}

// ===========================
// 辅助函数
// ===========================

// listenerTransfer processLog 内部使用的 Transfer 解析结果
type listenerTransfer struct {
	From   string
	Amount decimal.Decimal
}

// parseTransferFromLog 从单条 types.Log 解析 Transfer(from, to, amount)
// 该函数只处理已过滤的 USDT Transfer log（topics 已由 eth_getLogs filter 保证）
func parseTransferFromLog(logEntry types.Log) (*listenerTransfer, error) {
	if len(logEntry.Topics) < 3 {
		return nil, fmt.Errorf("insufficient topics: got %d, want 3", len(logEntry.Topics))
	}
	if logEntry.Topics[0] != transferEventSig {
		return nil, fmt.Errorf("unexpected event sig: %s", logEntry.Topics[0].Hex())
	}

	fromAddr := strings.ToLower(common.BytesToAddress(logEntry.Topics[1].Bytes()).Hex())

	if len(logEntry.Data) < 32 {
		return nil, fmt.Errorf("log data too short: %d bytes", len(logEntry.Data))
	}
	amountBig := new(big.Int).SetBytes(logEntry.Data[:32])
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	amountDec := decimal.NewFromBigInt(amountBig, 0).Div(decimal.NewFromBigInt(divisor, 0))

	return &listenerTransfer{
		From:   fromAddr,
		Amount: amountDec,
	}, nil
}

// getBlockTimestamp 按块高获取 block_timestamp（毫秒）
func (l *PresaleListener) getBlockTimestamp(ctx context.Context, blockNumber uint64) (int64, error) {
	header, err := l.bscClient.HeaderByNumber(ctx, new(big.Int).SetUint64(blockNumber))
	if err != nil {
		return 0, fmt.Errorf("[PresaleListener] header by number %d: %w", blockNumber, err)
	}
	return int64(header.Time) * 1000, nil
}

// blockNumberWithRetry 获取链头高度，失败时最多重试 3 次
func (l *PresaleListener) blockNumberWithRetry(ctx context.Context) (uint64, error) {
	var lastErr error
	for i := 0; i < 3; i++ {
		head, err := l.bscClient.BlockNumber(ctx)
		if err == nil {
			return head, nil
		}
		lastErr = err
		if i < 2 {
			time.Sleep(time.Duration(i+1) * 500 * time.Millisecond)
		}
	}
	return 0, fmt.Errorf("[PresaleListener] block number after 3 retries: %w", lastErr)
}

// filterLogsWithRetry eth_getLogs 失败时最多重试 3 次
func (l *PresaleListener) filterLogsWithRetry(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	var lastErr error
	for i := 0; i < 3; i++ {
		logs, err := l.bscClient.FilterLogs(ctx, q)
		if err == nil {
			return logs, nil
		}
		lastErr = err
		if i < 2 {
			time.Sleep(time.Duration(i+1) * 500 * time.Millisecond)
		}
	}
	return nil, fmt.Errorf("[PresaleListener] filter logs after 3 retries: %w", lastErr)
}
