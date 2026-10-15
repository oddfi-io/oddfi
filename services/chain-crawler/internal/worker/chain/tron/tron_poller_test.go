package tron

import (
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/tronclient"
	"context"
	"encoding/json"
	"fmt"
	"github.com/stretchr/testify/assert"
	"os"
	"testing"
)

func TestTronPoller_GetTronChainData(t *testing.T) {
	tracelog.InitLogger("dev")
	tracelog.InitTrace("web3", "chain_crawler")

	restRpcs := []string{"https://chaotic-crimson-wind.tron-mainnet.quiknode.pro/89eb75e68c03c9933f4c99a0e20bc5c7ba0dc02f"}
	jsonRpcs := []string{"https://chaotic-crimson-wind.tron-mainnet.quiknode.pro/89eb75e68c03c9933f4c99a0e20bc5c7ba0dc02f/jsonrpc"}
	tronClient, err := tronclient.NewTronClient(restRpcs, jsonRpcs, 5)
	assert.NoError(t, err)
	testPoller := &TronPoller{
		taskName:           "test_tron_poller",
		tronClient:         tronClient,
		hasGetBlockReceipt: false,
	}
	start := uint64(76669249)
	end := uint64(76669249)
	blocks, _, err := testPoller.GetTronChainData(context.Background(), start, end)
	assert.NoError(t, err)
	d, _ := json.Marshal(blocks[0])
	_ = os.WriteFile(fmt.Sprintf("./block_%d.josn", start), d, 0644)
}
