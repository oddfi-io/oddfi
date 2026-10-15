package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strings"
	"time"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/repository"

	"github.com/shopspring/decimal"
)

// ===========================
// 邀请码字符集
// ===========================

// referralCodeChars 邀请码字符集：去掉 0/1/I/O 四个视觉易混淆字符后的大写字母+数字
// 字符集：[2-9A-HJ-NP-Z]
//   - 数字：2,3,4,5,6,7,8,9 = 8 个（去掉 0/1）
//   - 字母：A-H(8) + J-N(5) + P-Z(11) = 24 个（去掉 I/O）
//
// 共 32 个字符，32^6 ≈ 10.74 亿空间；百万级用户碰撞率约 0.09%，5 次重试足够覆盖。
// 以 02-api-contract.md §4 为准（32 字符集 [2-9A-HJ-NP-Z]，包含 L/M）；
// batches/B1-referral.md §5.1 的"30 字符"是子文档描述瑕疵。
const referralCodeChars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

// referralCodeLen 邀请码长度（不含 "0x" 前缀）
const referralCodeLen = 6

// referralCodeMaxRetry 最大重试次数，超过说明 code 空间告急（系统级异常）
const referralCodeMaxRetry = 5

// ===========================
// 业务错误哨兵
// ===========================

var (
	// ErrCodeGenExhausted 5 次重试仍碰撞，邀请码空间耗尽，需人工介入
	ErrCodeGenExhausted = errors.New("referral code generation exhausted after max retries")
	// ErrInvalidReferralCode 邀请码不存在（归一化后仍查无此码）
	ErrInvalidReferralCode = errors.New("referral code not found")
	// ErrSelfReferral 自邀：用户不能用自己的邀请码绑定
	ErrSelfReferral = errors.New("cannot bind your own referral code")
	// ErrAlreadyBound 用户已绑定过邀请关系，一旦绑定不可改
	ErrAlreadyBound = errors.New("referral already bound")
)

// ===========================
// Service 接口定义（B1 §5.4）
// ===========================

// ReferralService 站点级邀请服务接口
// 邀请系统只管"谁邀请了谁"；奖励金额（ODD 计算 / holding upsert）由 presale deposit service 负责
type ReferralService interface {
	// GenerateCodeForUser 首次登录 hook 调用，INSERT IGNORE 幂等
	// 失败不阻断登录主链路（调用方以异步 goroutine 方式触发）
	GenerateCodeForUser(ctx context.Context, userID uint64, eoa string) error

	// BindReferral 绑定邀请关系。返回 ErrAlreadyBound 时前端静默（自动绑场景）
	BindReferral(ctx context.Context, req BindReferralRequest) (*BindReferralResponse, error)

	// GetMyReferralInfo 查当前用户的邀请码 + 邀请人 + 统计
	GetMyReferralInfo(ctx context.Context, userID uint64) (*MyReferralInfoResponse, error)

	// ListReferred 查我邀请的用户列表（含每人 presale deposit 明细）
	// business 参数可选，空字符串返回所有业务；本期只有 "presale"
	ListReferred(ctx context.Context, userID uint64, business string, page, size int) (*ListReferredResponse, error)
}

// ===========================
// 请求/响应 DTO
// ===========================

// BindReferralRequest 绑定邀请关系请求
type BindReferralRequest struct {
	UserID     uint64
	EoaAddress string
	Code       string // 前端输入，后端统一归一化为大写
	Source     string // "link" | "manual"
	Business   string // "presale"（本期固定）
}

// BindReferralResponse 绑定成功响应（对齐 02-api-contract.md §3.7）
type BindReferralResponse struct {
	ReferrerEoa  string `json:"referrerEoa"`
	ReferrerCode string `json:"referrerCode"`
	BoundAt      int64  `json:"boundAt"`
}

// ReferrerInfo 邀请人信息（null = 未绑）
type ReferrerInfo struct {
	Eoa     string `json:"eoa"`
	Code    string `json:"code"`
	BoundAt int64  `json:"boundAt"`
}

// ReferralStats 邀请统计
type ReferralStats struct {
	InvitedCount   int64  `json:"invitedCount"`
	TotalRewardOdd string `json:"totalRewardOdd"` // decimal 转字符串，前端按独立汇率服务换算 USD
}

// MyReferralInfoResponse GET /referral/me 响应（对齐 02-api-contract.md §3.6）
type MyReferralInfoResponse struct {
	MyCode    string        `json:"myCode"`
	ShareLink string        `json:"shareLink"`
	Referrer  *ReferrerInfo `json:"referrer"` // null = 未绑
	Stats     ReferralStats `json:"stats"`
}

// ReferredDepositItem 被邀请人单笔 deposit 明细
type ReferredDepositItem struct {
	DepositID         string `json:"depositId"`
	TxHash            string `json:"txHash"`
	RoundID           string `json:"roundId"`
	InvestedUsd       string `json:"investedUsd"`
	RewardOdd         string `json:"rewardOdd"`
	ReferralRewardPct string `json:"referralRewardPct"`
	Ts                int64  `json:"ts"`
}

// ReferredUserItem 被邀请用户 + 该用户触发的 deposits 明细
type ReferredUserItem struct {
	UserID         string                `json:"userId"`
	Eoa            string                `json:"eoa"`
	Code           string                `json:"code"`
	JoinedAt       int64                 `json:"joinedAt"`
	TotalRewardOdd string                `json:"totalRewardOdd"`
	Deposits       []ReferredDepositItem `json:"deposits"`
}

// ListReferredResponse GET /referral/list 响应（对齐 02-api-contract.md §3.8）
type ListReferredResponse struct {
	List  []ReferredUserItem `json:"list"`
	Total int64              `json:"total"`
}

// ===========================
// Lark 告警接口（B4 实现，本期占位）
// ===========================

// LarkAlerter Lark 告警接口，B4 才正式接入，本期用 warn 日志占位
type LarkAlerter interface {
	Alert(ctx context.Context, message string)
}

// noopLark 无操作占位实现，仅记 warn 日志
type noopLark struct{}

func (n *noopLark) Alert(_ context.Context, message string) {
	// B4 接入真实 Lark Webhook；本期仅记日志，不阻断流程
	logger.Warnf("[ReferralService] lark alert (noop): %s", message)
}

// ===========================
// 实现结构体
// ===========================

type referralService struct {
	codeRepo    repository.UserReferralCodeRepository
	bindRepo    repository.UserReferralBindRepository
	holdingRepo repository.PresaleHoldingRepository
	depositRepo repository.PresaleDepositRepository
	lark        LarkAlerter
	// shareBaseURL 邀请分享链接前缀，格式：https://app.oddfi.com/invest?ref=
	shareBaseURL string
}

// NewReferralService 构造函数，依赖注入所有 repo
func NewReferralService(
	codeRepo repository.UserReferralCodeRepository,
	bindRepo repository.UserReferralBindRepository,
	holdingRepo repository.PresaleHoldingRepository,
	depositRepo repository.PresaleDepositRepository,
) ReferralService {
	return &referralService{
		codeRepo:     codeRepo,
		bindRepo:     bindRepo,
		holdingRepo:  holdingRepo,
		depositRepo:  depositRepo,
		lark:         &noopLark{},
		shareBaseURL: "https://app.oddfi.com/invest?ref=",
	}
}

// ===========================
// 内部工具函数
// ===========================

// generateCode 用 crypto/rand 生成 6 位邀请码（不含 "0x" 前缀）
// 使用 crypto/rand 而非 math/rand：邀请码是资产凭证，伪随机有被预测风险
func generateCode() (string, error) {
	b := make([]byte, referralCodeLen)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("[ReferralService] crypto/rand read: %w", err)
	}
	charset := []byte(referralCodeChars)
	n := len(charset)
	code := make([]byte, referralCodeLen)
	for i, v := range b {
		// 取模映射到字符集；32 个字符时取模偏差可忽略（256/32=8，均匀分布）
		code[i] = charset[int(v)%n]
	}
	return "0x" + string(code), nil
}

// normalizeCode 大写归一化 + trim 空白
// 前端 URL 分享链接可能经过 URL 编码或自动小写，不强依赖前端保证大小写
func normalizeCode(input string) string {
	return strings.ToUpper(strings.TrimSpace(input))
}

// ===========================
// GenerateCodeForUser（B1 §5.1）
// ===========================

func (s *referralService) GenerateCodeForUser(ctx context.Context, userID uint64, eoa string) error {
	for attempt := 0; attempt < referralCodeMaxRetry; attempt++ {
		code, err := generateCode()
		if err != nil {
			// crypto/rand 失败属于系统级错误，不重试，直接返回
			return fmt.Errorf("[ReferralService] generate code for user %d: %w", userID, err)
		}

		inserted, err := s.codeRepo.InsertIgnore(ctx, userID, eoa, code)
		if err == nil && inserted {
			// 成功写入新邀请码
			logger.Infof("[ReferralService] generated referral code for user %d code=%s", userID, code)
			return nil
		}
		if err == nil && !inserted {
			// 该用户已有邀请码（uk_eoa/user_id 幂等），正常退出
			return nil
		}
		// ErrCodeConflict：code 字符串碰撞，重新生成后重试
		if errors.Is(err, repository.ErrCodeConflict) {
			logger.Warnf("[ReferralService] referral code collision attempt=%d user=%d code=%s", attempt+1, userID, code)
			continue
		}
		// 其他 DB 错误
		return fmt.Errorf("[ReferralService] insert ignore code for user %d: %w", userID, err)
	}

	// 5 次重试全部碰撞，字符空间告急，推 Lark 告警
	msg := fmt.Sprintf("referral code exhausted after %d retries for user %d", referralCodeMaxRetry, userID)
	s.lark.Alert(ctx, msg)
	logger.Errorf("[ReferralService] %s", msg)
	return ErrCodeGenExhausted
}

// ===========================
// BindReferral（B1 §5.3）
// ===========================

func (s *referralService) BindReferral(ctx context.Context, req BindReferralRequest) (*BindReferralResponse, error) {
	// 大写归一化：前端输入不区分大小写，后端统一转大写后查 uk_code
	code := normalizeCode(req.Code)

	// 1. 查邀请码是否存在
	codeRecord, err := s.codeRepo.GetByCode(ctx, code)
	if err != nil {
		if errors.Is(err, repository.ErrReferralCodeNotFound) {
			return nil, ErrInvalidReferralCode
		}
		return nil, fmt.Errorf("[ReferralService] get code %s: %w", code, err)
	}

	// 2. 自邀阻断：邀请码持有人不能用自己的码绑定
	if codeRecord.UserID == req.UserID {
		return nil, ErrSelfReferral
	}

	// 3. 幂等检查：用户是否已绑过
	existing, err := s.bindRepo.GetByUserID(ctx, req.UserID)
	if err == nil && existing != nil {
		// 已绑定，返回 ErrAlreadyBound（前端自动绑场景下静默处理）
		return nil, ErrAlreadyBound
	}
	// ErrReferralBindNotFound 是正常路径（未绑），其他错误向上透传
	if err != nil && !errors.Is(err, repository.ErrReferralBindNotFound) {
		return nil, fmt.Errorf("[ReferralService] check existing bind for user %d: %w", req.UserID, err)
	}

	// 4. 写入绑定关系（CreateIdempotent 保证 PK=user_id 幂等）
	// TOCTOU 说明：step 3 的 GetByUserID 与 step 4 的 CreateIdempotent 之间存在竞态窗口。
	// 两路请求并发绑定同一 user，DB 层 ON DUPLICATE KEY 保证只有一路真正写入（inserted=true），
	// 另一路 RowsAffected=0（inserted=false）；若胜出方绑定的是不同邀请码，则返回 ErrAlreadyBound，
	// 保证调用方收到一致的响应，不会误认为自己的码绑定成功。
	boundAt := time.Now().UnixMilli()
	bind := &model.UserReferralBind{
		UserID:         req.UserID,
		EoaAddress:     req.EoaAddress,
		ReferrerUserID: codeRecord.UserID,
		ReferrerEoa:    codeRecord.EoaAddress,
		ReferrerCode:   code,
		Source:         req.Source,
		Business:       req.Business,
		BoundAt:        boundAt,
	}
	inserted, err := s.bindRepo.CreateIdempotent(ctx, nil, bind)
	if err != nil {
		return nil, fmt.Errorf("[ReferralService] create bind for user %d: %w", req.UserID, err)
	}

	if !inserted {
		// RowsAffected=0：并发竞态下另一路请求抢先写入；取真实绑定记录校验一致性
		actual, getErr := s.bindRepo.GetByUserID(ctx, req.UserID)
		if getErr != nil {
			return nil, fmt.Errorf("[ReferralService] get actual bind after conflict for user %d: %w", req.UserID, getErr)
		}
		if actual.ReferrerCode != code {
			// 实际绑定的是不同邀请码，返回已绑定错误，避免误导调用方
			return nil, ErrAlreadyBound
		}
		// 幂等：实际绑定码与本次请求一致，视作成功（调用方重试场景）
		return &BindReferralResponse{
			ReferrerEoa:  actual.ReferrerEoa,
			ReferrerCode: actual.ReferrerCode,
			BoundAt:      actual.BoundAt,
		}, nil
	}

	return &BindReferralResponse{
		ReferrerEoa:  codeRecord.EoaAddress,
		ReferrerCode: code,
		BoundAt:      boundAt,
	}, nil
}

// ===========================
// GetMyReferralInfo（B1 §5.6）
// ===========================

func (s *referralService) GetMyReferralInfo(ctx context.Context, userID uint64) (*MyReferralInfoResponse, error) {
	// 1. 查当前用户的邀请码
	codeRecord, err := s.codeRepo.GetByUserID(ctx, userID)
	if err != nil && !errors.Is(err, repository.ErrReferralCodeNotFound) {
		return nil, fmt.Errorf("[ReferralService] get code for user %d: %w", userID, err)
	}

	var myCode string
	var shareLink string
	if codeRecord != nil {
		myCode = codeRecord.Code
		shareLink = s.shareBaseURL + codeRecord.Code
	}

	// 2. 查邀请人（当前用户是否被别人邀请）
	var referrer *ReferrerInfo
	bind, err := s.bindRepo.GetByUserID(ctx, userID)
	if err != nil && !errors.Is(err, repository.ErrReferralBindNotFound) {
		return nil, fmt.Errorf("[ReferralService] get bind for user %d: %w", userID, err)
	}
	if bind != nil {
		referrer = &ReferrerInfo{
			Eoa:     bind.ReferrerEoa,
			Code:    bind.ReferrerCode,
			BoundAt: bind.BoundAt,
		}
	}

	// 3. 统计：邀请人数
	// ListByReferrer 返回 total 字段（分页 page=1,size=1 取 count 即可）
	_, invitedCount, err := s.bindRepo.ListByReferrer(ctx, userID, 1, 1)
	if err != nil {
		return nil, fmt.Errorf("[ReferralService] count referred users for user %d: %w", userID, err)
	}

	// 4. 统计：累计邀请奖励 ODD（从 presale_holding source=2 聚合，不从 deposit）
	totalRewardOdd, err := s.holdingRepo.SumReferralOdd(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("[ReferralService] sum referral odd for user %d: %w", userID, err)
	}

	return &MyReferralInfoResponse{
		MyCode:    myCode,
		ShareLink: shareLink,
		Referrer:  referrer,
		Stats: ReferralStats{
			InvitedCount:   invitedCount,
			TotalRewardOdd: totalRewardOdd.String(),
		},
	}, nil
}

// ===========================
// ListReferred（B1 §5.5）
// ===========================

func (s *referralService) ListReferred(ctx context.Context, userID uint64, business string, page, size int) (*ListReferredResponse, error) {
	// 1. 查被邀请人列表（分页，支持 business 筛选）
	binds, total, err := s.bindRepo.ListByReferrerFiltered(ctx, userID, business, page, size)
	if err != nil {
		return nil, fmt.Errorf("[ReferralService] list referred binds for user %d: %w", userID, err)
	}

	if len(binds) == 0 {
		return &ListReferredResponse{List: []ReferredUserItem{}, Total: total}, nil
	}

	// 2. 收集被邀请人 user_id 列表（用于批量查 deposits，避免 N+1）
	referredIDs := make([]uint64, len(binds))
	for i, b := range binds {
		referredIDs[i] = b.UserID
	}

	// 3. 批量查这批被邀请人触发的 confirmed deposits（referrer_user_id = userID）
	deposits, err := s.depositRepo.ListByReferrerUserID(ctx, userID, referredIDs)
	if err != nil {
		return nil, fmt.Errorf("[ReferralService] list deposits by referrer %d: %w", userID, err)
	}

	// 4. 内存聚合：按 user_id 分组 deposit（binds 已分页，上限 size 条，无 N+1 风险）
	depositsByUser := make(map[uint64][]*model.PresaleDeposit, len(referredIDs))
	for _, d := range deposits {
		depositsByUser[d.UserID] = append(depositsByUser[d.UserID], d)
	}

	// 5. 批量查被邀请人的邀请码（用于 code 字段展示），避免循环内 N+1 查询
	codeMap, err := s.codeRepo.ListByUserIDs(ctx, referredIDs)
	if err != nil {
		return nil, fmt.Errorf("[ReferralService] list codes by user_ids for referrer %d: %w", userID, err)
	}

	// 6. 组装响应
	items := make([]ReferredUserItem, 0, len(binds))
	for _, b := range binds {
		// 从 map 取被邀请人自己的邀请码；查不到时保持空字符串（新用户可能尚未生成）
		var userCode string
		if rc, ok := codeMap[b.UserID]; ok {
			userCode = rc.Code
		}

		// 汇总该被邀请人的总奖励 ODD（在当前分页的 deposit 中计算）
		userDeposits := depositsByUser[b.UserID]
		var totalReward decimal.Decimal
		depositItems := make([]ReferredDepositItem, 0, len(userDeposits))
		for _, d := range userDeposits {
			totalReward = totalReward.Add(d.ReferralRewardOdd)
			pct := ""
			if d.ReferralRewardPct != nil {
				pct = d.ReferralRewardPct.String()
			}
			depositItems = append(depositItems, ReferredDepositItem{
				DepositID:         fmt.Sprintf("%d", d.ID),
				TxHash:            d.TxHash,
				RoundID:           d.RoundID,
				InvestedUsd:       d.AmountUsdt.String(),
				RewardOdd:         d.ReferralRewardOdd.String(),
				ReferralRewardPct: pct,
				Ts:                d.BlockTimestamp,
			})
		}

		items = append(items, ReferredUserItem{
			UserID:         fmt.Sprintf("%d", b.UserID),
			Eoa:            b.EoaAddress,
			Code:           userCode,
			JoinedAt:       b.BoundAt,
			TotalRewardOdd: totalReward.String(),
			Deposits:       depositItems,
		})
	}

	return &ListReferredResponse{
		List:  items,
		Total: total,
	}, nil
}
