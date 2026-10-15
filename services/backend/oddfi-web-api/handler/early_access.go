package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"oddfi-web-api/model"
	"oddfi-web-api/storage"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// earlyAccessLogger 可在测试中替换为 bytes.Buffer 以捕获日志
// 默认指向标准 log 输出
var earlyAccessLogger io.Writer = log.Writer()

// earlyAccessRepo handler 持有的 repo 全局变量（跟随项目现有风格）
var earlyAccessRepo storage.EarlyAccessRepo

// referralSourceAllowed 合法的 referral_source 枚举值
var referralSourceAllowed = map[string]bool{
	"x_twitter":     true,
	"telegram":      true,
	"discord":       true,
	"friend":        true,
	"kol":           true,
	"crypto_media":  true,
	"task_platform": true,
	"other":         true,
}

// sourceAllowed 合法的 source 枚举值
var sourceAllowed = map[string]bool{
	"market_page": true,
	"lp_page":     true,
	"stake_page":  true,
	"home":        true,
	"other":       true,
}

// emailRegex RFC 5322 简化正则，长度 ≤128 在校验函数里单独检查
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// walletRegex EVM 地址：0x + 40 位十六进制
var walletRegex = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)

// BuildEarlyAccess 注册早鸟登记路由（跟随 BuildMarket 风格）
func BuildEarlyAccess(group *gin.RouterGroup, repo storage.EarlyAccessRepo) {
	earlyAccessRepo = repo
	group.POST("/early_access/register", RegisterEarlyAccess)
}

// RegisterEarlyAccess POST /api/v1/early_access/register
func RegisterEarlyAccess(c *gin.Context) {
	// ── 1. 绑定请求体 ──────────────────────────────────────────
	var req model.RegisterEarlyAccessReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{
			Code: 400,
			Msg:  "missing required fields",
		})
		return
	}

	// ── 2. 归一化 ──────────────────────────────────────────────
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.WalletAddress = strings.ToLower(strings.TrimSpace(req.WalletAddress))
	// Trim → XSS escape → 再做长度校验（escape 后字符数可能增加）
	req.ExpectedFeature = html.EscapeString(strings.TrimSpace(req.ExpectedFeature))
	req.ReferralSourceOther = html.EscapeString(strings.TrimSpace(req.ReferralSourceOther))

	// ── 3. 字段校验 ────────────────────────────────────────────
	if len(req.Email) > 128 || !emailRegex.MatchString(req.Email) {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "Please enter a valid email"})
		return
	}
	if !walletRegex.MatchString(req.WalletAddress) {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "Error: Please enter a valid BSC wallet address (0x..., 42 chars)"})
		return
	}
	if len(req.ExpectedFeature) > 500 {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "Too long (max 500 chars)"})
		return
	}
	if req.ReferralSource != "" && !referralSourceAllowed[req.ReferralSource] {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "Please select a valid source"})
		return
	}
	// referral_source=other 时 referral_source_other 必填（trim 后非空）
	if req.ReferralSource == "other" && req.ReferralSourceOther == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "Please specify the source"})
		return
	}
	if req.Source != "" && !sourceAllowed[req.Source] {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "invalid source"})
		return
	}
	if len(req.ReferralSourceOther) > 64 {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "referral_source_other too long"})
		return
	}
	if len(req.UTMSource) > 64 {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "utm_source too long"})
		return
	}
	if len(req.UTMCampaign) > 64 {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "utm_campaign too long"})
		return
	}

	ctx := c.Request.Context()

	// ── 4. 重复检查 ────────────────────────────────────────────
	// PRD §3.2：重复提交返回 409，不再幂等放行
	existing, err := earlyAccessRepo.FindActiveByEmailOrWallet(ctx, req.Email, req.WalletAddress)
	if err != nil {
		logf("[EarlyAccess] failed to query existing record: %v", err)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Msg: "internal error"})
		return
	}
	if existing != nil {
		// email 优先判定（一致性优先）
		if existing.Email == req.Email {
			c.JSON(http.StatusConflict, model.Response{Code: 409, Msg: "This email is already registered"})
		} else {
			c.JSON(http.StatusConflict, model.Response{Code: 409, Msg: "This wallet is already registered"})
		}
		return
	}

	// ── 5. 插入新记录 ──────────────────────────────────────────
	rec := &model.EarlyAccessRegistration{
		BizID:               storage.GenBizID(),
		Email:               req.Email,
		WalletAddress:       req.WalletAddress,
		ExpectedFeature:     req.ExpectedFeature,
		ReferralSource:      req.ReferralSource,
		ReferralSourceOther: req.ReferralSourceOther,
		Source:              req.Source,
		UTMSource:           req.UTMSource,
		UTMCampaign:         req.UTMCampaign,
		IPAddress:           c.ClientIP(),
		UserAgent:           c.GetHeader("User-Agent"),
		Status:              1,
	}

	if err := earlyAccessRepo.Create(ctx, rec); err != nil {
		// INSERT 失败：可能是并发/拉黑 unique 冲突，重查 status=1
		retry, retryErr := earlyAccessRepo.FindActiveByEmailOrWallet(ctx, req.Email, req.WalletAddress)
		if retryErr == nil && retry != nil {
			// 并发竞争：对方已写入，按 PRD 返回 409
			if retry.Email == req.Email {
				c.JSON(http.StatusConflict, model.Response{Code: 409, Msg: "This email is already registered"})
			} else {
				c.JSON(http.StatusConflict, model.Response{Code: 409, Msg: "This wallet is already registered"})
			}
			return
		}
		// 拉黑用户：status=0 占位，重查仍无 status=1 记录
		emailHash := sha256Prefix(req.Email)
		logf("[EarlyAccess] blacklisted retry email_hash=%s wallet_masked=%s err=%v",
			emailHash, maskWallet(req.WalletAddress), err)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Msg: "internal error"})
		return
	}

	// ── 6. 计算排名并返回 ──────────────────────────────────────
	rank, err := earlyAccessRepo.CountRankByID(ctx, rec.ID)
	if err != nil {
		logf("[EarlyAccess] failed to count rank after insert: %v", err)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Msg: "internal error"})
		return
	}

	logf("[EarlyAccess] register success email_hash=%s wallet_masked=%s rank=%d",
		sha256Prefix(req.Email), maskWallet(req.WalletAddress), rank)
	c.JSON(http.StatusOK, model.Response{
		Code: 0,
		Msg:  "success",
		Data: model.RegisterEarlyAccessResp{
			ID:        rec.BizID,
			Rank:      rank,
			CreatedAt: rec.CreatedAt,
		},
	})
}

// ── 工具函数 ───────────────────────────────────────────────────────

// logf 写入可被测试替换的日志 writer
func logf(format string, args ...interface{}) {
	fmt.Fprintf(earlyAccessLogger, format+"\n", args...)
}

// sha256Prefix 取 email sha256 前 8 字节（16 hex 字符）用于日志脱敏
func sha256Prefix(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:8])
}

// maskWallet 钱包地址脱敏：前 6 位 + ... + 后 4 位
func maskWallet(w string) string {
	if len(w) < 10 {
		return w
	}
	return w[:6] + "..." + w[len(w)-4:]
}
