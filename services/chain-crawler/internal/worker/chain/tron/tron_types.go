package tron

import "github.com/ethereum/go-ethereum/common/hexutil"

type TronBlockSimple struct {
	BlockID      string                   `json:"blockID"`
	BlockHeader  *TronBlockHeaderSimple   `json:"block_header"`
	Transactions []*TronTransactionSimple `json:"transactions"`
}

type TronBlockHeaderSimple struct {
	RawData *TronBlockHeaderRawDataSimple `json:"raw_data"`
}

type TronBlockHeaderRawDataSimple struct {
	Number int64 `json:"number"`
}

type TronTransactionSimple struct {
	TxID string `json:"txID"`
}

type TronTransactionInfoSimple struct {
	Id          string `json:"id,omitempty"`
	BlockNumber int64  `json:"blockNumber,omitempty"`
}

type TVMBlockSimple struct {
	Hash         string                  `json:"hash"`
	Number       hexutil.Uint64          `json:"number"`
	Transactions []*TVMTransactionSimple `json:"transactions"` // 交易列表（哈希或交易对象）
}

type TVMTransactionSimple struct {
	BlockHash        string         `json:"blockHash"`   // 区块哈希
	BlockNumber      hexutil.Uint64 `json:"blockNumber"` // 区块高度
	Hash             string         `json:"hash"`        // 交易哈希
	TransactionIndex hexutil.Uint64 `json:"transactionIndex"`
}

type TVMTxReceiptSimple struct {
	BlockHash        string         `json:"blockHash"`        // 区块哈希
	BlockNumber      hexutil.Uint64 `json:"blockNumber"`      // 区块高度（十六进制）
	TransactionIndex string         `json:"transactionIndex"` // 交易在区块中的索引
	TransactionHash  string         `json:"transactionHash"`  // 交易哈希
}
