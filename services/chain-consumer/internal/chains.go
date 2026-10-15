package internal

type Chain string

const (
	ChainSolana    Chain = "solana"
	ChainEth       Chain = "eth"
	ChainBsc       Chain = "bsc"
	ChainBase      Chain = "base"
	ChainArb       Chain = "arb"
	ChainArbitrum  Chain = "arbitrum"
	ChainBlast     Chain = "blast"
	ChainOptimism  Chain = "optimism"
	ChainTon       Chain = "ton"
	ChainPolygon   Chain = "polygon"
	ChainZksync    Chain = "zksync"
	ChainAvaxc     Chain = "avalanche"
	ChainLinea     Chain = "linea"
	ChainSui       Chain = "sui"
	ChainBtc       Chain = "bitcoin"
	ChainLtc       Chain = "ltc"
	ChainTron      Chain = "tron"
	ChainGatelayer Chain = "gatelayer"
	ChainBera      Chain = "bera"
)

func (c Chain) String() string {
	return string(c)
}
