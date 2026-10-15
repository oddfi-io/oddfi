package middleware

import (
	"strings"
	"time"

	"chain_crawler/pkg/tracelog"

	"github.com/gin-gonic/gin"
)

func LoggerWithTraceID() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		pathSplits := strings.Split(c.Request.URL.Path, "/")
		ctx, span := tracelog.StartSpanWithRequest(c.Request, c.Request.URL.Path, pathSplits[len(pathSplits)-1])
		defer span.End()
		c.Request = c.Request.WithContext(ctx)
		tl := tracelog.NewWithContext(ctx)

		// run
		c.Next()

		// print response
		tl.Infow("response", "latency", time.Since(start), "path", c.Request.URL.Path, "method", c.Request.Method,
			"status_code", c.Writer.Status(), "response_size", c.Writer.Size(), "message", c.Errors.ByType(gin.ErrorTypePrivate).String(),
			"query", c.Request.URL.RawQuery, "form", c.Request.PostForm)
	}
}
