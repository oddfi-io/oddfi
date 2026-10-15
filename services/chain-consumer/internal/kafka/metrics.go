package kafka

import (
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	fwd = "forward"
	bwd = "backward"

	KafkaOffsetMap = sync.Map{}

	// 单次kafka消息处理时间,区分forward / backward topic
	KfkMsgConsumeDur = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "blockdata_backup",
		Name:      "kfk_consume_cost_time_ms",
		Help:      "kafka msg consume cost time(ms)",
	}, []string{"topic", "topic_type"})

	// 各消费kafka次数,区分forward / backward topic
	KfkMsgConsumeCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "web3",
		Subsystem: "blockdata_backup",
		Name:      "kfk_consume_count",
		Help:      "kafka msg consume count",
	}, []string{"topic", "topic_type"})

	// 单次kafka消息大小,区分forward / backward topic
	KfkMsgSize = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "blockdata_backup",
		Name:      "kfk_msg_size",
		Help:      "kafka msg size",
	}, []string{"topic", "topic_type"})

	// 各消费rebalance次数
	KfkRebalanceCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "web3",
		Subsystem: "blockdata_backup",
		Name:      "kfk_rebalance_count",
		Help:      "kafka rebalance count",
	}, []string{"topic"})

	// 各kafka消费最新点
	KfkHighWatermark = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "blockdata_backup",
		Name:      "kfk_high_watermark",
		Help:      "kafka high watermark",
	}, []string{"topic", "partition"})

	// 各分区偏移量
	KfkMsgOffset = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "blockdata_backup",
		Name:      "kfk_msg_offset",
		Help:      "kafka msg offset",
	}, []string{"topic"})

	// 各kafka消费错误率，消费失败数
	kfkMsgErrorCount = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "web3",
			Subsystem: "blockdata_backup",
			Name:      "kfk_msg_success_count",
			Help:      "kafka msg success count",
		}, []string{"topic"})

	// 各kafka消费错误率，消费总数
	kfkMsgTotalCount = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "web3",
			Subsystem: "blockdata_backup",
			Name:      "kfk_msg_total_count",
			Help:      "kafka msg total count",
		}, []string{"topic"})
)

func GetMetrics() []prometheus.Collector {
	return []prometheus.Collector{
		KfkMsgConsumeDur,
		KfkMsgConsumeCount,
		KfkMsgSize,
		KfkRebalanceCount,
		KfkHighWatermark,
		KfkMsgOffset,
		kfkMsgErrorCount,
		kfkMsgTotalCount,
	}
}

func KafkaMsgDur(topic string) func() {
	start := time.Now()

	return func() {
		KfkMsgConsumeDur.WithLabelValues(topic, TopicType(topic)).
			Observe(float64(time.Since(start).Milliseconds()))
	}
}

func KafkaMsgCount(topic string) {
	KfkMsgConsumeCount.WithLabelValues(topic, TopicType(topic)).Inc()
}

func KafkaMsgSize(topic string, size int) {
	KfkMsgSize.WithLabelValues(topic, TopicType(topic)).Set(float64(size))
}

func KafkaRebalance(topic string) {
	KfkRebalanceCount.WithLabelValues(topic).Inc()
}

func KafkaMsgError(topic string) {
	kfkMsgErrorCount.WithLabelValues(topic).Inc()
}

func KafkaMsgTotal(topic string) {
	kfkMsgTotalCount.WithLabelValues(topic).Inc()
}

func KafkaMsgWatermark(topic string, wm int64, par int32) {
	KfkHighWatermark.WithLabelValues(topic, strconv.FormatInt(int64(par), 10)).Set(float64(wm))
}

func KafkaMsgOffset(topic string, of int64) {
	KfkMsgOffset.WithLabelValues(topic).Set(float64(of))
}

func TopicType(topic string) string {
	if strings.Contains(topic, bwd) {
		return bwd
	}
	return fwd
}
