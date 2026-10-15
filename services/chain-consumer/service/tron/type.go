package tron

import (
	"encoding/json"

	"github.com/shopspring/decimal"
)

const (
	ContractRetSuccess = "SUCCESS"
)

type TronResult struct {
	BlockNumber uint64          `json:"block_number"`
	TronBlock   json.RawMessage `json:"tron_block"`
	TronTxInfos json.RawMessage `json:"tron_tx_infos"`
	TVMBlock    json.RawMessage `json:"tvm_block"`
	TVMReceipts json.RawMessage `json:"tvm_receipts"`
}

// TronBlock 完整区块结构
type TronBlock struct {
	BlockID      string             `json:"blockID"`
	BlockHeader  *TronBlockHeader   `json:"block_header"`
	Transactions []*TronTransaction `json:"transactions"`
}

// TronBlockHeader 区块头
type TronBlockHeader struct {
	RawData          *TronBlockHeaderRawData `json:"raw_data"`
	WitnessSignature string                  `json:"witness_signature"`
}

// TronBlockHeaderRawData 区块头原始数据
type TronBlockHeaderRawData struct {
	Number         int64  `json:"number"`
	TxTrieRoot     string `json:"txTrieRoot"`
	WitnessAddress string `json:"witness_address"`
	ParentHash     string `json:"parentHash"`
	Version        int    `json:"version"`
	Timestamp      int64  `json:"timestamp"`
}

// TronTransaction TRON 交易
type TronTransaction struct {
	Ret        []*TronTxRet   `json:"ret"`
	Signature  []string       `json:"signature"`
	TxID       string         `json:"txID"`
	RawData    *TronTxRawData `json:"raw_data"`
	RawDataHex string         `json:"raw_data_hex"`
}

// TronTxRet 交易返回结果
type TronTxRet struct {
	ContractRet string `json:"contractRet"`
}

// TronTxRawData 交易原始数据
type TronTxRawData struct {
	Contract      []*TronContract `json:"contract"`
	RefBlockBytes string          `json:"ref_block_bytes"`
	RefBlockHash  string          `json:"ref_block_hash"`
	Expiration    int64           `json:"expiration"`
	Timestamp     int64           `json:"timestamp"`
}

// TronContract TRON合约
type TronContract struct {
	Parameter *TronContractParameter `json:"parameter"`
	Type      string                 `json:"type"`
}

// TronContractParameter 合约参数
type TronContractParameter struct {
	Value   *TronContractValue `json:"value"`
	TypeURL string             `json:"type_url"`
}

// TronContractValue 合约值
type TronContractValue struct {
	Amount       int64  `json:"amount"`
	OwnerAddress string `json:"owner_address"`
	ToAddress    string `json:"to_address"`
}

// TronTxInfo 交易信息
type TronTxInfo struct {
	BlockNumber     int64        `json:"blockNumber"`
	ContractResult  []string     `json:"contractResult"`
	BlockTimeStamp  int64        `json:"blockTimeStamp"`
	Receipt         *TronReceipt `json:"receipt"`
	ID              string       `json:"id"`
	Log             []*TronLog   `json:"log"`
	ContractAddress string       `json:"contract_address"`
}

// TronReceipt 交易收据
type TronReceipt struct {
	NetUsage           int64  `json:"net_usage"`
	Result             string `json:"result"`
	EnergyPenaltyTotal int64  `json:"energy_penalty_total"`
	EnergyUsage        int64  `json:"energy_usage"`
	EnergyUsageTotal   int64  `json:"energy_usage_total"`
	OriginEnergyUsage  int64  `json:"origin_energy_usage"`
}

// TronLog 交易日志
type TronLog struct {
	Address string   `json:"address"`
	Data    string   `json:"data"`
	Topics  []string `json:"topics"`
}

// 程序内部使用的简易交易状态
type TronTxStatus struct {
	Txid        string
	ContractRet bool // 是否执行成功
}

// TronTransferEvent TRON Transfer 事件
type TronTransferEvent struct {
	ContractAddress string          // 合约地址（TRX格式）
	From            string          // 转账 from 地址（TRX格式）
	To              string          // 转账 to 地址（TRX格式）
	Amount          decimal.Decimal // 转账金额
	TxID            string          // 交易ID
	BlockNumber     int64           // 区块高度
	LogIndex        int             // 日志索引
}
