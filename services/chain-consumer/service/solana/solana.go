package solana

import (
	"chain-consumer/global"
	"chain-consumer/internal"
	"chain-consumer/internal/kafka"
	"chain-consumer/internal/mysql"
	"chain-consumer/internal/tracelog"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/IBM/sarama"
	"github.com/spf13/cast"
	"gorm.io/gorm"
)

type SolanaService struct {
	ctx      context.Context
	consumer *kafka.KafkaConsumer
	db       *gorm.DB
}

func NewSolanaService(ctx context.Context, cfg global.Config) (*SolanaService, error) {
	handleMessageSpanCtx, handleMessageSpan := tracelog.StartSpan(ctx, "solana", "NewSolanaService")
	defer handleMessageSpan.End()
	tl := tracelog.NewWithContext(handleMessageSpanCtx)

	s := &SolanaService{}

	// 检查 MySQL 是否初始化
	if mysql.IsEmpty() {
		return nil, fmt.Errorf("mysql is not initialized")
	}
	s.db = mysql.GetDB()

	consumer, err := kafka.NewKafkaConsumer(cfg.Global.ConsumerGroup, cfg.Solana.Kafka, s.HandleMessage)
	if err != nil {
		tl.Errorw("创建 Kafka 消费者失败", "error", err)
		return nil, err
	}
	s.consumer = consumer
	s.ctx = ctx
	return s, nil
}

func (s *SolanaService) Start() {
	s.consumer.Start(s.ctx)
}

func (s *SolanaService) Stop() {
	s.consumer.Stop(s.ctx)
}

func (s *SolanaService) HandleMessage(ctx context.Context, m *sarama.ConsumerMessage) error {
	handleMessageSpanCtx, handleMessageSpan := tracelog.StartSpan(tracelog.TransferCtxTrace(ctx, m), "kafka", "Solana-HandleMessage")
	defer handleMessageSpan.End()
	tl := tracelog.NewWithContext(handleMessageSpanCtx)
	tl.Infow("处理 Solana 消息", "key", string(m.Key))
	ss := strings.Split(string(m.Key), "_")
	if len(ss) == 3 {
		slot := cast.ToInt64(ss[2])
		if slot <= 0 {
			tl.Errorw("无效的 slot", "slot", ss[2])
			return nil
		}
		// objKey := fmt.Sprintf("solana/%d/block_slot_%d", slot/10000, slot)
		// value := fmt.Sprintf("{\"slot\": %d,\"block\":%s}", slot, string(m.Value))
		// err := s.cosClient.PushBlockDataToCos(handleMessageSpanCtx, objKey, []byte(value), internal.ChainSolana)
		// if err != nil {
		// 	tl.Errorw("推送 Solana 数据到 COS 失败", "objKey", objKey, "error", err)
		// 	return fmt.Errorf("推送 Solana 数据到 COS 失败: %w", err)
		// }
		var blockMsg SolBlockMsg
		if err := json.Unmarshal(m.Value, &blockMsg); err == nil {
			if _, err := time.Parse("2006-01-02T15:04:05Z", blockMsg.BlockTime); err != nil {
				tl.Errorf("umarshal_err, 22, chain:%s, data:%s", internal.ChainSolana.String(), string(m.Value))
			}
		} else {
			tl.Errorf("umarshal_err, 11, chain:%s, data:%s", internal.ChainSolana.String(), string(m.Value))
		}
	}
	return nil
}
