package logger

type LoggerIndex string

const (
	LogIndexCandlestick LoggerIndex = "candlestick"
	LogIndexKline       LoggerIndex = "kline"
	LogIndexRedis       LoggerIndex = "redis"
	LogIndexGauss       LoggerIndex = "gauss"
)

func (l LoggerIndex) String() string {
	return string(l)
}
