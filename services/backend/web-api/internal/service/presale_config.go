package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/repository"

	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"
)

// configCacheKey Redis 缓存键，版本化避免旧格式缓存命中
const configCacheKey = "presale:config:v1"

// configCacheTTL config 缓存 30s（监听器 confirm deposit 后 DEL，下次请求刷新 sold/raised）
const configCacheTTL = 30 * time.Second

// ===========================
// Response DTOs
// ===========================

// VaultInfo 金库信息（对齐 02-api-contract.md §3.1）
type VaultInfo struct {
	DepositAddress       string `json:"depositAddress"`
	Chain                string `json:"chain"`
	ChainID              int    `json:"chainId"`
	Asset                string `json:"asset"`
	UsdtAddress          string `json:"usdtAddress"`
	MinSubscribeUsd      string `json:"minSubscribeUsd"`
	TotalRaisedUsd       string `json:"totalRaisedUsd"`
	TotalTargetUsd       string `json:"totalTargetUsd"`
	TgeTs                int64  `json:"tgeTs"`
	TgeOpenPriceUsd      string `json:"tgeOpenPriceUsd"`
	Audit                string `json:"audit"`
	BoundaryToleranceMin int    `json:"boundaryToleranceMin"`
}

// RoundInfo 轮次信息（对齐 02-api-contract.md §3.1）
// tgeDiscountPct 是衍生字段，后端计算后填入
type RoundInfo struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	RoundType         string  `json:"roundType"`
	Price             string  `json:"price"`
	Supply            string  `json:"supply"`
	Sold              string  `json:"sold"`
	Raised            string  `json:"raised"`
	TargetRaiseUsd    string  `json:"targetRaiseUsd"`
	SoldPercent       float64 `json:"soldPercent"`
	MinPerOrderUsd    *string `json:"minPerOrderUsd"`
	MaxPerWalletUsd   *string `json:"maxPerWalletUsd"`
	TgeReleasePct     string  `json:"tgeReleasePct"`
	LinearReleaseDays uint    `json:"linearReleaseDays"`
	ReferralRewardPct string  `json:"referralRewardPct"`
	TgeDiscountPct    string  `json:"tgeDiscountPct"` // 衍生字段：(tge_open_price - price) / tge_open_price × 100
	StartTs           int64   `json:"startTs"`
	EndTs             int64   `json:"endTs"`
	Status            string  `json:"status"`
	Badge             *string `json:"badge"`
}

// ConfigResponse GET /api/v1/presale/config 响应（对齐 02-api-contract.md §3.1）
type ConfigResponse struct {
	Vault    VaultInfo   `json:"vault"`
	Rounds   []RoundInfo `json:"rounds"`
	ServerTs int64       `json:"serverTs"`
}

// ===========================
// Service 接口定义
// ===========================

// PresaleConfigService 预售配置聚合服务
type PresaleConfigService interface {
	// GetConfig 返回轮次配置 + 金库地址 + 全局参数（Redis 30s 缓存）
	GetConfig(ctx context.Context) (*ConfigResponse, error)
}

// ===========================
// 实现
// ===========================

type presaleConfigService struct {
	configRepo repository.PresaleConfigRepository
	roundRepo  repository.PresaleRoundRepository
	rdb        *redis.Client
	// usdtAddress BSC 上 USDT 合约地址（从 env 注入，对齐 02-api-contract.md §3.1 示例）
	usdtAddress string
}

// NewPresaleConfigService 构造函数，依赖注入
func NewPresaleConfigService(
	configRepo repository.PresaleConfigRepository,
	roundRepo repository.PresaleRoundRepository,
	rdb *redis.Client,
	usdtAddress string,
) PresaleConfigService {
	return &presaleConfigService{
		configRepo:  configRepo,
		roundRepo:   roundRepo,
		rdb:         rdb,
		usdtAddress: usdtAddress,
	}
}

func (s *presaleConfigService) GetConfig(ctx context.Context) (*ConfigResponse, error) {
	// 1. 尝试 Redis 缓存（缓存未命中或反序列化失败时降级到 DB）
	if cached, err := s.rdb.Get(ctx, configCacheKey).Bytes(); err == nil {
		var resp ConfigResponse
		if jsonErr := json.Unmarshal(cached, &resp); jsonErr == nil {
			return &resp, nil
		}
		// 反序列化失败说明缓存内容损坏，继续走 DB 路径
		logger.Warnf("[PresaleConfigService] cache unmarshal failed, falling back to DB")
	}

	// 2. DB 查询：全局配置 + 轮次列表 + 总募资
	cfg, err := s.configRepo.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleConfigService] get config: %w", err)
	}

	rounds, err := s.roundRepo.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleConfigService] list rounds: %w", err)
	}

	totalRaised, err := s.roundRepo.TotalRaisedUsd(ctx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleConfigService] total raised usd: %w", err)
	}

	// 3. 组装响应
	resp := s.buildConfigResponse(cfg, rounds, totalRaised)

	// 4. 写 Redis（写入失败不阻塞，缓存是优化非依赖）
	if b, marshalErr := json.Marshal(resp); marshalErr == nil {
		if setErr := s.rdb.Set(ctx, configCacheKey, b, configCacheTTL).Err(); setErr != nil {
			logger.Warnf("[PresaleConfigService] failed to set cache: %v", setErr)
		}
	}

	return resp, nil
}

// buildConfigResponse 组装 ConfigResponse，含 tgeDiscountPct 衍生字段计算
func (s *presaleConfigService) buildConfigResponse(
	cfg *model.PresaleConfig,
	rounds []*model.PresaleRound,
	totalRaised decimal.Decimal,
) *ConfigResponse {
	// 金库信息
	auditLabel := ""
	if cfg.AuditLabel != nil {
		auditLabel = *cfg.AuditLabel
	}

	vault := VaultInfo{
		DepositAddress:       cfg.VaultAddress,
		Chain:                "BSC",
		ChainID:              56,
		Asset:                "USDT",
		UsdtAddress:          s.usdtAddress,
		MinSubscribeUsd:      cfg.MinSubscribeUsd.String(),
		TotalRaisedUsd:       totalRaised.String(),
		TotalTargetUsd:       cfg.TotalTargetUsd.String(),
		TgeTs:                cfg.TgeTs,
		TgeOpenPriceUsd:      cfg.TgeOpenPriceUsd.String(),
		Audit:                auditLabel,
		BoundaryToleranceMin: cfg.BoundaryToleranceMin,
	}

	// 轮次列表（按 sort_order 升序，List() 已在 DB 层排序）
	roundInfos := make([]RoundInfo, 0, len(rounds))
	for _, r := range rounds {
		roundInfos = append(roundInfos, buildRoundInfo(r, cfg.TgeOpenPriceUsd))
	}

	// 按 sort_order 在内存二次排序，保证顺序稳定（DB 已排，但显式排序更清晰）
	sort.Slice(roundInfos, func(i, j int) bool {
		return roundInfos[i].StartTs < roundInfos[j].StartTs
	})

	return &ConfigResponse{
		Vault:    vault,
		Rounds:   roundInfos,
		ServerTs: time.Now().UnixMilli(),
	}
}

// buildRoundInfo 将 model.PresaleRound 转换为 RoundInfo，含衍生字段计算
// tgeDiscountPct 公式：(tge_open_price - round.price) / tge_open_price × 100
// 使用 decimal 精确计算，精度保留 18 位（前端展示时可自行 round）
func buildRoundInfo(r *model.PresaleRound, tgeOpenPrice decimal.Decimal) RoundInfo {
	// tgeDiscountPct = (tge_open_price - price) / tge_open_price * 100
	// 特殊情况：tge_open_price = 0 时（未配置）返回 "0"，防止除零
	var tgeDiscountPct decimal.Decimal
	if tgeOpenPrice.IsPositive() {
		tgeDiscountPct = tgeOpenPrice.Sub(r.PriceUsd).
			Div(tgeOpenPrice).
			Mul(decimal.NewFromInt(100))
	}

	// soldPercent = sold / supply * 100（float64 供前端进度条展示，精度要求不高）
	var soldPercent float64
	if r.SupplyOdd.IsPositive() {
		pct, _ := r.SoldOdd.Div(r.SupplyOdd).Mul(decimal.NewFromInt(100)).Float64()
		soldPercent = pct
	}

	// 可选金额限制字段：nil 时传 null（对齐 API 契约 §3.1 示例）
	var minPerOrderUsd, maxPerWalletUsd *string
	if r.MinPerOrderUsd != nil {
		s := r.MinPerOrderUsd.String()
		minPerOrderUsd = &s
	}
	if r.MaxPerWalletUsd != nil {
		s := r.MaxPerWalletUsd.String()
		maxPerWalletUsd = &s
	}

	return RoundInfo{
		ID:                r.ID,
		Name:              r.Name,
		RoundType:         r.RoundType,
		Price:             r.PriceUsd.String(),
		Supply:            r.SupplyOdd.String(),
		Sold:              r.SoldOdd.String(),
		Raised:            r.RaisedUsd.String(),
		TargetRaiseUsd:    r.TargetRaiseUsd.String(),
		SoldPercent:       soldPercent,
		MinPerOrderUsd:    minPerOrderUsd,
		MaxPerWalletUsd:   maxPerWalletUsd,
		TgeReleasePct:     r.TgeReleasePct.String(),
		LinearReleaseDays: r.LinearReleaseDays,
		ReferralRewardPct: r.ReferralRewardPct.String(),
		TgeDiscountPct:    tgeDiscountPct.String(),
		StartTs:           r.StartTs,
		EndTs:             r.EndTs,
		Status:            r.Status,
		Badge:             r.Badge,
	}
}
