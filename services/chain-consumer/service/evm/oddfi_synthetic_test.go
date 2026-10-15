package evm

import (
	"chain-consumer/service/evm/contract"
	"encoding/json"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 用当前 ABI 合成事件日志，确定性地验证解析/映射（不依赖网络与部署版本）。
// 弥补 testnet 部署版本早于源码、结算事件签名漂移导致 MarketSettled 无法用真实 tx 验证的问题。

var syntheticBettingABI = func() abi.ABI {
	a, err := abi.JSON(strings.NewReader(contract.BettingPoolMetaData.ABI))
	if err != nil {
		panic(err)
	}
	return a
}()

// packLog 用 ABI 把 indexed topics + 非 indexed 参数打包成一条 types.Log。
func packLog(t *testing.T, addr string, eventName string, topics []eth_common.Hash, nonIndexed ...any) types.Log {
	ev, ok := syntheticBettingABI.Events[eventName]
	require.True(t, ok, "event %s in ABI", eventName)
	data, err := ev.Inputs.NonIndexed().Pack(nonIndexed...)
	require.NoError(t, err, "pack non-indexed for %s", eventName)
	allTopics := append([]eth_common.Hash{ev.ID}, topics...)
	return types.Log{
		Address:     eth_common.HexToAddress(addr),
		Topics:      allTopics,
		Data:        data,
		BlockNumber: 109516290,
		TxHash:      eth_common.HexToHash("0x" + strings.Repeat("ab", 32)),
		BlockHash:   eth_common.HexToHash("0x" + strings.Repeat("cd", 32)),
		Index:       7,
	}
}

func TestParseOddFiSyntheticLogs(t *testing.T) {
	svc := newOddfiTestService(t)
	meta := newLogMeta(types.Log{
		Address:   eth_common.HexToAddress(oddfiTestBettingPool),
		TxHash:    eth_common.HexToHash("0x" + strings.Repeat("ab", 32)),
		BlockHash: eth_common.HexToHash("0x" + strings.Repeat("cd", 32)),
		Index:     7,
	}, oddfiTestChainID, "0x7501bCBFAAa99e6390577277D051A32ec2e64064", time.Unix(1779725375, 0).UTC())

	marketID := [32]byte{0x11, 0x22}

	t.Run("MarketSettlementFinalized→admin BUSINESS_OPS", func(t *testing.T) {
		// MarketSettlementFinalized(bytes32 indexed marketId, uint8 resultKind, bool scoreSettled,
		//   uint16 homeScore, uint16 awayScore, uint256 grossPayout, uint256 lpMarginShare,
		//   uint256 platformMarginShare, uint256 quoteVersion)
		lg := packLog(t, oddfiTestBettingPool, "MarketSettlementFinalized",
			[]eth_common.Hash{eth_common.BytesToHash(marketID[:])},
			uint8(0), true, uint16(1), uint16(0),
			big.NewInt(200), big.NewInt(30), big.NewInt(10), big.NewInt(5),
		)
		row := svc.parseAdminAction(lg, contract.ContractBettingPool, meta)
		require.NotNil(t, row)
		assert.Equal(t, "MarketSettlementFinalized", row.EventName)
		assert.Equal(t, "BUSINESS_OPS", row.Category)
		assert.Equal(t, meta.txFrom, row.Operator, "operator=tx.from")
		// params 必须是合法 JSON、大整数为字符串、可回读
		assert.Contains(t, row.Params, `"scoreSettled":true`)
		assert.Contains(t, row.Params, `"homeScore":1`)
		assert.Contains(t, row.Params, `"grossPayout":"200"`)
		assertParamsRoundTrip(t, row.Params)
	})

	t.Run("MarketSettlementScoreBatchProcessed→admin BUSINESS_OPS", func(t *testing.T) {
		lg := packLog(t, oddfiTestBettingPool, "MarketSettlementScoreBatchProcessed",
			[]eth_common.Hash{eth_common.BytesToHash(marketID[:])},
			uint16(1), uint16(0), big.NewInt(1), big.NewInt(1),
		)
		row := svc.parseAdminAction(lg, contract.ContractBettingPool, meta)
		require.NotNil(t, row)
		assert.Equal(t, "MarketSettlementScoreBatchProcessed", row.EventName)
		assert.Equal(t, "BUSINESS_OPS", row.Category)
		assert.Contains(t, row.Params, `"processedCount":"1"`)
		assertParamsRoundTrip(t, row.Params)
	})

	t.Run("PlatformReserveUpdated reason==0 入库 / reason!=0 过滤", func(t *testing.T) {
		// PlatformReserveUpdated(int256 delta, uint256 newBalance, uint8 reason) —— 全非 indexed
		mk := func(reason uint8) types.Log {
			return packLog(t, oddfiTestBettingPool, "PlatformReserveUpdated", nil,
				big.NewInt(-100), big.NewInt(900), reason)
		}
		// reason=0 管理员注资 → 入库
		row0 := svc.parseAdminAction(mk(0), contract.ContractBettingPool, meta)
		require.NotNil(t, row0, "reason==0 should be recorded")
		assert.Equal(t, "PlatformReserveUpdated", row0.EventName)
		assert.Contains(t, row0.Params, `"delta":"-100"`)
		assertParamsRoundTrip(t, row0.Params)
		// reason=1 结算副产物 → 过滤
		row1 := svc.parseAdminAction(mk(1), contract.ContractBettingPool, meta)
		assert.Nil(t, row1, "reason!=0 must be filtered out")
	})

	t.Run("RoleGranted→admin ROLE + role/target/可读名", func(t *testing.T) {
		// RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
		operatorRole := syntheticKeccakRole("OPERATOR_ROLE")
		account := eth_common.HexToAddress("0x46F00168097De28a2c436540C93db16914601d6d")
		sender := eth_common.HexToAddress("0x7501bCBFAAa99e6390577277D051A32ec2e64064")
		lg := packLog(t, oddfiTestBettingPool, "RoleGranted",
			[]eth_common.Hash{operatorRole, eth_common.BytesToHash(account.Bytes()), eth_common.BytesToHash(sender.Bytes())},
		)
		row := svc.parseAdminAction(lg, contract.ContractBettingPool, meta)
		require.NotNil(t, row)
		assert.Equal(t, "RoleGranted", row.EventName)
		assert.Equal(t, "ROLE", row.Category)
		require.NotNil(t, row.Role)
		assert.Equal(t, strings.ToLower(operatorRole.Hex()), *row.Role)
		require.NotNil(t, row.TargetAddress)
		assert.Equal(t, strings.ToLower(account.Hex()), *row.TargetAddress)
		assert.Equal(t, strings.ToLower(sender.Hex()), row.Operator, "operator=sender")
		assert.Contains(t, row.Params, `"roleName":"OPERATOR_ROLE"`)
		assertParamsRoundTrip(t, row.Params)
	})
}

func syntheticKeccakRole(name string) eth_common.Hash {
	return crypto.Keccak256Hash([]byte(name))
}

// assertParamsRoundTrip 验证 params/extra 列的 JSON 能被无损读回（用户关心：写入后读取不出错）。
// 解析成 map[string]any 必须成功，且大整数字段读回是字符串（不是会丢精度的 number）。
func assertParamsRoundTrip(t *testing.T, jsonText string) {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(jsonText), &m), "params must be valid JSON and re-readable: %s", jsonText)
}
