package kafka

import (
	"context"
	"testing"

	"chain_crawler/pkg/tracelog"

	"github.com/stretchr/testify/assert"
)

func TestConsumer(t *testing.T) {
	tracelog.InitLogger("dev")
	consumer := NewConsumer(context.Background(), "web3-token", "127.0.0.1:9094", "web3-chain-data", "", "")
	defer consumer.Close()
	msg, err := consumer.ReadRawMessage(context.Background())
	assert.NoError(t, err)
	t.Logf("msg: %+v %+v", string(msg.Key), string(msg.Value))
}
