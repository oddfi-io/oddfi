package consts

const (
	ETH_TASK_NAME   = "full_forward_eth"
	BASE_TASK_NAME  = "full_forward_base"
	BSC_TASK_NAME   = "full_forward_bsc"
	BLAST_TASK_NAME = "full_forward_blast"

	POLYGON_TASK_NAME   = "full_forward_polygon"
	AVALANCHE_TASK_NAME = "full_forward_avalanche"
	ARBITRUM_TASK_NAME  = "full_forward_arbitrum"
	OPTIMISM_TASK_NAME  = "full_forward_optimism"
	LINEA_TASK_NAME     = "full_forward_linea"

	ZKSYNC_TASK_NAME = "full_forward_zksync"

	// real time
	SUI_TASK_NAME                = "full_forward_sui"
	SUI_HISTORY_PHASE_TASK_PRFIX = "full_forward_sui_history_phase_%d"
	BTC_TASK_NAME                = "full_forward_btc"
	TRON_TASK_NAME               = "full_forward_tron"
	TON_TASK_NAME                = "full_forward_ton_quick"
)

const (
	BTC_REALTIME_TASK_NAME       = "full_realtime_btc"
	ETH_REALTIME_TASK_NAME       = "full_realtime_eth"
	BASE_REALTIME_TASK_NAME      = "full_realtime_base"
	BSC_REALTIME_TASK_NAME       = "full_realtime_bsc"
	BLAST_REALTIME_TASK_NAME     = "full_realtime_blast"
	POLYGON_REALTIME_TASK_NAME   = "full_realtime_polygon"
	AVALANCHE_REALTIME_TASK_NAME = "full_realtime_avalanche"
	ARBITRUM_REALTIME_TASK_NAME  = "full_realtime_arbitrum"
	OPTIMISM_REALTIME_TASK_NAME  = "full_realtime_optimism"
	LINEA_REALTIME_TASK_NAME     = "full_realtime_linea"
	ZKSYNC_REALTIME_TASK_NAME    = "full_realtime_zksync"
	TRON_REALTIME_TASK_NAME      = "full_realtime_tron"
)

const (
	BTC_BACKWARD_TASK_NAME  = "full_backward_btc"
	TRON_BACKWARD_TASK_NAME = "full_backward_tron"

	ETH_BACKWARD_TASK_NAME       = "full_backward_eth"
	BASE_BACKWARD_TASK_NAME      = "full_backward_base"
	BSC_BACKWARD_TASK_NAME       = "full_backward_bsc"
	BLAST_BACKWARD_TASK_NAME     = "full_backward_blast"
	POLYGON_BACKWARD_TASK_NAME   = "full_backward_polygon"
	AVALANCHE_BACKWARD_TASK_NAME = "full_backward_avalanche"
	ARBITRUM_BACKWARD_TASK_NAME  = "full_backward_arbitrum"
	OPTIMISM_BACKWARD_TASK_NAME  = "full_backward_optimism"
	LINEA_BACKWARD_TASK_NAME     = "full_backward_linea"
	ZKSYNC_BACKWARD_TASK_NAME    = "full_backward_zksync"
	SUI_BACKWARD_TASK_NAME       = "full_backward_sui"
	TON_BACKWARD_TASK_NAME       = "full_backward_ton_quick"
)

const (
	Eth_Client_Timeout = 70
	Rpc_Timeout        = "60s"
)

const (
	Debug_TraceBlockByNumber = "debug_traceBlockByNumber"
	Trace_Block              = "trace_block"
	Arbitrum_Trace_Block     = "arbtrace_block"
)

const (
	Success_Status = "success"
	Failed_Status  = "failed"
)

// tracerConfigs provides default configuration for tracer-related RPC calls.
// 输入: 无
// 输出: map[string]interface{} 类型的追踪器配置
// 作用: 用于统一管理 tracer 的参数配置，便于后续 RPC 调用时复用。
// 注意: 由于 map 不是常量，这里使用变量声明。
var Tracer_Configs = map[string]interface{}{
	"tracer": "callTracer",
	"tracerConfig": map[string]interface{}{
		"onlyTopCall": false,
	},
	"timeout": Rpc_Timeout, // 直接引用本包常量，无需加包名前缀
}
