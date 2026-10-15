package ethclient

import (
	"context"
	"math/big"
	"testing"

	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/kafka"
	"chain_crawler/pkg/tracelog"

	"github.com/stretchr/testify/assert"
)

var (
	ethClient          EthClient
	ethClientBsc       EthClient
	ethClientBlast     EthClient
	optimismClient     EthClient
	ethClientBase      EthClient
	ethClientAvalanche EthClient
	ethClientArbitrum  EthClient
	ethClientPolygon   EthClient
	ethClientLinea     EthClient
	producer           kafka.Producer
)

func init() {
	tracelog.InitLogger("dev")
	var err error
	ethClient, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}
	ethClientBlast, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}
	ethClientBsc, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}

	ethClientBase, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}

	ethClientAvalanche, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}

	ethClientArbitrum, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}

	optimismClient, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}

	ethClientPolygon, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}

	ethClientLinea, err = NewEthClient(context.Background(), []string{""})
	if err != nil {
		panic(err)
	}

	producer = kafka.NewProducer("127.0.0.1:9094", "web3-chain-data", "", "")
}

// func TestEthClient_WriteKafka(t *testing.T) {
// 	receipts, err := ethClientBase.BlockReceipts(context.Background(), RouteRandom, big.NewInt(27375322+0))
// 	assert.NoError(t, err)
// 	assert.True(t, len(receipts) > 0)
// 	t.Logf("receipts: %+v", len(receipts))
// 	t.Logf("receipts: %+v", receipts[146].TransactionHash)
// 	receipts = receipts[146:147]
// 	// receipts = append(receipts[:146], receipts[147:]...)

// 	producer := kafka.NewCompressionProducer("<SERVER_IP>:50002", "web3-token-swap-wbe", "ckafka-pbpw5gpq#web3-test", "Gate@1234!")

// 	// send message
// 	err = producer.WriteMessages(
// 		lo.Map(receipts, func(receipt Receipt, _ int) kafka.Message {
// 			receiptBytes, _ := utils.JsonEncode(receipt)
// 			t.Logf("receipt: %+v", len(receiptBytes))
// 			return kafka.Message{
// 				Type:  "test",
// 				Chain: "test",
// 				Data:  json.RawMessage(receiptBytes),
// 			}
// 		})...,
// 	)
// 	assert.NoError(t, err)
// 	err = producer.Close()
// 	assert.NoError(t, err)
// }

func TestEthClientBlockByNumberWithTxRaw(t *testing.T) {
	block, err := ethClient.BlockByNumberWithTxRaw(context.Background(), RouteRandom, big.NewInt(19814823))
	assert.NoError(t, err)
	t.Logf("block raw length: %+v", len(block))
	t.Logf("block raw preview: %+v", string(block[:min(100, len(block))]))
}

func TestEthClientTraceBlockRaw(t *testing.T) {
	traces, err := ethClientBlast.TraceBlockRaw(context.Background(), RouteRandom, big.NewInt(21918546), consts.CHAIN_BLAST)
	assert.NoError(t, err)
	t.Logf("traces raw: %+v", len(traces))
}

func TestOpClientTraceBlockRaw(t *testing.T) {
	traces, err := optimismClient.TraceBlockRaw(context.Background(), RouteRandom, big.NewInt(21918546), consts.CHAIN_OP)
	assert.NoError(t, err)
	t.Logf("traces raw: %+v", len(traces))
}

func TestLineaClientTraceBlockRaw(t *testing.T) {
	traces, err := ethClientLinea.TraceBlockRaw(context.Background(), RouteRandom, big.NewInt(22642289), consts.CHAIN_LINEA)
	assert.NoError(t, err)
	t.Logf("traces raw: %+v", len(traces))
}

func TestArbitrumClientTraceBlockRaw(t *testing.T) {
	traces, err := ethClientArbitrum.TraceBlockRaw(context.Background(), RouteRandom, big.NewInt(22207999), consts.CHAIN_ARBITRUM)
	assert.NoError(t, err)
	t.Logf("traces raw: %+v", len(traces))
}

func TestAvalancheClientTraceBlockRaw(t *testing.T) {
	traces, err := ethClientAvalanche.TraceBlockRaw(context.Background(), RouteRandom, big.NewInt(21918546), consts.CHAIN_AVALANCHE)
	assert.NoError(t, err)
	t.Logf("traces raw: %+v", len(traces))
}

// 22907456-22907471
// 22908160-22908175
func TestPolygonClientTraceBlockRaw(t *testing.T) {
	for i := 22908160; i <= 22908175; i++ {
		traces, err := ethClientPolygon.TraceBlockRaw(context.Background(), RouteRandom, big.NewInt(int64(i)), consts.CHAIN_POLYGON)
		assert.NoError(t, err)
		t.Logf("traces raw: %+v", len(traces))
	}

}

func TestEthClientNetVersion(t *testing.T) {
	netVersion, err := ethClient.NetVersion(context.Background(), RouteRandom)
	assert.NoError(t, err)
	t.Logf("net version: %+v", netVersion)
}
