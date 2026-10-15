package evm

import (
	"chain-consumer/internal/mysql"
	"chain-consumer/internal/tracelog"
	"chain-consumer/service/evm/contract"
	"context"
	"strings"

	"github.com/ethereum/go-ethereum/core/types"
)

// 操作大类常量（由 event_name 固定映射，见 admin_onchain_action.md）。
const (
	catBusinessOps = "BUSINESS_OPS"
	catConfig      = "CONFIG"
	catRole        = "ROLE"
	catPause       = "PAUSE"
	catUpgrade     = "UPGRADE"
	catInit        = "INIT"
)

// adminRow 用公共溯源信息 + 解析结果构造一行 admin_onchain_action（role/target 由调用方按需补）。
func (m logMeta) adminRow(category, eventName, operator string, params map[string]any) *mysql.AdminOnchainAction {
	return &mysql.AdminOnchainAction{
		ContractAddress: m.contractAddress,
		Category:        category,
		EventName:       eventName,
		Operator:        strings.ToLower(operator),
		Params:          jsonStr(params),
		ChainID:         m.chainID,
		BlockNumber:     m.blockNumber,
		BlockTime:       m.blockTime,
		TxHash:          m.txHash,
		TxFrom:          m.txFrom,
		LogIndex:        m.logIndex,
		BlockHash:       m.blockHash,
	}
}

// parseAdminAction 把一条日志解析成一行管理员审计；非 admin 事件返回 nil。
// 先按合约类型解析专属事件，未命中再解析 4 合约通用(OZ)事件。
func (s *EVMService) parseAdminAction(l types.Log, kind contract.ContractKind, meta logMeta) *mysql.AdminOnchainAction {
	if row := s.parseContractSpecificAdmin(l, kind, meta); row != nil {
		return row
	}
	return s.parseSharedAdminAction(l, meta)
}

// parseContractSpecificAdmin 解析各合约专属的 admin 事件（BUSINESS_OPS/CONFIG/INIT 中的非通用项）。
func (s *EVMService) parseContractSpecificAdmin(l types.Log, kind contract.ContractKind, meta logMeta) *mysql.AdminOnchainAction {
	switch kind {
	case contract.ContractBettingPool:
		// 1) MarketOpened — 运营开盘
		if e, err := s.bettingParser.ParseMarketOpened(l); err == nil {
			return meta.adminRow(catBusinessOps, "MarketOpened", meta.txFrom, map[string]any{
				"marketId":       hashHex(e.MarketId),
				"matchId":        hashHex(e.MatchId),
				"marketType":     e.MarketType,
				"line":           e.Line,
				"matchStartTime": e.MatchStartTime,
				"lockAt":         e.LockAt,
				"quoteVersion":   bigStr(e.QuoteVersion),
			})
		}
		// 2) OddsUpdated — 更新赔率
		if e, err := s.bettingParser.ParseOddsUpdated(l); err == nil {
			return meta.adminRow(catBusinessOps, "OddsUpdated", meta.txFrom, map[string]any{
				"marketId":     hashHex(e.MarketId),
				"updatedAt":    e.UpdatedAt,
				"quoteVersion": bigStr(e.QuoteVersion),
				"signal":       e.Signal,
			})
		}
		// 3a) MarketSettlementScoreBatchProcessed — 按比分批量结算(SETTLER，可分页多次)
		if e, err := s.bettingParser.ParseMarketSettlementScoreBatchProcessed(l); err == nil {
			return meta.adminRow(catBusinessOps, "MarketSettlementScoreBatchProcessed", meta.txFrom, map[string]any{
				"marketId":       hashHex(e.MarketId),
				"homeScore":      e.HomeScore,
				"awayScore":      e.AwayScore,
				"processedCount": bigStr(e.ProcessedCount),
				"totalBetCount":  bigStr(e.TotalBetCount),
			})
		}
		// 3b) MarketSettlementFinalized — 结算定盘(SETTLER，替代旧 MarketSettled)
		if e, err := s.bettingParser.ParseMarketSettlementFinalized(l); err == nil {
			return meta.adminRow(catBusinessOps, "MarketSettlementFinalized", meta.txFrom, map[string]any{
				"marketId":            hashHex(e.MarketId),
				"resultKind":          e.ResultKind,
				"scoreSettled":        e.ScoreSettled,
				"homeScore":           e.HomeScore,
				"awayScore":           e.AwayScore,
				"grossPayout":         bigStr(e.GrossPayout),
				"lpMarginShare":       bigStr(e.LpMarginShare),
				"platformMarginShare": bigStr(e.PlatformMarginShare),
				"quoteVersion":        bigStr(e.QuoteVersion),
			})
		}
		// 注：旧 PushRefunded(整盘退款汇总) 已从合约移除；退款明细现由每注 BetRefunded 覆盖(进 user 表)。
		// 5) PlatformReserveUpdated — 仅 reason==0(管理员注资) 入库
		if e, err := s.bettingParser.ParsePlatformReserveUpdated(l); err == nil {
			if e.Reason != 0 {
				return nil // reason 1/2/3 是结算副产物，丢弃
			}
			return meta.adminRow(catBusinessOps, "PlatformReserveUpdated", meta.txFrom, map[string]any{
				"delta":      bigStr(e.Delta),
				"newBalance": bigStr(e.NewBalance),
				"reason":     e.Reason,
			})
		}

	case contract.ContractStakingPool:
		// 6) StakingConfigUpdated
		if e, err := s.stakingParser.ParseStakingConfigUpdated(l); err == nil {
			row := meta.adminRow(catConfig, "StakingConfigUpdated", addrLower(e.Operator), map[string]any{
				"operator": addrLower(e.Operator),
				"treasury": addrLower(e.Treasury),
			})
			row.TargetAddress = ptrStr(addrLower(e.Treasury))
			return row
		}
		// 7) BettingPoolUpdated
		if e, err := s.stakingParser.ParseBettingPoolUpdated(l); err == nil {
			row := meta.adminRow(catConfig, "BettingPoolUpdated", addrLower(e.Operator), map[string]any{
				"operator":    addrLower(e.Operator),
				"bettingPool": addrLower(e.BettingPool),
			})
			row.TargetAddress = ptrStr(addrLower(e.BettingPool))
			return row
		}
		// 8) MinStakeAmountUpdated
		if e, err := s.stakingParser.ParseMinStakeAmountUpdated(l); err == nil {
			return meta.adminRow(catConfig, "MinStakeAmountUpdated", addrLower(e.Operator), map[string]any{
				"operator":  addrLower(e.Operator),
				"oldAmount": bigStr(e.OldAmount),
				"newAmount": bigStr(e.NewAmount),
			})
		}
		// 9) VipTierConfigUpdated
		if e, err := s.stakingParser.ParseVipTierConfigUpdated(l); err == nil {
			return meta.adminRow(catConfig, "VipTierConfigUpdated", addrLower(e.Operator), map[string]any{
				"operator":   addrLower(e.Operator),
				"tier":       e.Tier,
				"threshold":  bigStr(e.Threshold),
				"dailyLimit": bigStr(e.DailyLimit),
			})
		}
		// 10) VipConfigUpdated
		if e, err := s.stakingParser.ParseVipConfigUpdated(l); err == nil {
			return meta.adminRow(catConfig, "VipConfigUpdated", addrLower(e.Operator), map[string]any{
				"operator":   addrLower(e.Operator),
				"configHash": hashHex(e.ConfigHash),
			})
		}
		// 22) StakingInitialized
		if e, err := s.stakingParser.ParseStakingInitialized(l); err == nil {
			row := meta.adminRow(catInit, "StakingInitialized", addrLower(e.Admin), map[string]any{
				"admin":    addrLower(e.Admin),
				"oddToken": addrLower(e.OddToken),
				"treasury": addrLower(e.Treasury),
			})
			row.TargetAddress = ptrStr(addrLower(e.OddToken))
			return row
		}

	case contract.ContractLiquidityPool:
		// 11) LiquidityConfigUpdated
		if e, err := s.liquidityParser.ParseLiquidityConfigUpdated(l); err == nil {
			row := meta.adminRow(catConfig, "LiquidityConfigUpdated", addrLower(e.Operator), map[string]any{
				"operator":       addrLower(e.Operator),
				"newBettingPool": addrLower(e.NewBettingPool),
			})
			row.TargetAddress = ptrStr(addrLower(e.NewBettingPool))
			return row
		}
		// 12) MinDepositUpdated
		if e, err := s.liquidityParser.ParseMinDepositUpdated(l); err == nil {
			return meta.adminRow(catConfig, "MinDepositUpdated", addrLower(e.Operator), map[string]any{
				"operator":  addrLower(e.Operator),
				"oldAmount": bigStr(e.OldAmount),
				"newAmount": bigStr(e.NewAmount),
			})
		}
		// 13) UnbondEpochsUpdated
		if e, err := s.liquidityParser.ParseUnbondEpochsUpdated(l); err == nil {
			return meta.adminRow(catConfig, "UnbondEpochsUpdated", addrLower(e.Operator), map[string]any{
				"operator":  addrLower(e.Operator),
				"oldEpochs": e.OldEpochs,
				"newEpochs": e.NewEpochs,
			})
		}

	case contract.ContractODDToken:
		// 21) TokenInitialized
		if e, err := s.oddTokenParser.ParseTokenInitialized(l); err == nil {
			return meta.adminRow(catInit, "TokenInitialized", addrLower(e.Admin), map[string]any{
				"admin":       addrLower(e.Admin),
				"totalSupply": bigStr(e.TotalSupply),
			})
		}
	}
	return nil
}

// parseSharedAdminAction 解析 4 合约通用(OZ 继承)事件：Role*/Paused/Unpaused/Upgraded/Initialized。
// 这些事件签名在 4 个合约里完全一致(topic0 相同)，用 bettingParser 即可解码；来源合约由 meta.contractAddress 区分。
func (s *EVMService) parseSharedAdminAction(l types.Log, meta logMeta) *mysql.AdminOnchainAction {
	// 14) RoleGranted — operator=sender, role=role, target=account
	if e, err := s.bettingParser.ParseRoleGranted(l); err == nil {
		role := hashHex(e.Role)
		row := meta.adminRow(catRole, "RoleGranted", addrLower(e.Sender), map[string]any{
			"role":     role,
			"roleName": roleName(role),
			"account":  addrLower(e.Account),
			"sender":   addrLower(e.Sender),
		})
		row.Role = ptrStr(role)
		row.TargetAddress = ptrStr(addrLower(e.Account))
		return row
	}
	// 15) RoleRevoked — operator=sender, role=role, target=account
	if e, err := s.bettingParser.ParseRoleRevoked(l); err == nil {
		role := hashHex(e.Role)
		row := meta.adminRow(catRole, "RoleRevoked", addrLower(e.Sender), map[string]any{
			"role":     role,
			"roleName": roleName(role),
			"account":  addrLower(e.Account),
			"sender":   addrLower(e.Sender),
		})
		row.Role = ptrStr(role)
		row.TargetAddress = ptrStr(addrLower(e.Account))
		return row
	}
	// 16) RoleAdminChanged — operator=tx.from, role=role
	if e, err := s.bettingParser.ParseRoleAdminChanged(l); err == nil {
		role := hashHex(e.Role)
		row := meta.adminRow(catRole, "RoleAdminChanged", meta.txFrom, map[string]any{
			"role":              role,
			"roleName":          roleName(role),
			"previousAdminRole": hashHex(e.PreviousAdminRole),
			"newAdminRole":      hashHex(e.NewAdminRole),
		})
		row.Role = ptrStr(role)
		return row
	}
	// 17) Paused — operator=account
	if e, err := s.bettingParser.ParsePaused(l); err == nil {
		return meta.adminRow(catPause, "Paused", addrLower(e.Account), map[string]any{
			"account": addrLower(e.Account),
		})
	}
	// 18) Unpaused — operator=account
	if e, err := s.bettingParser.ParseUnpaused(l); err == nil {
		return meta.adminRow(catPause, "Unpaused", addrLower(e.Account), map[string]any{
			"account": addrLower(e.Account),
		})
	}
	// 19) Upgraded — operator=tx.from, target=implementation
	if e, err := s.bettingParser.ParseUpgraded(l); err == nil {
		row := meta.adminRow(catUpgrade, "Upgraded", meta.txFrom, map[string]any{
			"implementation": addrLower(e.Implementation),
		})
		row.TargetAddress = ptrStr(addrLower(e.Implementation))
		return row
	}
	// 20) Initialized — operator=tx.from
	if e, err := s.bettingParser.ParseInitialized(l); err == nil {
		return meta.adminRow(catInit, "Initialized", meta.txFrom, map[string]any{
			"version": e.Version,
		})
	}
	return nil
}

// handleAdminActions 批量写入管理员操作审计（幂等）。
func (s *EVMService) handleAdminActions(ctx context.Context, rows []*mysql.AdminOnchainAction) error {
	tl := tracelog.NewWithContext(ctx)
	tl.Infof("handle admin onchain actions, chain:%s, count:%d", s.Chain.String(), len(rows))
	if err := mysql.BatchInsertAdminActions(ctx, rows); err != nil {
		tl.Errorf("failed to batch insert admin actions: %v", err)
		return err
	}
	return nil
}
