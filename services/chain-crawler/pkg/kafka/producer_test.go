package kafka

import (
	"context"
	"encoding/json"
	"testing"

	"chain_crawler/pkg/ethclient"
	"chain_crawler/pkg/utils"

	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
)

func TestProducer(t *testing.T) {
	producer := NewProducer("127.0.0.1:9094", "web3-chain-data", "", "")
	b, _ := utils.JsonEncode(ethclient.Log{
		Address: eth_common.HexToAddress("0x0000000000000000000000000000000000000000"),
	})
	err := producer.WriteMessages(context.Background(),
		Message{
			Type:  MessageTypeEvmLog,
			Chain: "eth",
			Data:  json.RawMessage(b),
		},
	)
	assert.NoError(t, err)
	err = producer.Close()
	assert.NoError(t, err)
}

func TestProducerCase1(t *testing.T) {
	producer := NewProducer("<KAFKA_IP>:9095,<KAFKA_IP>:9095,<KAFKA_IP>:9095,<KAFKA_IP>:9095,<KAFKA_IP>:9095", "web3-chain-test", "web3-kafka", "SbnR1olsWcO")
	b, _ := utils.JsonEncode(ethclient.Log{
		Address: eth_common.HexToAddress("0x0000000000000000000000000000000000000000"),
	})
	err := producer.WriteMessages(context.Background(),
		Message{
			Type:  MessageTypeEvmLog,
			Chain: "eth",
			Data:  json.RawMessage(b),
		},
	)
	assert.NoError(t, err)
	err = producer.Close()
	assert.NoError(t, err)
}

func TestProducerCase2(t *testing.T) {
	producer := NewProducer("<SERVER_IP>:50002", "web3-token-swap-wbe", "ckafka-pbpw5gpq#web3-test", "Gate@1234!")
	b, _ := utils.JsonEncode(ethclient.Log{
		Address: eth_common.HexToAddress("0x0000000000000000000000000000000000000000"),
	})
	err := producer.WriteMessages(context.Background(),
		Message{
			Type:  MessageTypeEvmLog,
			Chain: "eth",
			Data:  json.RawMessage(b),
		},
	)
	assert.NoError(t, err)
	err = producer.Close()
	assert.NoError(t, err)
}
