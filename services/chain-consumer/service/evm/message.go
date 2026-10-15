package evm

import (
	"encoding/json"

	"github.com/ethereum/go-ethereum/core/types"
	"github.com/shopspring/decimal"
)

type Message struct {
	Type           string          `json:"type"`
	Chain          string          `json:"chain"`
	Data           json.RawMessage `json:"data"`
	Timestamp      int64           `json:"timestamp"`
	BlockNumber    uint64          `json:"block_number"`
	TxIndex        uint            `json:"tx_index,omitempty"`
	EventTopic     string          `json:"event_topic,omitempty"`
	DelayFlag      bool            `json:"delay_flag,omitempty"` // 是否延迟处理
	KafkaTimestamp int64           `json:"-"`
}

type EvmResult struct {
	BlockNumber uint64          `json:"blockNumber"`
	Block       json.RawMessage `json:"block"`
	Receipts    []EvmReceipts   `json:"receipts"`
	TraceBlock  json.RawMessage `json:"traceBlock"`
}

type EvmReceipts struct {
	BlockHash         string       `json:"blockHash"`
	BlockNumber       string       `json:"blockNumber"` // 0x52e1ff7
	From              string       `json:"from"`        // 0x90da...
	To                string       `json:"to"`          // 0x4848...
	CumulativeGasUsed string       `json:"cumulativeGasUsed"`
	GasUsed           string       `json:"gasUsed"`
	Status            string       `json:"status"` // 0x1 为成功
	TransactionHash   string       `json:"transactionHash"`
	Logs              []*types.Log `json:"logs"` // 数组对象
	// ContractAddress   *string      `json:"contractAddress"` // 可能为 null
}

type EvmDataBlock struct {
	Hash      string `json:"hash"`
	Number    string `json:"number"`
	Timestamp string `json:"timestamp"`
}

type evmtxInfo struct {
	Token       string
	From        string
	to          string
	Value       decimal.Decimal
	BlockNumber uint64
	TxId        string
	LogIndex    uint
}

type betPlacedInfo struct {
	Txid  string
	BetId [32]byte
}
