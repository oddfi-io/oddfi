package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ===========================
// Mock 实现（仅测试用）
// ===========================

// mockCodeRepo 邀请码 repo mock
type mockCodeRepo struct {
	// insertIgnoreFunc 控制 InsertIgnore 的行为
	insertIgnoreFunc func(ctx context.Context, userID uint64, eoa string, code string) (bool, error)
	// getByCodeFunc 控制 GetByCode 的行为
	getByCodeFunc func(ctx context.Context, code string) (*model.UserReferralCode, error)
	// getByUserIDFunc 控制 GetByUserID 的行为
	getByUserIDFunc func(ctx context.Context, userID uint64) (*model.UserReferralCode, error)
	// createIfNotExistsFunc 控制 CreateIfNotExists 的行为
	createIfNotExistsFunc func(ctx context.Context, rc *model.UserReferralCode) error
	// listByUserIDsFunc 控制 ListByUserIDs 的行为
	listByUserIDsFunc func(ctx context.Context, userIDs []uint64) (map[uint64]*model.UserReferralCode, error)
}

func (m *mockCodeRepo) GetByUserID(ctx context.Context, userID uint64) (*model.UserReferralCode, error) {
	if m.getByUserIDFunc != nil {
		return m.getByUserIDFunc(ctx, userID)
	}
	return nil, repository.ErrReferralCodeNotFound
}

func (m *mockCodeRepo) GetByCode(ctx context.Context, code string) (*model.UserReferralCode, error) {
	if m.getByCodeFunc != nil {
		return m.getByCodeFunc(ctx, code)
	}
	return nil, repository.ErrReferralCodeNotFound
}

func (m *mockCodeRepo) CreateIfNotExists(ctx context.Context, rc *model.UserReferralCode) error {
	if m.createIfNotExistsFunc != nil {
		return m.createIfNotExistsFunc(ctx, rc)
	}
	return nil
}

func (m *mockCodeRepo) InsertIgnore(ctx context.Context, userID uint64, eoa string, code string) (bool, error) {
	if m.insertIgnoreFunc != nil {
		return m.insertIgnoreFunc(ctx, userID, eoa, code)
	}
	return true, nil
}

func (m *mockCodeRepo) ListByUserIDs(ctx context.Context, userIDs []uint64) (map[uint64]*model.UserReferralCode, error) {
	if m.listByUserIDsFunc != nil {
		return m.listByUserIDsFunc(ctx, userIDs)
	}
	return map[uint64]*model.UserReferralCode{}, nil
}

// mockBindRepo 邀请绑定 repo mock
type mockBindRepo struct {
	getByUserIDFunc            func(ctx context.Context, userID uint64) (*model.UserReferralBind, error)
	createIdempotentFunc       func(ctx context.Context, bind *model.UserReferralBind) (bool, error)
	listByReferrerFunc         func(ctx context.Context, referrerUserID uint64, page, size int) ([]*model.UserReferralBind, int64, error)
	listByReferrerFilteredFunc func(ctx context.Context, referrerUserID uint64, business string, page, size int) ([]*model.UserReferralBind, int64, error)
}

func (m *mockBindRepo) GetByUserID(ctx context.Context, userID uint64) (*model.UserReferralBind, error) {
	if m.getByUserIDFunc != nil {
		return m.getByUserIDFunc(ctx, userID)
	}
	return nil, repository.ErrReferralBindNotFound
}

func (m *mockBindRepo) CreateIdempotent(ctx context.Context, tx *gorm.DB, bind *model.UserReferralBind) (bool, error) {
	if m.createIdempotentFunc != nil {
		return m.createIdempotentFunc(ctx, bind)
	}
	return true, nil
}

func (m *mockBindRepo) ListByReferrer(ctx context.Context, referrerUserID uint64, page, size int) ([]*model.UserReferralBind, int64, error) {
	if m.listByReferrerFunc != nil {
		return m.listByReferrerFunc(ctx, referrerUserID, page, size)
	}
	return nil, 0, nil
}

func (m *mockBindRepo) ListByReferrerFiltered(ctx context.Context, referrerUserID uint64, business string, page, size int) ([]*model.UserReferralBind, int64, error) {
	if m.listByReferrerFilteredFunc != nil {
		return m.listByReferrerFilteredFunc(ctx, referrerUserID, business, page, size)
	}
	return nil, 0, nil
}

// mockHoldingRepo 持仓 repo mock
type mockHoldingRepo struct {
	sumReferralOddFunc func(ctx context.Context, userID uint64) (decimal.Decimal, error)
}

func (m *mockHoldingRepo) UpsertInvest(ctx context.Context, tx *gorm.DB, userID uint64, roundID string, deltaOdd, deltaUsd, price decimal.Decimal) error {
	return nil
}
func (m *mockHoldingRepo) UpsertReferral(ctx context.Context, tx *gorm.DB, referrerUserID uint64, roundID string, deltaOdd decimal.Decimal) error {
	return nil
}
func (m *mockHoldingRepo) ListByUser(ctx context.Context, userID uint64) ([]*model.PresaleHolding, error) {
	return nil, nil
}
func (m *mockHoldingRepo) SumReferralOdd(ctx context.Context, userID uint64) (decimal.Decimal, error) {
	if m.sumReferralOddFunc != nil {
		return m.sumReferralOddFunc(ctx, userID)
	}
	return decimal.Zero, nil
}

// mockDepositRepo 入账 repo mock
type mockDepositRepo struct {
	listByReferrerUserIDFunc func(ctx context.Context, referrerUserID uint64, referredIDs []uint64) ([]*model.PresaleDeposit, error)
}

func (m *mockDepositRepo) CreateOrGet(ctx context.Context, tx *gorm.DB, deposit *model.PresaleDeposit) (*model.PresaleDeposit, bool, error) {
	return nil, false, nil
}
func (m *mockDepositRepo) GetByTxHash(ctx context.Context, txHash string, userID uint64) (*model.PresaleDeposit, error) {
	return nil, nil
}
func (m *mockDepositRepo) ListByUser(ctx context.Context, userID uint64, status string, page, size int) ([]*model.PresaleDeposit, int64, error) {
	return nil, 0, nil
}
func (m *mockDepositRepo) ConfirmDeposit(ctx context.Context, tx *gorm.DB, depositID uint64, confirmedAt int64) error {
	return nil
}
func (m *mockDepositRepo) MarkAnomaly(ctx context.Context, tx *gorm.DB, depositID uint64, reason string) error {
	return nil
}
func (m *mockDepositRepo) ListPendingByBlockThreshold(ctx context.Context, safeBlockNumber uint64) ([]*model.PresaleDeposit, error) {
	return nil, nil
}
func (m *mockDepositRepo) ListByReferrerUserID(ctx context.Context, referrerUserID uint64, referredIDs []uint64) ([]*model.PresaleDeposit, error) {
	if m.listByReferrerUserIDFunc != nil {
		return m.listByReferrerUserIDFunc(ctx, referrerUserID, referredIDs)
	}
	return nil, nil
}

// UpdateReferrerIfNull mock：B7 cmd/inv6-backfill 工具用，本测试不调用，stub 返回 true
func (m *mockDepositRepo) UpdateReferrerIfNull(ctx context.Context, tx *gorm.DB, depositID uint64, referrerUserID uint64, referrerEoa string, pct, rewardOdd decimal.Decimal) (bool, error) {
	return true, nil
}

// newTestService 构造测试用 referralService，允许自定义 mock
func newTestService(codeRepo *mockCodeRepo, bindRepo *mockBindRepo, holdingRepo *mockHoldingRepo, depositRepo *mockDepositRepo) *referralService {
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
// P0 测试：CSPRNG 字符集验证
// ===========================

// TestGenerateCode_Charset 验证生成的邀请码字符全部在 [2-9A-HJ-NP-Z] 字符集内
// P0：邀请码字符集错误会导致用户输入时出现视觉混淆（0/1/I/O）
func TestGenerateCode_Charset(t *testing.T) {
	charset := referralCodeChars
	charsetSet := make(map[byte]bool, len(charset))
	for i := 0; i < len(charset); i++ {
		charsetSet[charset[i]] = true
	}

	// 生成足够多次数验证随机性覆盖
	for i := 0; i < 1000; i++ {
		code, err := generateCode()
		if err != nil {
			t.Fatalf("generateCode() error: %v", err)
		}
		// 格式：0x + 6 位字符
		if !strings.HasPrefix(code, "0x") {
			t.Errorf("code %q must start with '0x'", code)
		}
		suffix := code[2:]
		if len(suffix) != referralCodeLen {
			t.Errorf("code suffix length = %d, want %d", len(suffix), referralCodeLen)
		}
		for _, ch := range []byte(suffix) {
			if !charsetSet[ch] {
				t.Errorf("code %q contains invalid char %q (not in charset %q)", code, ch, charset)
			}
		}
	}
}

// TestReferralCodeChars_Length 验证字符集长度为 32（去掉 0/1/I/O 后）
// 32^6 ≈ 10.74 亿空间；spec 注释写"30"有误，以字符串字面量为准
func TestReferralCodeChars_Length(t *testing.T) {
	if len(referralCodeChars) != 32 {
		t.Errorf("referralCodeChars length = %d, want 32 (spec comment '30' is incorrect)", len(referralCodeChars))
	}
	// 验证去掉了混淆字符
	for _, forbidden := range []byte{'0', '1', 'I', 'O'} {
		if strings.ContainsRune(referralCodeChars, rune(forbidden)) {
			t.Errorf("referralCodeChars contains forbidden char %q", forbidden)
		}
	}
	// 验证包含应有字符
	for _, expected := range []byte{'2', '9', 'A', 'Z', 'H', 'J', 'N', 'P'} {
		if !strings.ContainsRune(referralCodeChars, rune(expected)) {
			t.Errorf("referralCodeChars missing expected char %q", expected)
		}
	}
}

// TestNormalizeCode_UpperCase 验证大写归一化逻辑
// P0：前端 URL 分享链接可能经 URL 编码小写，后端必须归一化后再查 uk_code
func TestNormalizeCode_UpperCase(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"0xh7k9x2", "0XH7K9X2"},
		{"0xH7K9X2", "0XH7K9X2"},
		{"  0xH7K9X2  ", "0XH7K9X2"},
		{"0xaBcDeF", "0XABCDEF"},
		{"", ""},
	}
	for _, tc := range cases {
		got := normalizeCode(tc.input)
		if got != tc.want {
			t.Errorf("normalizeCode(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

// ===========================
// P0 测试：GenerateCodeForUser 重试逻辑
// ===========================

// TestGenerateCodeForUser_FirstSuccess 验证首次 InsertIgnore 成功时直接返回 nil
func TestReferralService_GenerateCodeForUser_FirstSuccess(t *testing.T) {
	codeRepo := &mockCodeRepo{
		insertIgnoreFunc: func(_ context.Context, _ uint64, _ string, _ string) (bool, error) {
			return true, nil // 首次成功
		},
	}
	svc := newTestService(codeRepo, &mockBindRepo{}, &mockHoldingRepo{}, &mockDepositRepo{})
	if err := svc.GenerateCodeForUser(context.Background(), 1, "0xabc"); err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
}

// TestReferralService_GenerateCodeForUser_Idempotent 验证用户已有邀请码时（幂等路径）返回 nil
func TestReferralService_GenerateCodeForUser_Idempotent(t *testing.T) {
	codeRepo := &mockCodeRepo{
		insertIgnoreFunc: func(_ context.Context, _ uint64, _ string, _ string) (bool, error) {
			return false, nil // 已存在，幂等
		},
	}
	svc := newTestService(codeRepo, &mockBindRepo{}, &mockHoldingRepo{}, &mockDepositRepo{})
	if err := svc.GenerateCodeForUser(context.Background(), 1, "0xabc"); err != nil {
		t.Errorf("expected nil error for idempotent path, got %v", err)
	}
}

// TestReferralService_GenerateCodeForUser_RetryOnCollision 验证碰撞时重试，5 次全碰撞后返回 ErrCodeGenExhausted
// P0：邀请码碰撞重试是资产生成的关键路径
func TestReferralService_GenerateCodeForUser_RetryOnCollision(t *testing.T) {
	attempts := 0
	codeRepo := &mockCodeRepo{
		insertIgnoreFunc: func(_ context.Context, _ uint64, _ string, _ string) (bool, error) {
			attempts++
			// 前 4 次碰撞，第 5 次成功
			if attempts < referralCodeMaxRetry {
				return false, repository.ErrCodeConflict
			}
			return true, nil
		},
	}
	svc := newTestService(codeRepo, &mockBindRepo{}, &mockHoldingRepo{}, &mockDepositRepo{})
	if err := svc.GenerateCodeForUser(context.Background(), 1, "0xabc"); err != nil {
		t.Errorf("expected success on 5th attempt, got %v", err)
	}
	if attempts != referralCodeMaxRetry {
		t.Errorf("expected %d attempts, got %d", referralCodeMaxRetry, attempts)
	}
}

// TestReferralService_GenerateCodeForUser_ExhaustedAfter5Retries 验证 5 次全碰撞后返回 ErrCodeGenExhausted
func TestReferralService_GenerateCodeForUser_ExhaustedAfter5Retries(t *testing.T) {
	codeRepo := &mockCodeRepo{
		insertIgnoreFunc: func(_ context.Context, _ uint64, _ string, _ string) (bool, error) {
			return false, repository.ErrCodeConflict // 每次都碰撞
		},
	}
	svc := newTestService(codeRepo, &mockBindRepo{}, &mockHoldingRepo{}, &mockDepositRepo{})
	err := svc.GenerateCodeForUser(context.Background(), 1, "0xabc")
	if !errors.Is(err, ErrCodeGenExhausted) {
		t.Errorf("expected ErrCodeGenExhausted after 5 collisions, got %v", err)
	}
}

// ===========================
// P0 测试：BindReferral 自邀阻断
// ===========================

// TestReferralService_BindReferral_SelfReferral 验证自邀阻断：用户不能用自己的邀请码
// P0：自邀阻断是防刷奖励的核心安全约束
func TestReferralService_BindReferral_SelfReferral(t *testing.T) {
	const userID = uint64(42)
	codeRepo := &mockCodeRepo{
		getByCodeFunc: func(_ context.Context, code string) (*model.UserReferralCode, error) {
			// 邀请码持有人 = 请求用户本人
			return &model.UserReferralCode{UserID: userID, Code: code, EoaAddress: "0xself"}, nil
		},
	}
	svc := newTestService(codeRepo, &mockBindRepo{}, &mockHoldingRepo{}, &mockDepositRepo{})
	_, err := svc.BindReferral(context.Background(), BindReferralRequest{
		UserID:     userID,
		EoaAddress: "0xself",
		Code:       "0xABCDEF",
		Source:     "manual",
		Business:   "presale",
	})
	if !errors.Is(err, ErrSelfReferral) {
		t.Errorf("expected ErrSelfReferral, got %v", err)
	}
}

// TestReferralService_BindReferral_InvalidCode 验证邀请码不存在时返回 ErrInvalidReferralCode
func TestReferralService_BindReferral_InvalidCode(t *testing.T) {
	codeRepo := &mockCodeRepo{
		getByCodeFunc: func(_ context.Context, _ string) (*model.UserReferralCode, error) {
			return nil, repository.ErrReferralCodeNotFound
		},
	}
	svc := newTestService(codeRepo, &mockBindRepo{}, &mockHoldingRepo{}, &mockDepositRepo{})
	_, err := svc.BindReferral(context.Background(), BindReferralRequest{
		UserID: 1, Code: "0xINVALID", Source: "manual", Business: "presale",
	})
	if !errors.Is(err, ErrInvalidReferralCode) {
		t.Errorf("expected ErrInvalidReferralCode, got %v", err)
	}
}

// ===========================
// P0 测试：BindReferral 重复绑定幂等
// ===========================

// TestReferralService_BindReferral_AlreadyBound 验证重复绑定返回 ErrAlreadyBound
// P0：幂等绑定是防止重复奖励的核心约束
func TestReferralService_BindReferral_AlreadyBound(t *testing.T) {
	const referrerUserID = uint64(99)
	const userID = uint64(1)
	codeRepo := &mockCodeRepo{
		getByCodeFunc: func(_ context.Context, code string) (*model.UserReferralCode, error) {
			return &model.UserReferralCode{UserID: referrerUserID, Code: code, EoaAddress: "0xref"}, nil
		},
	}
	bindRepo := &mockBindRepo{
		getByUserIDFunc: func(_ context.Context, _ uint64) (*model.UserReferralBind, error) {
			// 用户已绑定过
			return &model.UserReferralBind{UserID: userID, ReferrerUserID: referrerUserID}, nil
		},
	}
	svc := newTestService(codeRepo, bindRepo, &mockHoldingRepo{}, &mockDepositRepo{})
	_, err := svc.BindReferral(context.Background(), BindReferralRequest{
		UserID: userID, Code: "0xABCDEF", Source: "link", Business: "presale",
	})
	if !errors.Is(err, ErrAlreadyBound) {
		t.Errorf("expected ErrAlreadyBound, got %v", err)
	}
}

// TestReferralService_BindReferral_HappyPath 验证正常绑定流程返回正确响应
func TestReferralService_BindReferral_HappyPath(t *testing.T) {
	const referrerUserID = uint64(99)
	const userID = uint64(1)
	codeRepo := &mockCodeRepo{
		getByCodeFunc: func(_ context.Context, code string) (*model.UserReferralCode, error) {
			return &model.UserReferralCode{UserID: referrerUserID, Code: code, EoaAddress: "0xreferrer"}, nil
		},
	}
	bindRepo := &mockBindRepo{
		getByUserIDFunc: func(_ context.Context, _ uint64) (*model.UserReferralBind, error) {
			return nil, repository.ErrReferralBindNotFound // 未绑定
		},
	}
	svc := newTestService(codeRepo, bindRepo, &mockHoldingRepo{}, &mockDepositRepo{})
	resp, err := svc.BindReferral(context.Background(), BindReferralRequest{
		UserID:     userID,
		EoaAddress: "0xuser",
		Code:       "0xABCDEF",
		Source:     "link",
		Business:   "presale",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp.ReferrerEoa != "0xreferrer" {
		t.Errorf("ReferrerEoa = %q, want %q", resp.ReferrerEoa, "0xreferrer")
	}
	if resp.ReferrerCode != "0XABCDEF" { // normalizeCode 转大写
		t.Errorf("ReferrerCode = %q, want %q", resp.ReferrerCode, "0XABCDEF")
	}
	if resp.BoundAt <= 0 {
		t.Errorf("BoundAt should be positive, got %d", resp.BoundAt)
	}
}

// ===========================
// P0 测试：GetMyReferralInfo
// ===========================

// TestReferralService_GetMyReferralInfo_NoCode 验证用户尚未生成邀请码时 myCode 为空
func TestReferralService_GetMyReferralInfo_NoCode(t *testing.T) {
	codeRepo := &mockCodeRepo{
		getByUserIDFunc: func(_ context.Context, _ uint64) (*model.UserReferralCode, error) {
			return nil, repository.ErrReferralCodeNotFound
		},
	}
	svc := newTestService(codeRepo, &mockBindRepo{}, &mockHoldingRepo{}, &mockDepositRepo{})
	resp, err := svc.GetMyReferralInfo(context.Background(), 1)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp.MyCode != "" {
		t.Errorf("MyCode should be empty when no code exists, got %q", resp.MyCode)
	}
	if resp.Referrer != nil {
		t.Errorf("Referrer should be nil when not bound, got %+v", resp.Referrer)
	}
}

// ===========================
// P0 测试：ListReferred happy path
// ===========================

// TestReferralService_ListReferred_HappyPath 验证 referrer 有 2 个被邀请人 + 每人 1 笔 deposit 时聚合正确
// totalReferred=2，totalRewardOdd 加总正确，无 N+1（批量 ListByUserIDs mock 调用一次）
func TestReferralService_ListReferred_HappyPath(t *testing.T) {
	const referrerID = uint64(1)
	const inviteeA = uint64(101)
	const inviteeB = uint64(102)

	bindRepo := &mockBindRepo{
		listByReferrerFilteredFunc: func(_ context.Context, _ uint64, _ string, _, _ int) ([]*model.UserReferralBind, int64, error) {
			return []*model.UserReferralBind{
				{UserID: inviteeA, EoaAddress: "0xA", BoundAt: 1000},
				{UserID: inviteeB, EoaAddress: "0xB", BoundAt: 2000},
			}, 2, nil
		},
	}

	codeRepo := &mockCodeRepo{
		listByUserIDsFunc: func(_ context.Context, userIDs []uint64) (map[uint64]*model.UserReferralCode, error) {
			// 验证一次性批量调用（非循环单查）
			if len(userIDs) != 2 {
				t.Errorf("ListByUserIDs should be called once with 2 user_ids, got %d", len(userIDs))
			}
			return map[uint64]*model.UserReferralCode{
				inviteeA: {UserID: inviteeA, Code: "0xCODE_A"},
				inviteeB: {UserID: inviteeB, Code: "0xCODE_B"},
			}, nil
		},
	}

	rewardA := decimal.RequireFromString("100")
	rewardB := decimal.RequireFromString("250")
	depositRepo := &mockDepositRepo{
		listByReferrerUserIDFunc: func(_ context.Context, _ uint64, _ []uint64) ([]*model.PresaleDeposit, error) {
			return []*model.PresaleDeposit{
				{
					ID:                1,
					UserID:            inviteeA,
					TxHash:            "0xtxA",
					RoundID:           "round-1",
					AmountUsdt:        decimal.RequireFromString("1000"),
					ReferralRewardOdd: rewardA,
					BlockTimestamp:    1001,
				},
				{
					ID:                2,
					UserID:            inviteeB,
					TxHash:            "0xtxB",
					RoundID:           "round-1",
					AmountUsdt:        decimal.RequireFromString("2500"),
					ReferralRewardOdd: rewardB,
					BlockTimestamp:    2001,
				},
			}, nil
		},
	}

	svc := newTestService(codeRepo, bindRepo, &mockHoldingRepo{}, depositRepo)
	resp, err := svc.ListReferred(context.Background(), referrerID, "presale", 1, 20)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	// 验证总数
	if resp.Total != 2 {
		t.Errorf("Total = %d, want 2", resp.Total)
	}
	if len(resp.List) != 2 {
		t.Errorf("len(List) = %d, want 2", len(resp.List))
	}

	// 验证 inviteeA
	itemA := resp.List[0]
	if itemA.Eoa != "0xA" {
		t.Errorf("itemA.Eoa = %q, want %q", itemA.Eoa, "0xA")
	}
	if itemA.Code != "0xCODE_A" {
		t.Errorf("itemA.Code = %q, want %q", itemA.Code, "0xCODE_A")
	}
	if itemA.TotalRewardOdd != "100" {
		t.Errorf("itemA.TotalRewardOdd = %q, want %q", itemA.TotalRewardOdd, "100")
	}
	if len(itemA.Deposits) != 1 {
		t.Errorf("itemA.Deposits len = %d, want 1", len(itemA.Deposits))
	}

	// 验证 inviteeB
	itemB := resp.List[1]
	if itemB.TotalRewardOdd != "250" {
		t.Errorf("itemB.TotalRewardOdd = %q, want %q", itemB.TotalRewardOdd, "250")
	}
	if len(itemB.Deposits) != 1 {
		t.Errorf("itemB.Deposits len = %d, want 1", len(itemB.Deposits))
	}
}

// TestReferralService_ListReferred_Empty 验证 referrer 无被邀请人时返回空列表
func TestReferralService_ListReferred_Empty(t *testing.T) {
	svc := newTestService(&mockCodeRepo{}, &mockBindRepo{}, &mockHoldingRepo{}, &mockDepositRepo{})
	resp, err := svc.ListReferred(context.Background(), 1, "", 1, 20)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(resp.List) != 0 {
		t.Errorf("expected empty list, got %d items", len(resp.List))
	}
}

// TestReferralService_GetMyReferralInfo_WithCode 验证用户有邀请码时返回正确信息
func TestReferralService_GetMyReferralInfo_WithCode(t *testing.T) {
	codeRepo := &mockCodeRepo{
		getByUserIDFunc: func(_ context.Context, userID uint64) (*model.UserReferralCode, error) {
			return &model.UserReferralCode{UserID: userID, Code: "0xABC123", EoaAddress: "0xme"}, nil
		},
	}
	holdingRepo := &mockHoldingRepo{
		sumReferralOddFunc: func(_ context.Context, _ uint64) (decimal.Decimal, error) {
			return decimal.NewFromInt(3200), nil
		},
	}
	bindRepo := &mockBindRepo{
		listByReferrerFunc: func(_ context.Context, _ uint64, page, size int) ([]*model.UserReferralBind, int64, error) {
			return nil, 12, nil // 12 个被邀请人
		},
	}
	svc := newTestService(codeRepo, bindRepo, holdingRepo, &mockDepositRepo{})
	resp, err := svc.GetMyReferralInfo(context.Background(), 1)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp.MyCode != "0xABC123" {
		t.Errorf("MyCode = %q, want %q", resp.MyCode, "0xABC123")
	}
	if !strings.Contains(resp.ShareLink, "0xABC123") {
		t.Errorf("ShareLink %q should contain code", resp.ShareLink)
	}
	if resp.Stats.InvitedCount != 12 {
		t.Errorf("InvitedCount = %d, want 12", resp.Stats.InvitedCount)
	}
	if resp.Stats.TotalRewardOdd != "3200" {
		t.Errorf("TotalRewardOdd = %q, want %q", resp.Stats.TotalRewardOdd, "3200")
	}
}
