package evm

import (
	"chain-consumer/global"
	"chain-consumer/internal"
	"chain-consumer/internal/kafka"
	"chain-consumer/internal/mysql"
	redispkg "chain-consumer/internal/redis"
	"chain-consumer/internal/tracelog"
	"chain-consumer/service"
	"chain-consumer/service/evm/contract"
	"chain-consumer/utils"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"
	"golang.org/x/sync/errgroup"

	"github.com/IBM/sarama"
	"github.com/golang/snappy"
	"github.com/redis/go-redis/v9"
	"github.com/samber/lo"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	bscCheckToken1Decimal = 18
)

type EVMService struct {
	ctx             context.Context
	consumer        *kafka.KafkaConsumer
	Chain           internal.Chain
	isDebugTrace    bool
	erc20parser     *contract.ERC20Filterer
	betPlacedparser *contract.BettingPoolFilterer
	db              *gorm.DB
	redis           *redis.Client
	checkToken      string // 充值过滤的目标 token 地址(小写)，来自 config oddfi.odd_token

	// OddFi 链上行为/管理员审计索引
	chainID         int64                            // 链ID（配置注入，BSC 测试网97/主网56）
	oddfiAddrs      map[string]contract.ContractKind // 合约地址(小写) -> 合约类型，白名单路由
	bettingParser   *contract.BettingPoolFilterer    // = betPlacedparser，OddFi 事件解析复用
	stakingParser   *contract.StakingPoolFilterer
	liquidityParser *contract.LiquidityPoolFilterer
	oddTokenParser  *contract.ODDTokenFilterer

	// 余额加减相关
	bettingPoolAddr string              // betting_pool 地址(小写)，用于识别下注转账(C)
	poolAddrs       map[string]struct{} // betting/staking/liquidity 三个 Pool 地址(小写)，派彩转入排除出充值
	betTaxBps       uint16              // 下注税率兜底(D)
}

func NewEVMService(ctx context.Context, consumerGroup string, chainCrawlerCfg global.ChainCrawlerConfig, cfg global.ChainConfig, chain internal.Chain, redisClient *redis.Client) (service.Service, error) {
	s := &EVMService{}
	s.ctx = ctx

	// 检查 MySQL 是否初始化
	if !mysql.IsEmpty() {
		s.db = mysql.GetDB()
	} else {
		return nil, fmt.Errorf("mysql is not initialized")
	}

	consumer, err := kafka.NewKafkaConsumer(consumerGroup, cfg.Kafka, s.HandleMessage)
	if err != nil {
		return nil, err
	}

	erc20parser, err := contract.NewERC20Filterer(eth_common.HexToAddress(""), nil)
	if err != nil {
		panic(fmt.Errorf("failed to new erc20 parser, error: %v", err))
	}

	bpp, err := contract.NewBettingPoolFilterer(eth_common.HexToAddress(""), nil)
	if err != nil {
		panic(fmt.Errorf("failed to new erc20 parser, error: %v", err))
	}

	spp, err := contract.NewStakingPoolFilterer(eth_common.HexToAddress(""), nil)
	if err != nil {
		panic(fmt.Errorf("failed to new staking pool parser, error: %v", err))
	}

	lpp, err := contract.NewLiquidityPoolFilterer(eth_common.HexToAddress(""), nil)
	if err != nil {
		panic(fmt.Errorf("failed to new liquidity pool parser, error: %v", err))
	}

	otp, err := contract.NewODDTokenFilterer(eth_common.HexToAddress(""), nil)
	if err != nil {
		panic(fmt.Errorf("failed to new odd token parser, error: %v", err))
	}

	s.consumer = consumer
	s.Chain = chain
	s.isDebugTrace = cfg.IsDebugTrace
	s.erc20parser = erc20parser
	s.betPlacedparser = bpp
	s.redis = redisClient

	// 充值过滤目标 token：复用 OddFi 的 odd_token 地址（统一小写）
	s.checkToken = strings.ToLower(strings.TrimSpace(cfg.OddFi.ODDToken))

	// OddFi 索引：注入 chain_id 与合约地址白名单
	s.chainID = cfg.OddFi.ChainID
	s.bettingParser = bpp
	s.stakingParser = spp
	s.liquidityParser = lpp
	s.oddTokenParser = otp
	s.oddfiAddrs = buildOddFiAddrMap(cfg.OddFi)

	// 余额加减：betting_pool 地址(下注转账识别)、三个 Pool 地址集合(派彩转入排除)、税率兜底
	s.bettingPoolAddr = strings.ToLower(strings.TrimSpace(cfg.OddFi.BettingPool))
	s.poolAddrs = make(map[string]struct{}, 3)
	for _, a := range []string{cfg.OddFi.BettingPool, cfg.OddFi.StakingPool, cfg.OddFi.LiquidityPool} {
		if a = strings.ToLower(strings.TrimSpace(a)); a != "" {
			s.poolAddrs[a] = struct{}{}
		}
	}
	s.betTaxBps = cfg.OddFi.BetTaxBps

	return s, nil
}

// buildOddFiAddrMap 把配置里的 4 个合约地址（统一小写）映射到 ContractKind，用于按 log.Address 路由。
// 空地址不入表，方便未配置时自动跳过对应合约。
func buildOddFiAddrMap(cfg global.OddFiConfig) map[string]contract.ContractKind {
	m := make(map[string]contract.ContractKind, 4)
	add := func(addr string, kind contract.ContractKind) {
		addr = strings.ToLower(strings.TrimSpace(addr))
		if addr == "" {
			return
		}
		m[addr] = kind
	}
	add(cfg.BettingPool, contract.ContractBettingPool)
	add(cfg.StakingPool, contract.ContractStakingPool)
	add(cfg.LiquidityPool, contract.ContractLiquidityPool)
	add(cfg.ODDToken, contract.ContractODDToken)
	return m
}

func (s *EVMService) Start() {
	s.consumer.Start(s.ctx)
}

func (s *EVMService) Stop() {
	s.consumer.Stop(s.ctx)
}

func (s *EVMService) HandleMessage(ctx context.Context, m *sarama.ConsumerMessage) error {
	handleMessageSpanCtx, handleMessageSpan := tracelog.StartSpan(tracelog.TransferCtxTrace(ctx, m), "kafka", "EVM-HandleMessage")
	defer handleMessageSpan.End()
	tl := tracelog.NewWithContext(handleMessageSpanCtx)
	var eg errgroup.Group

	tl.Infof("处理消息, chain:%s, key:%s", s.Chain, string(m.Key))

	decoded, err := snappy.Decode(nil, m.Value)
	if err != nil {
		tl.Infow("Failed to decode snappy message", "error", err)
		return fmt.Errorf("failed to decode snappy message: %w", err)
	}

	var message Message
	if err := json.Unmarshal(decoded, &message); err != nil {
		tl.Infow("Failed to unmarshal message", "error", err)
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	var evmResult EvmResult
	if err := json.Unmarshal(message.Data, &evmResult); err != nil {
		tl.Infow("Failed to unmarshal evm result", "error", err)
		return fmt.Errorf("failed to unmarshal evm result: %w", err)
	}
	blockNumber := evmResult.BlockNumber
	// 区块时间整块共用；取不到则回退当前时间
	blockTime := parseBlockTime(evmResult.Block)
	evmtxInfos := make([]*evmtxInfo, 0)
	betPlacedInfos := make([]*betPlacedInfo, 0)
	var oddBatch *oddfiBatch
	// 过滤出block里需要入库的tx信息
	// bsc
	if strings.EqualFold(s.Chain.String(), internal.ChainBsc.String()) {
		tl.Infof("checkBscReceipts chain:%s blockNumber:%s,  evmResult.Receipts:%d",
			s.Chain.String(), blockNumber, len(evmResult.Receipts))
		evmtxInfos, betPlacedInfos, oddBatch, err = s.checkBscReceipts(ctx, evmResult.Receipts, blockTime)
		if err != nil {
			tl.Errorf("failed to check bsc receipts: %v", err)
			return fmt.Errorf("failed to check bsc receipts: %w", err)
		}
	}

	// 下注扣款金额来源(C)：同 tx 内 magic 钱包→betting_pool 的 ODD Transfer 总额 = 含税总额。
	// 必须在并发 fan-out 之前用原始 Value 构建，避免与 handleEvmTxInfos 的 formatTxValue 改写竞争。
	betDebits := s.buildBetDebits(evmtxInfos)

	// 处理入库信息
	eg.Go(func() error {
		if len(evmtxInfos) > 0 {
			// for i, info := range evmtxInfos {
			// 	tl.Infof("handle evm tx infos, chain:%s, count:%d, index:%d, info:%+v",
			// 		s.Chain.String(), len(evmtxInfos), i, info)
			// }

			err := s.handleEvmTxInfos(ctx, evmtxInfos)
			if err != nil {
				tl.Errorf("failed to handle evm tx infos: %v", err)
				return fmt.Errorf("failed to handle evm tx infos: %w", err)
			}
		}

		return nil
	})

	eg.Go(func() error {
		if len(betPlacedInfos) > 0 {
			err := s.handleEvmBetPlaced(ctx, betPlacedInfos)
			if err != nil {
				tl.Errorf("failed to handle evm bet placed: %v", err)
				return fmt.Errorf("failed to handle evm bet placed: %w", err)
			}
		}
		return nil
	})

	// OddFi 管理员审计入库（与用户行为并行）
	eg.Go(func() error {
		if oddBatch != nil && len(oddBatch.adminRows) > 0 {
			if err := s.handleAdminActions(ctx, oddBatch.adminRows); err != nil {
				return fmt.Errorf("failed to handle admin actions: %w", err)
			}
		}
		return nil
	})

	// OddFi 用户行为入库（含映射表写入→match_id 回填，顺序在分支内保证）
	eg.Go(func() error {
		if oddBatch != nil && !oddBatch.empty() {
			if err := s.handleUserActions(ctx, oddBatch, betDebits); err != nil {
				return fmt.Errorf("failed to handle user actions: %w", err)
			}
		}
		return nil
	})

	// OddFi 盘口结算：MarketSettlementFinalized → INSERT onchain_tx_orders 结算行（与上面并行）
	eg.Go(func() error {
		if oddBatch != nil && len(oddBatch.settlementOrders) > 0 {
			if err := s.handleMarketSettlements(ctx, oddBatch.settlementOrders); err != nil {
				return fmt.Errorf("failed to handle market settlements: %w", err)
			}
		}
		return nil
	})

	// OddFi 提前兑现：BetCashedOut → UPDATE 原 place_bet 行结算态为 CASHED_OUT（与上面并行）
	eg.Go(func() error {
		if oddBatch != nil && len(oddBatch.cashOuts) > 0 {
			if err := s.handleCashOutSettlements(ctx, oddBatch.cashOuts); err != nil {
				return fmt.Errorf("failed to handle cash-out settlements: %w", err)
			}
		}
		return nil
	})

	if err := eg.Wait(); err != nil {
		tl.Errorf("failed to handle message: %v", err)
		return err
	}

	tl.Infof("success handle evm msg, block_number:%d, chain:%s",
		blockNumber,
		s.GetChainName(),
	)

	return nil
}

// 解析 receipts，返回需要提取的交易信息
func (s *EVMService) checkBscReceipts(ctx context.Context, data []EvmReceipts, blockTime time.Time) ([]*evmtxInfo, []*betPlacedInfo, *oddfiBatch, error) {
	ctx, span := tracelog.StartSpan(ctx, "kafka", "EVM-HandleMessage")
	defer span.End()
	tl := tracelog.NewWithContext(ctx)
	res := make([]*evmtxInfo, 0)
	resBp := make([]*betPlacedInfo, 0)
	oddBatch := &oddfiBatch{}

	for _, receiptsData := range data {
		if len(receiptsData.Logs) == 0 {
			continue
		}

		for _, l := range receiptsData.Logs {
			_l := lo.FromPtr(l)

			// OddFi 合约日志：解析管理员审计/用户行为/映射事件（按 log.Address 白名单路由）
			s.collectOddFiLog(_l, receiptsData.From, blockTime, oddBatch)

			// 检查 send token 交易
			transfer, err := s.erc20parser.ParseTransfer(_l)
			// if err == nil && transfer != nil {
			// 	tl.Infof(" token from :%s, to:%s, token:%s", transfer.From.String(), transfer.To.String(), _l.Address.String())
			// }
			if err == nil &&
				transfer != nil &&
				s.checkToken != "" &&
				!contract.IsNullAddresses(transfer.To.String()) &&
				strings.EqualFold(_l.Address.String(), s.checkToken) {

				tl.Infof("find target token transfer, from:%s, to:%s, value:%s, hash:%s",
					transfer.From.String(), transfer.To.String(), transfer.Value.String(), l.TxHash.String(),
				)

				res = append(res, &evmtxInfo{
					Token:       s.checkToken,
					From:        transfer.From.String(),
					to:          transfer.To.String(),
					Value:       decimal.NewFromBigInt(transfer.Value, 0),
					BlockNumber: l.BlockNumber,
					TxId:        l.TxHash.Hex(),
					LogIndex:    l.Index,
				})
			}

			bp, err := s.betPlacedparser.ParseBetPlaced(_l)
			if err == nil && bp != nil {
				// 过滤阶段一旦识别出 BetPlaced 就打印命中（tx/betId/合约地址），
				// 便于排查“到底有没有监听到这笔下注事件”，与后续 handleEvmBetPlaced 的写入日志串成全链路。
				tl.Infof("found BetPlaced, chain:%s, tx:%s, betId:%s, addr:%s",
					s.Chain.String(), strings.ToLower(l.TxHash.Hex()), eth_common.Hash(bp.BetId).Hex(), _l.Address.Hex())
				resBp = append(resBp, &betPlacedInfo{
					Txid:  strings.ToLower(l.TxHash.Hex()),
					BetId: bp.BetId,
				})
			}

			// TODO: 1. 记录 创建v2 pair 交易的信息，存在pool库里
			// TODO: 2. 检查uniswap_v2 交易，过滤出to 地址，判断 l.Address 地址是否是pair地址，是的话加进evmtxInfo
		}
	}

	return res, resBp, oddBatch, nil
}

func (s *EVMService) GetChainName() string {
	return string(s.Chain)
}

// 用 common.HexToHash(s)读回
func (s *EVMService) handleEvmBetPlaced(ctx context.Context, betPlacedInfos []*betPlacedInfo) error {
	tl := tracelog.NewWithContext(ctx)
	tl.Infof("handle evm total bet palced, chain:%s, count:%d", s.Chain.String(), len(betPlacedInfos))

	for _, item := range betPlacedInfos {
		betID := eth_common.Hash(item.BetId).Hex()
		tl.Infof("handle evm bet palced, chain:%s, tx:%s, betId:%s", s.Chain.String(), item.Txid, betID)

		rows, err := mysql.UpdateOnchainBetIDByTxHash(ctx, item.Txid, betID)
		if err != nil {
			tl.Errorf("failed to update onchain_bet_id, tx_hash:%s, bet_id:%s, err:%v", item.Txid, betID, err)
			continue
		}
		if rows == 0 {
			tl.Infof("no onchain_tx_orders matched, tx_hash:%s, bet_id:%s", item.Txid, betID)
			continue
		}
		tl.Infof("updated onchain_bet_id, tx_hash:%s, bet_id:%s, rows:%d", item.Txid, betID, rows)
	}
	return nil
}

// 写入deposit_records，带txid，因为是延迟推送流
// 写入asset_ledger，标记充值事件
// 写入user_balances，更新用户余额
func (s *EVMService) handleEvmTxInfos(ctx context.Context, evmtxInfos []*evmtxInfo) error {
	var (
		ctxn, span        = tracelog.StartSpan(ctx, "kafka", "EVM-HandleMessage")
		allAddresses      = make([]string, 0, len(evmtxInfos)*2)
		isDepositAddress  = make([]string, 0)
		depositAddress2Id = make(map[string]uint64, 0)
		depositTx         = make([]*evmtxInfo, 0, len(evmtxInfos))
		collectTransferTx = make([]*evmtxInfo, 0, len(evmtxInfos))
		eg1               = errgroup.Group{}
		eg2               = errgroup.Group{}
	)

	defer span.End()
	tl := tracelog.NewWithContext(ctxn)
	tl.Infof("handle evm tx infos, chain:%s, count:%d", s.Chain.String(), len(evmtxInfos))

	//1 取出所有涉及到交易的to地址
	toAddresses := lo.Map(evmtxInfos, func(item *evmtxInfo, _ int) string {
		return strings.ToLower(item.to)
	})

	//2 取出所有涉及到的from地址
	fromAddresses := lo.Map(evmtxInfos, func(item *evmtxInfo, _ int) string {
		return strings.ToLower(item.From)
	})

	allAddresses = append(allAddresses, toAddresses...)
	allAddresses = append(allAddresses, fromAddresses...)

	// 3 涉及到的地址通过redis的Set查询是否存在
	isDepositAddress, err := redispkg.FilterExistingInSet(ctxn, utils.GetRedisDepositAddressesKey(s.Chain.String()), allAddresses...)
	if err != nil {
		tl.Errorf("failed to check deposit addresses: %v", err)
		return fmt.Errorf("failed to check deposit addresses: %w", err)
	}

	if len(isDepositAddress) > 0 {
		isDepositAddress = lo.Uniq(isDepositAddress)
	}

	for i, item := range isDepositAddress {
		tl.Infof("deposit address found, chain:%s, index:%d, address:%s", s.Chain.String(), i, item)
	}

	// 无 充值地址直接退出
	if len(isDepositAddress) == 0 {
		return nil
	}

	// 有 充值地址继续入库处理
	eg1.Go(func() error {
		for _, evmtxInfo := range evmtxInfos {
			// 充值
			info := evmtxInfo
			if lo.Contains(isDepositAddress, strings.ToLower(evmtxInfo.to)) {
				// 排除 from=OddFi Pool 合约 的转入：那是领奖/赎回派彩(by 语义事件加余额)，不是充值，
				// 否则同一笔钱会被当充值再加一次(双计)。
				if _, fromPool := s.poolAddrs[strings.ToLower(evmtxInfo.From)]; fromPool {
					tl.Infof("skip pool payout as deposit, chain:%s, tx:%s, from:%s, to:%s", s.Chain.String(), evmtxInfo.TxId, evmtxInfo.From, evmtxInfo.to)
				} else {
					tl.Infof("deposit address found, chain:%s, address:%s", s.Chain.String(), evmtxInfo.to)
					depositTx = append(depositTx, s.formatTxValue(info))
				}
			}

			// 归集转移
			if lo.Contains(isDepositAddress, strings.ToLower(evmtxInfo.From)) {
				// tl.Infof("collect transfer address found, chain:%s, address:%s", s.Chain.String(), evmtxInfo.From)
				collectTransferTx = append(collectTransferTx, s.formatTxValue(info))
			}
		}
		return nil
	})

	// 查充值地址对对应user_id
	eg1.Go(func() error {
		users, err := mysql.GetUserIdByDepositAddresses(ctxn, isDepositAddress)
		if err != nil {
			tl.Errorf("failed to get user id by deposit addresses: %v", err)
			return fmt.Errorf("failed to get user id by deposit addresses: %w", err)
		}
		for _, user := range users {
			if user.UserID == 0 {
				tl.Errorf("find user id is 0, address:%s, chain:%s", user.Address, user.Chain)
				continue
			}

			depositAddress2Id[user.Address] = user.UserID
		}
		return nil
	})

	if err := eg1.Wait(); err != nil {
		tl.Errorf("failed to handle eg1, err: %v", err)
		return fmt.Errorf("failed to handle eg1, err: %w", err)
	}

	// 处理充值入库
	eg2.Go(func() error {
		if len(depositTx) > 0 {
			return s.handleDeposit(ctxn, depositAddress2Id, depositTx)
		}
		return nil
	})

	// 处理划转入库
	eg2.Go(func() error {
		if len(collectTransferTx) > 0 {
			return s.handleCollectTransfer(ctxn, depositAddress2Id, collectTransferTx)
		}
		return nil
	})

	if err := eg2.Wait(); err != nil {
		tl.Errorf("failed to handle eg2, err: %v", err)
		return fmt.Errorf("failed to handle eg2, err: %w", err)
	}

	return nil
}

// 交易去精度
func (s *EVMService) formatTxValue(tx *evmtxInfo) *evmtxInfo {
	tx.Value = tx.Value.Shift(-bscCheckToken1Decimal)
	return tx
}

// handleDeposit 处理充值
// deposit_record 更新 充值信息
// asset_ledger/user_balance 更新资产变动信息和用户余额，在一个事务里更新
func (s *EVMService) handleDeposit(ctx context.Context, addr2Id map[string]uint64, txs []*evmtxInfo) error {
	tl := tracelog.NewWithContext(ctx)
	tl.Infof("handle deposit, chain:%s, count:%d, addr2Id:%+v, txs:%v, amount:%v", s.Chain.String(), len(txs), addr2Id, lo.Map(txs, func(item *evmtxInfo, _ int) string {
		return item.TxId
	}), lo.Map(txs, func(item *evmtxInfo, _ int) decimal.Decimal {
		return item.Value
	}))

	for _, item := range txs {
		userID := addr2Id[item.to]
		if userID == 0 {
			tl.Errorf("user id is 0, address:%s, chain:%s", item.to, s.Chain.String())
			continue
		}

		// 1. 更新充值记录表。命中唯一键(tx_id)返回 affected=0，说明该笔已处理过 → 跳过加钱(幂等，
		//    防止 Kafka 重投/重扫导致重复加余额)。
		affected, err := mysql.CreateDepositRecord(ctx, s.GetChainName(), item.TxId, item.LogIndex, userID, item.Value, item.From, item.to, item.BlockNumber, 2, 20)
		if err != nil {
			tl.Errorf("failed to update deposit record, tx:%v, err:%v", *item, err)
			continue
		}
		if affected == 0 {
			tl.Infof("deposit already processed, skip credit, chain:%s, tx:%s, userID:%d", s.Chain.String(), item.TxId, userID)
			continue
		}

		// 2. 在事务中处理资产变动（充值即 available 加钱）
		err = s.updateBalanceInTx(ctx, userID, item.Value, item.TxId)
		if err != nil {
			tl.Errorf("failed to update balance in transaction, tx:%v, err:%v", *item, err)
			continue
		}
	}
	return nil
}

// balanceDelta 一次余额变动对各桶的增减(已是人类单位、带正负)。available 为正=加可用，负=减可用。
type balanceDelta struct {
	available decimal.Decimal // 可用余额变动
	stakeLock decimal.Decimal // 质押锁定变动
	liqLock   decimal.Decimal // 流动性锁定变动
}

func (d balanceDelta) isZero() bool {
	return d.available.IsZero() && d.stakeLock.IsZero() && d.liqLock.IsZero()
}

// betDebit 同一(tx, from)下注转出的聚合：amount=magic→betting_pool 的 ODD 原始 wei 总额，count=笔数。
type betDebit struct {
	amount decimal.Decimal
	count  int
}

// errBalanceRowMissing 用户无 user_balance 行(异常数据)。此时保留审计行、跳过余额，不回滚不重试。
var errBalanceRowMissing = errors.New("user balance row missing")

// buildBetDebits 汇总本区块内 magic 钱包→betting_pool 的 ODD Transfer，按 (txHash|from) 聚合金额与笔数。
// 供 BET_PLACED 取含税总额(C)。必须在 formatTxValue 改写 Value 之前调用(用原始 wei)。
func (s *EVMService) buildBetDebits(txs []*evmtxInfo) map[string]*betDebit {
	m := make(map[string]*betDebit)
	if s.bettingPoolAddr == "" {
		return m
	}
	for _, t := range txs {
		if !strings.EqualFold(t.to, s.bettingPoolAddr) {
			continue
		}
		k := strings.ToLower(t.TxId) + "|" + strings.ToLower(t.From)
		d := m[k]
		if d == nil {
			d = &betDebit{amount: decimal.Zero}
			m[k] = d
		}
		d.amount = d.amount.Add(t.Value)
		d.count++
	}
	return m
}

// updateBalanceInTx 充值加钱(沿用旧签名，内部走统一的 applyBalanceDelta)。
func (s *EVMService) updateBalanceInTx(ctx context.Context, userID uint64, depositAmount decimal.Decimal, refID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return s.applyBalanceDelta(tx, userID, balanceDelta{available: depositAmount}, "deposit", refID)
	})
}

// applyBalanceDelta 在给定事务内对一个用户的余额按 delta 增减各桶，并写一条 asset_ledger 流水。
// 行锁 FOR UPDATE 防并发；user_balance 行缺失时返回 errBalanceRowMissing(由调用方决定是否保留审计行)。
// 不自行开启/提交事务，调用方负责把它和"幂等插入审计行"放进同一事务以保证只加一次。
func (s *EVMService) applyBalanceDelta(tx *gorm.DB, userID uint64, d balanceDelta, businessType, refID string) error {
	var ub mysql.UserBalance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("user_id = ?", userID).
		First(&ub).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return errBalanceRowMissing
		}
		return fmt.Errorf("failed to query user balance, userID:%d, err:%w", userID, err)
	}

	availBefore := ub.AvailableBalance
	availAfter := availBefore.Add(d.available)

	// asset_ledger 记录可用余额的变动(stake/liq 锁定的搬动反映在 user_balance 各桶，金额取可用变动)
	ledger := mysql.AssetLedger{
		UserID:        userID,
		BusinessType:  businessType,
		Amount:        d.available,
		BalanceBefore: availBefore,
		BalanceAfter:  availAfter,
		RefID:         refID,
		// token_address 列为 varchar(20)，存不下 42 字符的 EVM 地址；平台单 ODD 币种，留空(与原充值逻辑一致)。
	}
	if err := tx.Create(&ledger).Error; err != nil {
		return fmt.Errorf("failed to create asset ledger: %w", err)
	}

	updates := map[string]any{"available_balance": availAfter}
	if !d.stakeLock.IsZero() {
		updates["stake_lock_balance"] = ub.StakeLockBalance.Add(d.stakeLock)
	}
	if !d.liqLock.IsZero() {
		updates["liq_lock_balance"] = ub.LiqLockBalance.Add(d.liqLock)
	}
	if err := tx.Model(&mysql.UserBalance{}).
		Where("user_id = ?", userID).
		Updates(updates).Error; err != nil {
		return fmt.Errorf("failed to update user balance: %w", err)
	}
	return nil
}

// 处理转移归集
// deposit_record 更新
func (s *EVMService) handleCollectTransfer(ctx context.Context, addr2Id map[string]uint64, txs []*evmtxInfo) error {
	tl := tracelog.NewWithContext(ctx)

	// 1 更新 归集信息
	for _, item := range txs {
		userID := addr2Id[item.From]
		if userID == 0 {
			tl.Errorf("user id is 0, address:%s, chain:%s", item.From, s.Chain.String())
			continue
		}

		// 1. 更新充值记录表(归集仅记录，不动余额)
		if _, err := mysql.CreateDepositRecord(ctx, s.GetChainName(), item.TxId, item.LogIndex, userID, item.Value, item.From, item.to, item.BlockNumber, 2, 20); err != nil {
			tl.Errorf("failed to update deposit record, tx:%v, err:%v", *item, err)
			continue
		}
	}
	return nil
}
