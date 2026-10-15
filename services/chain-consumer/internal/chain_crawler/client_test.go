package chain_crawler

import (
	"chain-consumer/global"
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

var testClient *Client

func TestMain(m *testing.M) {
	cfg := &global.ChainCrawlerConfig{
		RpcUrl: "",
	}
	testClient = NewClient(cfg)
	m.Run()
}

func TestClient_RequestBackward(t *testing.T) {
	blockNumber := int64(21722762)
	err := testClient.RequestBackward(context.Background(), "linea", blockNumber, blockNumber)
	assert.Nil(t, err)
}
