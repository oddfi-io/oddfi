package withdrawal

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"oddfi-cron-job/internal/contract/distribute"
	"oddfi-cron-job/internal/contract/erc20"
	"oddfi-cron-job/internal/logger"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

// Multicall3 contract address (universal for all EVM chains)
const Multicall3Address = "0xcA11bde05977b3631167028862bE2a173976CA11"

// Multicall3 ABI
const multicall3ABI = `[{"inputs":[{"components":[{"name":"target","type":"address"},{"name":"allowFailure","type":"bool"},{"name":"callData","type":"bytes"}],"name":"calls","type":"tuple[]"}],"name":"aggregate3","outputs":[{"components":[{"name":"success","type":"bool"},{"name":"returnData","type":"bytes"}],"name":"returnData","type":"tuple[]"}],"stateMutability":"payable","type":"function"}]`

// ERC20 ABI (transfer method only)
const erc20ABI = `[{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]`

// GasConfig Gas configuration
type GasConfig struct {
	MaxFeePerGas    *big.Int // max fee per gas
	MaxPriorityFee  *big.Int // priority fee tip
	GasLimitPerCall uint64   // gas limit per call
	Multiplicator   float64  // gas limit multiplier for buffer
}

// Transfer 单笔转账
type Transfer struct {
	OrderSn    string         // 业务流水
	To         common.Address // 接收者地址
	RealAmount *big.Int       // 转账金额
}

// DefaultGasConfig returns default gas config for BSC chain
func DefaultGasConfig() *GasConfig {
	return &GasConfig{
		MaxFeePerGas:    nil,             // nil means auto-fetch from network
		MaxPriorityFee:  big.NewInt(2e9), // 2 Gwei tip
		GasLimitPerCall: 65000,           // ~65K gas per transfer
		Multiplicator:   1.2,             // 20% buffer
	}
}

// BatchTransferReq batch transfer request
type BatchTransferReq struct {
	TokenAddress              common.Address // token contract address
	Transfers                 []Transfer     // 转账配对列表
	PrivateKeyHex             string         // sender private key (hex)
	GasConfig                 *GasConfig     // gas config (optional, uses default if nil)
	DistributeContractAddress common.Address // 分发合约地址
}

// BatchTransferResult batch transfer result
type BatchTransferResult struct {
	TxHash            common.Hash    // transaction hash
	GasUsed           uint64         // actual gas used
	EffectiveGasPrice *big.Int       // effective gas price
	TotalFees         *big.Int       // total fees (GasUsed * EffectiveGasPrice)
	TxReceipt         *types.Receipt // transaction receipt
	Orders            []string       // all success orders
}

type Erc20TransferInfo struct {
	ToAddress common.Address  // token address
	Amount    decimal.Decimal // amount (human-readable, divided by 10^dec)
	AmountWei decimal.Decimal // amount in wei (unscaled)
	Success   bool            // success status
	TxId      string
}

// BatchTransferWithDistribute 使用 TokenDistributor 合约批量分发
func BatchTransferWithDistribute(ctx context.Context, client *ethclient.Client, req *BatchTransferReq) (*BatchTransferResult, error) {
	// 1. 创建合约实例
	distributeContract, err := distribute.NewDis(req.DistributeContractAddress, client)
	if err != nil {
		return nil, err
	}

	// 2. 获取 sender 地址
	privateKey, err := crypto.HexToECDSA(req.PrivateKeyHex)
	if err != nil {
		return nil, err
	}
	sender := crypto.PubkeyToAddress(privateKey.PublicKey)

	// 3. 从 Transfers 提取 recipients 和 amounts
	recipients := make([]common.Address, len(req.Transfers))
	amounts := make([]*big.Int, len(req.Transfers))
	for i, t := range req.Transfers {
		recipients[i] = t.To
		amounts[i] = t.RealAmount
	}

	// 4. 动态计算 gas（使用链上 EstimateGas）
	disAbi, err := abi.JSON(strings.NewReader(distribute.DisABI))
	if err != nil {
		return nil, fmt.Errorf("parse distribute ABI failed: %w", err)
	}
	callData, err := disAbi.Pack("batchDistribute", req.TokenAddress, recipients, amounts)
	if err != nil {
		return nil, fmt.Errorf("pack batchDistribute failed: %w", err)
	}

	distributeAddr := req.DistributeContractAddress
	gasEstimate, err := client.EstimateGas(ctx, ethereum.CallMsg{
		From: sender,
		To:   &distributeAddr,
		Data: callData,
	})
	if err != nil {
		gasEstimate = uint64(65000 * len(req.Transfers))
		logger.Warnf("EstimateGas failed, use fallback gas: %d, error: %v", gasEstimate, err)
	} else {
		gasEstimate = uint64(float64(gasEstimate) * 1.2)
	}

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		gasPrice = big.NewInt(5e9)
		logger.Warnf("SuggestGasPrice failed, use fallback gas price: %s", gasPrice.String())
	}

	// 5. 构建 transact options
	chainID, err := client.NetworkID(ctx)
	if err != nil {
		return nil, fmt.Errorf("get network ID failed: %w", err)
	}
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return nil, fmt.Errorf("create transact options failed: %w", err)
	}
	auth.GasLimit = gasEstimate
	auth.GasPrice = gasPrice

	// 6. 调用 batchDistribute
	tx, err := distributeContract.BatchDistribute(auth, req.TokenAddress, recipients, amounts)
	if err != nil {
		return nil, fmt.Errorf("batchDistribute failed: %w", err)
	}

	logger.Infof("BatchTransferWithDistribute tx sent: %s, gasLimit: %d, gasPrice: %s", tx.Hash().Hex(), gasEstimate, gasPrice.String())

	// 7. 等待 Receipt
	receipt, err := waitForReceipt(ctx, client, tx.Hash())
	if err != nil {
		return nil, fmt.Errorf("wait for receipt failed: %w", err)
	}

	return &BatchTransferResult{
		TxHash:            tx.Hash(),
		GasUsed:           receipt.GasUsed,
		EffectiveGasPrice: receipt.EffectiveGasPrice,
		TotalFees:         new(big.Int).Mul(big.NewInt(int64(receipt.GasUsed)), receipt.EffectiveGasPrice),
		TxReceipt:         receipt,
		Orders: lo.Map(req.Transfers, func(item Transfer, _ int) string {
			return item.OrderSn
		}),
	}, nil
}

func Erc20ReceiptToInfo(ctx context.Context, receipt types.Receipt, tokenAddress common.Address, tokenDec int) ([]Erc20TransferInfo, error) {
	res := make([]Erc20TransferInfo, 0)
	erc20parser, err := erc20.NewERC20Filterer(common.HexToAddress(""), nil)
	if err != nil {
		panic(fmt.Errorf("failed to new erc20 parser, error: %v", err))
	}

	for _, item := range receipt.Logs {
		if item == nil {
			continue
		}
		_item := lo.FromPtr(item)
		transfer, err := erc20parser.ParseTransfer(_item)
		if err == nil &&
			transfer != nil &&
			!IsNullAddresses(transfer.To.String()) &&
			strings.EqualFold(strings.ToLower(_item.Address.String()), tokenAddress.String()) {

			logger.Infof("find target token transfer, from:%s, to:%s, value:%s, hash:%s",
				transfer.From.String(), transfer.To.String(), transfer.Value.String(), _item.TxHash.String(),
			)

			res = append(res, Erc20TransferInfo{
				ToAddress: transfer.To,
				Amount:    decimal.NewFromBigInt(transfer.Value, int32(-tokenDec)),
				AmountWei: decimal.NewFromBigInt(transfer.Value, 0),
				Success:   true,
				TxId:      receipt.TxHash.String(),
			})
		}
	}
	return res, nil
}

// calculateDynamicGas dynamically calculate gas limit and price
func calculateDynamicGas(ctx context.Context, client *ethclient.Client, cfg *GasConfig, callCount int) (gasLimit uint64, gasPrice *big.Int, err error) {
	// BSC uses Legacy transaction type (no EIP-1559)
	if cfg.MaxFeePerGas != nil {
		gasPrice = cfg.MaxFeePerGas
	} else {
		// Fetch real-time gas price from network
		suggestedPrice, err := client.SuggestGasPrice(ctx)
		if err != nil {
			// Fallback: use default 5 Gwei
			gasPrice = big.NewInt(5e9)
		} else {
			gasPrice = suggestedPrice
		}
	}

	// Calculate gas limit based on call count
	// Each ERC20 transfer costs approximately 65K gas
	gasLimit = uint64(float64(cfg.GasLimitPerCall*uint64(callCount)) * cfg.Multiplicator)

	return gasLimit, gasPrice, nil
}

// GetCallCount returns the number of calls from the batch request
// This is used to calculate gas limit dynamically
func GetCallCount(transfers []Transfer) int {
	return len(transfers)
}

// EstimateGas estimates gas for a call
func EstimateGas(ctx context.Context, client *ethclient.Client, from, to common.Address, data []byte) (uint64, error) {
	msg := ethereum.CallMsg{
		From: from,
		To:   &to,
		Data: data,
	}
	return client.EstimateGas(ctx, msg)
}

// GetSuggestedGasPrice gets suggested gas price from network
func GetSuggestedGasPrice(ctx context.Context, client *ethclient.Client) (*big.Int, error) {
	return client.SuggestGasPrice(ctx)
}

// waitForReceipt waits for transaction confirmation
func waitForReceipt(ctx context.Context, client *ethclient.Client, txHash common.Hash) (*types.Receipt, error) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
			receipt, err := client.TransactionReceipt(ctx, txHash)
			if err == nil {
				return receipt, nil
			}
		}
	}
}

// GetTokenBalance queries token balance
func GetTokenBalance(ctx context.Context, client *ethclient.Client, tokenAddress, account common.Address) (*big.Int, error) {
	erc20Abi, err := abi.JSON(strings.NewReader(erc20ABI))
	if err != nil {
		return nil, err
	}

	data, err := erc20Abi.Pack("balanceOf", account)
	if err != nil {
		return nil, err
	}

	msg := ethereum.CallMsg{
		To:   &tokenAddress,
		Data: data,
	}

	result, err := client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, err
	}

	values, err := erc20Abi.Unpack("balanceOf", result)
	if err != nil {
		return nil, err
	}
	return values[0].(*big.Int), nil
}

// FormatGweiToWei converts Gwei to Wei
func FormatGweiToWei(gwei int64) *big.Int {
	return big.NewInt(gwei * 1e9)
}
