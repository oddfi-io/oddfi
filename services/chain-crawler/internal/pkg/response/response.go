package response

import (
	"errors"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	RequestCount = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "web3",
		Subsystem: "middleware",
		Name:      "request_count",
		Help:      "Request count",
	}, []string{
		"path",
		"code",
	})

	RequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "middleware",
		Name:      "request_duration",
		Help:      "Request duration",
	}, []string{
		"api",
	})
)

type Response struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

type GinReplier interface {
	Reply(*gin.Context, any, time.Time, string)
	ReplyError(*gin.Context, error, time.Time, string)
}

func NewGinReplier() GinReplier {
	return &ginReplierImpl{}
}

type ginReplierImpl struct{}

func (g *ginReplierImpl) Reply(c *gin.Context, data any, startTime time.Time, api string) {
	c.JSON(200, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
	RequestDuration.WithLabelValues(api).Observe(time.Since(startTime).Seconds())
	RequestCount.WithLabelValues(api, fmt.Sprint(0)).Inc()
}

func (g *ginReplierImpl) ReplyError(c *gin.Context, err error, startTime time.Time, api string) {
	var e Error
	if errors.As(err, &e) {
		c.JSON(e.Code, Response{
			Code:    e.Code,
			Message: e.Message,
		})
		RequestDuration.WithLabelValues(api).Observe(time.Since(startTime).Seconds())
		RequestCount.WithLabelValues(api, fmt.Sprint(e.Code)).Inc()
		return
	}
	c.JSON(ErrInternalServer.Code, Response{
		Code:    ErrInternalServer.Code,
		Message: ErrInternalServer.Message,
	})
	RequestDuration.WithLabelValues(api).Observe(time.Since(startTime).Seconds())
	RequestCount.WithLabelValues(api, fmt.Sprint(ErrInternalServer.Code)).Inc()
}
