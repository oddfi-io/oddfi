package service

// presale_deposit_impl.go
//
// PresaleDepositService 的完整实现（Agent B 职责）。
// 实现 presale_deposit.go 中声明的 PresaleDepositService 接口。
//
// 关键设计：
//   - ReportTx：链上 4 项校验 → FindRound → INSERT pending(幂等) → round_mismatch anomaly 信息流
//   - ConfirmDeposit：大事务 UPDATE confirmed + IncrSoldAndRaised(overflow→anomaly) + UpsertHolding
//   - FindRound：边界容差 ±tolerance，超出找 upcoming 兜底，再无则 ErrNoActiveRound
//   - GetPosition：presale_holding 聚合，invest 行参与加权，referral 行只计 holdings
//   - recordAnomaly：同步落 presale_ops_event，异步 warn 日志占位（B4 接入 Lark）

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"strings"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/redis"
	"everything_finance/org/web-api/internal/repository"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ===========================
// BscClient 接口抽象（便于测试 mock）
// ===========================

// BscClient 封装 ethclient 所需的最小 BSC RPC 方法集
// Worker 路径使用完整 ethclient；测试注入 mock 实现
type BscClient interface {
	// TransactionReceipt 按 txHash 取 receipt（report-tx 链上校验用）
	TransactionReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error)

	// FilterLogs eth_getLogs 批量拉 Transfer 事件（监听器扫块用）
	FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error)

	// BlockNumber 获取当前链头区块高度（计算 safeBlock 用）
	BlockNumber(ctx context.Context) (uint64, error)

	// HeaderByNumber 按块高取 block header（获取 block_timestamp 用）
	HeaderByNumber(ctx context.Context, number *big.Int) (*types.Header, error)
}

// NewBscClientFromURL 创建真实的 BSC RPC 客户端（生产使用）
// 导出供 presale-worker main.go 复用
func NewBscClientFromURL(rpcURL string) (BscClient, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("[PresaleDepositImpl] dial bsc rpc %s: %w", rpcURL, err)
	}
	return client, nil
}

// ===========================
// parsedTransfer 解析后的 USDT Transfer 事件
// ===========================

type parsedTransfer struct {
	From     string          // tx.from EOA，小写
	To       string          // 收款地址（金库），小写
	Amount   decimal.Decimal // 实际到账金额（USDT，18位精度）
	LogIndex uint            // log 在 receipt 中的索引
}

// transferEventID ERC-20 Transfer 事件签名 hash
var transferEventID = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))

// usdtTransferABI 用于记录 ABI 解析能力（当前仅用 topics 解析，不需 ABI decode）
var _ = func() abi.ABI {
	parsed, err := abi.JSON(strings.NewReader(`[{
		"anonymous": false,
		"inputs": [
			{"indexed": true,  "name": "from",  "type": "address"},
			{"indexed": true,  "name": "to",    "type": "address"},
			{"indexed": false, "name": "value", "type": "uint256"}
		],
		"name": "Transfer",
		"type": "event"
	}]`))
	if err != nil {
		panic(fmt.Sprintf("[PresaleDepositImpl] parse transfer ABI: %v", err))
	}
	return parsed
}()

// ErrMultipleTransfersToVault tx 包含多条 to=vault 的 USDT Transfer log（合约路由/sweep 场景）
// 拒绝多条 Transfer to vault，只接受 EOA 直转金库语义：
//   - 合约调用（如聚合器、钱包合约）可能产生多条内部 Transfer，to=vault 出现多次
//   - 此类链路无法明确识别"用户直接支付意图"，视为路由错误，映射到 40007
var ErrMultipleTransfersToVault = errPresale("multiple USDT transfers to vault in same tx: routing error")

// parseUsdtTransferLog 从 receipt.Logs 中找到 USDT Transfer(to ∈ vaultPool) 的日志。
// 返回 parsedTransfer；找不到时：
//   - ErrTxNotToVault：有 USDT Transfer log 但 to 不在金库池
//   - ErrTxNotUsdt：没有符合的 USDT Transfer log（用户转了别的 token）
//   - ErrMultipleTransfersToVault：存在 >1 条 to=vault 的 Transfer（合约路由场景，拒绝）
//
// 设计：只接受"单条 EOA 直转金库"语义。
// 若 tx 包含多条 to=vault Transfer，无法确认用户真实支付意图，返回路由错误。
func parseUsdtTransferLog(logs []*types.Log, vaultPool []string, usdtAddr string) (*parsedTransfer, error) {
	usdtAddrLower := strings.ToLower(usdtAddr)
	vaultSet := make(map[string]struct{}, len(vaultPool))
	for _, v := range vaultPool {
		vaultSet[strings.ToLower(v)] = struct{}{}
	}

	hasUsdtLog := false
	var matched *parsedTransfer // 首条命中的 Transfer to vault

	for _, log := range logs {
		// 过滤合约地址（USDT 合约）
		if strings.ToLower(log.Address.Hex()) != usdtAddrLower {
			continue
		}
		// 必须是 Transfer 事件（topics[0] 匹配签名）且有 from/to topics
		if len(log.Topics) < 3 || log.Topics[0] != transferEventID {
			continue
		}
		hasUsdtLog = true

		// topics[2] = to（32字节，前12字节padding，后20字节是地址）
		toAddr := strings.ToLower(common.BytesToAddress(log.Topics[2].Bytes()).Hex())

		// 收款地址必须在金库池
		if _, ok := vaultSet[toAddr]; !ok {
			continue
		}

		// 发现第二条 to=vault 的 Transfer → 拒绝（合约路由场景，语义不明）
		if matched != nil {
			return nil, ErrMultipleTransfersToVault
		}

		// topics[1] = from
		fromAddr := strings.ToLower(common.BytesToAddress(log.Topics[1].Bytes()).Hex())

		// 解析 amount（data 字段是 ABI 编码的 uint256，前 32 字节）
		if len(log.Data) < 32 {
			continue
		}
		amountBig := new(big.Int).SetBytes(log.Data[:32])

		// USDT BEP-20 精度 18：1 USDT = 1e18 wei
		divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
		amountDec := decimal.NewFromBigInt(amountBig, 0).
			Div(decimal.NewFromBigInt(divisor, 0))

		matched = &parsedTransfer{
			From:     fromAddr,
			To:       toAddr,
			Amount:   amountDec,
			LogIndex: uint(log.Index),
		}
	}

	if matched != nil {
		return matched, nil
	}

	if hasUsdtLog {
		// 有 USDT Transfer log 但 to 不在金库池（用户转错地址）
		return nil, ErrTxNotToVault
	}
	// 没有 USDT Transfer log（用户转了别的 token）
	return nil, ErrTxNotUsdt
}

// ===========================
// ErrNoActiveRound - 找不到归属轮次（进 late_arrival anomaly）
// ===========================

var ErrNoActiveRound = errPresale("no active round found for block timestamp")

// ===========================
// presaleDepositService 实现结构体
// ===========================

type presaleDepositService struct {
	cfg         *config.PresaleConfig
	db          *gorm.DB
	depositRepo repository.PresaleDepositRepository
	roundRepo   repository.PresaleRoundRepository
	holdingRepo repository.PresaleHoldingRepository
	opsRepo     repository.PresaleOpsEventRepository
	bindRepo    repository.UserReferralBindRepository
	// kolRepo 可选；nil 时不查 KOL 自定义比例，直接用 round.ReferralRewardPct（REQ-004 向后兼容）
	kolRepo     repository.KolReferralPctRepository
	rdb         *redis.Client
	bscClient   BscClient
	// larkAlerter 异常告警接口（nil 时降级 noop，B4 注入真实 LarkWebhookService）
	larkAlerter AnomalyAlerter
}

// NewPresaleDepositService 构造函数，注入所有依赖。
// bscClient 为 nil 时尝试从 cfg.BscRpcUrl 创建（生产路径）。
// kolRepo 为 nil 时不启用 KOL 自定义返佣（REQ-004），回落 round.ReferralRewardPct。
// larkAlerter 为 nil 时使用 noopLarkAlerter（向后兼容旧装配代码）。
func NewPresaleDepositService(
	cfg *config.PresaleConfig,
	db *gorm.DB,
	depositRepo repository.PresaleDepositRepository,
	roundRepo repository.PresaleRoundRepository,
	holdingRepo repository.PresaleHoldingRepository,
	opsRepo repository.PresaleOpsEventRepository,
	bindRepo repository.UserReferralBindRepository,
	kolRepo repository.KolReferralPctRepository,
	rdb *redis.Client,
	bscClient BscClient,
	larkAlerter ...AnomalyAlerter, // 可选参数，nil 时降级 noop
) PresaleDepositService {
	if bscClient == nil && cfg.BscRpcUrl != "" {
		var err error
		bscClient, err = NewBscClientFromURL(cfg.BscRpcUrl)
		if err != nil {
			// 启动时 BSC RPC 不可达是致命错误（沿用 B0 InitGORM panic 风格）
			panic(fmt.Sprintf("[PresaleDepositImpl] cannot connect to bsc rpc: %v", err))
		}
	}

	// 处理可选 larkAlerter 参数：nil 或未传均降级 noop，保证向后兼容
	var alerter AnomalyAlerter = noopAnomalyAlerter{}
	if len(larkAlerter) > 0 && larkAlerter[0] != nil {
		alerter = larkAlerter[0]
	}

	return &presaleDepositService{
		cfg:         cfg,
		db:          db,
		depositRepo: depositRepo,
		roundRepo:   roundRepo,
		holdingRepo: holdingRepo,
		opsRepo:     opsRepo,
		bindRepo:    bindRepo,
		kolRepo:     kolRepo,
		rdb:         rdb,
		bscClient:   bscClient,
		larkAlerter: alerter,
	}
}

// ===========================
// ReportTx（前端上报入口，双轨之一）
// ===========================

func (s *presaleDepositService) ReportTx(ctx context.Context, userID uint64, eoa string, req ReportTxRequest) (*ReportTxResponse, error) {
	// 1. 链上 4 项校验（fail-fast）：
	//    INVALID_TX(40006) / TX_NOT_TO_VAULT(40007) / TX_NOT_USDT(40008) / WALLET_MISMATCH(40902)
	transfer, logIndex, blockNumber, blockTs, err := s.validateAndParseReceipt(ctx, req.TxHash, eoa)
	if err != nil {
		return nil, err
	}

	// 2. 找归属轮次（含边界容差）
	round, err := s.FindRound(ctx, blockTs)
	if err != nil {
		// 无法归属轮次：直接返错给前端（前端可重试或联系客服）
		logger.Warnf("[PresaleDepositImpl] report-tx no active round tx=%s blockTs=%d: %v",
			req.TxHash, blockTs, err)
		return nil, ErrNoActiveRound
	}

	// 3. 计算 shares_odd + 邀请奖励（INV-6/INV-7）
	sharesOdd := transfer.Amount.Div(round.PriceUsd)
	bind, _ := s.bindRepo.GetByUserID(ctx, userID)

	var referrerUserID *uint64
	var referrerEoa *string
	var referralRewardPct *decimal.Decimal
	referralRewardOdd := decimal.Zero

	// INV-6：bound_at - Inv6BoundAtClockSkewMs < block_timestamp 才算有效邀请（时序保护）
	// 容差吸收"bind.BoundAt(墙钟真 ms) vs blockTs(链端秒粒度填零)"跨时钟域差异
	// 常量定义 + 残留风险说明详见 presale_consts.go
	if bind != nil && bind.BoundAt-Inv6BoundAtClockSkewMs < blockTs {
		referrerUserID = &bind.ReferrerUserID
		referrerEoa = &bind.ReferrerEoa
		// REQ-004：优先查 KOL 自定义返佣比例；未命中（ErrKolNotFound）/ repo 未注入 时
		// 回退轮次全局比例 round.ReferralRewardPct，保持默认行为
		pct := round.ReferralRewardPct
		if s.kolRepo != nil && bind.ReferrerEoa != "" {
			if kol, kerr := s.kolRepo.GetByEoa(ctx, strings.ToLower(bind.ReferrerEoa)); kerr == nil {
				pct = kol.ReferralPct
			} else if !errors.Is(kerr, repository.ErrKolNotFound) {
				// 非 NotFound 视为 DB 异常：降级用全局比例，打 warn 日志便于排查
				logger.Warnf("[PresaleDepositImpl] kol lookup failed eoa=%s err=%v - fallback to round pct",
					strings.ToLower(bind.ReferrerEoa), kerr)
			}
		}
		referralRewardPct = &pct
		// INV-7：referral_reward_odd = shares_odd × pct / 100（精确 decimal 计算）
		referralRewardOdd = sharesOdd.Mul(pct).Div(decimal.NewFromInt(100))
		// 监控埋点：容差实际吸收时打 info 日志（bound_at > blockTs 但差距 ≤ Inv6BoundAtClockSkewMs）
		// 部署后 7d 观察 diff_ms 分布，验证容差值是否合适
		// 安全：只打 diff_ms 相对量 + 已 normalize 的 tx_hash，不暴露 bound_at / block_ts 服务器墙钟绝对值
		// （否则可被反向用于服务器时钟校准 — v2 round security MAJ-2）
		if bind.BoundAt > blockTs {
			logger.Infof("[PresaleDepositImpl] inv6 tolerance absorbed tx=%s diff_ms=%d",
				strings.ToLower(req.TxHash), bind.BoundAt-blockTs)
		}
	}

	// 4. 构造 deposit 记录（source=frontend, status=pending）
	txHashLower := strings.ToLower(req.TxHash)
	eoaLower := strings.ToLower(eoa)
	vaultLower := strings.ToLower(transfer.To)

	deposit := &model.PresaleDeposit{
		TxHash:            txHashLower,
		LogIndex:          logIndex,
		BlockNumber:       blockNumber,
		BlockTimestamp:    blockTs,
		UserID:            userID,
		EoaAddress:        eoaLower,
		VaultAddress:      vaultLower,
		RoundID:           round.ID,
		AmountUsdt:        transfer.Amount,
		PriceUsd:          round.PriceUsd,
		SharesOdd:         sharesOdd,
		ReferrerUserID:    referrerUserID,
		ReferrerEoa:       referrerEoa,
		ReferralRewardPct: referralRewardPct,
		ReferralRewardOdd: referralRewardOdd,
		Status:            model.PresaleDepositStatusPending,
		Source:            model.PresaleDepositSourceFrontend,
		ExpectedRoundID:   req.ExpectedRoundID,
	}

	if req.ExpectedAmountUsdt != nil {
		if ea, err2 := decimal.NewFromString(*req.ExpectedAmountUsdt); err2 == nil {
			deposit.ExpectedAmount = &ea
		}
	}

	// 5. INSERT 幂等（uk_(tx_hash, log_index)）
	// 双轨：前端先 INSERT pending，Worker 后续 confirm；或 Worker 先 INSERT confirmed，前端查到 confirmed
	result, isNew, err := s.depositRepo.CreateOrGet(ctx, nil, deposit)
	if err != nil {
		return nil, fmt.Errorf("[PresaleDepositImpl] report-tx create deposit tx=%s: %w", txHashLower, err)
	}

	if isNew {
		// 6. round_mismatch anomaly 检测（信息流，不阻塞入账，只在新建 deposit 时检测）
		// 前端期望轮次 ≠ 实际归属轮次：边界切轮信号，落 ops_event 供运营观察
		if req.ExpectedRoundID != nil && *req.ExpectedRoundID != round.ID {
			payload, _ := json.Marshal(map[string]string{
				"expected_round_id": *req.ExpectedRoundID,
				"actual_round_id":   round.ID,
			})
			pj := string(payload)
			opsEvent := &model.PresaleOpsEvent{
				EventType:   model.AnomalyRoundMismatch,
				DepositID:   &result.ID,
				TxHash:      &txHashLower,
				EoaAddress:  &eoaLower,
				AmountUsdt:  &transfer.Amount,
				PayloadJson: &pj,
				Status:      model.OpsEventStatusPending,
			}
			if opsErr := s.opsRepo.Create(ctx, nil, opsEvent); opsErr != nil {
				// anomaly 落库失败只记日志，不阻塞主流程（信息流不影响业务）
				logger.Warnf("[PresaleDepositImpl] record round_mismatch anomaly failed tx=%s: %v",
					txHashLower, opsErr)
			}
		}
		result.Status = deposit.Status
		result.RoundID = deposit.RoundID
	}

	return &ReportTxResponse{
		DepositID: depositIDStr(result.ID),
		Status:    result.Status,
		RoundID:   result.RoundID,
	}, nil
}

// validateAndParseReceipt 链上校验 4 项 + 解析 Transfer log
// 返回：parsedTransfer, logIndex, blockNumber, blockTimestampMs, error
func (s *presaleDepositService) validateAndParseReceipt(ctx context.Context, txHash, userEoa string) (*parsedTransfer, uint, uint64, int64, error) {
	if s.bscClient == nil {
		return nil, 0, 0, 0, fmt.Errorf("[PresaleDepositImpl] bsc client not configured")
	}

	// 1. eth_getTransactionReceipt（40006：不存在或 tx 执行失败）
	receipt, err := s.bscClient.TransactionReceipt(ctx, common.HexToHash(txHash))
	if err != nil || receipt == nil {
		return nil, 0, 0, 0, ErrInvalidTx
	}
	if receipt.Status != types.ReceiptStatusSuccessful {
		return nil, 0, 0, 0, ErrInvalidTx
	}

	// 2. 从 logs 找 USDT Transfer(to ∈ vaultPool)
	//    ErrTxNotToVault(40007) 或 ErrTxNotUsdt(40008)
	transfer, err := parseUsdtTransferLog(receipt.Logs, s.cfg.VaultPool, s.cfg.UsdtAddress)
	if err != nil {
		return nil, 0, 0, 0, err
	}

	// 3. tx.from 严格匹配登录态 EOA（INV-4：禁止合约钱包代付，40902）
	// transfer.From 来自 log.topics[1]，即链上 Transfer 事件的 from 参数
	// 注意：ERC-20 Transfer event 的 from 是 msg.sender，与 tx.from 一致（非合约路由时）
	if !strings.EqualFold(transfer.From, userEoa) {
		return nil, 0, 0, 0, ErrDepositWalletMismatch
	}

	// 4. 获取 block_timestamp（从 block header，毫秒）
	blockTs, err := s.getBlockTimestamp(ctx, receipt.BlockNumber.Uint64())
	if err != nil {
		return nil, 0, 0, 0, fmt.Errorf("[PresaleDepositImpl] get block timestamp block=%d: %w",
			receipt.BlockNumber.Uint64(), err)
	}

	return transfer, transfer.LogIndex, receipt.BlockNumber.Uint64(), blockTs, nil
}

// getBlockTimestamp 按块高获取区块时间戳（毫秒）
func (s *presaleDepositService) getBlockTimestamp(ctx context.Context, blockNumber uint64) (int64, error) {
	header, err := s.bscClient.HeaderByNumber(ctx, new(big.Int).SetUint64(blockNumber))
	if err != nil {
		return 0, fmt.Errorf("[PresaleDepositImpl] header by number %d: %w", blockNumber, err)
	}
	// header.Time 是 Unix 时间戳（秒），转毫秒
	return int64(header.Time) * 1000, nil
}

// ===========================
// FindRound（边界容差逻辑，B2 §5.5）
// ===========================

// FindRound 按 block_timestamp 找归属轮次（含 ±tolerance 容差）
// 边界设计：
//   - 正常：blockTs ∈ [round.start_ts, round.end_ts] → 属于该轮次
//   - 边界切轮：blockTs ∈ (round.end_ts, round.end_ts + tolerance] → 仍属于上一轮（容差保护）
//   - 超时：blockTs > round.end_ts + tolerance → 找最近 upcoming 轮次
//   - 无 upcoming → ErrNoActiveRound，进 late_arrival anomaly
func (s *presaleDepositService) FindRound(ctx context.Context, blockTsMs int64) (*model.PresaleRound, error) {
	toleranceMs := int64(s.cfg.BoundaryToleranceMin) * 60 * 1000

	// 查 status ∈ {active, paused} 的轮次（允许 paused 状态也匹配，信息流 paused_arrival anomaly）
	rounds, err := s.roundRepo.ListActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleDepositImpl] list active rounds: %w", err)
	}

	for _, r := range rounds {
		// 标准窗口内
		if blockTsMs >= r.StartTs && blockTsMs <= r.EndTs {
			return r, nil
		}
		// 边界容差：刚过 end_ts 的 tolerance 内仍算本轮
		if blockTsMs > r.EndTs && blockTsMs <= r.EndTs+toleranceMs {
			return r, nil
		}
	}

	// 找最近 upcoming 轮次（blockTs 在所有 active 之前或空窗期时兜底）
	upcoming, err := s.roundRepo.FindUpcomingNearest(ctx)
	if err == nil && upcoming != nil {
		return upcoming, nil
	}

	return nil, ErrNoActiveRound
}

// ===========================
// GetByTxHash
// ===========================

func (s *presaleDepositService) GetByTxHash(ctx context.Context, userID uint64, txHash string) (*DepositDetail, error) {
	deposit, err := s.depositRepo.GetByTxHash(ctx, strings.ToLower(txHash), userID)
	if err != nil {
		if errors.Is(err, repository.ErrDepositNotFound) {
			return nil, ErrDepositTxNotFound
		}
		return nil, fmt.Errorf("[PresaleDepositImpl] get deposit by tx_hash %s: %w", txHash, err)
	}
	return PresaleDepositServiceFromDeposit(deposit), nil
}

// ===========================
// ListByUser
// ===========================

func (s *presaleDepositService) ListByUser(ctx context.Context, userID uint64, status string, page, size int) (*DepositListResponse, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 || size > 100 {
		size = 20
	}

	deposits, total, err := s.depositRepo.ListByUser(ctx, userID, status, page, size)
	if err != nil {
		return nil, fmt.Errorf("[PresaleDepositImpl] list deposits for user %d: %w", userID, err)
	}

	list := make([]DepositListItem, 0, len(deposits))
	for _, d := range deposits {
		list = append(list, *PresaleDepositServiceFromDeposit(d))
	}

	return &DepositListResponse{
		List:  list,
		Total: total,
		Page:  page,
		Size:  size,
	}, nil
}

// ===========================
// GetPosition（持仓聚合，B2 §9）
// ===========================

// GetPosition 从 presale_holding 表聚合用户预售持仓
// 计算规则：
//   - source=invest 行：参与 lockedPriceAvg 加权 Σ(total×avg)/Σ(total)，计入 investOdd/investedUsd
//   - source=referral 行：只计入 referralOdd，不参与 avg 计算（无成本价语义）
func (s *presaleDepositService) GetPosition(ctx context.Context, userID uint64) (*PositionResponse, error) {
	holdings, err := s.holdingRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("[PresaleDepositImpl] list holdings for user %d: %w", userID, err)
	}

	var totalOdd, investOdd, referralOdd decimal.Decimal
	var investedUsd decimal.Decimal
	var weightedSum decimal.Decimal // Σ(total_odd × locked_price_avg)，分母为 investOdd

	type perRoundAccum struct {
		investOdd      decimal.Decimal
		investedUsd    decimal.Decimal
		lockedPriceAvg decimal.Decimal
		referralOdd    decimal.Decimal
	}
	perRoundMap := make(map[string]*perRoundAccum)

	for _, h := range holdings {
		if _, ok := perRoundMap[h.RoundID]; !ok {
			perRoundMap[h.RoundID] = &perRoundAccum{}
		}
		acc := perRoundMap[h.RoundID]
		totalOdd = totalOdd.Add(h.TotalOdd)

		if h.Source == model.HoldingSourceInvest {
			investOdd = investOdd.Add(h.TotalOdd)
			investedUsd = investedUsd.Add(h.InvestedUsd)
			weightedSum = weightedSum.Add(h.TotalOdd.Mul(h.LockedPriceAvg))
			acc.investOdd = acc.investOdd.Add(h.TotalOdd)
			acc.investedUsd = acc.investedUsd.Add(h.InvestedUsd)
			acc.lockedPriceAvg = h.LockedPriceAvg // 单轮 invest 行只有一条，直接取
		} else { // source=referral
			referralOdd = referralOdd.Add(h.TotalOdd)
			acc.referralOdd = acc.referralOdd.Add(h.TotalOdd)
		}
	}

	// 跨轮次加权平均成本价：Σ(round_total × round_avg) / Σ(round_total)
	var lockedPriceAvg decimal.Decimal
	if investOdd.IsPositive() {
		lockedPriceAvg = weightedSum.Div(investOdd)
	}

	// 构造 perRound 响应（按 round_id 字典序排列）
	roundIDs := make([]string, 0, len(perRoundMap))
	for k := range perRoundMap {
		roundIDs = append(roundIDs, k)
	}
	sort.Strings(roundIDs)

	perRound := make([]PerRoundItem, 0, len(roundIDs))
	for _, rid := range roundIDs {
		acc := perRoundMap[rid]
		perRound = append(perRound, PerRoundItem{
			RoundID:        rid,
			TotalOdd:       acc.investOdd.Add(acc.referralOdd).String(),
			InvestedUsd:    acc.investedUsd.String(),
			LockedPriceAvg: acc.lockedPriceAvg.String(),
			ReferralOdd:    acc.referralOdd.String(),
		})
	}

	return &PositionResponse{
		Holdings:         totalOdd.String(),
		HoldingsBySource: map[string]string{"invest": investOdd.String(), "referral": referralOdd.String()},
		InvestedUsd:      investedUsd.String(),
		LockedPriceAvg:   lockedPriceAvg.String(),
		PerRound:         perRound,
	}, nil
}

// ===========================
// ConfirmDeposit（双轨会师核心事务，B2 §6.2）
// ===========================

// ConfirmDeposit 在事务内完成 deposit 确认 + holding 更新：
//  1. 按 ID 取 deposit（确认存在且状态为 pending）
//  2. UPDATE pending → confirmed
//  3. IncrSoldAndRaised（乐观超额检测 INV-1）
//     → ErrCapacityExceeded：MarkAnomaly overflow + 落 ops_event，不 upsert holding
//  4. UpsertInvest holding（source=invest）
//  5. UpsertReferral holding（source=referral，如有邀请人）
//  6. DEL Redis "presale:config:v1" 缓存（sold/raised 已变更）
//
// 幂等：已 confirmed 的 deposit 直接返回 nil（重复扫块保护）
// 事务边界说明：
//   - Worker 路径：tx 由监听器 scanVault 提供（与游标在同一外部事务）
//   - 测试路径：tx 为 nil 时内部新开事务
func (s *presaleDepositService) ConfirmDeposit(ctx context.Context, tx *gorm.DB, depositID uint64, confirmedAt int64) error {
	// 取操作 DB（优先使用外部事务，无外部事务则使用主 DB）
	activeDB := tx
	if activeDB == nil {
		activeDB = s.db
	}

	// 1. 取 deposit（按 ID 查，在事务内）
	var dep model.PresaleDeposit
	if err := activeDB.WithContext(ctx).Where("id = ?", depositID).First(&dep).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("[PresaleDepositImpl] confirm deposit id=%d: not found", depositID)
		}
		return fmt.Errorf("[PresaleDepositImpl] confirm deposit id=%d query: %w", depositID, err)
	}

	// 幂等保护：已 confirmed 直接返回（重复扫块或双轨并发保护）
	if dep.Status == model.PresaleDepositStatusConfirmed {
		return nil
	}

	// 取轮次配置（需要 price 快照 + referral_reward_pct）
	round, err := s.roundRepo.GetByID(ctx, dep.RoundID)
	if err != nil {
		return fmt.Errorf("[PresaleDepositImpl] get round %s for deposit %d: %w", dep.RoundID, depositID, err)
	}

	// 大事务：confirm + holding upsert + 游标（游标由监听器层管理）
	doConfirm := func(txInner *gorm.DB) error {
		// 2. UPDATE pending → confirmed（幂等：WHERE status=pending，已 confirmed 的 RowsAffected=0 不报错）
		if err := s.depositRepo.ConfirmDeposit(ctx, txInner, depositID, confirmedAt); err != nil {
			return fmt.Errorf("[PresaleDepositImpl] confirm deposit update id=%d: %w", depositID, err)
		}

		// 3. IncrSoldAndRaised：乐观条件 sold_odd + delta ≤ supply_odd（INV-1 保护）
		if err := s.roundRepo.IncrSoldAndRaised(ctx, txInner, dep.RoundID, dep.SharesOdd, dep.AmountUsdt); err != nil {
			if errors.Is(err, repository.ErrCapacityExceeded) {
				// overflow anomaly：到账超容量，deposit 标 anomaly，不 upsert holding
				if markErr := s.depositRepo.MarkAnomaly(ctx, txInner, depositID, model.AnomalyOverflow); markErr != nil {
					return fmt.Errorf("[PresaleDepositImpl] mark overflow anomaly deposit=%d: %w", depositID, markErr)
				}
				payload := fmt.Sprintf(`{"round_id":%q,"shares_odd":%q,"supply_odd":%q}`,
					dep.RoundID, dep.SharesOdd.String(), round.SupplyOdd.String())
				depID := depositID
				txh := dep.TxHash
				eoa := dep.EoaAddress
				amt := dep.AmountUsdt
				opsEvent := &model.PresaleOpsEvent{
					EventType:   model.AnomalyOverflow,
					DepositID:   &depID,
					TxHash:      &txh,
					EoaAddress:  &eoa,
					AmountUsdt:  &amt,
					PayloadJson: &payload,
					Status:      model.OpsEventStatusPending,
				}
				if opsErr := s.opsRepo.Create(ctx, txInner, opsEvent); opsErr != nil {
					logger.Warnf("[PresaleDepositImpl] record overflow ops_event failed deposit=%d: %v",
						depositID, opsErr)
				}
				// overflow 不继续 upsert holding（超容量意味着 round 已满）
				return nil
			}
			return fmt.Errorf("[PresaleDepositImpl] incr sold_and_raised round=%s deposit=%d: %w",
				dep.RoundID, depositID, err)
		}

		// 4. UpsertInvest holding（source=invest）
		if err := s.holdingRepo.UpsertInvest(ctx, txInner,
			dep.UserID, dep.RoundID, dep.SharesOdd, dep.AmountUsdt, round.PriceUsd); err != nil {
			return fmt.Errorf("[PresaleDepositImpl] upsert invest holding user=%d deposit=%d: %w",
				dep.UserID, depositID, err)
		}

		// 5. UpsertReferral holding（INV-6/INV-7：只在 referrer 存在且奖励 > 0 时写）
		if dep.ReferrerUserID != nil && dep.ReferralRewardOdd.IsPositive() {
			if err := s.holdingRepo.UpsertReferral(ctx, txInner,
				*dep.ReferrerUserID, dep.RoundID, dep.ReferralRewardOdd); err != nil {
				return fmt.Errorf("[PresaleDepositImpl] upsert referral holding referrer=%d deposit=%d: %w",
					*dep.ReferrerUserID, depositID, err)
			}
		}

		// 6. DEL Redis config 缓存（sold/raised 已更新，下次请求自然刷新 config 接口数据）
		if s.rdb != nil {
			if delErr := s.rdb.Del(ctx, "presale:config:v1"); delErr != nil {
				// 缓存删除失败不阻塞主流程（缓存是优化非依赖）
				logger.Warnf("[PresaleDepositImpl] del config cache failed deposit=%d: %v", depositID, delErr)
			}
		}

		// 7. 异步推送 Lark 认购成功通知（有主入账，正向事件）。
		//    仅 happy path 触达 — overflow 在 step 3 ErrCapacityExceeded 分支已 return nil
		//    提前返回，不会落到此处（误推 deposit_confirmed 给被异常拒收的入账）。
		//    若未来在 step 3-6 之间插入新逻辑，须保持「异常路径必须 return nil 而不是 fallthrough」。
		//
		//    SendAnomalyAlert 内部 goroutine + recover panic，不阻塞事务；
		//    与 recordAnomaly 的告警路径同源，race 风险一致（外部 tx rollback 仍可能误推），
		//    但 MVP 目标是运营掌握成交情况，可接受。
		//
		//    ISSUE-005：推送逻辑抽到 NotifyDepositConfirmed，与 worker 路径共用。
		//    Worker 路径（presale_listener.processLog）走"事务外补发"，无 race 风险。
		s.NotifyDepositConfirmed(&dep)

		return nil
	}

	// 如果调用方已提供外部事务，直接在其中执行（Worker 路径，游标和 confirm 同一事务）
	if tx != nil {
		return doConfirm(tx)
	}
	// 无外部事务时自己开事务（前端路径 / 测试路径）
	return s.db.Transaction(doConfirm)
}

// ===========================
// NotifyDepositConfirmed（ISSUE-005）
// ===========================

// NotifyDepositConfirmed 异步推送 deposit_confirmed Lark 卡片。
//
// 调用者保证 dep 已落库（事务已 commit），本方法只读 dep 字段并调用
// larkAlerter.SendAnomalyAlert，后者内部 goroutine + recover panic，不阻塞。
//
// Worker（presale-worker）路径在 processLog 大事务提交后调用此方法，
// 避免 rollback race；service.ConfirmDeposit 内部 step 7 也调用此方法，
// 保证单一发推点（DRY）。
//
// 字段安全：dep.AmountUsdt / dep.SharesOdd 是 decimal.Decimal 值类型，
// 零值 .String() 返回 "0"，nil 安全；若日后改成 *decimal.Decimal 指针类型
// 需在此处补 nil 判空。
func (s *presaleDepositService) NotifyDepositConfirmed(dep *model.PresaleDeposit) {
	if dep == nil {
		// 防御性：调用方逻辑漏洞时静默 noop，不 panic
		return
	}
	referrer := ""
	if dep.ReferrerUserID != nil {
		referrer = fmt.Sprintf("uid=%d", *dep.ReferrerUserID)
	}
	referrerEoa := ""
	if dep.ReferrerEoa != nil {
		referrerEoa = *dep.ReferrerEoa
	}
	s.larkAlerter.SendAnomalyAlert(LarkEvent{
		EventType:   "deposit_confirmed",
		TxHash:      dep.TxHash,
		EOA:         dep.EoaAddress,
		AmountUsdt:  dep.AmountUsdt.String(),
		RoundID:     dep.RoundID,
		SharesOdd:   dep.SharesOdd.String(),
		Referrer:    referrer,
		ReferrerEoa: referrerEoa,
	})
}

// ===========================
// recordAnomaly helper
// ===========================

// recordAnomaly 落 presale_ops_event + 异步 warn 日志
// 同步：DB 落 ops_event 保证不丢失
// 异步：warn 日志（B4 替换为 Lark webhook）
// 调用方可选择是否在事务内（txOrNil=nil 时自动用 r.db）
func (s *presaleDepositService) recordAnomaly(
	ctx context.Context,
	depositID *uint64,
	txHash, eoa string,
	amountUsdt decimal.Decimal,
	eventType, payloadJSON string,
) error {
	txHashCopy := strings.ToLower(txHash)
	eoaCopy := strings.ToLower(eoa)
	amtCopy := amountUsdt

	event := &model.PresaleOpsEvent{
		EventType:  eventType,
		DepositID:  depositID,
		TxHash:     &txHashCopy,
		EoaAddress: &eoaCopy,
		AmountUsdt: &amtCopy,
		Status:     model.OpsEventStatusPending,
	}
	if payloadJSON != "" {
		pj := payloadJSON
		event.PayloadJson = &pj
	}

	if err := s.opsRepo.Create(ctx, nil, event); err != nil {
		return fmt.Errorf("[PresaleDepositImpl] record anomaly event_type=%s tx=%s: %w",
			eventType, txHash, err)
	}

	// 同步 warn 日志（zerolog 内部已 buffer，无 IO 阻塞风险）
	logger.Warnf("[PresaleDepositImpl] anomaly event_type=%s tx=%s eoa=%s amount=%s",
		eventType, txHash, eoa, amountUsdt.String())

	// 异步推送 Lark 告警（goroutine 由 LarkAlerter 实现内部管理，不阻塞事务）
	// nil 安全：noopLarkAlerter 实现为空操作，不会 panic
	s.larkAlerter.SendAnomalyAlert(LarkEvent{
		EventType:  eventType,
		TxHash:     txHashCopy,
		EOA:        eoaCopy,
		AmountUsdt: amtCopy.String(),
		Reason:     eventType,
	})

	return nil
}

// ===========================
// 编译时接口断言
// ===========================

var _ PresaleDepositService = (*presaleDepositService)(nil)
