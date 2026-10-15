package handler

import (
	"context"
	"testing"

	"chain_crawler/internal/config"
	"chain_crawler/internal/pkg/response"
	"chain_crawler/internal/repository"
	"chain_crawler/pkg/tracelog"

	"github.com/gin-gonic/gin"
)

func TestHandlerImpl_BackwardChain(t *testing.T) {
	tracelog.InitLogger("dev")
	ctx := context.Background()
	cfg := config.Config{MySQL: config.MySQLConfig{
		DSN: "",
	}}
	h := &handlerImpl{
		cfg:        cfg,
		GinReplier: response.NewGinReplier(),
		repository: repository.NewRepository(ctx, cfg),
	}
	c := &gin.Context{}
	h.backwardChain(ctx, c, &BackwardChainReq{
			ChainName: "gatechain",
			StartBlock:  18901994,
			EndBlock:  18901994,
	})

}
