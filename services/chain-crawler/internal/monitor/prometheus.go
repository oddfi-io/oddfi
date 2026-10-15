package monitor

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	Registry = prometheus.NewRegistry()

	LatestBlockNumber = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "chaincrawler",
		Name:      "latest_block_number",
		Help:      "Latest block number",
	}, []string{
		"env",
		"chain",
	})

	RealtimeBlockNumber = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "chaincrawler",
		Name:      "realtime_block_number",
		Help:      "Realtime block number",
	}, []string{
		"env",
		"chain",
	})

	DelayBlockNumber = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "chaincrawler",
		Name:      "delay_block_number",
		Help:      "Delay block number",
	}, []string{
		"env",
		"chain",
	})

	RealTimeDelayBlockNumber = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "chaincrawler",
		Name:      "realtime_delay_block_number",
		Help:      "Realtime delay block number",
	}, []string{
		"env",
		"chain",
	})

	CurrentBlockNumber = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "chaincrawler",
		Name:      "current_block_number",
		Help:      "Current block number",
	}, []string{
		"env",
		"chain",
	})

	CurrentBlockDelay = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "chaincrawler",
		Name:      "current_block_delay",
		Help:      "Current block delay",
	}, []string{
		"chain",
	})

	CurrentBackBlockNumber = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "chaincrawler",
		Name:      "current_back_block_number",
		Help:      "Current back block number",
	}, []string{
		"env",
		"chain",
	})

	HistoryBlockNumber = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "chaincrawler",
		Name:      "history_block_number",
		Help:      "history block number",
	}, []string{
		"env",
		"chain",
		"startBlock",
		"endBlock",
	})
)

// func init() {
// 	Registry.MustRegister(
// 		collectors.NewGoCollector(),
// 		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
// 		LatestBlockNumber,
// 		RealtimeBlockNumber,
// 		DelayBlockNumber,
// 		RealTimeDelayBlockNumber,
// 		CurrentBlockNumber,
// 		CurrentBackBlockNumber,
// 		CurrentBlockDelay,
// 		HistoryBlockNumber,
// 		response.RequestCount,
// 		response.RequestDuration,
// 		httpclient.HttpRequestDuration,
// 		httpclient.HttpResponseStatus,
// 		ethclient.RequestDuration,
// 		kafka.RequestDuration,
// 		redis.RequestDuration,
// 		ethclient.TraceBlockRequestDuration,
// 		suiclient.RequestDuration,
// 		tronclient.TronRpcRequestDuration,
// 		tronclient.TronRpcRequestCount,
// 		tronclient.TronRpcRequestErrors,
// 	)
// }
