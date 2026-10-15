package utils

import (
	"context"

	"chain_crawler/internal/config"
	"chain_crawler/internal/monitor"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/ethclient"

	"go.uber.org/zap"
)

// BlockRangeResult 区块范围查询结果
type BlockRangeResult struct {
	FromBlock   uint64 // 起始区块
	ToBlock     uint64 // 结束区块
	BlockStep   uint64 // 区块步长
	MaxToBlock  uint64 // 最大可处理区块
	BlockNumber uint64 // 当前最新区块
	ShouldWait  bool   // 是否需要等待
}

// BlockRangeParams 区块范围查询参数
type BlockRangeParams struct {
	Chain            consts.Chain        // 区块链类型
	CurrentBlock     uint64              // 当前处理的区块
	BlockStep        uint64              // 每次处理的区块数量
	DelayBlockHeight uint64              // 延迟区块高度
	EvmClient        ethclient.EthClient // EVM客户端
	Cfg              *config.Config      // 配置
	Logger           *zap.SugaredLogger  // 日志器
	TaskName         string              // 任务名称
}

func GetDefaultBlockStep(chain consts.Chain) uint64 {
	switch chain {
	case consts.CHAIN_INEVM:
		return 64
	case consts.CHAIN_THUNDERCORE:
		return 64
	case consts.CHAIN_NEON:
		return 32
	default:
		return 16
	}
}

// GetBlockRange 获取区块处理范围
// 根据当前区块、步长和延迟设置计算需要处理的区块范围
func GetBlockRange(ctx context.Context, params BlockRangeParams) *BlockRangeResult {
	// 设置默认的区块步长
	if params.BlockStep <= 0 {
		params.BlockStep = GetDefaultBlockStep(params.Chain)
	}

	// 设置默认的延迟区块高度
	if params.DelayBlockHeight == 0 {
		if chainConfig, ok := consts.ChainConfigs[params.Chain]; ok {
			params.DelayBlockHeight = uint64(chainConfig.MaxBlockLag)
		} else {
			params.Logger.Errorw("ChainConfig not found", "chain", params.Chain)
			return &BlockRangeResult{
				ShouldWait: true,
			}
		}
	}

	// 获取最新块高
	blockNumber, err := params.EvmClient.BlockNumber(ctx, ethclient.RouteRandom)
	if err != nil {
		params.Logger.Errorw("ethClient.BlockNumber failed", "error", err.Error(), "chain", params.Chain, "task", params.TaskName)
		return &BlockRangeResult{
			ShouldWait: true,
		}
	}

	// 更新监控指标
	monitor.LatestBlockNumber.WithLabelValues(params.Cfg.Env, string(params.Chain+"full_forward")).Set(float64(blockNumber))

	// 计算处理范围
	fromBlock := params.CurrentBlock
	maxToBlock := blockNumber - params.DelayBlockHeight
	toBlock := fromBlock + params.BlockStep - 1

	if toBlock > maxToBlock {
		toBlock = maxToBlock
	}

	// 检查是否需要等待
	if fromBlock > maxToBlock {
		params.Logger.Infow("等待新块", "fromBlock", fromBlock, "maxToBlock", maxToBlock, "chain", params.Chain)
		return &BlockRangeResult{
			FromBlock:   fromBlock,
			ToBlock:     toBlock,
			BlockStep:   params.BlockStep,
			MaxToBlock:  maxToBlock,
			BlockNumber: blockNumber,
			ShouldWait:  true,
		}
	}

	return &BlockRangeResult{
		FromBlock:   fromBlock,
		ToBlock:     toBlock,
		BlockStep:   params.BlockStep,
		MaxToBlock:  maxToBlock,
		BlockNumber: blockNumber,
		ShouldWait:  false,
	}
}
