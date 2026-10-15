package evm

import (
	"chain-consumer/internal/mysql"
	"chain-consumer/internal/tracelog"
	"chain-consumer/service/evm/contract"
	"context"
	"fmt"

	"github.com/ethereum/go-ethereum/core/types"
)

// op 标识：结算行写进 onchain_tx_orders.op，查询时按它过滤。
const opMarketSettlementFinalized = "market_settlement_finalized"

// collectSettlementOrder 解析 MarketSettlementFinalized（盘口级结算定盘，一个盘口一次），
// 额外生成一条 onchain_tx_orders 结算行（与 admin_onchain_action 审计并存）。
//
// 只 INSERT 新行，不匹配/不更新已有订单（结算 tx ≠ 下注 tx，本就匹配不到下注单）；
// 全部参数塞 request_json；幂等靠 idempotency_key 唯一键（见 BatchInsertSettlementOrders）。
func (s *EVMService) collectSettlementOrder(l types.Log, kind contract.ContractKind, meta logMeta, batch *oddfiBatch) {
	if kind != contract.ContractBettingPool {
		return
	}
	e, err := s.bettingParser.ParseMarketSettlementFinalized(l)
	if err != nil || e == nil {
		return
	}

	params := map[string]any{
		"marketId":            hashHex(e.MarketId),
		"resultKind":          e.ResultKind,
		"scoreSettled":        e.ScoreSettled,
		"homeScore":           e.HomeScore,
		"awayScore":           e.AwayScore,
		"grossPayout":         bigStr(e.GrossPayout),
		"lpMarginShare":       bigStr(e.LpMarginShare),
		"platformMarginShare": bigStr(e.PlatformMarginShare),
		"quoteVersion":        bigStr(e.QuoteVersion),
	}

	settledAt := meta.blockTime
	batch.settlementOrders = append(batch.settlementOrders, &mysql.OnchainTxOrder{
		UserID:           0, // 系统/管理员操作，无具体用户
		Chain:            s.GetChainName(),
		Op:               opMarketSettlementFinalized,
		IdempotencyKey:   fmt.Sprintf("%s:%d:%s:%d", opMarketSettlementFinalized, s.chainID, meta.txHash, meta.logIndex),
		TxHash:           meta.txHash,
		Status:           "confirmed",
		RequestJSON:      jsonStr(params),
		SettlementStatus: "", // 本次不按 resultKind 映射，先留空串
		ActualPayoutWei:  bigStr(e.GrossPayout),
		SettledAt:        &settledAt,
		CreatedAt:        meta.blockTime,
		UpdatedAt:        meta.blockTime,
	})
}

// handleMarketSettlements 把结算行批量 INSERT 进 onchain_tx_orders（幂等）。
func (s *EVMService) handleMarketSettlements(ctx context.Context, orders []*mysql.OnchainTxOrder) error {
	tl := tracelog.NewWithContext(ctx)
	tl.Infof("handle market settlement orders, chain:%s, count:%d", s.Chain.String(), len(orders))
	if err := mysql.BatchInsertSettlementOrders(ctx, orders); err != nil {
		tl.Errorf("failed to batch insert settlement orders: %v", err)
		return err
	}
	return nil
}
