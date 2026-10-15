package evm

import (
	"chain-consumer/internal/mysql"
	"chain-consumer/internal/tracelog"
	"chain-consumer/service/evm/contract"
	"context"
	"errors"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/core/types"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// userEvent 一条可直接成行的用户行为（行已基本构建）。
// backfillMarketID/backfillPoolID 非空时，落库前用它查映射表回填 match_id（查不到则保持 NULL）。
type userEvent struct {
	row              *mysql.UserOnchainAction
	backfillMarketID string
	backfillPoolID   string
}

// claimPart 领奖事件碎片：BetClaimed 与 PayoutClaimed 同 tx 同 betId，合并成一条 BET_CLAIMED。
type claimPart struct {
	txHash   string
	betId    string
	isPayout bool // true=PayoutClaimed(带金额拆解)，false=BetClaimed(带 marketId/executor)
	meta     logMeta
	// BetClaimed
	marketId string
	user     string
	executor string
	// PayoutClaimed
	gross *big.Int
	tax   *big.Int
	net   *big.Int
}

// userRow 用公共溯源信息构造一行 user_onchain_action（业务字段由调用方按事件补）。
func (m logMeta) userRow(actionType, userAddr string) *mysql.UserOnchainAction {
	return &mysql.UserOnchainAction{
		UserAddress:     strings.ToLower(userAddr),
		ActionType:      actionType,
		ChainID:         m.chainID,
		ContractAddress: m.contractAddress,
		BlockNumber:     m.blockNumber,
		BlockTime:       m.blockTime,
		TxHash:          m.txHash,
		TxFrom:          ptrStr(m.txFrom),
		LogIndex:        m.logIndex,
		BlockHash:       m.blockHash,
	}
}

func u8ptr(v uint8) *uint8 { return &v }

// collectUserAndMaps 解析一条日志的用户行为/映射来源事件，追加到 batch。
func (s *EVMService) collectUserAndMaps(l types.Log, kind contract.ContractKind, meta logMeta, batch *oddfiBatch) {
	switch kind {
	case contract.ContractBettingPool:
		// BET_PLACED
		if e, err := s.bettingParser.ParseBetPlaced(l); err == nil {
			row := meta.userRow("BET_PLACED", addrLower(e.User))
			row.BetID = ptrStr(hashHex(e.BetId))
			row.MarketID = ptrStr(hashHex(e.MarketId))
			row.Amount = nullDecFromBig(e.AcceptedAmount)
			row.AmountSecondary = nullDecFromBig(e.RequestedAmount)
			row.Extra = jsonPtr(map[string]any{
				"lockedOdds":   bigStr(e.LockedOdds),
				"quoteVersion": bigStr(e.QuoteVersion),
				"outcome":      e.Outcome,
			})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row, backfillMarketID: hashHex(e.MarketId)})
			return
		}
		// BET_CLAIMED — BetClaimed 碎片
		if e, err := s.bettingParser.ParseBetClaimed(l); err == nil {
			batch.claimParts = append(batch.claimParts, &claimPart{
				txHash: meta.txHash, betId: hashHex(e.BetId), isPayout: false, meta: meta,
				marketId: hashHex(e.MarketId), user: addrLower(e.User), executor: addrLower(e.Executor),
			})
			return
		}
		// BET_CLAIMED — PayoutClaimed 碎片（金额拆解）
		if e, err := s.bettingParser.ParsePayoutClaimed(l); err == nil {
			batch.claimParts = append(batch.claimParts, &claimPart{
				txHash: meta.txHash, betId: hashHex(e.BetId), isPayout: true, meta: meta,
				user: addrLower(e.User), gross: e.GrossPayout, tax: e.TaxAmount, net: e.NetPayout,
			})
			return
		}
		// BET_REFUNDED
		if e, err := s.bettingParser.ParseBetRefunded(l); err == nil {
			row := meta.userRow("BET_REFUNDED", addrLower(e.User))
			row.BetID = ptrStr(hashHex(e.BetId))
			row.MarketID = ptrStr(hashHex(e.MarketId))
			row.Amount = nullDecFromBig(e.RefundAmount)
			row.Extra = jsonPtr(map[string]any{
				"reason":       e.Reason,
				"quoteVersion": bigStr(e.QuoteVersion),
			})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row, backfillMarketID: hashHex(e.MarketId)})
			return
		}
		// BET_CASHED_OUT — 提前兑现：合约把 cashOutAmount(已扣 fee)transfer 给用户 magic 钱包
		if e, err := s.bettingParser.ParseBetCashedOut(l); err == nil {
			row := meta.userRow("BET_CASHED_OUT", addrLower(e.User))
			row.BetID = ptrStr(hashHex(e.BetId))
			row.MarketID = ptrStr(hashHex(e.MarketId))
			row.Amount = nullDecFromBig(e.CashOutAmount)           // 用户实收(已扣 cashout fee)
			row.AmountSecondary = nullDecFromBig(e.RemainingStake) // 释放的剩余本金(审计用)
			row.Extra = jsonPtr(map[string]any{
				"currentOdds":  bigStr(e.CurrentOdds),
				"feeBps":       e.FeeBps,
				"quoteVersion": bigStr(e.QuoteVersion),
			})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row, backfillMarketID: hashHex(e.MarketId)})
			// 除审计行/加余额外，还要把这笔兑现回写到原 place_bet 行的结算态，
			// 否则 web-api History 只看 onchain_tx_orders.settlement_status，注单会永远卡在「进行中」。
			batch.cashOuts = append(batch.cashOuts, &cashOutUpdate{
				betID:           hashHex(e.BetId),
				actualPayoutWei: bigStr(e.CashOutAmount),
				settledAt:       meta.blockTime,
			})
			return
		}
		// REFERRER_BOUND
		if e, err := s.bettingParser.ParseReferrerBound(l); err == nil {
			row := meta.userRow("REFERRER_BOUND", addrLower(e.User))
			row.CounterpartyAddress = ptrStr(addrLower(e.Referrer))
			batch.userEvents = append(batch.userEvents, &userEvent{row: row})
			return
		}
		// REFERRAL_REWARD_ACCRUED
		if e, err := s.bettingParser.ParseReferralRewardAccumulated(l); err == nil {
			row := meta.userRow("REFERRAL_REWARD_ACCRUED", addrLower(e.Referrer))
			row.CounterpartyAddress = ptrStr(addrLower(e.From))
			row.Amount = nullDecFromBig(e.Amount)
			row.Extra = jsonPtr(map[string]any{"kind": e.Kind})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row})
			return
		}
		// REFERRAL_CLAIMED
		if e, err := s.bettingParser.ParseReferralClaimed(l); err == nil {
			row := meta.userRow("REFERRAL_CLAIMED", addrLower(e.Referrer))
			row.Amount = nullDecFromBig(e.OddAmount)
			batch.userEvents = append(batch.userEvents, &userEvent{row: row})
			return
		}
		// REFERRAL_CLAIMED_USDT
		if e, err := s.bettingParser.ParseReferralClaimedUSDT(l); err == nil {
			row := meta.userRow("REFERRAL_CLAIMED_USDT", addrLower(e.Referrer))
			row.Amount = nullDecFromBig(e.OddAmount)
			row.AmountSecondary = nullDecFromBig(e.UsdtAmount)
			row.Extra = jsonPtr(map[string]any{"currentPriceX18": bigStr(e.CurrentPriceX18)})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row})
			return
		}
		// MarketOpened → market_match_map（同一事件也已进 admin 审计表）
		if e, err := s.bettingParser.ParseMarketOpened(l); err == nil {
			batch.marketMaps = append(batch.marketMaps, &mysql.MarketMatchMap{
				MarketID:   hashHex(e.MarketId),
				MatchID:    hashHex(e.MatchId),
				MarketType: u8ptr(e.MarketType),
				Line:       u8ptr(e.Line),
				LockAt:     unixToUTC(e.LockAt),
			})
			return
		}

	case contract.ContractStakingPool:
		// STAKE_CREATED
		if e, err := s.stakingParser.ParseStakeCreated(l); err == nil {
			row := meta.userRow("STAKE_CREATED", addrLower(e.User))
			row.PositionID = ptrStr(e.PositionId.String())
			row.Amount = nullDecFromBig(e.Principal)
			row.Extra = jsonPtr(map[string]any{
				"planId":     e.PlanId,
				"sourceType": e.SourceType,
				"weight":     bigStr(e.Weight),
				"unlockAt":   e.UnlockAt,
			})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row})
			return
		}
		// STAKE_WITHDRAWN
		if e, err := s.stakingParser.ParseStakeWithdrawn(l); err == nil {
			row := meta.userRow("STAKE_WITHDRAWN", addrLower(e.User))
			row.PositionID = ptrStr(e.PositionId.String())
			row.Amount = nullDecFromBig(e.Principal)
			row.AmountSecondary = nullDecFromBig(e.Reward)
			row.Extra = jsonPtr(map[string]any{"early": e.Early})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row})
			return
		}

	case contract.ContractLiquidityPool:
		// LIQUIDITY_DEPOSITED
		if e, err := s.liquidityParser.ParseLiquidityDeposited(l); err == nil {
			row := meta.userRow("LIQUIDITY_DEPOSITED", addrLower(e.User))
			row.PositionID = ptrStr(e.PositionId.String())
			row.Amount = nullDecFromBig(e.Amount)
			row.Extra = jsonPtr(map[string]any{
				"poolId":   e.PoolId.String(),
				"weight":   bigStr(e.Weight),
				"planId":   e.PlanId,
				"unlockAt": e.UnlockAt,
			})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row, backfillPoolID: e.PoolId.String()})
			return
		}
		// LIQUIDITY_UNBOND_REQUESTED
		if e, err := s.liquidityParser.ParseUnbondRequested(l); err == nil {
			row := meta.userRow("LIQUIDITY_UNBOND_REQUESTED", addrLower(e.User))
			row.PositionID = ptrStr(e.PositionId.String())
			row.Extra = jsonPtr(map[string]any{
				"unbondingEpoch":         e.UnbondingEpoch,
				"frozenRewardPerWeight":  bigStr(e.FrozenRewardPerWeight),
				"frozenLossPerPrincipal": bigStr(e.FrozenLossPerPrincipal),
			})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row})
			return
		}
		// LIQUIDITY_WITHDRAWN
		if e, err := s.liquidityParser.ParseLiquidityWithdrawn(l); err == nil {
			row := meta.userRow("LIQUIDITY_WITHDRAWN", addrLower(e.User))
			row.PositionID = ptrStr(e.PositionId.String())
			row.Amount = nullDecFromBig(e.WithdrawAmount)
			row.AmountSecondary = nullDecFromBig(e.NetPnl) // int256，可为负
			row.Extra = jsonPtr(map[string]any{"finalState": e.FinalState})
			batch.userEvents = append(batch.userEvents, &userEvent{row: row})
			return
		}
		// MatchPoolOpened → pool_match_map
		if e, err := s.liquidityParser.ParseMatchPoolOpened(l); err == nil {
			batch.poolMaps = append(batch.poolMaps, &mysql.PoolMatchMap{
				PoolID:         e.PoolId.String(),
				MatchID:        hashHex(e.MatchId),
				MatchEndTime:   unixToUTC(e.MatchEndTime),
				DepositCloseAt: unixToUTC(e.DepositCloseAt),
			})
			return
		}
	}
}

// mergeClaims 把 BetClaimed/PayoutClaimed 碎片按 (tx,betId) 合并为一条 BET_CLAIMED。
// 行身份(log_index 等)优先用 BetClaimed 的 meta；金额拆解来自 PayoutClaimed。
func mergeClaims(parts []*claimPart) []*userEvent {
	type agg struct{ bc, pc *claimPart }
	byKey := make(map[string]*agg)
	order := make([]string, 0, len(parts))
	for _, p := range parts {
		k := p.txHash + "|" + p.betId
		a := byKey[k]
		if a == nil {
			a = &agg{}
			byKey[k] = a
			order = append(order, k)
		}
		if p.isPayout {
			a.pc = p
		} else {
			a.bc = p
		}
	}

	out := make([]*userEvent, 0, len(order))
	for _, k := range order {
		a := byKey[k]
		var (
			meta                          logMeta
			betId, marketId, user, execut string
		)
		switch {
		case a.bc != nil:
			meta, betId, marketId, user, execut = a.bc.meta, a.bc.betId, a.bc.marketId, a.bc.user, a.bc.executor
		case a.pc != nil:
			meta, betId, user = a.pc.meta, a.pc.betId, a.pc.user
		}

		row := meta.userRow("BET_CLAIMED", user)
		row.BetID = ptrStr(betId)
		if marketId != "" {
			row.MarketID = ptrStr(marketId)
		}
		if execut != "" {
			row.CounterpartyAddress = ptrStr(execut)
		}
		if a.pc != nil { // 金额拆解：amount=netPayout, gross/tax
			row.Amount = nullDecFromBig(a.pc.net)
			row.AmountGross = nullDecFromBig(a.pc.gross)
			row.AmountTax = nullDecFromBig(a.pc.tax)
		}
		ue := &userEvent{row: row}
		if marketId != "" {
			ue.backfillMarketID = marketId
		}
		out = append(out, ue)
	}
	return out
}

// handleUserActions 落库用户行为：先写映射表→合并领奖→回填 match_id→入库(余额相关事件同事务加减余额)。
// betDebits 提供 BET_PLACED 的含税扣款金额来源(C，同 tx magic→betting_pool 的 Transfer)。
func (s *EVMService) handleUserActions(ctx context.Context, batch *oddfiBatch, betDebits map[string]*betDebit) error {
	tl := tracelog.NewWithContext(ctx)

	// 1. 先写映射表（本批 MarketOpened/MatchPoolOpened），供下一步回填 match_id
	if err := mysql.BatchUpsertMarketMatchMap(ctx, batch.marketMaps); err != nil {
		tl.Errorf("failed to upsert market_match_map: %v", err)
		return err
	}
	if err := mysql.BatchUpsertPoolMatchMap(ctx, batch.poolMaps); err != nil {
		tl.Errorf("failed to upsert pool_match_map: %v", err)
		return err
	}

	// 2. 合并领奖碎片，汇总所有用户行为
	events := batch.userEvents
	events = append(events, mergeClaims(batch.claimParts)...)
	if len(events) == 0 {
		return nil
	}

	// 3. 批量回填 match_id（实时查映射表，查不到保持 NULL）
	marketIDs := make([]string, 0)
	poolIDs := make([]string, 0)
	for _, e := range events {
		if e.backfillMarketID != "" {
			marketIDs = append(marketIDs, e.backfillMarketID)
		}
		if e.backfillPoolID != "" {
			poolIDs = append(poolIDs, e.backfillPoolID)
		}
	}
	marketToMatch, err := mysql.GetMatchIDsByMarketIDs(ctx, marketIDs)
	if err != nil {
		tl.Errorf("failed to query market_match_map: %v", err)
		return err
	}
	poolToMatch, err := mysql.GetMatchIDsByPoolIDs(ctx, poolIDs)
	if err != nil {
		tl.Errorf("failed to query pool_match_map: %v", err)
		return err
	}

	rows := make([]*mysql.UserOnchainAction, 0, len(events))
	for _, e := range events {
		if e.row == nil {
			continue
		}
		if e.backfillMarketID != "" {
			if mid, ok := marketToMatch[e.backfillMarketID]; ok {
				e.row.MatchID = ptrStr(mid)
			}
		}
		if e.backfillPoolID != "" {
			if mid, ok := poolToMatch[e.backfillPoolID]; ok {
				e.row.MatchID = ptrStr(mid)
			}
		}
		rows = append(rows, e.row)
	}

	tl.Infof("handle user onchain actions, chain:%s, count:%d", s.Chain.String(), len(rows))

	// 拆分：余额相关事件走"插入审计行+加减余额"同事务(幂等)；其余批量入库。
	type balRow struct {
		row     *mysql.UserOnchainAction
		delta   balanceDelta
		bizType string
	}
	var (
		auditOnly []*mysql.UserOnchainAction
		balRows   []*balRow
	)
	for _, r := range rows {
		delta, bizType, affects := s.classifyBalance(ctx, r, betDebits)
		if !affects || delta.isZero() {
			auditOnly = append(auditOnly, r)
			continue
		}
		balRows = append(balRows, &balRow{row: r, delta: delta, bizType: bizType})
	}

	// 非余额行：批量幂等入库
	if err := mysql.BatchInsertUserActions(ctx, auditOnly); err != nil {
		tl.Errorf("failed to batch insert user actions: %v", err)
		return err
	}
	if len(balRows) == 0 {
		return nil
	}

	// 解析余额行的用户地址 → user_id（magic 地址即充值地址，复用 user_deposit_address 映射）
	addrSet := make(map[string]struct{}, len(balRows))
	for _, b := range balRows {
		addrSet[strings.ToLower(b.row.UserAddress)] = struct{}{}
	}
	addrList := make([]string, 0, len(addrSet))
	for a := range addrSet {
		addrList = append(addrList, a)
	}
	addr2Id := make(map[string]uint64, len(addrList))
	if users, err := mysql.GetUserIdByDepositAddresses(ctx, addrList); err != nil {
		tl.Errorf("failed to resolve user ids for balance: %v", err)
		return err
	} else {
		for _, u := range users {
			if u.UserID != 0 {
				addr2Id[strings.ToLower(u.Address)] = u.UserID
			}
		}
	}

	// 逐条：同事务内 幂等插入审计行 + 加减余额（不同 user 之间相互不阻塞，同 user 由行锁串行）
	for _, b := range balRows {
		row, bd, biz := b.row, b.delta, b.bizType
		uid := addr2Id[strings.ToLower(row.UserAddress)]
		txErr := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			affected, err := mysql.InsertUserActionWithTx(tx, row)
			if err != nil {
				return err
			}
			if affected == 0 {
				return nil // 已处理过(重投/重扫) → 跳过加减余额，幂等
			}
			if uid == 0 {
				tl.Infof("no user mapping for balance action, action:%s, addr:%s, tx:%s", row.ActionType, row.UserAddress, row.TxHash)
				return nil // 审计行已插入，非平台用户/地址未登记 → 不加减余额
			}
			balErr := s.applyBalanceDelta(tx, uid, bd, biz, row.TxHash)
			if errors.Is(balErr, errBalanceRowMissing) {
				tl.Errorf("user balance row missing, keep audit skip balance, action:%s, userID:%d, tx:%s", row.ActionType, uid, row.TxHash)
				return nil // 保留审计行，余额跳过，不回滚不重试
			}
			return balErr
		})
		if txErr != nil {
			tl.Errorf("failed to apply balance action, action:%s, tx:%s, err:%v", row.ActionType, row.TxHash, txErr)
			continue // 不中断其余事件
		}
	}
	return nil
}

// handleCashOutSettlements 把 BetCashedOut 逐笔回写到原 place_bet 行（settlement_status='CASHED_OUT'）。
// 与审计行/加余额相互独立：本步只动 onchain_tx_orders。单条失败不阻断其余；rows==0（betId 未回填或已是终态）仅记日志，靠重扫/重投最终一致。
func (s *EVMService) handleCashOutSettlements(ctx context.Context, items []*cashOutUpdate) error {
	tl := tracelog.NewWithContext(ctx)
	tl.Infof("handle cash-out settlements, chain:%s, count:%d", s.Chain.String(), len(items))
	for _, it := range items {
		if it == nil {
			continue
		}
		rows, err := mysql.UpdateCashOutSettlementByBetID(ctx, it.betID, it.actualPayoutWei, it.settledAt)
		if err != nil {
			tl.Errorf("cash-out settlement update failed, betId:%s, err:%v", it.betID, err)
			continue
		}
		if rows == 0 {
			tl.Infof("cash-out settlement no row matched (betId not backfilled or already settled), betId:%s", it.betID)
			continue
		}
		tl.Infof("cash-out settlement written, betId:%s, payout_wei:%s, rows:%d", it.betID, it.actualPayoutWei, rows)
	}
	return nil
}

// decFromNull NullDecimal → Decimal(无值取 0)。
func decFromNull(n decimal.NullDecimal) decimal.Decimal {
	if !n.Valid {
		return decimal.Zero
	}
	return n.Decimal
}

// shiftODD 把链上原始 wei 金额转人类单位(与充值一致，ODD 18 位精度)。
func shiftODD(d decimal.Decimal) decimal.Decimal {
	return d.Shift(-bscCheckToken1Decimal)
}

// classifyBalance 把一条用户行为映射成余额变动(人类单位)。affects=false 表示该事件不动余额。
func (s *EVMService) classifyBalance(ctx context.Context, e *mysql.UserOnchainAction, betDebits map[string]*betDebit) (balanceDelta, string, bool) {
	amt := shiftODD(decFromNull(e.Amount)) // 主金额(ODD)
	switch e.ActionType {
	case "BET_PLACED":
		total := s.resolveBetDebit(ctx, e, betDebits) // 含税总额
		return balanceDelta{available: total.Neg()}, "bet_placed", true
	case "BET_CLAIMED":
		return balanceDelta{available: amt}, "bet_claimed", true // amt=netPayout
	case "BET_REFUNDED":
		return balanceDelta{available: amt}, "bet_refunded", true
	case "BET_CASHED_OUT":
		return balanceDelta{available: amt}, "bet_cashed_out", true // amt=cashOutAmount，用户实收
	case "STAKE_CREATED":
		return balanceDelta{available: amt.Neg(), stakeLock: amt}, "stake_created", true
	case "STAKE_WITHDRAWN":
		reward := shiftODD(decFromNull(e.AmountSecondary))
		return balanceDelta{available: amt.Add(reward), stakeLock: amt.Neg()}, "stake_withdrawn", true
	case "LIQUIDITY_DEPOSITED":
		return balanceDelta{available: amt.Neg(), liqLock: amt}, "liquidity_deposited", true
	case "LIQUIDITY_WITHDRAWN":
		pnl := shiftODD(decFromNull(e.AmountSecondary)) // int256，可为负
		principal := amt.Sub(pnl)                       // 本金 = 提取额 - 盈亏
		return balanceDelta{available: amt, liqLock: principal.Neg()}, "liquidity_withdrawn", true
	case "REFERRAL_CLAIMED":
		return balanceDelta{available: amt}, "referral_claimed", true
	default:
		// REFERRAL_CLAIMED_USDT(USDT 不入 ODD 余额) / REFERRER_BOUND / REFERRAL_REWARD_ACCRUED /
		// LIQUIDITY_UNBOND_REQUESTED 等 → 仅审计，不动余额
		return balanceDelta{}, "", false
	}
}

// resolveBetDebit 取 BET_PLACED 含税扣款(人类单位)：优先同 tx 的 magic→betting_pool Transfer 总额(C)，
// 仅当该 (tx,user) 恰好一笔下注转账时采用；否则回退按 acceptedAmount*(1+betTaxBps/1e4) 估算(D)并告警。
func (s *EVMService) resolveBetDebit(ctx context.Context, e *mysql.UserOnchainAction, betDebits map[string]*betDebit) decimal.Decimal {
	k := strings.ToLower(e.TxHash) + "|" + strings.ToLower(e.UserAddress)
	if d, ok := betDebits[k]; ok && d.count == 1 {
		return shiftODD(d.amount)
	}
	// D 兜底：用配置税率估算，并告警(C 配不到，可能是多笔同 tx 或转账结构异常)
	accepted := shiftODD(decFromNull(e.Amount))
	factor := decimal.NewFromInt(1).Add(decimal.NewFromInt(int64(s.betTaxBps)).Div(decimal.NewFromInt(10000)))
	est := accepted.Mul(factor)
	tracelog.NewWithContext(ctx).Errorf("bet debit fallback to config tax, tx:%s, user:%s, accepted:%s, est:%s, bps:%d",
		e.TxHash, e.UserAddress, accepted.String(), est.String(), s.betTaxBps)
	return est
}
