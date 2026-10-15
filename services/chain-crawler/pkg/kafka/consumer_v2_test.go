package kafka

import (
	"chain_crawler/pkg/tracelog"
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConsumerV2(t *testing.T) {
	tracelog.InitLogger("dev")
	consumer := NewConsumerV2("web3-token", "127.0.0.1:9094")
	defer consumer.Close()
	consumer.Subscribe(context.Background(), []string{"web3-chain-data"})
	msg := consumer.ReadRawMessage(context.Background(), "web3-chain-data")
	t.Logf("msg: %+v %+v", string(msg.Key), string(msg.Value))
}

func TestConsumerV2Message(t *testing.T) {
	tracelog.InitLogger("dev")
	consumer := NewConsumerV2("web3-token", "127.0.0.1:9094")
	defer consumer.Close()
	consumer.Subscribe(context.Background(), []string{"web3-chain-data"})
	msg, err := consumer.ReadMessage(context.Background(), "web3-chain-data")
	assert.NoError(t, err)
	t.Logf("msg: %+v %+v", msg.Chain, string(msg.Data))
}
