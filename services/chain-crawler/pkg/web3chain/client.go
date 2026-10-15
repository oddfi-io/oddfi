package web3chain

import (
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/httpclient"
	"chain_crawler/pkg/tracelog"
	"context"
	"fmt"
	"strings"

	"github.com/samber/lo"
)

const (
	GetChainsInternalAPI = "/web3chain/internal/v1/chain/search"
)

type ChainType string

const (
	ChainTypeEthereum ChainType = "ethereum"
	ChainTypeTron     ChainType = "tron"
	ChainTypeBitcoin  ChainType = "bitcoin"
	ChainTypeSolana   ChainType = "solana"
	ChainTypeAptos    ChainType = "aptos"
	ChainTypeTon      ChainType = "ton"
	ChainTypeSui      ChainType = "sui"
	ChainTypeGate     ChainType = "gatechain"
	ChainTypeCosmos   ChainType = "cosmos"

	ChainTypeSubstrate   ChainType = "substrate"
	ChainTypeSaga        ChainType = "saga"
	ChainTypeNibiru      ChainType = "nibi"
	ChainTypeKaspa       ChainType = "kas"
	ChainTypeCardano     ChainType = "ada"
	ChainTypeBitcoinCash ChainType = "bitcoin_cash"
	ChainTypeVenom       ChainType = "venom"
)

var (
	P4ChainTypes = []ChainType{
		ChainTypeSubstrate,
		ChainTypeSaga,
		ChainTypeNibiru,
		ChainTypeKaspa,
		ChainTypeCardano,
		ChainTypeBitcoinCash,
		ChainTypeVenom,
	}
)

type ChainLayer string

const (
	ChainLayerLayer1 ChainLayer = "layer1"
	ChainLayerLayer2 ChainLayer = "layer2"
	ChainLayerLayer3 ChainLayer = "layer3"
)

type Chain struct {
	Chain             consts.Chain `gorm:"column:chain" json:"chain" form:"chain"`
	ChainID           string       `gorm:"column:chain_id" json:"chain_id" form:"chain_id"`
	NetworkID         string       `gorm:"column:network_id" json:"network_id" form:"network_id"`
	Name              string       `gorm:"column:name" json:"name" form:"name"`
	Type              ChainType    `gorm:"column:type" json:"type" form:"type"`
	Layer             ChainLayer   `gorm:"column:layer" json:"layer" form:"layer"`
	Endpoints         []string     `gorm:"column:endpoints" json:"endpoints" form:"endpoints"`
	NativeName        string       `gorm:"column:native_name" json:"native_name"`
	NativeCurrency    string       `gorm:"column:native_currency" json:"native_currency" form:"native_currency"`
	NativeDecimals    int64        `gorm:"column:native_decimals" json:"native_decimals" form:"native_decimals"`
	NativeTotalSupply int64        `gorm:"column:native_total_supply" json:"native_total_supply"`
	ParentChain       string       `gorm:"column:parent_chain" json:"parent_chain" form:"parent_chain"`
	Web3Key           string       `gorm:"column:web3_key" json:"web3_key" form:"web3_key"` // 移动端用的标识
	Explorer          string       `gorm:"column:explorer" json:"explorer" form:"explorer"`
	TxExplorer        string       `gorm:"column:tx_explorer" json:"tx_explorer" form:"tx_explorer"`
}

type Client interface {
	GetChains(ctx context.Context, params QueryChainParams) (QueryChainsData, error)
}

func NewClient(endpoint string, rpcKey string, httpClient httpclient.HttpClient) Client {
	return &clientImpl{endpoint: endpoint, rpcKey: rpcKey, httpClient: httpClient}
}

type clientImpl struct {
	endpoint   string
	httpClient httpclient.HttpClient
	rpcKey     string
}

type QueryChainParams struct {
	Chains      []string     `json:"chains"`
	ChainTypes  []ChainType  `json:"chain_types"`
	ChainLayers []ChainLayer `json:"chain_layers"`
}

type QueryChainsData struct {
	Chains []Chain `json:"chains"`
}

type GetChainsResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    QueryChainsData `json:"data"`
	Error   string          `json:"error"`
}

func (c *clientImpl) GetChains(ctx context.Context, params QueryChainParams) (QueryChainsData, error) {
	getChainsSpanCtx, getChainsSpan := tracelog.StartSpan(ctx, "web3chain", "GetChains")
	defer getChainsSpan.End()
	tl := tracelog.NewWithContext(getChainsSpanCtx)
	var ret GetChainsResponse
	queryParams := make(map[string]string, 4)
	queryParams["rpc_key"] = c.rpcKey
	if len(params.Chains) > 0 {
		queryParams["chains"] = strings.Join(params.Chains, ",")
	}
	if len(params.ChainTypes) > 0 {
		queryParams["chain_types"] = strings.Join(lo.Map(params.ChainTypes, func(s ChainType, _ int) string { return string(s) }), ",")
	}
	if len(params.ChainLayers) > 0 {
		queryParams["chain_layers"] = strings.Join(lo.Map(params.ChainLayers, func(s ChainLayer, _ int) string { return string(s) }), ",")
	}
	if err := c.httpClient.Get(getChainsSpanCtx, fmt.Sprintf("%+v%+v", c.endpoint, GetChainsInternalAPI), nil, queryParams, &ret); err != nil {
		tl.Errorw("failed to get chains", "error", err)
		return ret.Data, err
	} else if ret.Code != 0 {
		tl.Errorw("failed to get chains", "message", ret.Message, "error", ret.Error)
		return ret.Data, fmt.Errorf("failed to get chains: %s", ret.Message)
	}
	return ret.Data, nil
}
