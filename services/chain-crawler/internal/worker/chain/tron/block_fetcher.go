package tron

import (
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/tronclient"
	"chain_crawler/pkg/utils"
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"sort"
	"strings"

	"github.com/samber/lo"
	"github.com/sourcegraph/conc/pool"
)

type BlockFetcher struct {
	ctx                context.Context
	tronClient         *tronclient.TronClient
	hasGetBlockReceipt bool // 是否有eth_getBlockReceipts接口，quickNode是有的，但是其他节点是没有的
	tronBlockData      json.RawMessage
	tronBlock          *TronBlockSimple
	tvmBlockData       json.RawMessage
	tvmBlock           *TVMBlockSimple
	tronTxInfosData    json.RawMessage
	tronTxInfos        []*TronTransactionInfoSimple
	txReceiptsData     json.RawMessage
	txReceipts         []*TVMTxReceiptSimple
}

func NewBlockFetcher(ctx context.Context, tronClient *tronclient.TronClient, hasGetBlockReceipt bool) *BlockFetcher {
	// 为区块链查询创建 span，追踪查询时间
	blockFetcherSpanCtx, blockFetcherSpan := tracelog.StartSpan(ctx, "blockchain", "NewBlockFetcher")
	defer blockFetcherSpan.End()

	return &BlockFetcher{
		ctx:                blockFetcherSpanCtx,
		tronClient:         tronClient,
		hasGetBlockReceipt: hasGetBlockReceipt,
	}
}

/*
 * 获取tron block数据
 * 目前只写了 tronTxInfosData  tronTxInfos tronBlockData tronBlock
 */
func (fetcher *BlockFetcher) FetchBlock(ctx context.Context, blockNumber uint64) (*tronclient.TronBlockInfo, error) {
	// 为区块链查询创建 span，追踪查询时间
	fetchBlockSpanCtx, fetchBlockSpan := tracelog.StartSpan(ctx, "blockchain", "FetchBlock")
	defer fetchBlockSpan.End()

	_, err := fetcher.fetchTronBlock(fetchBlockSpanCtx, blockNumber)
	if err != nil {
		return nil, fmt.Errorf("fetchTronBlock error:%w", err)
	}

	// tvmBlock, err := fetcher.fetchTVMBlock(fetchBlockSpanCtx, blockNumber)
	// if err != nil {
	// 	return nil, err
	// }
	// if err = fetcher.verifyTvmBlock(fetchBlockSpanCtx, tvmBlock); err != nil {
	// 	return nil, fmt.Errorf("verifyTvmBlock error:%w", err)
	// }

	tronTxInfos, err := fetcher.fetchTronTxInfos(fetchBlockSpanCtx, blockNumber)
	if err != nil {
		return nil, fmt.Errorf("fetchTronTxInfos error:%w", err)
	}
	if err = fetcher.verifyTronTxInfos(fetchBlockSpanCtx, tronTxInfos); err != nil {
		return nil, fmt.Errorf("verifyTronTxInfos error:%w", err)
	}

	// txReceipts, err := fetcher.fetchTxReceipts(fetchBlockSpanCtx, blockNumber)
	// if err != nil {
	// 	return nil, fmt.Errorf("fetchTxReceipts error:%w", err)
	// }
	// if err = fetcher.verifyTxReceipts(fetchBlockSpanCtx, txReceipts); err != nil {
	// 	return nil, fmt.Errorf("verifyTxReceipts error:%w", err)
	// }
	if err = fetcher.verifyTxs(fetchBlockSpanCtx); err != nil {
		return nil, fmt.Errorf("verifyTxs blockNumber:%d error:%w", blockNumber, err)
	}
	return fetcher.getBlockInfoData(blockNumber), nil
}

func (fetcher *BlockFetcher) fetchTronBlock(ctx context.Context, blockNumber uint64) (*TronBlockSimple, error) {
	// 为区块链查询创建 span，追踪查询时间
	fetchTronBlockSpanCtx, fetchTronBlockSpan := tracelog.StartSpan(ctx, "blockchain", "fetchTronBlock")
	defer fetchTronBlockSpan.End()

	tl := tracelog.NewWithContext(fetchTronBlockSpanCtx)
	tronBlockData, err := fetcher.tronClient.GetTronBlockRaw(fetchTronBlockSpanCtx, blockNumber)
	if err != nil {
		tl.Errorw("GetTronBlockRaw failed", "blockNumber", blockNumber, "error", err.Error())
		return nil, fmt.Errorf("GetTronBlockRaw blockNumber:%d error: %w", blockNumber, err)
	}
	tronBlock := &TronBlockSimple{}
	if err = utils.JsonDecode(tronBlockData, tronBlock); err != nil {
		tl.Errorw("JsonDecode tronBlock failed", "blockNumber", blockNumber, "error", err.Error(), "data", string(tronBlockData))
		return nil, fmt.Errorf("JsonDecode tronBlock error: %w", err)
	}
	fetcher.tronBlockData = tronBlockData
	fetcher.tronBlock = tronBlock
	return tronBlock, nil
}

func (fetcher *BlockFetcher) fetchTVMBlock(ctx context.Context, blockNumber uint64) (*TVMBlockSimple, error) {
	// 为区块链查询创建 span，追踪查询时间
	fetchTVMBlockSpanCtx, fetchTVMBlockSpan := tracelog.StartSpan(ctx, "blockchain", "fetchTVMBlock")
	defer fetchTVMBlockSpan.End()

	tl := tracelog.NewWithContext(fetchTVMBlockSpanCtx)
	tvmBlockData, err := fetcher.tronClient.GetTVMBlockRaw(fetchTVMBlockSpanCtx, blockNumber)
	if err != nil {
		tl.Errorw("GetTVMBlockRaw failed", "blockNumber", blockNumber, "error", err.Error())
		return nil, fmt.Errorf("GetTVMBlockRaw blockNumber:%d error: %w", blockNumber, err)
	}
	tvmBlock := &TVMBlockSimple{}
	if err = utils.JsonDecode(tvmBlockData, tvmBlock); err != nil {
		tl.Errorw("JsonDecode tvmBlock failed", "blockNumber", blockNumber, "error", err.Error(), "data", string(tvmBlockData))
		return nil, fmt.Errorf("JsonDecode tvmBlock blockNumber:%d error: %w", blockNumber, err)
	}
	fetcher.tvmBlockData = tvmBlockData
	fetcher.tvmBlock = tvmBlock
	return tvmBlock, nil
}

func (fetcher *BlockFetcher) fetchTronTxInfos(ctx context.Context, blockNumber uint64) ([]*TronTransactionInfoSimple, error) {
	// 为区块链查询创建 span，追踪查询时间
	fetchTronTxInfosSpanCtx, fetchTronTxInfosSpan := tracelog.StartSpan(ctx, "blockchain", "fetchTronTxInfos")
	defer fetchTronTxInfosSpan.End()

	tl := tracelog.NewWithContext(fetchTronTxInfosSpanCtx)
	tronTxInfosData, err := fetcher.tronClient.GetTronTransactionInfoRaw(fetchTronTxInfosSpanCtx, blockNumber)
	if err != nil {
		tl.Errorw("GetTronTransactionInfoRaw failed", "blockNumber", blockNumber, "error", err.Error())
		return nil, fmt.Errorf("GetTronTransactionInfoRaw blockNumber:%d error: %w", blockNumber, err)
	}
	var tronTxInfos []*TronTransactionInfoSimple
	if err = utils.JsonDecode(tronTxInfosData, &tronTxInfos); err != nil {
		tl.Errorw("JsonDecode tronTxInfos failed", "blockNumber", blockNumber, "error", err.Error(), "data", string(tronTxInfosData))
		return nil, fmt.Errorf("JsonDecode tronTxInfos blockNumber:%d error: %w", blockNumber, err)
	}
	fetcher.tronTxInfosData = tronTxInfosData
	fetcher.tronTxInfos = tronTxInfos
	return tronTxInfos, nil
}

/*
 * 获取 tron receipts
 * quickNode 支持 eth_getBlockReceipts，其他不支持
 * fetchTxReceiptsByTxInfos 方法是用每个tx单独获取一次Receipts，rpc消耗很大
 */
func (fetcher *BlockFetcher) fetchTxReceipts(ctx context.Context, blockNumber uint64) ([]*TVMTxReceiptSimple, error) {
	fetchTxReceiptsSpanCtx, fetchTxReceiptsSpan := tracelog.StartSpan(ctx, "blockchain", "fetchTxReceipts")
	defer fetchTxReceiptsSpan.End()
	if fetcher.hasGetBlockReceipt {
		return fetcher.fetchTxReceiptsByBlock(fetchTxReceiptsSpanCtx, blockNumber)
	}
	return fetcher.fetchTxReceiptsByTxInfos(fetchTxReceiptsSpanCtx, fetcher.tvmBlock)
}

func (fetcher *BlockFetcher) fetchTxReceiptsByBlock(ctx context.Context, blockNumber uint64) ([]*TVMTxReceiptSimple, error) {
	// 为区块链查询创建 span，追踪查询时间
	fetchTxReceiptsByBlockSpanCtx, fetchTxReceiptsByBlockSpan := tracelog.StartSpan(ctx, "blockchain", "fetchTxReceiptsByBlock")
	defer fetchTxReceiptsByBlockSpan.End()

	tl := tracelog.NewWithContext(fetchTxReceiptsByBlockSpanCtx)
	txReceiptsData, err := fetcher.tronClient.GetTVMBlockReceiptsRaw(fetchTxReceiptsByBlockSpanCtx, blockNumber)
	if err != nil {
		tl.Errorw("GetTVMBlockReceiptsRaw failed", "blockNumber", blockNumber, "error", err.Error())
		return nil, fmt.Errorf("GetTVMBlockReceiptsRaw blockNumber:%d error: %w", blockNumber, err)
	}
	var txReceipts []*TVMTxReceiptSimple
	if err = utils.JsonDecode(txReceiptsData, &txReceipts); err != nil {
		tl.Errorw("JsonDecode txReceipts failed", "blockNumber", blockNumber, "error", err.Error(), "data", string(txReceiptsData))
		return nil, fmt.Errorf("JsonDecode txReceipts blockNumber:%d error: %w", blockNumber, err)
	}
	fetcher.txReceiptsData = txReceiptsData
	fetcher.txReceipts = txReceipts
	return txReceipts, nil
}

func (fetcher *BlockFetcher) fetchTxReceiptsByTxInfos(ctx context.Context, tvmBlock *TVMBlockSimple) ([]*TVMTxReceiptSimple, error) {
	// 为区块链查询创建 span，追踪查询时间
	fetchTxReceiptsByTxInfosSpanCtx, fetchTxReceiptsByTxInfosSpan := tracelog.StartSpan(ctx, "blockchain", "fetchTxReceiptsByTxInfos")
	defer fetchTxReceiptsByTxInfosSpan.End()

	tl := tracelog.NewWithContext(fetchTxReceiptsByTxInfosSpanCtx)
	blockNumber := tvmBlock.Number
	txHashes := lo.Map(tvmBlock.Transactions, func(tx *TVMTransactionSimple, i int) string {
		return tx.Hash
	})

	txHashBatchSize := 16
	goSize := len(txHashes) / txHashBatchSize
	if goSize < 1 {
		goSize = 1
	} else if goSize > 16 {
		goSize = 16
	}
	blockFetchPool := pool.NewWithResults[[]json.RawMessage]().
		WithErrors().
		WithContext(fetchTxReceiptsByTxInfosSpanCtx).
		WithMaxGoroutines(goSize)

	for _, batchTxHash := range utils.SplitSlice(txHashes, int64(txHashBatchSize)) {
		blockFetchPool.Go(func(ctx context.Context) ([]json.RawMessage, error) {
			return fetcher.tronClient.BatchGetTVMTransactionReceiptsRaw(ctx, batchTxHash)
		})
	}
	results, err := blockFetchPool.Wait()
	if err != nil {
		tl.Errorw("BatchGetTVMTransactionReceipts failed", "blockNumber", blockNumber, "txCount", len(txHashes), "error", err.Error())
		return nil, fmt.Errorf("BatchGetTVMTransactionReceiptsRaw txCount:%d blockNumber:%d error: %w", len(txHashes), blockNumber, err)
	}

	txReceiptsData := lo.Flatten(results)
	txReceipts := make([]*TVMTxReceiptSimple, len(txReceiptsData))
	txReceiptIndexMap := make(map[int]int64, len(txReceiptsData))
	//排序
	for i, txReceiptData := range txReceiptsData {
		txReceipt := &TVMTxReceiptSimple{}
		if err = utils.JsonDecode(txReceiptData, txReceipt); err != nil {
			tl.Errorw("JsonDecode tvmReceipt failed", "blockNumber", blockNumber, "error", err.Error(), "data", string(txReceiptData))
			return nil, fmt.Errorf("JsonDecode tvmReceipt blockNumber:%d error: %w", blockNumber, err)
		}
		txIndex, ok := new(big.Int).SetString(strings.TrimPrefix(txReceipt.TransactionIndex, "0x"), 16)
		if !ok {
			tl.Errorw("ParseInt tvmReceipt.TransactionIndex failed", "TransactionIndex", txReceipt.TransactionIndex, "blockNumber", blockNumber, "data", string(txReceiptData))
			return nil, fmt.Errorf("ParseInt tvmReceipt.TransactionIndex:%s failed", txReceipt.TransactionIndex)
		}
		txReceiptIndexMap[i] = txIndex.Int64()
		txReceipts[i] = txReceipt
	}

	// 创建索引切片并排序
	indices := make([]int, len(txReceiptsData))
	for i := range indices {
		indices[i] = i
	}
	sort.Slice(indices, func(p, q int) bool {
		return txReceiptIndexMap[indices[p]] < txReceiptIndexMap[indices[q]]
	})

	// 根据排序后的索引重新排列 txReceipts
	sortedTxReceipts := make([]*TVMTxReceiptSimple, len(txReceipts))
	sortedTxReceiptsData := make([]json.RawMessage, len(txReceiptsData))
	for newIdx, oldIdx := range indices {
		sortedTxReceiptsData[newIdx] = txReceiptsData[oldIdx]
		sortedTxReceipts[newIdx] = txReceipts[oldIdx]
	}
	txReceiptsTotalData, err := json.Marshal(sortedTxReceiptsData)
	if err != nil {
		return nil, fmt.Errorf("utils.JsonEncode sortedTxReceipts blockNumber:%d error: %w", blockNumber, err)
	}
	fetcher.txReceiptsData = txReceiptsTotalData
	fetcher.txReceipts = sortedTxReceipts
	return txReceipts, nil
}

func (fetcher *BlockFetcher) verifyTvmBlock(ctx context.Context, tvmBlock *TVMBlockSimple) error {
	verifyTvmBlockSpanCtx, verifyTvmBlockSpan := tracelog.StartSpan(ctx, "blockchain", "verifyTvmBlock")
	defer verifyTvmBlockSpan.End()
	tl := tracelog.NewWithContext(verifyTvmBlockSpanCtx)

	tronBlock := fetcher.tronBlock
	if !strings.EqualFold(tronBlock.BlockID, strings.TrimPrefix(tvmBlock.Hash, "0x")) {
		tl.Errorw("verifyTvmBlock tronBlock.BlockID not equal tvmBlock.Hash", "tronBlock.BlockID", tronBlock.BlockID, "tvmBlock.Hash", tvmBlock.Hash)
		return fmt.Errorf("tronBlock.BlockID:%s not equal tvmBlock.Hash:%s", tronBlock.BlockID, tvmBlock.Hash)
	}
	if len(tronBlock.Transactions) != len(tvmBlock.Transactions) {
		tl.Errorw("verifyTvmBlock tronBlock tx count not equal tvmBlock tx count", "tronBlock.Transactions", len(tronBlock.Transactions), "tvmBlock.Transactions", len(tvmBlock.Transactions))
		return fmt.Errorf("tronBlock tx count:%d not equal tvmBlock tx count:%d", len(tronBlock.Transactions), len(tvmBlock.Transactions))
	}
	return nil
}

func (fetcher *BlockFetcher) verifyTronTxInfos(ctx context.Context, tronTxInfos []*TronTransactionInfoSimple) error {
	verifyTronTxInfosSpanCtx, verifyTronTxInfosSpan := tracelog.StartSpan(ctx, "blockchain", "verifyTronTxInfos")
	defer verifyTronTxInfosSpan.End()
	tl := tracelog.NewWithContext(verifyTronTxInfosSpanCtx)
	tronBlock := fetcher.tronBlock
	if len(tronBlock.Transactions) != len(tronTxInfos) {
		tl.Errorw("verifyTronTxInfos tronBlock tx count not equal tronTxInfos count", "tronBlock.Transactions", len(tronBlock.Transactions), "tronTxInfos", len(tronTxInfos))
		return fmt.Errorf("tronBlock tx count:%d not equal tronTxInfos count:%d", len(tronBlock.Transactions), len(tronTxInfos))
	}
	return nil
}

func (fetcher *BlockFetcher) verifyTxReceipts(ctx context.Context, txReceipts []*TVMTxReceiptSimple) error {
	verifyTxReceiptsSpanCtx, verifyTxReceiptsSpan := tracelog.StartSpan(ctx, "blockchain", "verifyTxReceipts")
	defer verifyTxReceiptsSpan.End()
	tl := tracelog.NewWithContext(verifyTxReceiptsSpanCtx)
	tvmBlock := fetcher.tvmBlock
	if len(tvmBlock.Transactions) != len(txReceipts) {
		tl.Errorw("verifyTxReceipts tvmBlock tx count not equal txReceipts count", "tvmBlock.Transactions", len(tvmBlock.Transactions), "txReceipts", len(txReceipts))
		return fmt.Errorf("tvmBlock tx count:%d not equal txReceipts count:%d", len(tvmBlock.Transactions), len(txReceipts))
	}
	return nil
}

func (fetcher *BlockFetcher) verifyTxs(ctx context.Context) error {
	verifyTxsSpanCtx, verifyTxsSpan := tracelog.StartSpan(ctx, "blockchain", "verifyTxs")
	defer verifyTxsSpan.End()
	tl := tracelog.NewWithContext(verifyTxsSpanCtx)
	tronBlock := fetcher.tronBlock
	// tvmBlock := fetcher.tvmBlock
	txInfos := fetcher.tronTxInfos
	// txReceipts := fetcher.txReceipts
	for i, tronTx := range tronBlock.Transactions {
		// tvmTx := tvmBlock.Transactions[i]
		txInfo := txInfos[i]
		// txReceipt := txReceipts[i]
		if !strings.EqualFold(txInfo.Id, tronTx.TxID) {
			tl.Errorw("verifyTxs txInfo.Id not equal tronTx.TxID", "index", i, "txInfo.Id", txInfo.Id, "tronTx.TxID", tronTx.TxID)
			return fmt.Errorf("index:%d txInfo.Id:%s not equal tronTx.TxID:%s", i, txInfo.Id, tronTx.TxID)
		}
		// if !strings.EqualFold(tvmTx.Hash, txReceipt.TransactionHash) {
		// 	tl.Errorw("verifyTxs tvmTx.Hash not equal txReceipt.TransactionHash", "index", i, "tvmTx.Hash", tvmTx.Hash, "txReceipt.TransactionHash", txReceipt.TransactionHash)
		// 	return fmt.Errorf("index:%d tvmTx.Hash:%s not equal txReceipt.TransactionHash:%s", i, tvmTx.Hash, txReceipt.TransactionHash)
		// }
		// if !strings.EqualFold(strings.TrimPrefix(tvmTx.Hash, "0x"), txInfo.Id) {
		// 	tl.Errorw("verifyTxs tvmTx.Hash not equal txInfo.Id", "index", i, "tvmTx.Hash", tvmTx.Hash, "txInfo.Id", txInfo.Id)
		// 	return fmt.Errorf("index:%d tvmTx.Hash:%s not equal txInfo.Id:%s", i, tvmTx.Hash, txInfo.Id)
		// }
		// if !strings.EqualFold(txReceipt.TransactionHash, tvmTx.Hash) {
		// 	tl.Errorw("verifyTxs txReceipt.TransactionHash not equal tvmTx.Hash", "index", i, "txReceipt.TransactionHash", txReceipt.TransactionHash, "tvmTx.Hash", tvmTx.Hash)
		// 	return fmt.Errorf("index:%d txReceipt.TransactionHash:%s not equal tvmTx.Hash:%s", i, txReceipt.TransactionHash, tvmTx.Hash)
		// }
	}
	return nil
}

func (fetcher *BlockFetcher) getBlockInfoData(blockNumber uint64) *tronclient.TronBlockInfo {
	return &tronclient.TronBlockInfo{
		BlockNumber: blockNumber,
		TronBlock:   fetcher.tronBlockData,
		TronTxInfos: fetcher.tronTxInfosData,
		TVMBlock:    fetcher.tvmBlockData,
		TVMReceipts: fetcher.txReceiptsData,
	}
}
