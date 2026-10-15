package consts

import "github.com/samber/lo"

type Chain string

const (
	CHAIN_UNKONW        Chain = "unkonw"
	CHAIN_ETHEREUM      Chain = "eth"
	CHAIN_ARBITRUM      Chain = "arbitrum"
	CHAIN_BSC           Chain = "bsc"
	CHAIN_OP            Chain = "optimism"
	CHAIN_ZK            Chain = "zksync"
	CHAIN_POLYGON       Chain = "polygon"
	CHAIN_BASE          Chain = "base"
	CHAIN_LINEA         Chain = "linea"
	CHAIN_AVALANCHE     Chain = "avalanche"
	CHAIN_FANTOM        Chain = "fantom"
	CHAIN_GATE          Chain = "gatechain"
	CHAIN_GTEVM         Chain = "gatechain_evm"
	CHAIN_MERLIN        Chain = "merlin"
	CHAIN_BLAST         Chain = "blast"
	CHAIN_SOLANA        Chain = "solana"
	CHAIN_BITCOIN       Chain = "bitcoin"
	CHAIN_MANTLE        Chain = "mantle"
	CHAIN_XLAYER        Chain = "xlayer"
	CHAIN_MODE          Chain = "mode"
	CHAIN_MANTA         Chain = "manta"
	CHAIN_SCROLL        Chain = "scroll"
	CHAIN_TRON          Chain = "tron"
	CHAIN_CRONOS        Chain = "cronos"
	CHAIN_APTOS         Chain = "aptos"
	CHAIN_CONFLUX       Chain = "conflux"
	CHAIN_ETHW          Chain = "ethw"
	CHAIN_ZETA          Chain = "zeta"
	CHAIN_METIS         Chain = "metis"
	CHAIN_SUI           Chain = "sui"
	CHAIN_TON           Chain = "ton"
	CHAIN_OPBNB         Chain = "opbnb"
	CHAIN_POLYGONZKEVM  Chain = "polygonzkevm"
	CHAIN_BITLAYER      Chain = "bitlayer"
	CHAIN_BOB           Chain = "bob"
	CHAIN_KAIA          Chain = "kaia"
	CHAIN_SEIEVM        Chain = "seievm"
	CHAIN_PULSECHAIN    Chain = "pulsechain"
	CHAIN_BSQUARED      Chain = "bsquared"
	CHAIN_CELO          Chain = "celo"
	CHAIN_BOUNCEBIT     Chain = "bouncebit"
	CHAIN_ZKFAIR        Chain = "zkfair"
	CHAIN_KROMA         Chain = "kroma"
	CHAIN_KAVA          Chain = "kava"
	CHAIN_CORE          Chain = "core"
	CHAIN_ETC           Chain = "etc"
	CHAIN_FLARE         Chain = "flare"
	CHAIN_APECHAIN      Chain = "apechain"
	CHAIN_RONIN         Chain = "ronin"
	CHAIN_AURORA        Chain = "aurora"
	CHAIN_ROOTSTOCK     Chain = "rootstock"
	CHAIN_DEGEN         Chain = "degen"
	CHAIN_IOTEX         Chain = "iotex"
	CHAIN_ASTAR         Chain = "astar"
	CHAIN_BOBA          Chain = "boba"
	CHAIN_CHILIZ        Chain = "chiliz"
	CHAIN_ARTHERA       Chain = "arthera"
	CHAIN_TAIKO         Chain = "taiko"
	CHAIN_MOONBEAM      Chain = "moonbeam"
	CHAIN_ACALA         Chain = "acala"
	CHAIN_HARMONY       Chain = "harmony"
	CHAIN_FILECOIN      Chain = "filecoin"
	CHAIN_TELOS         Chain = "telos"
	CHAIN_MANDE         Chain = "mande"
	CHAIN_MOONRIVER     Chain = "moonriver"
	CHAIN_CELESTIA      Chain = "celestia"
	CHAIN_CKB           Chain = "ckb"
	CHAIN_FB            Chain = "fb" // Fractal Bitcoin
	CHAIN_ARB_NOVA      Chain = "arbitrum_nova"
	CHAIN_BEVM          Chain = "bevm"
	CHAIN_ZORA          Chain = "zora"
	CHAIN_STEP          Chain = "step"
	CHAIN_GNOSIS        Chain = "gnosis"
	CHAIN_IMX           Chain = "immutable"
	CHAIN_ZK_NOVA       Chain = "zklink"
	CHAIN_FUSE          Chain = "fuse"
	CHAIN_KCC           Chain = "kcc"
	CHAIN_NEON          Chain = "neon"
	CHAIN_MAP           Chain = "map"
	CHAIN_ELA           Chain = "elastos"
	CHAIN_VIZING        Chain = "vizing"
	CHAIN_ALIENX        Chain = "alienx"
	CHAIN_COINEX        Chain = "coinex"
	CHAIN_SBCH          Chain = "smartbch"
	CHAIN_VLX           Chain = "velas"
	CHAIN_SHIDENEVM     Chain = "shiden"
	CHAIN_GRAVITY_ALPHA Chain = "gravity"
	CHAIN_NAXION        Chain = "naxion"
	CHAIN_BITCOIN_CASH  Chain = "bch"
	CHAIN_EOS           Chain = "eos_evm"
	CHAIN_DOGECHAINEVM  Chain = "doge_evm"
	CHAIN_OKTC          Chain = "oktc"
	CHAIN_WEMIX         Chain = "wemix"
	CHAIN_VICTION       Chain = "viction"
	CHAIN_EWT           Chain = "ewt"
	CHAIN_WANCHAIN      Chain = "wanchain"
	CHAIN_KARDIACHAIN   Chain = "kardia"
	CHAIN_INEVM         Chain = "inEVM"
	CHAIN_KARURA        Chain = "karura"
	CHAIN_MIXMAX        Chain = "mixmax"
	CHAIN_LITECOIN      Chain = "ltc"
	CHAIN_MARO          Chain = "maro"
	CHAIN_DIS           Chain = "ethf"
	CHAIN_LIGHT         Chain = "lightlink"
	CHAIN_CALLISTO      Chain = "callisto"
	CHAIN_NEOX          Chain = "neox"
	CHAIN_OCTA          Chain = "octa"
	CHAIN_BITWAVE       Chain = "btcw"
	CHAIN_BLACKFORT     Chain = "bxn"
	CHAIN_DARWINIA      Chain = "darwinia"
	CHAIN_B3            Chain = "b3"
	CHAIN_GOCHAIN       Chain = "gochain"
	CHAIN_THUNDERCORE   Chain = "thunderCore"
	CHAIN_SATOSHIVM     Chain = "satoshiVM"
	CHAIN_PEGO          Chain = "pego"
	CHAIN_PEAQ          Chain = "peaq"
	CHAIN_EVMOS         Chain = "evmos"
	CHAIN_BITCICHAIN    Chain = "bitcichain"
	CHAIN_ZULU          Chain = "zulu"
	CHAIN_PLATON        Chain = "platon"
	CHAIN_A3ULL         Chain = "3ull"
	CHAIN_GM            Chain = "gm"
	CHAIN_JAPANOPEN     Chain = "joc"
	CHAIN_XCAP          Chain = "xcap"
	CHAIN_ANVM          Chain = "anvm"
	CHAIN_WBT           Chain = "whitechain"
	CHAIN_ERBIE         Chain = "erbie"
	CHAIN_CZZ           Chain = "classzz"
	CHAIN_LAVA          Chain = "elysium"
	CHAIN_MIRAICHAIN    Chain = "mirai"
	CHAIN_HUMANODE      Chain = "humanode"
	CHAIN_SWAN          Chain = "swan"
	CHAIN_WATER         Chain = "waterfall"
	CHAIN_DASH          Chain = "dash"
	CHAIN_MINT          Chain = "mint"
	CHAIN_VENOM         Chain = "venom"
	CHAIN_CARDANO       Chain = "ada"
	CHAIN_KASPA         Chain = "kas"
	CHAIN_OORT          Chain = "oort"
	CHAIN_ENDURANCE     Chain = "endurance"
	CHAIN_ZYTRONLINEA   Chain = "zytronlinea"
	CHAIN_XTER          Chain = "xter"
	CHAIN_OVER          Chain = "over"
	CHAIN_WORLDCHAIN    Chain = "world"
	CHAIN_SONEIUM       Chain = "soneium"

	// gas price 2nd season
	CHAIN_SEI        Chain = "sei"
	CHAIN_BRISE      Chain = "bitgert"
	CHAIN_DOGECHAIN  Chain = "dogechain"
	CHAIN_COSMOS_HUB Chain = "cosmoshub"
	CHAIN_INJECTIVE  Chain = "injective"
	CHAIN_OASYS      Chain = "oasys"
	CHAIN_RUNECHAIN  Chain = "rune"
	CHAIN_FUSION     Chain = "fusion"
	CHAIN_BTT        Chain = "bittorrent"
	CHAIN_SHIBARIUM  Chain = "shibarium"
	CHAIN_MORPH      Chain = "morph"
	// p3 not evm
	CHAIN_SAGA   Chain = "saga"
	CHAIN_NIBIRU Chain = "nibi"
	CHAIN_XION   Chain = "xion"

	// substrate
	CHAIN_VARA      Chain = "vara"
	CHAIN_ASTAR_SUB Chain = "astar_sub"
	CHAIN_MANTA_ALT Chain = "mantaAtl"
	CHAIN_DEEPBRAIN Chain = "deepbrain"

	// p5 evm
	CHAIN_IP       Chain = "ip"  // story
	CHAIN_HSK      Chain = "hsk" // hashkey
	CHAIN_ABSTRACT Chain = "abs"
	CHAIN_BERA     Chain = "bera"
	CHAIN_MATCHAIN Chain = "matchain"
	CHAIN_SHM      Chain = "shm"

	// p5 not evm
	CHAIN_SOON      Chain = "soon"
	CHAIN_SVM_BNB   Chain = "svmbnb"
	CHAIN_SOON_BASE Chain = "soonbase"
	CHAIN_ECLIPSE   Chain = "eclipse"

	// p6 not evm
	CHAIN_MOVEMENT Chain = "move"
	CHAIN_BABYLON  Chain = "baby"

	// p6 evm
	CHAIN_SONIC Chain = "sonic"
	CHAIN_HYPE  Chain = "hype"

	// p6 not evm
	CHAIN_SONIC_SVM Chain = "sonic_svm"
)

func (c Chain) ToString() string {
	return string(c)
}

var (
	P1EvmChains = []Chain{
		CHAIN_GTEVM,
		CHAIN_CRONOS,
		CHAIN_CELO,
		CHAIN_METIS,
		CHAIN_CONFLUX,
		CHAIN_SEIEVM,
		CHAIN_OPBNB,
		CHAIN_SCROLL,
		CHAIN_ARB_NOVA,
		CHAIN_ZKFAIR,
		CHAIN_MANTA,
		CHAIN_MODE,
		CHAIN_XLAYER,
		CHAIN_BOB,
		CHAIN_BITLAYER,
		CHAIN_BOUNCEBIT,
		CHAIN_MANTLE,
		CHAIN_POLYGONZKEVM,
		CHAIN_MANDE,
		CHAIN_KROMA,
		CHAIN_APECHAIN,
		CHAIN_MERLIN,
		CHAIN_ETC,
		CHAIN_KAVA,
		CHAIN_CORE,
		CHAIN_PULSECHAIN,
		CHAIN_OASYS,
		CHAIN_KAIA,
	}

	BTCChains = []Chain{
		CHAIN_BITCOIN,
		CHAIN_FB,
		CHAIN_LITECOIN,
		CHAIN_DASH,
	}

	CosmosChains = []Chain{ // p6 之后的，可通用的cosmos系列链，统一的爬块逻辑方可使用
		CHAIN_BABYLON,
	}

	SolanaChains = []Chain{
		CHAIN_SOON,
		CHAIN_SVM_BNB,
		CHAIN_SOON_BASE,
		CHAIN_SONIC_SVM,
		CHAIN_ECLIPSE,
	}

	P2EvmChains = []Chain{
		CHAIN_CONFLUX,
		CHAIN_MANDE,
		CHAIN_KROMA,
		CHAIN_APECHAIN,
		CHAIN_FLARE,
		CHAIN_AURORA,
		CHAIN_MOONBEAM,
		CHAIN_FILECOIN,
		CHAIN_MOONRIVER,
		CHAIN_TELOS,
		CHAIN_HARMONY,
		CHAIN_RONIN,
		CHAIN_ROOTSTOCK,
		CHAIN_ZETA,
		CHAIN_DEGEN,
		CHAIN_ACALA,
		CHAIN_IOTEX,
		CHAIN_ASTAR,
		CHAIN_BOBA,
		CHAIN_CHILIZ,
		CHAIN_TAIKO,
		CHAIN_ARTHERA,
		CHAIN_ABSTRACT,
	}

	P2NotEvmChains = []Chain{
		CHAIN_CELESTIA,
		CHAIN_COSMOS_HUB,
		CHAIN_DOGECHAIN,
		CHAIN_SEI,
		CHAIN_INJECTIVE,
		CHAIN_CKB,
		CHAIN_VARA,
		CHAIN_ASTAR_SUB,
	}

	P3EvmChains = []Chain{
		CHAIN_BTT,
		CHAIN_OASYS,
		CHAIN_WANCHAIN,
		CHAIN_ALIENX,
		CHAIN_COINEX,
		CHAIN_DOGECHAINEVM,
		CHAIN_MAP,
		CHAIN_VIZING,
		CHAIN_EOS,
		CHAIN_MIXMAX,
		CHAIN_OKTC,
		CHAIN_BEVM,
		CHAIN_ELA,
		CHAIN_GNOSIS,
		CHAIN_IMX,
		CHAIN_KCC,
		CHAIN_NEON,
		CHAIN_STEP,
		CHAIN_VLX,
		CHAIN_ZK_NOVA,
		CHAIN_ZORA,
		CHAIN_FUSE,
		CHAIN_GRAVITY_ALPHA,
		CHAIN_NAXION,
		CHAIN_SHIBARIUM,
		CHAIN_WEMIX,
		CHAIN_SBCH,
	}

	P3NotEvmChains = []Chain{
		CHAIN_KASPA,
		CHAIN_BITCOIN_CASH,
		CHAIN_CARDANO,
		CHAIN_LITECOIN,
		CHAIN_VENOM,
	}

	P4EvmChains = []Chain{
		CHAIN_ANVM,
		CHAIN_EWT,
		CHAIN_VICTION,
		CHAIN_INEVM,
		CHAIN_KARDIACHAIN,
		CHAIN_KARURA,
		CHAIN_B3,
		CHAIN_BITCICHAIN,
		CHAIN_BITWAVE,
		CHAIN_BLACKFORT,
		CHAIN_DARWINIA,
		CHAIN_GM,
		CHAIN_GOCHAIN,
		CHAIN_JAPANOPEN,
		CHAIN_SATOSHIVM,
		CHAIN_THUNDERCORE,
		CHAIN_XCAP,
		// CHAIN_ZULU, // TODO: zulu rpc 服务连续一天一直提示服务内部错误，暂时停止爬块操作
		CHAIN_ENDURANCE,
		CHAIN_MINT,
		CHAIN_OORT,
		CHAIN_BRISE,
		CHAIN_FUSION,
		CHAIN_RUNECHAIN,
		CHAIN_CZZ,
		CHAIN_EVMOS,
		CHAIN_HUMANODE,
		CHAIN_LIGHT,
		CHAIN_NEOX,
		CHAIN_OCTA,
		CHAIN_PEAQ,
		CHAIN_A3ULL,
		CHAIN_WBT,
		CHAIN_CALLISTO,
		CHAIN_LAVA,
		CHAIN_ERBIE,
		CHAIN_ETHW,
		CHAIN_MARO,
		CHAIN_MIRAICHAIN,
		CHAIN_PEGO,
		CHAIN_PLATON,
		CHAIN_SHIDENEVM,
		CHAIN_SWAN,
		CHAIN_WATER,
		CHAIN_DIS,
		CHAIN_ZYTRONLINEA,
		CHAIN_MORPH,
		CHAIN_XTER,
		CHAIN_BSQUARED,
		CHAIN_OVER,
		CHAIN_WORLDCHAIN,
	}

	P4NotEvmChains = []Chain{
		CHAIN_DEEPBRAIN,
		CHAIN_MANTA_ALT,
		CHAIN_NIBIRU,
		CHAIN_SAGA,
		CHAIN_DASH,
		CHAIN_FB,
		CHAIN_XION,
	}

	P5EvmChains = []Chain{
		CHAIN_SONEIUM,
		CHAIN_IP,
		CHAIN_HSK,
		CHAIN_ABSTRACT,
		CHAIN_BERA,
		CHAIN_MATCHAIN,
		CHAIN_SHM,
	}

	P5NotEvmChains = []Chain{
		CHAIN_SOON,
		CHAIN_SVM_BNB,
		CHAIN_SOON_BASE,
		CHAIN_ECLIPSE,
	}

	P6EvmChains = []Chain{
		CHAIN_SONIC,
		CHAIN_HYPE,
	}

	P6NotEvmChains = []Chain{
		CHAIN_MOVEMENT,
		CHAIN_SONIC_SVM,
	}
)

func NeedSendToOutKafka(chain Chain) bool {
	return lo.Contains(P6NotEvmChains, chain) || lo.Contains(P6EvmChains, chain)
}

func IsHotFlag1Chain(chain Chain) bool {
	return lo.Contains(P3EvmChains, chain) || lo.Contains(P3NotEvmChains, chain) ||
		lo.Contains(P4EvmChains, chain) || lo.Contains(P4NotEvmChains, chain) ||
		lo.Contains(P5EvmChains, chain) || lo.Contains(P5NotEvmChains, chain) ||
		lo.Contains(P6EvmChains, chain) || lo.Contains(P6NotEvmChains, chain)
}

func IsTargetChain(hotFlag int, chain Chain) bool {
	if hotFlag == 1 {
		return IsHotFlag1Chain(chain)
	}

	// used for test env
	// if hotFlag == 2 { //ton
	// 	return chain == CHAIN_TON
	// }
	// if hotFlag == 3 {
	// 	return chain == CHAIN_SUI
	// }
	// return !IsHotFlag1Chain(chain) && chain != CHAIN_TON && chain != CHAIN_SUI
	return !IsHotFlag1Chain(chain)
}

var SupportChainList = []Chain{
	CHAIN_ARBITRUM,
	CHAIN_AVALANCHE,
	CHAIN_BASE,
	CHAIN_BLAST,
	CHAIN_BSC,
	CHAIN_ETHEREUM,
	CHAIN_FANTOM,
	CHAIN_LINEA,
	CHAIN_MERLIN,
	CHAIN_OP,
	CHAIN_POLYGON,
	CHAIN_SOLANA,
	CHAIN_ZK,
	CHAIN_TON,
	CHAIN_TRON,
	CHAIN_SUI,
}

type ChainID int

const (
	ChainIDEthereum ChainID = 1
	ChainIdSolana   ChainID = 501
	ChainIdSui      ChainID = 784
	ChainIdGate     ChainID = 86
	ChainIdTon      ChainID = 607
	ChainIdEthereum ChainID = 1
	ChainIdOptimism ChainID = 10
	ChainIdBsc      ChainID = 56
	ChainIdPolygon  ChainID = 137
	ChainIdTron     ChainID = 195
	ChainIdFantom   ChainID = 250
	ChainIDZK       ChainID = 324
	ChainIdMerlin   ChainID = 4200
	ChainIdBase     ChainID = 8453
	ChainIdArbitrum ChainID = 42161
	ChainIdAvax     ChainID = 43114
	ChainIdLinea    ChainID = 59144
	ChainIdBlast    ChainID = 81457
	ChainIdMantle   ChainID = 5000
	ChainIdMode     ChainID = 34443
	ChainIdManta    ChainID = 169
	ChainIdScroll   ChainID = 534352
	ChainIdCronos   ChainID = 25
	ChainIdConflux  ChainID = 1030
)

var (
	Chain2ChainId = map[Chain]ChainID{
		CHAIN_ETHEREUM:  ChainIDEthereum,
		CHAIN_ARBITRUM:  ChainIdArbitrum,
		CHAIN_BSC:       ChainIdBsc,
		CHAIN_OP:        ChainIdOptimism,
		CHAIN_ZK:        ChainIDZK,
		CHAIN_POLYGON:   ChainIdPolygon,
		CHAIN_BASE:      ChainIdBase,
		CHAIN_LINEA:     ChainIdLinea,
		CHAIN_AVALANCHE: ChainIdAvax,
		CHAIN_FANTOM:    ChainIdFantom,
		CHAIN_GATE:      ChainIdGate,
		CHAIN_MERLIN:    ChainIdMerlin,
		CHAIN_BLAST:     ChainIdBlast,
		CHAIN_SOLANA:    ChainIdSolana,
		CHAIN_MANTLE:    ChainIdMantle,
		CHAIN_MODE:      ChainIdMode,
		CHAIN_MANTA:     ChainIdManta,
		CHAIN_SCROLL:    ChainIdScroll,
		CHAIN_TRON:      ChainIdTron,
		CHAIN_CRONOS:    ChainIdCronos,
		CHAIN_CONFLUX:   ChainIdConflux,
	}
)

func GetChainIdByChain(chain Chain) ChainID {
	chainId, ok := Chain2ChainId[chain]
	if !ok {
		return 0
	}
	return chainId
}

type ChainConfig struct {
	ChainName    string
	AvgBlockTime float64 // 平均出块时间（秒）
	MaxBlockLag  int     // 最大允许延后区块数
}

const (
	BlockTimeThresholdL1 = 1.0
	BlockTimeThresholdL2 = 2.0
	BlockTimeThresholdL3 = 3.0
	BlockTimeThresholdL4 = 5.0
	BlockTimeThresholdL5 = 12.0

	// 延迟区块数
	DelayBlockL1 = 240
	DelayBlockL2 = 120
	DelayBlockL3 = 80
	DelayBlockL4 = 48
	DelayBlockL5 = 20
)

var ChainConfigs = map[Chain]ChainConfig{

	CHAIN_MOVEMENT: {AvgBlockTime: 0.3, MaxBlockLag: 150}, // Kept original (1.0 doesn't match thresholds)
	CHAIN_APTOS:    {AvgBlockTime: 0.3, MaxBlockLag: 400}, // Kept original (0.3 doesn't match thresholds)
	CHAIN_TON:      {AvgBlockTime: 2, MaxBlockLag: 32},    // Kept original (0.3 doesn't match thresholds)

	//evm chains
	CHAIN_ARBITRUM:  {AvgBlockTime: 0.25, MaxBlockLag: 60}, // Kept original (0.3 doesn't match thresholds)
	CHAIN_AVALANCHE: {AvgBlockTime: 2, MaxBlockLag: 1},
	CHAIN_BASE:      {AvgBlockTime: 2, MaxBlockLag: 20},
	CHAIN_BLAST:     {AvgBlockTime: 2, MaxBlockLag: 20},
	CHAIN_ETHEREUM:  {AvgBlockTime: 12, MaxBlockLag: 12},
	CHAIN_FANTOM:    {AvgBlockTime: BlockTimeThresholdL1, MaxBlockLag: DelayBlockL1},
	CHAIN_LINEA:     {AvgBlockTime: 2, MaxBlockLag: 10},
	CHAIN_OP:        {AvgBlockTime: 2, MaxBlockLag: 20},
	CHAIN_POLYGON:   {AvgBlockTime: 2, MaxBlockLag: 33},
	CHAIN_TRON:      {AvgBlockTime: 3, MaxBlockLag: 19},
	CHAIN_BSC:       {AvgBlockTime: 0.75, MaxBlockLag: 5},
	CHAIN_ZK:        {AvgBlockTime: 3, MaxBlockLag: 20}, // Kept original (0.1 doesn't match thresholds)

	// P1EvmChains
	CHAIN_GTEVM:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_CRONOS:       {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_CELO:         {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_METIS:        {AvgBlockTime: BlockTimeThresholdL3, MaxBlockLag: DelayBlockL3},
	CHAIN_CONFLUX:      {AvgBlockTime: 0.5, MaxBlockLag: 400}, // Kept original (0.5 doesn't match thresholds)
	CHAIN_SEIEVM:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_OPBNB:        {AvgBlockTime: BlockTimeThresholdL1, MaxBlockLag: DelayBlockL1},
	CHAIN_SCROLL:       {AvgBlockTime: 3.5, MaxBlockLag: 80},   // Kept original (3.5 doesn't match thresholds)
	CHAIN_ARB_NOVA:     {AvgBlockTime: 0.25, MaxBlockLag: 400}, // Kept original (0.25 doesn't match thresholds)
	CHAIN_ZKFAIR:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_MANTA:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_MODE:         {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_XLAYER:       {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_BOB:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_BITLAYER:     {AvgBlockTime: BlockTimeThresholdL3, MaxBlockLag: DelayBlockL3},
	CHAIN_BOUNCEBIT:    {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_MANTLE:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_POLYGONZKEVM: {AvgBlockTime: 1.5, MaxBlockLag: 150}, // Kept original (1.5 doesn't match thresholds)
	CHAIN_MANDE:        {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_KROMA:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_APECHAIN:     {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_MERLIN:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ETC:          {AvgBlockTime: 13.0, MaxBlockLag: 20}, // Kept original (13.0 doesn't match thresholds)
	CHAIN_KAVA:         {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_CORE:         {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_PULSECHAIN:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_OASYS:        {AvgBlockTime: BlockTimeThresholdL3, MaxBlockLag: DelayBlockL3},
	CHAIN_KAIA:         {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},

	// P2EvmChains
	CHAIN_FLARE:     {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_AURORA:    {AvgBlockTime: BlockTimeThresholdL1, MaxBlockLag: DelayBlockL1},
	CHAIN_MOONBEAM:  {AvgBlockTime: BlockTimeThresholdL5, MaxBlockLag: DelayBlockL5},
	CHAIN_FILECOIN:  {AvgBlockTime: 30.0, MaxBlockLag: 10}, // Kept original (30.0 doesn't match thresholds)
	CHAIN_MOONRIVER: {AvgBlockTime: BlockTimeThresholdL5, MaxBlockLag: DelayBlockL5},
	CHAIN_TELOS:     {AvgBlockTime: 0.5, MaxBlockLag: 400}, // Kept original (0.5 doesn't match thresholds)
	CHAIN_HARMONY:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_RONIN:     {AvgBlockTime: BlockTimeThresholdL3, MaxBlockLag: DelayBlockL3},
	CHAIN_ROOTSTOCK: {AvgBlockTime: 30.0, MaxBlockLag: 10}, // Kept original (30.0 doesn't match thresholds)
	CHAIN_ZETA:      {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_DEGEN:     {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ACALA:     {AvgBlockTime: BlockTimeThresholdL5, MaxBlockLag: DelayBlockL5},
	CHAIN_IOTEX:     {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_ASTAR:     {AvgBlockTime: BlockTimeThresholdL5, MaxBlockLag: DelayBlockL5},
	CHAIN_BOBA:      {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_CHILIZ:    {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_TAIKO:     {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ARTHERA:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ABSTRACT:  {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},

	// P3EvmChains
	CHAIN_BTT:           {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_WANCHAIN:      {AvgBlockTime: 10.0, MaxBlockLag: 20}, // Kept original (10.0 doesn't match thresholds)
	CHAIN_ALIENX:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_COINEX:        {AvgBlockTime: BlockTimeThresholdL3, MaxBlockLag: DelayBlockL3},
	CHAIN_DOGECHAINEVM:  {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_MAP:           {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_VIZING:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_EOS:           {AvgBlockTime: 0.5, MaxBlockLag: 400}, // Kept original (0.5 doesn't match thresholds)
	CHAIN_MIXMAX:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_OKTC:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_BEVM:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ELA:           {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_GNOSIS:        {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_IMX:           {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_KCC:           {AvgBlockTime: BlockTimeThresholdL3, MaxBlockLag: DelayBlockL3},
	CHAIN_NEON:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_STEP:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_VLX:           {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ZK_NOVA:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ZORA:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_FUSE:          {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_GRAVITY_ALPHA: {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_NAXION:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_SHIBARIUM:     {AvgBlockTime: BlockTimeThresholdL4, MaxBlockLag: DelayBlockL4},
	CHAIN_WEMIX:         {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_SBCH:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},

	// P4EvmChains
	CHAIN_ANVM:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_EWT:         {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_VICTION:     {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_INEVM:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_KARDIACHAIN: {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_KARURA:      {AvgBlockTime: BlockTimeThresholdL5, MaxBlockLag: DelayBlockL5},
	CHAIN_B3:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_BITCICHAIN:  {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_BITWAVE:     {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_BLACKFORT:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_DARWINIA:    {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_GM:          {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_GOCHAIN:     {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_JAPANOPEN:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_SATOSHIVM:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_THUNDERCORE: {AvgBlockTime: BlockTimeThresholdL1, MaxBlockLag: DelayBlockL1},
	CHAIN_XCAP:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ENDURANCE:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_MINT:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_OORT:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_BRISE:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_FUSION:      {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_RUNECHAIN:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_CZZ:         {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_EVMOS:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_HUMANODE:    {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_LIGHT:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_NEOX:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_OCTA:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_PEAQ:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_A3ULL:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_WBT:         {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_CALLISTO:    {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_LAVA:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ERBIE:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ETHW:        {AvgBlockTime: 13.5, MaxBlockLag: 20}, // Kept original (13.5 doesn't match thresholds)
	CHAIN_MARO:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_MIRAICHAIN:  {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_PEGO:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_PLATON:      {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_SHIDENEVM:   {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_SWAN:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_WATER:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_DIS:         {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_ZYTRONLINEA: {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_MORPH:       {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_XTER:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_BSQUARED:    {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_OVER:        {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
	CHAIN_WORLDCHAIN:  {AvgBlockTime: BlockTimeThresholdL2, MaxBlockLag: DelayBlockL2},
}

var ChainAlertBlockDelay = map[Chain]uint64{
	CHAIN_ETHEREUM:  25,
	CHAIN_ARBITRUM:  1200,
	CHAIN_BASE:      150,
	CHAIN_BLAST:     150,
	CHAIN_FANTOM:    10,
	CHAIN_LINEA:     150,
	CHAIN_OP:        150,
	CHAIN_POLYGON:   150,
	CHAIN_TRON:      19,
	CHAIN_BSC:       400,
	CHAIN_ZK:        100,
	CHAIN_AVALANCHE: 150,
}

var ChainAlertBlockDelayRealTime = map[Chain]uint64{
	CHAIN_ETHEREUM:  20,
	CHAIN_ARBITRUM:  200,
	CHAIN_BASE:      150,
	CHAIN_BLAST:     150,
	CHAIN_FANTOM:    10,
	CHAIN_LINEA:     150,
	CHAIN_OP:        150,
	CHAIN_POLYGON:   150,
	CHAIN_TRON:      19,
	CHAIN_BSC:       200,
	CHAIN_ZK:        100,
	CHAIN_AVALANCHE: 150,
}
