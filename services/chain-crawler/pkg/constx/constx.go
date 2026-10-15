package constx

import (
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

const (
	ServiceWeb3Trade = "web3-trade"
	ServiceWeb3Token = "web3-token"
)

const (
	SIDE_BUY  = "buy"
	SIDE_SELL = "sell"
)

const (
	ChainTypeEthereum = "ethereum"
	ChainTypeSolana   = "solana"
	ChainTypeAptos    = "aptos"
	ChainTypeTon      = "ton"
)

const (
	CHAIN_ETHEREUM  = "eth"
	CHAIN_ARBITRUM  = "arbitrum"
	CHAIN_BSC       = "bsc"
	CHAIN_OP        = "optimism"
	CHAIN_ZK        = "zksync"
	CHAIN_POLYGON   = "polygon"
	CHAIN_BASE      = "base"
	CHAIN_LINEA     = "linea"
	CHAIN_AVALANCHE = "avalanche"
	CHAIN_FANTOM    = "fantom"
	CHAIN_GATE      = "gate"
	CHAIN_MERLIN    = "merlin"
	CHAIN_BLAST     = "blast"
	CHAIN_SOLANA    = "solana"
	CHAIN_BITCOIN   = "bitcoin"
	CHAIN_STARKNET  = "starknet"
	CHAIN_MANTLE    = "mantle"
	CHAIN_XLAYER    = "xlayer"
	CHAIN_MODE      = "mode"
	CHAIN_MANTA     = "manta"
	CHAIN_SCROLL    = "scroll"
	CHAIN_ZKEVM     = "zkevm"
	CHAIN_TRON      = "tron"
	CHAIN_OKTC      = "oktc"
	CHAIN_CRONOS    = "cronos"
	CHAIN_APTOS     = "aptos"
	CHAIN_CONFLUX   = "conflux"
	CHAIN_ETHW      = "ethw"
	CHAIN_STACKS    = "stacks"
	CHAIN_ZETA      = "zeta"
	CHAIN_METIS     = "metis"
	CHAIN_SUI       = "sui"
	CHAIN_TON       = "ton"
)

const (
	CHAIN_ID_SOLANA = 501
	CHAIN_ID_SUI    = 784
	CHAIN_ID_GATE   = 86
	CHAIN_ID_TON    = 607
)

const (
	DEX_UNISWAP_V2     = "uniswap_v2"
	DEX_UNISWAP_V3     = "uniswap_v3"
	DEX_CAMELOT        = "camelot"
	DEX_CAMELOT_V3     = "camelot_v3"
	DEX_PANCAKE_V2     = "pancake_v2"
	DEX_PANCAKE_V3     = "pancake_v3"
	DEX_TRADERJOE      = "traderjoe"
	DEX_TRADERJOE_V2P1 = "traderjoe_v2_1"
	DEX_MUTE           = "mute_v3"
	DEX_VELODROME      = "velodrome"
	DEX_VELODROME_V2   = "velodrome_v2"
	DEX_SYNCSWAP       = "syncswap_v2"
	DEX_QUICKSWAP      = "quickswap"
	DEX_QUICKSWAP_V3   = "quickswap_v3"
	DEX_BASESWAP       = "baseswap"
	DEX_SWAPBASED      = "swapbased"
	DEX_SUSHISWAP_V3   = "sushiswap_v3"
	DEX_BALANCER       = "balancer"
	DEX_KYBERSWAP_V2   = "kyberswap_v2"
	DEX_SUSHISWAP_V2   = "sushiswap_v2"
	DEX_ZYBERSWAP_V2   = "zyberswap_v2"
	DEX_ZYBERSWAP_V3   = "zyberswap_v3"
	DEX_PANGOLIN_V2    = "pangolin_v2"
	DEX_SPIRITSWAP     = "spiritswap"
	DEX_SPOOKYSWAP     = "spookyswap_v2"
	DEX_BISWAP_V2      = "biswap_v2"
	DEX_MERLINSWAP     = "merlinswap"
	DEX_THRUSTER_V2    = "thruster_v2"
	DEX_THRUSTER_V3    = "thruster_v3"
	DEX_MONOSWAP_V3    = "monoswap_v3"
	DEX_MONOSWAP_V2    = "monoswap_v2"
	DEX_BLASTER        = "blaster"
	DEX_RAYDIUM_AMM    = "raydium_amm"
	DEX_RAYDIUM_CLMM   = "raydium_clmm"
	DEX_RAYDIUM_CPMM   = "raydium_cpmm"
	DEX_FLUXBEAM       = "fluxbeam"
	DEX_METEORA_DYN    = "meteora_dyn"
	DEX_METEORA_DLMM   = "meteora_dlmm"
	DEX_ORCA           = "orca"
	DEX_PUMPFUN        = "pumpfun"
	DEX_MOONSHOT       = "moonshot"
	DEX_TINYSPL        = "tinyspl"
	DEX_FLOWX          = "flowX"
	DEX_TURBOS         = "turbos"
	DEX_BLUEMOVE       = "bluemove"
	DEX_CETUS          = "cetus"
	DEX_EQUALIZER      = "equalizer"
	DEX_WIGOSWAP       = "wigoswap"
	DEX_BEETHOVENX     = "beethovenx"
	DEX_DEDUST         = "dedust"
	DEX_STONFI         = "stonfi"
)

const (
	MIN_VOLUME       = 0.001
	NATIVE_COIN_ADDR = "0x0000000000000000000000000000000000000000"
)

const (
	ERR_MSG_CHECK_SIGN   = "check signature error"
	ERR_MSG_SIGN_EXPIRED = "signature expired"
)

const SWAP_CHAINS_INFO = `[
    {
        "chainId": 1,
        "chainName": "Ethereum",
        "wrappedTokenAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "usdtTokenAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "usdcTokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    },{
        "chainId": 56,
        "chainName": "BscChain",
        "wrappedTokenAddress": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "usdtTokenAddress": "0x55d398326f99059fF775485246999027B3197955",
        "usdcTokenAddress": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
    },{
        "chainId": 137,
        "chainName": "Polygon",
        "wrappedTokenAddress": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        "usdtTokenAddress": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        "usdcTokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
    },{
        "chainId": 42161,
        "chainName": "Arbitrum",
        "wrappedTokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        "usdtTokenAddress": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        "usdcTokenAddress": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
    },{
        "chainId": 10,
        "chainName": "Optimism",
        "wrappedTokenAddress": "0x4200000000000000000000000000000000000006",
        "usdtTokenAddress": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
        "usdcTokenAddress": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607"
    },{
        "chainId": 324,
        "chainName": "ZkSync",
        "wrappedTokenAddress": "0x5aea5775959fbc2557cc8789bc1bf90a239d9a91",
        "usdtTokenAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "usdcTokenAddress": "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4"
    },{
        "chainId": 43114,
        "chainName": "Avalanche",
        "wrappedTokenAddress": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        "usdtTokenAddress": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
        "usdcTokenAddress": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
    },{
        "chainId": 250,
        "chainName": "Fantom",
        "wrappedTokenAddress": "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83",
        "usdtTokenAddress": "0x049d68029688eAbF473097a2fC38ef61633A3C7A",
        "usdcTokenAddress": "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75"
    },{
        "chainId": 501,
        "chainName": "Solana",
        "wrappedTokenAddress": "So11111111111111111111111111111111111111112",
        "usdtTokenAddress": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "usdcTokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    },{
        "chainId": 4200,
        "chainName": "Merlin",
        "wrappedTokenAddress": "0xF6D226f9Dc15d9bB51182815b320D3fBE324e1bA",
        "usdtTokenAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "usdcTokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    },{
        "chainId": 8453,
        "chainName": "Base",
        "wrappedTokenAddress": "0x4200000000000000000000000000000000000006",
        "usdtTokenAddress": "",
        "usdcTokenAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    },{
        "chainId": 81457,
        "chainName": "Blast",
        "wrappedTokenAddress": "0x4300000000000000000000000000000000000004",
        "usdtTokenAddress": "",
        "usdcTokenAddress": ""
    },{
        "chainId": 784,
        "chainName": "Sui",
        "wrappedTokenAddress": "0x2::sui::SUI",
        "usdtTokenAddress": "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN",
        "usdcTokenAddress": "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"
    },{
        "chainId": 607,
        "chainName": "Ton",
        "wrappedTokenAddress": "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        "usdtTokenAddress": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        "usdcTokenAddress": ""
    },{
        "chainId": 195,
        "chainName": "Tron",
        "wrappedTokenAddress": "TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR",
        "usdtTokenAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "usdcTokenAddress": "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8"
    }
]`

var EmptyAddress = common.HexToAddress("0x0000000000000000000000000000000000000000")

var (
	WSOL        = "So11111111111111111111111111111111111111112"
	SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
	SOLANA_USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
)

type WalletTag int

func (s WalletTag) Name() string {
	m := map[WalletTag]string{
		WalletTagsKOL:        "kol",
		WalletTagsSmartMoney: "smart_money",
	}
	return m[s]
}

func GetSmartMoneyTag(tagName string) WalletTag {
	tagName = strings.Trim(tagName, " ")
	m := map[string]WalletTag{
		"kol":         WalletTagsKOL,
		"kol_vc":      WalletTagsKOL,
		"KOL_VC":      WalletTagsKOL,
		"smart_money": WalletTagsSmartMoney,
	}
	return m[tagName]
}

func (t TokenWalletTag) Name() string {
	m := map[TokenWalletTag]string{
		TokenWalletInsiderTag: "insider",
		TokenWalletDevTag:     "dev",
	}
	return m[t]
}

func GetTokenWalletTag(tagName string) TokenWalletTag {
	tagName = strings.Trim(tagName, " ")
	m := map[string]TokenWalletTag{
		"insider": TokenWalletInsiderTag,
		"dev":     TokenWalletDevTag,
	}
	return m[tagName]
}

const (
	WalletTagsKOL        WalletTag = 1
	WalletTagsSmartMoney WalletTag = 1 << 1
)

type TokenWalletTag int

const (
	TokenWalletInsiderTag TokenWalletTag = 1      // 老鼠仓
	TokenWalletDevTag     TokenWalletTag = 1 << 1 // 开发者持仓
)

const (
	INSIDER      = "insider"
	DEV          = "dev"
	KOL          = "kol"
	SMART_MONEY  = "smart_money"
	FOLLOWS      = "follows"
	NEW_MONEY    = "new_money"
	WHALE        = "whale"
	SNIPER       = "sniper"
	EARLY_BUYERS = "early_buyers"
)

type AddressType int
type PositionActionType int
type ChainType string
