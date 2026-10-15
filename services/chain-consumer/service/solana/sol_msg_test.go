package solana

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDecodeMsg(t *testing.T) {
	var block SolBlockMsg
	msg := `{"Blockhash":"7GrDVEoFHiojSoyzMDEvCtT5CNLcHSwBHP81SjPYSGdC","BlockTime":"2026-01-05T02:58:36Z","BlockHeight":369532205,"PreviousBlockhash":"CAAEY8epcH2NaaawprAxQzQ3utLFqtTbFDjB8nHSTyMb","ParentSlot":391392767,"Transactions":[],"Signatures":null,"Rewards":[{"pubkey":"5pPRHniefFjkiaArbGX3Y8NUysJmQ9tMZg3FrFGwHzSm","lamports":28615068,"postBalance":124538512613,"rewardType":"Fee","commission":null}]}`

	err := json.Unmarshal([]byte(msg), &block)
	if err != nil {
		t.Error(err)
	}

	layout := "2006-01-02T15:04:05Z"
	ts, _ := time.Parse(layout, block.BlockTime)

	t.Logf("UTC timestamp:%d", ts.Unix())
	t.Logf("ts :%d", time.Now().Unix())
}
