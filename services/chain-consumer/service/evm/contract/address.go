package contract

import (
	"github.com/samber/lo"
)

// ContractKind 标识一条日志来源于哪个 OddFi 合约。
// 由 EVMService 启动时根据配置的合约地址构建白名单，按 log.Address 路由到对应 parser。
type ContractKind uint8

const (
	ContractNone ContractKind = iota
	ContractBettingPool
	ContractStakingPool
	ContractLiquidityPool
	ContractODDToken
)

func (k ContractKind) String() string {
	switch k {
	case ContractBettingPool:
		return "BettingPool"
	case ContractStakingPool:
		return "StakingPool"
	case ContractLiquidityPool:
		return "LiquidityPool"
	case ContractODDToken:
		return "ODDToken"
	default:
		return "None"
	}
}

const (
	NullAddress  = "0x0000000000000000000000000000000000000000"
	DeadAddress1 = "0x000000000000000000000000000000000000dead"
	DeadAddress2 = "0x1111111111111111111111111111111111111111"
)

const (
	GMGNReceiver              = "0xb8159ba378904f803639d274cec79f788931c9c8"
	GmgnTradeContant          = "0x1de460f363AF910f51726DEf188F9004276Bf4bc"
	GMGNBatchTransferContract = "0xd0afd22c2bddf7131595c9d9a125be60c76ebad4"
	PADREReceiver             = "0x2b0a28a0a9197f8af5d1b8371c048e92dd78b640"
	AXIOMTradeContract        = "0xaaaaaaaaaac9630b35e6d485f57abd93ad3d2930"
	AXIOMReceiver             = "0xc5c5c6d885287e9aa4cc54214d4ff33709a08636"
)

func NullAddresses() []string {
	return []string{
		NullAddress, DeadAddress1, DeadAddress2,
	}
}

func IsNullAddresses(address string) bool {
	return lo.Contains(NullAddresses(), address)
}

// eth
const (
	WETHAddressInETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
	USDTAddressInETH = "0xdac17f958d2ee523a2206206994597c13d831ec7"
	USDCAddressInETH = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
	DAIAddressInETH  = "0x6b175474e89094c44da98b954eedeac495271d0f"
)
