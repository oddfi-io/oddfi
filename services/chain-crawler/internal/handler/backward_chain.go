package handler

import (
	"chain_crawler/internal/repository"
	"chain_crawler/internal/worker/backward"
	"chain_crawler/pkg/consts"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"chain_crawler/internal/pkg/response"
	"chain_crawler/pkg/tracelog"

	"github.com/gin-gonic/gin"
)

type BackwardChainReq struct {
	ChainName  consts.Chain      `json:"chain_name" form:"chain_name"`
	StartBlock uint64            `json:"start_block"`
	EndBlock   uint64            `json:"end_block"`
	Extension  map[string]string `json:"extension,omitempty"` // 回溯任务参数，会在发送Kafka消息时放入Kafka的header中
}

func (h *handlerImpl) BackwardChain(c *gin.Context) {
	ctx := c.Request.Context()
	// 为区块链查询创建 span，追踪查询时间
	backwardChainSpanCtx, backwardChainSpan := tracelog.StartSpan(ctx, "blockchain", "BackwardChain")
	defer backwardChainSpan.End()
	tl := tracelog.NewWithContext(backwardChainSpanCtx)
	var params BackwardChainReq
	if err := c.BindJSON(&params); err != nil {
		tl.Errorw("BackwardChain BindQuery", "error", err.Error())
		h.ReplyError(c, response.BuildError(response.ErrBadRequest, err), time.Now(), "BackwardChain")
		return
	}
	h.backwardChain(backwardChainSpanCtx, c, &params)
}

func (h *handlerImpl) canonicalBackwardChain(ctx context.Context, chain consts.Chain) consts.Chain {
	// 为区块链查询创建 span，追踪查询时间
	_, canonicalBackwardChainSpan := tracelog.StartSpan(ctx, "blockchain", "canonicalBackwardChain")
	defer canonicalBackwardChainSpan.End()
	switch strings.ToLower(string(chain)) {
	case "ethereum":
		return consts.CHAIN_ETHEREUM
	case "btc":
		return consts.CHAIN_BITCOIN
	default:
		return chain
	}
}

func (h *handlerImpl) backwardChain(ctx context.Context, c *gin.Context, params *BackwardChainReq) {
	// 为区块链查询创建 span，追踪查询时间
	backwardChainSpanCtx, backwardChainSpan := tracelog.StartSpan(ctx, "blockchain", "backwardChain")
	defer backwardChainSpan.End()
	tl := tracelog.NewWithContext(backwardChainSpanCtx)

	tl.Infow("BackwardChain", "chain", params.ChainName, "startBlock", params.StartBlock, "endBlock", params.EndBlock)

	start := time.Now()
	if params.ChainName == "" || params.StartBlock == 0 || params.EndBlock == 0 {
		tl.Errorw("BackwardChain", "error", "chain_name, start_block, end_block cannot be empty")
		h.ReplyError(c, response.BuildError(response.ErrInvalidParams, errors.New("chain_name, start_block, end_block cannot be empty")), start, "BackwardChain")
		return
	}
	if params.StartBlock > params.EndBlock {
		tl.Errorw("BackwardChain", "error", "start_block cannot be greater than end_block")
		h.ReplyError(c, response.BuildError(response.ErrInvalidParams, errors.New("start_block cannot be greater than end_block")), start, "BackwardChain")
		return
	}
	params.ChainName = h.canonicalBackwardChain(backwardChainSpanCtx, params.ChainName)

	chain := params.ChainName
	startBlock := params.StartBlock
	endBlock := params.EndBlock

	taskName := backward.GetFullBackwardTaskName(chain, startBlock, endBlock)
	tasks, err := h.repository.QueryTask(backwardChainSpanCtx, repository.QueryTaskParams{
		Task: taskName,
	})
	if err != nil {
		tl.Errorw("BackwardChain QueryTask failed", "chain", chain, "startBlock", startBlock, "endBlock", endBlock, "timeCost", fmt.Sprintf("%.3fs", time.Since(start).Seconds()), "err", err)
		h.ReplyError(c, err, start, "BackwardChain")
		return
	}

	taskData := &backward.FullBackwardTaskData{
		Chain:      params.ChainName,
		StartBlock: params.StartBlock,
		EndBlock:   params.EndBlock,
		Extension:  params.Extension,
	}
	data, _ := json.Marshal(taskData)

	if len(tasks) != 0 {
		task := tasks[0] // task name 是唯一的，所以只会有一个任务
		if task.State == repository.TaskStatePending || task.State == repository.TaskStateProcessing {
			// 不必重复插入一个相同的未完成任务
			h.Reply(c, "ok", start, "BackwardChain")
			tl.Infow("BackwardChain success", "chain", chain, "startBlock", startBlock, "endBlock", endBlock, "timeCost", fmt.Sprintf("%.3fs", time.Since(start).Seconds()))
			return
		}
		task.UpdatedAt = time.Now()
		task.State = repository.TaskStatePending // 更新状态为待处理
		task.Data = string(data)
		if _, err = h.repository.UpdateTaskWithSelect(backwardChainSpanCtx, task); err != nil {
			tl.Errorw("BackwardChain UpdateTaskWithSelect failed", "chain", chain, "startBlock", startBlock, "endBlock", endBlock, "timeCost", fmt.Sprintf("%.3fs", time.Since(start).Seconds()), "err", err)
			h.ReplyError(c, err, start, "BackwardChain")
			return
		}
		h.Reply(c, "ok", start, "BackwardChain")
		tl.Infow("BackwardChain success", "chain", chain, "startBlock", startBlock, "endBlock", endBlock, "timeCost", fmt.Sprintf("%.3fs", time.Since(start).Seconds()))
		return
	}

	task := repository.ScheduleTask{
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Task:      taskName,
		State:     repository.TaskStatePending,
		Data:      string(data),
	}
	if _, err = h.repository.CreateTask(backwardChainSpanCtx, task); err != nil {
		tl.Errorw("BackwardChain CreateTask failed", "chain", chain, "startBlock", startBlock, "endBlock", endBlock, "timeCost", fmt.Sprintf("%.3fs", time.Since(start).Seconds()), "err", err)
		h.ReplyError(c, err, start, "BackwardChain")
		return
	}

	h.Reply(c, "ok", start, "BackwardChain")
	tl.Infow("BackwardChain success", "chain", chain, "startBlock", startBlock, "endBlock", endBlock, "timeCost", fmt.Sprintf("%.3fs", time.Since(start).Seconds()))
}
