package tron

import (
	"chain-consumer/global"
	"chain-consumer/internal"
	"chain-consumer/internal/kafka"
	"chain-consumer/internal/mysql"
	"chain-consumer/internal/tracelog"
	"chain-consumer/service"
	"chain-consumer/service/evm"
	"context"
	"encoding/hex"
	"fmt"
	"strings"

	"encoding/json"

	"github.com/IBM/sarama"
	"github.com/ethereum/go-ethereum/common"
	"github.com/golang/snappy"
	"github.com/redis/go-redis/v9"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

type TronService struct {
	ctx      context.Context
	consumer *kafka.KafkaConsumer
	db       *gorm.DB
	redis    *redis.Client
}

type TronMsg struct {
	Data struct {
		TronBlock struct {
			BlockHeader struct {
				RawData struct {
					Timestamp int64 `json:"timestamp"`
				} `json:"raw_data"`
			} `json:"block_header"`
		} `json:"tron_block"`
	} `json:"data"`
}

func NewTronService(ctx context.Context, cfg global.Config, redisClient *redis.Client) (service.Service, error) {
	s := &TronService{}
	s.ctx = ctx

	// 检查 MySQL 是否初始化
	if mysql.IsEmpty() {
		return nil, fmt.Errorf("mysql is not initialized")
	}
	s.db = mysql.GetDB()

	consumer, err := kafka.NewKafkaConsumer(cfg.Global.ConsumerGroup, cfg.Tron.Kafka, s.HandleMessage)
	if err != nil {
		return nil, err
	}
	s.consumer = consumer
	s.redis = redisClient
	return s, nil
}

func (tron *TronService) GetChainName() string {
	return internal.ChainTron.String()
}

func (tron *TronService) GetBlockCosKey(blockNumber int64) string {
	return fmt.Sprintf("tron/%d/block_by_number_%d", blockNumber, blockNumber)
}

func (tron *TronService) Start() {
	tron.consumer.Start(tron.ctx)
}

func (tron *TronService) Stop() {
	_ = tron.consumer.Stop(tron.ctx)
}

func (tron *TronService) HandleMessage(ctx context.Context, m *sarama.ConsumerMessage) error {
	ctx, span := tracelog.StartSpan(tracelog.TransferCtxTrace(ctx, m), "kafka", "Tron-HandleMessage")
	defer span.End()
	tl := tracelog.NewWithContext(ctx)

	tl.Infof("start handle tron msg, key:%s, Topic:%s, Offset:%d, value_len:%d",
		string(m.Key),
		m.Topic,
		m.Offset,
		len(m.Value),
	)

	decoded, err := snappy.Decode(nil, m.Value)
	if err != nil {
		tl.Errorf("Failed to decode snappy message, chain:%s, key:%s, err:%v",
			tron.GetChainName(),
			string(m.Key),
			err)
		return fmt.Errorf("failed to decode snappy message: %w", err)
	}

	var message evm.Message
	if err = json.Unmarshal(decoded, &message); err != nil {
		tl.Errorf("Failed to unmarshal message, chain:%s, key:%s, err:%v",
			tron.GetChainName(),
			string(m.Key),
			err)
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	var tronResult = &TronResult{}
	if err = json.Unmarshal(message.Data, tronResult); err != nil {
		tl.Errorf("Failed to unmarshal tron result, chain:%s, key:%s, err:%v",
			tron.GetChainName(),
			string(m.Key),
			err)
		return fmt.Errorf("failed to unmarshal tron result: %w", err)
	}

	blockNumber := tronResult.BlockNumber

	// 检查tron有没有需要记录的入金信息
	err = tron.CheckTronBlock(tronResult)
	if err != nil {
		tl.Errorf("Failed to check tron block, chain:%s, block_number:%d, err:%v",
			tron.GetChainName(),
			blockNumber,
			err,
		)
		return fmt.Errorf("failed to check tron block: %w", err)
	}

	tl.Infof("success handle tron msg, block_number:%d, chain:%s",
		blockNumber,
		tron.GetChainName(),
	)
	var tmsg TronMsg
	if err := json.Unmarshal(decoded, &tmsg); err != nil || tmsg.Data.TronBlock.BlockHeader.RawData.Timestamp == 0 {
		tl.Errorf("tron umarshal_err, chain:%s, data:%s", tron.GetChainName(), string(m.Value))
	}
	return nil
}

func (tron *TronService) CheckTronBlock(data *TronResult) error {
	var (
		eg                  errgroup.Group
		transactionsInfoMap = make(map[string]bool)
	)

	if data == nil {
		return nil
	}

	// 解析 TronBlock
	eg.Go(func() error {
		if len(data.TronBlock) > 0 {
			transactionsInfo, err := parseTronBlock(data.TronBlock)
			if err != nil {
				return fmt.Errorf("failed to parse tron block: %w", err)
			}

			transactionsInfoMap = lo.SliceToMap(transactionsInfo, func(txStatus *TronTxStatus) (string, bool) {
				return txStatus.Txid, txStatus.ContractRet
			})

			transactionsInfoMap = lo.SliceToMap(transactionsInfo, func(txStatus *TronTxStatus) (string, bool) {
				return txStatus.Txid, txStatus.ContractRet
			})

			transactionsInfoMap = lo.SliceToMap(transactionsInfo, func(txStatus *TronTxStatus) (string, bool) {
				return txStatus.Txid, txStatus.ContractRet
			})

			transactionsInfoMap = lo.SliceToMap(transactionsInfo, func(txStatus *TronTxStatus) (string, bool) {
				return txStatus.Txid, txStatus.ContractRet
			})
		}

		return nil
	})

	// 解析 TronTxInfos
	eg.Go(func() error {
		if len(data.TronTxInfos) > 0 {

		}
		return nil
	})

	if len(data.TronTxInfos) > 0 {

	}

	if err := eg.Wait(); err != nil {
		return fmt.Errorf("failed to check tron block: %w", err)
	}
	_ = transactionsInfoMap
	// // 解析 TVMBlock
	// var tvmBlock interface{}
	// if len(data.TVMBlock) > 0 && string(data.TVMBlock) != "null" {
	// 	if err := json.Unmarshal(data.TVMBlock, &tvmBlock); err != nil {
	// 		return fmt.Errorf("failed to unmarshal tvm block: %w", err)
	// 	}
	// }

	// // 解析 TVMReceipts
	// var tvmReceipts interface{}
	// if len(data.TVMReceipts) > 0 && string(data.TVMReceipts) != "null" {
	// 	if err := json.Unmarshal(data.TVMReceipts, &tvmReceipts); err != nil {
	// 		return fmt.Errorf("failed to unmarshal tvm receipts: %w", err)
	// 	}
	// }

	// TODO: 在这里添加业务逻辑，例如：
	// - 筛选入金交易
	// - 保存到数据库
	// - 发送通知等

	return nil
}

func parseTronBlock(data json.RawMessage) ([]*TronTxStatus, error) {
	var (
		txStatuses = make([]*TronTxStatus, 0)
		tronBlock  TronBlock
	)

	if err := json.Unmarshal(data, &tronBlock); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tron, parseTronBlock, err:%v", err)
	}

	// transactions 数组
	for _, tx := range tronBlock.Transactions {
		if tx == nil {
			continue
		}

		txStatus := TronTxStatus{Txid: tx.TxID}
		if len(tx.Ret) > 0 {
			txStatus.ContractRet = tx.Ret[0].ContractRet == ContractRetSuccess
			txStatuses = append(txStatuses, &txStatus)
		}
	}

	return txStatuses, nil
}

// todo : 写完tron
func parseTronTxInfos(data json.RawMessage) ([]TronTransferEvent, error) {
	var tronTxInfos []TronTxInfo
	if err := json.Unmarshal(data, &tronTxInfos); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tron tx infos: %w", err)
	}

	var transfers []TronTransferEvent

	for _, txInfo := range tronTxInfos {
		if len(txInfo.ID) == 0 {
			continue
		}
		for logIndex, log := range txInfo.Log {
			// 过滤非Trc20
			if log == nil || len(log.Topics) == 0 {
				continue
			}

			// 检查是否为 Transfer 事件 (topics[0] = event signature)
			if log.Topics[0] != TransferEventSignature {
				continue
			}

			// 手动解析 Transfer 事件
			// topics[1] = from address (indexed)
			// topics[2] = to address (indexed)
			// data = amount (uint256)
			if len(log.Topics) < 3 {
				continue
			}

			// 解析 from 地址 (从 topics[1] 提取最后 20 字节)
			fromHex := strings.TrimPrefix(log.Topics[1], "0x000000000000000000000000")
			if len(fromHex) != 40 {
				continue
			}
			fromAddr := "T" + base58Encode(mustHexDecode(fromHex))

			// 解析 to 地址 (从 topics[2] 提取最后 20 字节)
			toHex := strings.TrimPrefix(log.Topics[2], "0x000000000000000000000000")
			if len(toHex) != 40 {
				continue
			}
			toAddr := "T" + base58Encode(mustHexDecode(toHex))

			// 解析金额 (从 data 提取)
			amountHex := strings.TrimPrefix(log.Data, "0x")
			amountBigInt := common.BytesToHash(mustHexDecode(amountHex)).Big()
			amount := decimal.NewFromBigInt(amountBigInt, 0)

			// 转换合约地址为 TRX 格式
			contractHex := strings.TrimPrefix(log.Address, "0x")
			contractAddr := "T" + base58Encode(mustHexDecode(contractHex))

			transfers = append(transfers, TronTransferEvent{
				ContractAddress: contractAddr,
				From:            fromAddr,
				To:              toAddr,
				Amount:          amount,
				TxID:            txInfo.ID,
				BlockNumber:     txInfo.BlockNumber,
				LogIndex:        logIndex,
			})
		}
	}
	return transfers, nil
}

// TransferEventSignature 是 ERC-20 Transfer 事件的签名
const TransferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

// convertHexToTrxAddress 将 Hex 格式地址转换为 TRX Base58 格式
// Hex 格式: 41xxxxxxxxxxxx (41 + 40位十六进制)
// TRX 格式: T + Base58Check 编码
func convertHexToTrxAddress(hexAddr string) string {
	// 移除 0x 前缀（如果有）
	hexAddr = strings.TrimPrefix(hexAddr, "0x")

	// 如果是 41 开头，移除它
	if strings.HasPrefix(hexAddr, "41") {
		hexAddr = hexAddr[2:]
	}

	// 将 hex 转换为 bytes
	bytes := mustHexDecode(hexAddr)

	// 使用 base58 编码
	return "T" + base58Encode(bytes)
}

// mustHexDecode 解码 hex 字符串，失败时 panic
func mustHexDecode(s string) []byte {
	bytes, err := hex.DecodeString(s)
	if err != nil {
		return nil
	}
	return bytes
}

// base58Encode 使用 Base58 编码
func base58Encode(input []byte) string {
	alphabet := "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

	result := make([]byte, 0, len(input)*2)
	for _, b := range input {
		if b != 0 {
			result = append(result, b)
		}
	}

	// 计算前导零
	zeros := 0
	for _, b := range input {
		if b == 0 {
			zeros++
		} else {
			break
		}
	}

	// Base58 转换
	var parts []byte
	for len(result) > 0 {
		var quotient []byte
		var remainder byte
		for _, b := range result {
			temp := int(b) + int(remainder)*256
			quotient = append(quotient, byte(temp/58))
			remainder = byte(temp % 58)
		}
		parts = append([]byte{alphabet[remainder]}, parts...)
		for len(result) > 0 && result[0] == 0 {
			result = result[1:]
		}
		if len(result) == 0 {
			break
		}
		result = quotient
	}

	// 添加前导 '1'
	for i := 0; i < zeros; i++ {
		parts = append([]byte{alphabet[0]}, parts...)
	}

	return string(parts)
}

func parseTronTVMBlock(data *TronResult) error {
	return nil
}

func parseTronTVMReceipts(data *TronResult) error {
	return nil
}
