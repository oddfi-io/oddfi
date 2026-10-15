package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"oddfi-web-spider/config"
	"oddfi-web-spider/model"

	kafkago "github.com/segmentio/kafka-go"
)

var Writer *kafkago.Writer

// InitKafka 初始化 Kafka 生产者
func InitKafka() {
	Writer = &kafkago.Writer{
		Addr:         kafkago.TCP(config.AppConfigData.Kafka.Brokers...),
		Topic:        config.AppConfigData.Kafka.Topic,
		Balancer:     &kafkago.LeastBytes{},
		WriteTimeout: 10 * time.Second,
	}
	log.Println("✅ Kafka 生产者初始化成功")
}

// PublishLeaguesUpdate 推送联赛更新事件到 Kafka
func PublishLeaguesUpdate(leagues []model.League) {
	for _, league := range leagues {
		msgBytes, err := json.Marshal(league)
		if err != nil {
			log.Printf("Kafka 序列化失败: %v", err)
			continue
		}

		err = Writer.WriteMessages(context.Background(),
			kafkago.Message{
				Key:   []byte("league_update"),
				Value: msgBytes,
			},
		)
		if err != nil {
			log.Printf("❌ 推送 Kafka 失败: %v", err)
		}
	}
}

// Close 关闭 Kafka 连接
func Close() {
	if Writer != nil {
		Writer.Close()
	}
}
