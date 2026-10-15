package web3chain

import (
	"context"
	"testing"

	"chain_crawler/pkg/httpclient"
	"chain_crawler/pkg/tracelog"

	"github.com/stretchr/testify/assert"
)

var impl Client

func init() {
	tracelog.InitLogger("dev")
	impl = NewClient("", "G7bJ2nA9kL5wP3vF", httpclient.NewHttpClient())
}

func TestGetChains(t *testing.T) {
	resp, err := impl.GetChains(context.Background(), QueryChainParams{
		Chains: []string{},
	})
	assert.NoError(t, err)
	t.Logf("resp: %+v", resp)
}
