package service_test

// presale_deposit_impl_test.go
//
// M3: ReportTx 4 项链上校验 service 单测
// M4: ConfirmDeposit 大事务单测
// FindRound 边界容差测试

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"math/big"
	"strings"
	"testing"
	"time"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/shopspring/decimal"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// ===========================
// deposit-aware fake SQL driver（for ConfirmDeposit transaction + SELECT support）
//
// ConfirmDeposit 在 service 层直接用 gorm.DB.First(&dep, id) 查询 deposit。
// 为让测试能正确返回 deposit 数据，fake driver 的 Query 需要按列顺序返回 deposit 字段值。
// 设计：depositStore 全局存储 mock deposit，Query 直接返回对应列值。
// ===========================

// depositStore 存放当前测试用的 mock deposit（测试级别单例，goroutine unsafe，每个测试独立）
var depositStore map[uint64]*model.PresaleDeposit

func init() {
	sql.Register("fakemysql_svc", &fakeSvcDriver{})
	depositStore = make(map[uint64]*model.PresaleDeposit)
	// ConfirmDeposit 通过 GORM First 触发 model.PresaleDeposit.TableName()，
	// TableName() 调用 config.Get()，测试环境需要用 InitForTest 避免读 config.yaml
	config.InitForTest()
}

type fakeSvcDriver struct{}

type fakeSvcConn struct{}
type fakeSvcTx struct{}
type fakeSvcStmt struct{ query string }
type fakeSvcResult struct{}

// fakeSvcRows 按列名动态返回 deposit 字段值（供 GORM First 扫描）
type fakeSvcRows struct {
	cols    []string
	vals    []driver.Value
	yielded bool
}

func (*fakeSvcDriver) Open(_ string) (driver.Conn, error) { return &fakeSvcConn{}, nil }
func (*fakeSvcConn) Prepare(query string) (driver.Stmt, error) {
	return &fakeSvcStmt{query: query}, nil
}
func (*fakeSvcConn) Close() error              { return nil }
func (*fakeSvcConn) Begin() (driver.Tx, error) { return &fakeSvcTx{}, nil }
func (*fakeSvcTx) Commit() error               { return nil }
func (*fakeSvcTx) Rollback() error             { return nil }
func (*fakeSvcStmt) Close() error              { return nil }
func (*fakeSvcStmt) NumInput() int             { return -1 }
func (*fakeSvcStmt) Exec(_ []driver.Value) (driver.Result, error) {
	return &fakeSvcResult{}, nil
}
func (s *fakeSvcStmt) Query(args []driver.Value) (driver.Rows, error) {
	// GORM 初始化时发出 SELECT VERSION() 等
	// SELECT 查询 presale_deposit 时，从 depositStore 中取 deposit 数据
	if strings.Contains(s.query, "presale_deposit") && len(args) > 0 {
		if id, ok := args[0].(int64); ok {
			if dep, found := depositStore[uint64(id)]; found {
				cols, vals := depositToRow(dep)
				return &fakeSvcRows{cols: cols, vals: vals}, nil
			}
		}
		// 未找到 deposit → 返回空结果集（GORM 会返回 ErrRecordNotFound）
		return &fakeSvcRows{cols: []string{"id"}, vals: nil, yielded: true}, nil
	}
	// 其他查询（VERSION() 等）返回最小行
	return &fakeSvcRows{cols: []string{"version"}, vals: []driver.Value{"8.0.0-fake"}}, nil
}

func (*fakeSvcResult) LastInsertId() (int64, error) { return 1, nil }
func (*fakeSvcResult) RowsAffected() (int64, error) { return 1, nil }
func (r *fakeSvcRows) Columns() []string            { return r.cols }
func (r *fakeSvcRows) Close() error                 { return nil }
func (r *fakeSvcRows) Next(dest []driver.Value) error {
	if r.yielded || r.vals == nil {
		return io.EOF
	}
	r.yielded = true
	for i, v := range r.vals {
		if i < len(dest) {
			dest[i] = v
		}
	}
	return nil
}

// depositToRow 将 PresaleDeposit 转为 (cols, vals)，供 fake driver 返回
// 列顺序必须与 GORM SELECT 列顺序一致（按 struct tag 顺序）
func depositToRow(dep *model.PresaleDeposit) ([]string, []driver.Value) {
	referrerUserID := driver.Value(nil)
	if dep.ReferrerUserID != nil {
		referrerUserID = int64(*dep.ReferrerUserID)
	}
	referrerEoa := driver.Value(nil)
	if dep.ReferrerEoa != nil {
		referrerEoa = *dep.ReferrerEoa
	}
	referralRewardPct := driver.Value(nil)
	if dep.ReferralRewardPct != nil {
		referralRewardPct = dep.ReferralRewardPct.String()
	}
	anomalyReason := driver.Value(nil)
	if dep.AnomalyReason != nil {
		anomalyReason = *dep.AnomalyReason
	}
	confirmedAt := driver.Value(nil)
	if dep.ConfirmedAt != nil {
		confirmedAt = *dep.ConfirmedAt
	}
	expectedRoundID := driver.Value(nil)
	if dep.ExpectedRoundID != nil {
		expectedRoundID = *dep.ExpectedRoundID
	}
	expectedAmount := driver.Value(nil)
	if dep.ExpectedAmount != nil {
		expectedAmount = dep.ExpectedAmount.String()
	}

	cols := []string{
		"id", "tx_hash", "log_index", "block_number", "block_timestamp",
		"user_id", "eoa_address", "vault_address", "round_id",
		"amount_usdt", "price_usd", "shares_odd",
		"referrer_user_id", "referrer_eoa", "referral_reward_pct", "referral_reward_odd",
		"status", "anomaly_reason", "confirmed_at",
		"expected_round_id", "expected_amount", "source",
		"created_at", "updated_at",
	}
	vals := []driver.Value{
		int64(dep.ID), dep.TxHash, int64(dep.LogIndex), int64(dep.BlockNumber), dep.BlockTimestamp,
		int64(dep.UserID), dep.EoaAddress, dep.VaultAddress, dep.RoundID,
		dep.AmountUsdt.String(), dep.PriceUsd.String(), dep.SharesOdd.String(),
		referrerUserID, referrerEoa, referralRewardPct, dep.ReferralRewardOdd.String(),
		dep.Status, anomalyReason, confirmedAt,
		expectedRoundID, expectedAmount, dep.Source,
		dep.CreatedAt, dep.UpdatedAt,
	}
	return cols, vals
}

// openFakeSvcGORM opens a GORM DB backed by the deposit-aware fake SQL driver
func openFakeSvcGORM(t *testing.T) *gorm.DB {
	t.Helper()
	sqlDB, err := sql.Open("fakemysql_svc", "fake")
	if err != nil {
		t.Fatalf("open fake sql: %v", err)
	}
	db, err := gorm.Open(mysql.New(mysql.Config{Conn: sqlDB}), &gorm.Config{
		Logger:                 gormlogger.Default.LogMode(gormlogger.Silent),
		SkipDefaultTransaction: false,
	})
	if err != nil {
		t.Fatalf("open fake gorm: %v", err)
	}
	return db
}

// seedDeposit registers a deposit in depositStore so the fake driver can return it
func seedDeposit(dep *model.PresaleDeposit) {
	depositStore[dep.ID] = dep
}

// clearDeposits resets depositStore between tests
func clearDeposits() {
	depositStore = make(map[uint64]*model.PresaleDeposit)
}

// ===========================
// mock BscClient（M3 测试专用）
// ===========================

var transferEventSigSvc = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))

const (
	svcVaultAddr = "0x1100000000000000000000000000000000000001"
	svcUsdtAddr  = "0x2200000000000000000000000000000000000002"
	svcUserEoa   = "0x3300000000000000000000000000000000000003"
	svcOtherAddr = "0x4400000000000000000000000000000000000004"
)

type mockSvcBscClient struct {
	receipt    *types.Receipt
	receiptErr error
	blockNum   uint64
	header     *types.Header
}

func (m *mockSvcBscClient) TransactionReceipt(_ context.Context, _ common.Hash) (*types.Receipt, error) {
	return m.receipt, m.receiptErr
}
func (m *mockSvcBscClient) FilterLogs(_ context.Context, _ ethereum.FilterQuery) ([]types.Log, error) {
	return nil, errors.New("not used in service tests")
}
func (m *mockSvcBscClient) BlockNumber(_ context.Context) (uint64, error) {
	return m.blockNum, nil
}
func (m *mockSvcBscClient) HeaderByNumber(_ context.Context, _ *big.Int) (*types.Header, error) {
	if m.header != nil {
		return m.header, nil
	}
	return &types.Header{Time: 1_700_000_000}, nil
}

var _ service.BscClient = (*mockSvcBscClient)(nil)

// makeUsdtTransferReceipt 构造包含单条 USDT Transfer log 的 receipt
func makeUsdtTransferReceipt(from, to string, usdtContract string, status uint64, blockNum uint64) *types.Receipt {
	fromHash := common.BytesToHash(common.HexToAddress(from).Bytes())
	toHash := common.BytesToHash(common.HexToAddress(to).Bytes())
	amtBytes := make([]byte, 32)
	big.NewInt(100).Mul(big.NewInt(100), new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)).FillBytes(amtBytes)

	log := &types.Log{
		Address: common.HexToAddress(usdtContract),
		Topics:  []common.Hash{transferEventSigSvc, fromHash, toHash},
		Data:    amtBytes,
		Index:   0,
	}
	return &types.Receipt{
		Status:      status,
		BlockNumber: new(big.Int).SetUint64(blockNum),
		Logs:        []*types.Log{log},
	}
}

func makePresaleCfgWithVault() *config.PresaleConfig {
	return &config.PresaleConfig{
		VaultPool:            []string{svcVaultAddr},
		UsdtAddress:          svcUsdtAddr,
		ConfirmBlocks:        3,
		BoundaryToleranceMin: 5,
		PollIntervalSec:      6,
		RedisLeaderKey:       "presale:leader",
		RedisLeaderTTLSec:    30,
	}
}

func buildSvcWithBsc(
	bscClient service.BscClient,
	depositRepo repository.PresaleDepositRepository,
	roundRepo repository.PresaleRoundRepository,
	holdingRepo repository.PresaleHoldingRepository,
	opsRepo repository.PresaleOpsEventRepository,
	bindRepo repository.UserReferralBindRepository,
) service.PresaleDepositService {
	cfg := makePresaleCfgWithVault()
	return service.NewPresaleDepositService(
		cfg, nil,
		depositRepo, roundRepo, holdingRepo, opsRepo, bindRepo,
		nil, // kolRepo（REQ-004 未启用，回落 round.ReferralRewardPct）
		nil, bscClient,
	)
}

// ===========================
// mock PresaleDepositRepository
// ===========================

type mockDepositRepo struct {
	deposits        map[uint64]*model.PresaleDeposit
	createdDeposits []*model.PresaleDeposit // ReportTx 路径 CreateOrGet 创建的记录（顺序追加）
	nextID          uint64
	confirmCalled   []uint64
	anomalyCalled   map[uint64]string
	confirmErr      error
	anomalyErr      error
}

func newMockDepositRepo(deposits ...*model.PresaleDeposit) *mockDepositRepo {
	m := &mockDepositRepo{
		deposits:      make(map[uint64]*model.PresaleDeposit),
		anomalyCalled: make(map[uint64]string),
	}
	for _, d := range deposits {
		m.deposits[d.ID] = d
	}
	return m
}

func (m *mockDepositRepo) CreateOrGet(_ context.Context, _ *gorm.DB, deposit *model.PresaleDeposit) (*model.PresaleDeposit, bool, error) {
	// 捕获 ReportTx 路径创建的 deposit（供 BUG-001 INV-6 容差测试断言）
	// 与既有 seedAndClear 注入 m.deposits 的 ConfirmDeposit 测试不冲突（不同字段）
	if deposit.ID == 0 {
		m.nextID++
		deposit.ID = m.nextID
	}
	m.createdDeposits = append(m.createdDeposits, deposit)
	return deposit, true, nil
}
func (m *mockDepositRepo) GetByTxHash(_ context.Context, _ string, _ uint64) (*model.PresaleDeposit, error) {
	return nil, errors.New("not implemented")
}
func (m *mockDepositRepo) ListByUser(_ context.Context, _ uint64, _ string, _, _ int) ([]*model.PresaleDeposit, int64, error) {
	return nil, 0, errors.New("not implemented")
}
func (m *mockDepositRepo) ConfirmDeposit(_ context.Context, _ *gorm.DB, depositID uint64, _ int64) error {
	m.confirmCalled = append(m.confirmCalled, depositID)
	if dep, ok := m.deposits[depositID]; ok {
		dep.Status = model.PresaleDepositStatusConfirmed
	}
	return m.confirmErr
}
func (m *mockDepositRepo) MarkAnomaly(_ context.Context, _ *gorm.DB, depositID uint64, reason string) error {
	m.anomalyCalled[depositID] = reason
	return m.anomalyErr
}
func (m *mockDepositRepo) ListPendingByBlockThreshold(_ context.Context, _ uint64) ([]*model.PresaleDeposit, error) {
	return nil, errors.New("not implemented")
}
// UpdateReferrerIfNull mock：B7 cmd/inv6-backfill 工具用，本测试不调用，stub 返回 true
func (m *mockDepositRepo) UpdateReferrerIfNull(_ context.Context, _ *gorm.DB, _ uint64, _ uint64, _ string, _, _ decimal.Decimal) (bool, error) {
	return true, nil
}

func (m *mockDepositRepo) ListByReferrerUserID(_ context.Context, _ uint64, _ []uint64) ([]*model.PresaleDeposit, error) {
	return nil, errors.New("not implemented")
}

var _ repository.PresaleDepositRepository = (*mockDepositRepo)(nil)

// ===========================
// mock PresaleRoundRepository（extended for ConfirmDeposit / FindRound）
// ===========================

type mockRoundRepoFull struct {
	// embed advanceCalls from cron test? No — separate type here to avoid collision.
	byID           map[string]*model.PresaleRound
	incrErr        error
	incrCalledWith []string
	advanceErrMap  map[string]error
}

func newMockRoundRepoFull(rounds ...*model.PresaleRound) *mockRoundRepoFull {
	m := &mockRoundRepoFull{
		byID:          make(map[string]*model.PresaleRound),
		advanceErrMap: make(map[string]error),
	}
	for _, r := range rounds {
		m.byID[r.ID] = r
	}
	return m
}

func (m *mockRoundRepoFull) GetByID(_ context.Context, id string) (*model.PresaleRound, error) {
	if r, ok := m.byID[id]; ok {
		return r, nil
	}
	return nil, repository.ErrRoundNotFound
}
func (m *mockRoundRepoFull) List(_ context.Context) ([]*model.PresaleRound, error) {
	return nil, errors.New("not implemented")
}
func (m *mockRoundRepoFull) ListActive(_ context.Context) ([]*model.PresaleRound, error) {
	var out []*model.PresaleRound
	for _, r := range m.byID {
		if r.Status == model.RoundStatusActive || r.Status == model.RoundStatusPaused {
			out = append(out, r)
		}
	}
	return out, nil
}
func (m *mockRoundRepoFull) ListAutoAdvanceable(_ context.Context, _ int64) ([]*model.PresaleRound, error) {
	return nil, errors.New("not implemented")
}
func (m *mockRoundRepoFull) AdvanceStatus(_ context.Context, id, _, _ string) error {
	if err, ok := m.advanceErrMap[id]; ok {
		return err
	}
	return nil
}
func (m *mockRoundRepoFull) IncrSoldAndRaised(_ context.Context, _ *gorm.DB, roundID string, _, _ decimal.Decimal) error {
	m.incrCalledWith = append(m.incrCalledWith, roundID)
	return m.incrErr
}
func (m *mockRoundRepoFull) FindUpcomingNearest(_ context.Context) (*model.PresaleRound, error) {
	return nil, repository.ErrRoundNotFound
}
func (m *mockRoundRepoFull) TotalRaisedUsd(_ context.Context) (decimal.Decimal, error) {
	return decimal.Zero, errors.New("not implemented")
}

var _ repository.PresaleRoundRepository = (*mockRoundRepoFull)(nil)

// ===========================
// mock PresaleHoldingRepository
// ===========================

type mockHoldingRepo struct {
	upsertInvestCalled   []uint64
	upsertReferralCalled []uint64
	upsertInvestErr      error
	upsertReferralErr    error
}

func (m *mockHoldingRepo) UpsertInvest(_ context.Context, _ *gorm.DB, userID uint64, _ string, _, _, _ decimal.Decimal) error {
	m.upsertInvestCalled = append(m.upsertInvestCalled, userID)
	return m.upsertInvestErr
}
func (m *mockHoldingRepo) UpsertReferral(_ context.Context, _ *gorm.DB, referrerID uint64, _ string, _ decimal.Decimal) error {
	m.upsertReferralCalled = append(m.upsertReferralCalled, referrerID)
	return m.upsertReferralErr
}
func (m *mockHoldingRepo) ListByUser(_ context.Context, _ uint64) ([]*model.PresaleHolding, error) {
	return nil, errors.New("not implemented")
}
func (m *mockHoldingRepo) SumReferralOdd(_ context.Context, _ uint64) (decimal.Decimal, error) {
	return decimal.Zero, errors.New("not implemented")
}

var _ repository.PresaleHoldingRepository = (*mockHoldingRepo)(nil)

// ===========================
// mock PresaleOpsEventRepository
// ===========================

type mockOpsRepo struct {
	events []*model.PresaleOpsEvent
}

func (m *mockOpsRepo) Create(_ context.Context, _ *gorm.DB, event *model.PresaleOpsEvent) error {
	m.events = append(m.events, event)
	return nil
}
func (m *mockOpsRepo) ListPending(_ context.Context, _ int) ([]*model.PresaleOpsEvent, error) {
	return nil, errors.New("not implemented")
}
func (m *mockOpsRepo) UpdateStatus(_ context.Context, _ *gorm.DB, _ uint64, _ string) error {
	return errors.New("not implemented")
}

var _ repository.PresaleOpsEventRepository = (*mockOpsRepo)(nil)

// ===========================
// mock UserReferralBindRepository
// ===========================

type mockBindRepo struct {
	binds map[uint64]*model.UserReferralBind
}

func newMockBindRepo(binds ...*model.UserReferralBind) *mockBindRepo {
	m := &mockBindRepo{binds: make(map[uint64]*model.UserReferralBind)}
	for _, b := range binds {
		m.binds[b.UserID] = b
	}
	return m
}

func (m *mockBindRepo) GetByUserID(_ context.Context, userID uint64) (*model.UserReferralBind, error) {
	if b, ok := m.binds[userID]; ok {
		return b, nil
	}
	return nil, nil
}
func (m *mockBindRepo) CreateIdempotent(_ context.Context, _ *gorm.DB, _ *model.UserReferralBind) (bool, error) {
	return false, errors.New("not implemented")
}
func (m *mockBindRepo) ListByReferrer(_ context.Context, _ uint64, _, _ int) ([]*model.UserReferralBind, int64, error) {
	return nil, 0, errors.New("not implemented")
}
func (m *mockBindRepo) ListByReferrerFiltered(_ context.Context, _ uint64, _ string, _, _ int) ([]*model.UserReferralBind, int64, error) {
	return nil, 0, errors.New("not implemented")
}

var _ repository.UserReferralBindRepository = (*mockBindRepo)(nil)

// ===========================
// helpers
// ===========================

func makePresaleConfig() *config.PresaleConfig {
	return &config.PresaleConfig{
		VaultPool:            []string{"0xvault1"},
		UsdtAddress:          "0xusdt",
		ConfirmBlocks:        3,
		BoundaryToleranceMin: 5,
		PollIntervalSec:      6,
		RedisLeaderKey:       "presale:leader",
		RedisLeaderTTLSec:    30,
	}
}

func makeActiveRound(id string) *model.PresaleRound {
	return &model.PresaleRound{
		ID:                id,
		Status:            model.RoundStatusActive,
		PriceUsd:          decimal.NewFromFloat(0.05),
		SupplyOdd:         decimal.NewFromInt(10_000_000),
		SoldOdd:           decimal.Zero,
		RaisedUsd:         decimal.Zero,
		ReferralRewardPct: decimal.NewFromInt(10),
		StartTs:           time.Now().Add(-24 * time.Hour).UnixMilli(),
		EndTs:             time.Now().Add(24 * time.Hour).UnixMilli(),
	}
}

func buildServiceNoDB(
	depositRepo repository.PresaleDepositRepository,
	roundRepo repository.PresaleRoundRepository,
	holdingRepo repository.PresaleHoldingRepository,
	opsRepo repository.PresaleOpsEventRepository,
	bindRepo repository.UserReferralBindRepository,
) service.PresaleDepositService {
	cfg := makePresaleConfig()
	return service.NewPresaleDepositService(
		cfg, nil,
		depositRepo, roundRepo, holdingRepo, opsRepo, bindRepo,
		nil, // kolRepo（REQ-004 未启用）
		nil, nil,
	)
}

// ===========================
// TestFindRound tests
// ===========================

func TestFindRound_HitsActiveRound(t *testing.T) {
	round := makeActiveRound("r1")
	roundRepo := newMockRoundRepoFull(round)
	svc := buildServiceNoDB(
		newMockDepositRepo(), roundRepo, &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	blockTs := time.Now().UnixMilli()
	got, err := svc.FindRound(context.Background(), blockTs)
	if err != nil {
		t.Fatalf("FindRound unexpected error: %v", err)
	}
	if got.ID != "r1" {
		t.Errorf("expected round r1, got %s", got.ID)
	}
}

func TestFindRound_NoActiveRound(t *testing.T) {
	roundRepo := newMockRoundRepoFull()
	svc := buildServiceNoDB(
		newMockDepositRepo(), roundRepo, &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	_, err := svc.FindRound(context.Background(), time.Now().UnixMilli())
	if !errors.Is(err, service.ErrNoActiveRound) {
		t.Errorf("expected ErrNoActiveRound, got %v", err)
	}
}

func TestFindRound_BoundaryTolerance(t *testing.T) {
	round := makeActiveRound("r1")
	// end_ts 2 minutes ago, tolerance=5min → still within window
	round.EndTs = time.Now().Add(-2 * time.Minute).UnixMilli()
	roundRepo := newMockRoundRepoFull(round)
	svc := buildServiceNoDB(
		newMockDepositRepo(), roundRepo, &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	blockTs := time.Now().UnixMilli()
	got, err := svc.FindRound(context.Background(), blockTs)
	if err != nil {
		t.Fatalf("FindRound within tolerance should succeed, got: %v", err)
	}
	if got.ID != "r1" {
		t.Errorf("expected r1, got %s", got.ID)
	}
}

func TestFindRound_BeyondTolerance_ReturnsError(t *testing.T) {
	round := makeActiveRound("r1")
	// end_ts 10 minutes ago, tolerance=5min → beyond window
	round.EndTs = time.Now().Add(-10 * time.Minute).UnixMilli()
	roundRepo := newMockRoundRepoFull(round)
	svc := buildServiceNoDB(
		newMockDepositRepo(), roundRepo, &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	blockTs := time.Now().UnixMilli()
	_, err := svc.FindRound(context.Background(), blockTs)
	if !errors.Is(err, service.ErrNoActiveRound) {
		t.Errorf("expected ErrNoActiveRound beyond tolerance, got %v", err)
	}
}

// TestFindRound_BoundAfterTx verifies INV-6 boundary:
// FindRound itself doesn't check bind, but the test confirms no active round returns
// ErrNoActiveRound which triggers late_arrival anomaly path — the INV-6 bind check
// lives in processLog (chain package) and is covered in TestPresaleListener tests.
func TestFindRound_BoundAfterTx_NoRound(t *testing.T) {
	// No active rounds at all — simulates blockTs with no matching round (late_arrival scenario)
	roundRepo := newMockRoundRepoFull()
	svc := buildServiceNoDB(
		newMockDepositRepo(), roundRepo, &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	pastBlockTs := time.Now().Add(-48 * time.Hour).UnixMilli()
	_, err := svc.FindRound(context.Background(), pastBlockTs)
	if !errors.Is(err, service.ErrNoActiveRound) {
		t.Errorf("expected ErrNoActiveRound for far-past blockTs, got %v", err)
	}
}

// ===========================
// M3: ReportTx 4 项链上校验单测
// ===========================

// TestReportTx_InvalidTx_ReceiptNil：receipt 不存在 → ErrInvalidTx (40006)
func TestReportTx_InvalidTx_ReceiptNil(t *testing.T) {
	bsc := &mockSvcBscClient{receipt: nil, receiptErr: errors.New("not found")}
	svc := buildSvcWithBsc(bsc,
		newMockDepositRepo(), newMockRoundRepoFull(), &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	req := service.ReportTxRequest{TxHash: "0xdeadbeef"}
	_, err := svc.ReportTx(context.Background(), 1, svcUserEoa, req)
	if !errors.Is(err, service.ErrInvalidTx) {
		t.Errorf("receipt nil: want ErrInvalidTx, got %v", err)
	}
}

// TestReportTx_InvalidTx_StatusFailed：receipt.Status=0 (tx reverted) → ErrInvalidTx (40006)
func TestReportTx_InvalidTx_StatusFailed(t *testing.T) {
	receipt := makeUsdtTransferReceipt(svcUserEoa, svcVaultAddr, svcUsdtAddr, 0 /* failed */, 100)
	bsc := &mockSvcBscClient{receipt: receipt}
	svc := buildSvcWithBsc(bsc,
		newMockDepositRepo(), newMockRoundRepoFull(), &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	req := service.ReportTxRequest{TxHash: "0xdeadbeef"}
	_, err := svc.ReportTx(context.Background(), 1, svcUserEoa, req)
	if !errors.Is(err, service.ErrInvalidTx) {
		t.Errorf("tx reverted: want ErrInvalidTx, got %v", err)
	}
}

// TestReportTx_TxNotToVault：Transfer log 的 to 不在 vaultPool → ErrTxNotToVault (40007)
func TestReportTx_TxNotToVault(t *testing.T) {
	// to=svcOtherAddr（不在 vaultPool）
	receipt := makeUsdtTransferReceipt(svcUserEoa, svcOtherAddr, svcUsdtAddr, types.ReceiptStatusSuccessful, 100)
	bsc := &mockSvcBscClient{receipt: receipt}
	svc := buildSvcWithBsc(bsc,
		newMockDepositRepo(), newMockRoundRepoFull(), &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	req := service.ReportTxRequest{TxHash: "0xdeadbeef"}
	_, err := svc.ReportTx(context.Background(), 1, svcUserEoa, req)
	if !errors.Is(err, service.ErrTxNotToVault) {
		t.Errorf("to not in vault: want ErrTxNotToVault, got %v", err)
	}
}

// TestReportTx_TxNotUsdt：log.address ≠ USDT 合约 → ErrTxNotUsdt (40008)
func TestReportTx_TxNotUsdt(t *testing.T) {
	// log.Address = svcOtherAddr（不是 USDT）
	receipt := makeUsdtTransferReceipt(svcUserEoa, svcVaultAddr, svcOtherAddr /* wrong token */, types.ReceiptStatusSuccessful, 100)
	bsc := &mockSvcBscClient{receipt: receipt}
	svc := buildSvcWithBsc(bsc,
		newMockDepositRepo(), newMockRoundRepoFull(), &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	req := service.ReportTxRequest{TxHash: "0xdeadbeef"}
	_, err := svc.ReportTx(context.Background(), 1, svcUserEoa, req)
	if !errors.Is(err, service.ErrTxNotUsdt) {
		t.Errorf("non-usdt token: want ErrTxNotUsdt, got %v", err)
	}
}

// TestReportTx_WalletMismatch：transfer.From ≠ 登录态 EOA → ErrDepositWalletMismatch (40902)
func TestReportTx_WalletMismatch(t *testing.T) {
	// Transfer from=svcOtherAddr，but user EOA=svcUserEoa
	receipt := makeUsdtTransferReceipt(svcOtherAddr, svcVaultAddr, svcUsdtAddr, types.ReceiptStatusSuccessful, 100)
	bsc := &mockSvcBscClient{receipt: receipt}
	svc := buildSvcWithBsc(bsc,
		newMockDepositRepo(), newMockRoundRepoFull(), &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	req := service.ReportTxRequest{TxHash: "0xdeadbeef"}
	_, err := svc.ReportTx(context.Background(), 1, svcUserEoa /* login EOA */, req)
	if !errors.Is(err, service.ErrDepositWalletMismatch) {
		t.Errorf("wallet mismatch: want ErrDepositWalletMismatch, got %v", err)
	}
}

// TestReportTx_MultipleTransfersToVault：同 tx 有 2 条 Transfer to vault → 拒绝（M6）
func TestReportTx_MultipleTransfersToVault(t *testing.T) {
	// 构造 2 条 to=vault 的 Transfer log
	fromHash := common.BytesToHash(common.HexToAddress(svcUserEoa).Bytes())
	toHash := common.BytesToHash(common.HexToAddress(svcVaultAddr).Bytes())
	amtBytes := make([]byte, 32)
	big.NewInt(50).Mul(big.NewInt(50), new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)).FillBytes(amtBytes)

	log1 := &types.Log{
		Address: common.HexToAddress(svcUsdtAddr),
		Topics:  []common.Hash{transferEventSigSvc, fromHash, toHash},
		Data:    amtBytes,
		Index:   0,
	}
	log2 := &types.Log{
		Address: common.HexToAddress(svcUsdtAddr),
		Topics:  []common.Hash{transferEventSigSvc, fromHash, toHash},
		Data:    amtBytes,
		Index:   1,
	}
	receipt := &types.Receipt{
		Status:      types.ReceiptStatusSuccessful,
		BlockNumber: big.NewInt(100),
		Logs:        []*types.Log{log1, log2},
	}
	bsc := &mockSvcBscClient{receipt: receipt}
	svc := buildSvcWithBsc(bsc,
		newMockDepositRepo(), newMockRoundRepoFull(), &mockHoldingRepo{}, &mockOpsRepo{}, newMockBindRepo(),
	)

	req := service.ReportTxRequest{TxHash: "0xdeadbeef"}
	_, err := svc.ReportTx(context.Background(), 1, svcUserEoa, req)
	if !errors.Is(err, service.ErrMultipleTransfersToVault) {
		t.Errorf("multiple transfers: want ErrMultipleTransfersToVault, got %v", err)
	}
}

// ===========================
// M4: ConfirmDeposit 大事务单测
// ===========================

// buildSvcForConfirm 构造带 fake gorm.DB 的 service（ConfirmDeposit 需要事务 + SELECT 支持）
// deposits 参数会同时注入 depositRepo 和 depositStore（供 fake driver SELECT 使用）
func buildSvcForConfirm(
	t *testing.T,
	depositRepo repository.PresaleDepositRepository,
	roundRepo repository.PresaleRoundRepository,
	holdingRepo repository.PresaleHoldingRepository,
	opsRepo repository.PresaleOpsEventRepository,
	bindRepo repository.UserReferralBindRepository,
) service.PresaleDepositService {
	t.Helper()
	db := openFakeSvcGORM(t)
	cfg := makePresaleConfig()
	return service.NewPresaleDepositService(
		cfg, db,
		depositRepo, roundRepo, holdingRepo, opsRepo, bindRepo,
		nil, // kolRepo（REQ-004 未启用）
		nil, nil,
	)
}

// seedAndClear seeds deposit into both depositRepo mock and global depositStore,
// and registers a test cleanup to clear the store after the test.
func seedAndClear(t *testing.T, depositRepo *mockDepositRepo, deps ...*model.PresaleDeposit) {
	t.Helper()
	clearDeposits()
	for _, dep := range deps {
		depositRepo.deposits[dep.ID] = dep
		seedDeposit(dep)
	}
	t.Cleanup(clearDeposits)
}

// TestConfirmDeposit_HappyPath：pending → confirmed，IncrSoldAndRaised + UpsertInvest 各 1 次
func TestConfirmDeposit_HappyPath(t *testing.T) {
	referrerID := uint64(9001)
	dep := &model.PresaleDeposit{
		ID:                1,
		TxHash:            "0xaabb",
		UserID:            2001,
		RoundID:           "r1",
		Status:            model.PresaleDepositStatusPending,
		AmountUsdt:        decimal.NewFromInt(100),
		SharesOdd:         decimal.NewFromInt(2000),
		ReferralRewardOdd: decimal.NewFromInt(200),
		ReferrerUserID:    &referrerID,
	}
	depositRepo := newMockDepositRepo(dep)
	roundRepo := newMockRoundRepoFull(makeActiveRound("r1"))
	holdingRepo := &mockHoldingRepo{}
	opsRepo := &mockOpsRepo{}

	seedAndClear(t, depositRepo, dep)
	svc := buildSvcForConfirm(t, depositRepo, roundRepo, holdingRepo, opsRepo, newMockBindRepo())

	if err := svc.ConfirmDeposit(context.Background(), nil, 1, time.Now().UnixMilli()); err != nil {
		t.Fatalf("ConfirmDeposit: %v", err)
	}

	// ConfirmDeposit called once
	if len(depositRepo.confirmCalled) != 1 || depositRepo.confirmCalled[0] != 1 {
		t.Errorf("ConfirmDeposit on deposit repo: want [1], got %v", depositRepo.confirmCalled)
	}
	// IncrSoldAndRaised called once
	if len(roundRepo.incrCalledWith) != 1 {
		t.Errorf("IncrSoldAndRaised should be called once, got %d", len(roundRepo.incrCalledWith))
	}
	// UpsertInvest called once
	if len(holdingRepo.upsertInvestCalled) != 1 {
		t.Errorf("UpsertInvest should be called once, got %d", len(holdingRepo.upsertInvestCalled))
	}
	// UpsertReferral called once (referrer exists and reward>0)
	if len(holdingRepo.upsertReferralCalled) != 1 {
		t.Errorf("UpsertReferral should be called once (referrer present), got %d", len(holdingRepo.upsertReferralCalled))
	}
}

// TestConfirmDeposit_AlreadyConfirmed：已 confirmed 的 deposit 二次调用 → noop，不重复 incr/upsert
func TestConfirmDeposit_AlreadyConfirmed(t *testing.T) {
	dep := &model.PresaleDeposit{
		ID:         2,
		TxHash:     "0xccdd",
		UserID:     2002,
		RoundID:    "r1",
		Status:     model.PresaleDepositStatusConfirmed, // 已 confirmed
		AmountUsdt: decimal.NewFromInt(50),
		SharesOdd:  decimal.NewFromInt(1000),
	}
	depositRepo := newMockDepositRepo(dep)
	roundRepo := newMockRoundRepoFull(makeActiveRound("r1"))
	holdingRepo := &mockHoldingRepo{}
	opsRepo := &mockOpsRepo{}

	seedAndClear(t, depositRepo, dep)
	svc := buildSvcForConfirm(t, depositRepo, roundRepo, holdingRepo, opsRepo, newMockBindRepo())

	if err := svc.ConfirmDeposit(context.Background(), nil, 2, time.Now().UnixMilli()); err != nil {
		t.Fatalf("ConfirmDeposit already-confirmed: %v", err)
	}

	// 幂等：不重复 incr/upsert
	if len(roundRepo.incrCalledWith) != 0 {
		t.Errorf("IncrSoldAndRaised must NOT be called for already-confirmed deposit, got %d", len(roundRepo.incrCalledWith))
	}
	if len(holdingRepo.upsertInvestCalled) != 0 {
		t.Errorf("UpsertInvest must NOT be called for already-confirmed deposit, got %d", len(holdingRepo.upsertInvestCalled))
	}
}

// TestConfirmDeposit_Overflow：IncrSoldAndRaised → ErrCapacityExceeded → MarkAnomaly(overflow)，不 UpsertInvest
func TestConfirmDeposit_Overflow(t *testing.T) {
	dep := &model.PresaleDeposit{
		ID:         3,
		TxHash:     "0xeeff",
		UserID:     2003,
		RoundID:    "r1",
		Status:     model.PresaleDepositStatusPending,
		AmountUsdt: decimal.NewFromInt(999_999),
		SharesOdd:  decimal.NewFromInt(10_000_000),
	}
	depositRepo := newMockDepositRepo(dep)
	roundRepo := newMockRoundRepoFull(makeActiveRound("r1"))
	roundRepo.incrErr = repository.ErrCapacityExceeded
	holdingRepo := &mockHoldingRepo{}
	opsRepo := &mockOpsRepo{}

	seedAndClear(t, depositRepo, dep)
	svc := buildSvcForConfirm(t, depositRepo, roundRepo, holdingRepo, opsRepo, newMockBindRepo())

	if err := svc.ConfirmDeposit(context.Background(), nil, 3, time.Now().UnixMilli()); err != nil {
		t.Fatalf("ConfirmDeposit overflow should not return error to caller: %v", err)
	}

	// MarkAnomaly(overflow) 被调
	if reason, ok := depositRepo.anomalyCalled[3]; !ok {
		t.Error("MarkAnomaly should be called for overflow")
	} else if reason != model.AnomalyOverflow {
		t.Errorf("anomaly reason: want overflow, got %s", reason)
	}
	// UpsertInvest 不调（INV-1）
	if len(holdingRepo.upsertInvestCalled) != 0 {
		t.Errorf("UpsertInvest must NOT be called on overflow (INV-1), got %d", len(holdingRepo.upsertInvestCalled))
	}
	// ops_event 落库
	foundOverflow := false
	for _, e := range opsRepo.events {
		if e.EventType == model.AnomalyOverflow {
			foundOverflow = true
		}
	}
	if !foundOverflow {
		t.Error("overflow ops_event should be created")
	}
}

// TestConfirmDeposit_WithReferrer：ReferrerUserID != nil → UpsertReferral 被调；nil → 不调
func TestConfirmDeposit_WithReferrer(t *testing.T) {
	referrerID := uint64(9002)

	// case 1: with referrer
	dep1 := &model.PresaleDeposit{
		ID:                4,
		TxHash:            "0x1234",
		UserID:            2004,
		RoundID:           "r1",
		Status:            model.PresaleDepositStatusPending,
		AmountUsdt:        decimal.NewFromInt(100),
		SharesOdd:         decimal.NewFromInt(2000),
		ReferralRewardOdd: decimal.NewFromInt(200), // > 0
		ReferrerUserID:    &referrerID,
	}
	depositRepo1 := newMockDepositRepo(dep1)
	holdingRepo1 := &mockHoldingRepo{}
	seedAndClear(t, depositRepo1, dep1)
	svc1 := buildSvcForConfirm(t, depositRepo1, newMockRoundRepoFull(makeActiveRound("r1")), holdingRepo1, &mockOpsRepo{}, newMockBindRepo())

	if err := svc1.ConfirmDeposit(context.Background(), nil, 4, time.Now().UnixMilli()); err != nil {
		t.Fatalf("ConfirmDeposit with referrer: %v", err)
	}
	if len(holdingRepo1.upsertReferralCalled) != 1 {
		t.Errorf("UpsertReferral should be called when referrer present, got %d", len(holdingRepo1.upsertReferralCalled))
	}

	// case 2: no referrer
	dep2 := &model.PresaleDeposit{
		ID:                5,
		TxHash:            "0x5678",
		UserID:            2005,
		RoundID:           "r1",
		Status:            model.PresaleDepositStatusPending,
		AmountUsdt:        decimal.NewFromInt(100),
		SharesOdd:         decimal.NewFromInt(2000),
		ReferralRewardOdd: decimal.Zero,
		ReferrerUserID:    nil, // no referrer
	}
	depositRepo2 := newMockDepositRepo(dep2)
	holdingRepo2 := &mockHoldingRepo{}
	seedAndClear(t, depositRepo2, dep2)
	svc2 := buildSvcForConfirm(t, depositRepo2, newMockRoundRepoFull(makeActiveRound("r1")), holdingRepo2, &mockOpsRepo{}, newMockBindRepo())

	if err := svc2.ConfirmDeposit(context.Background(), nil, 5, time.Now().UnixMilli()); err != nil {
		t.Fatalf("ConfirmDeposit without referrer: %v", err)
	}
	if len(holdingRepo2.upsertReferralCalled) != 0 {
		t.Errorf("UpsertReferral must NOT be called when no referrer, got %d", len(holdingRepo2.upsertReferralCalled))
	}
}

// ===========================
// BUG-001: INV-6 跨时钟域容差 — ReportTx 路径关键 case
//
// listener 路径已在 chain/presale_listener_test.go TestPresaleListener_Inv6_ClockSkewTolerance
// 覆盖 7 条用例 + NoBind。本测试验证 ReportTx (service) 路径在 INV-6 容差比较上行为镜像，
// 保证双轨（worker / report-tx）在同一容差常量 service.Inv6BoundAtClockSkewMs 下决策一致。
//
// 详见 .progress/bug/BUG-001-inv6-cross-clock-domain/BD.md §5.1
// ===========================

func TestReportTx_Inv6_ClockSkewTolerance(t *testing.T) {
	const userID = uint64(3001)
	const referrerID = uint64(7777)
	// 用整秒数（header.Time * 1000 后还原），落在 makeActiveRound 的 ±24h 窗口内
	headerTime := uint64(time.Now().Unix())
	blockTs := int64(headerTime) * 1000

	cases := []struct {
		name            string
		boundAtOffsetMs int64
		hasBind         bool
		expectReferrer  bool
	}{
		{"主 bug 场景: 同秒 ms 反超", +800, true, true},
		{"边界态相等", 0, true, true},
		{"容差边缘内", +4999, true, true},
		{"容差外刚过 5001ms（与 listener 镜像）", +5001, true, false},
		{"容差外: 真实先买后绑（晚 60s）", +60_000, true, false},
		{"先绑后买 分钟级（正常）", -60_000, true, true},
		{"无绑定", 0, false, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			receipt := makeUsdtTransferReceipt(svcUserEoa, svcVaultAddr, svcUsdtAddr,
				types.ReceiptStatusSuccessful, 100)
			bsc := &mockSvcBscClient{
				receipt: receipt,
				header:  &types.Header{Time: headerTime},
			}

			depositRepo := newMockDepositRepo()
			roundRepo := newMockRoundRepoFull(makeActiveRound("r1"))

			var bindRepo *mockBindRepo
			if tc.hasBind {
				bindRepo = newMockBindRepo(&model.UserReferralBind{
					UserID:         userID,
					ReferrerUserID: referrerID,
					ReferrerEoa:    "0xreferrer",
					BoundAt:        blockTs + tc.boundAtOffsetMs,
				})
			} else {
				bindRepo = newMockBindRepo()
			}

			svc := buildSvcWithBsc(bsc, depositRepo, roundRepo, &mockHoldingRepo{}, &mockOpsRepo{}, bindRepo)

			req := service.ReportTxRequest{TxHash: "0xdeadbeef"}
			_, err := svc.ReportTx(context.Background(), userID, svcUserEoa, req)
			if err != nil {
				t.Fatalf("ReportTx: %v", err)
			}

			if len(depositRepo.createdDeposits) != 1 {
				t.Fatalf("expected 1 deposit created, got %d", len(depositRepo.createdDeposits))
			}
			dep := depositRepo.createdDeposits[0]

			if tc.expectReferrer {
				if dep.ReferrerUserID == nil {
					t.Errorf("expected ReferrerUserID set, got nil")
				} else if *dep.ReferrerUserID != referrerID {
					t.Errorf("ReferrerUserID: want %d, got %d", referrerID, *dep.ReferrerUserID)
				}
				if dep.ReferralRewardOdd.IsZero() {
					t.Errorf("expected ReferralRewardOdd > 0, got 0")
				}
			} else {
				if dep.ReferrerUserID != nil {
					t.Errorf("expected ReferrerUserID nil, got %d", *dep.ReferrerUserID)
				}
				if !dep.ReferralRewardOdd.IsZero() {
					t.Errorf("expected ReferralRewardOdd = 0, got %s", dep.ReferralRewardOdd)
				}
			}
		})
	}
}

// TestPresaleDepositService_NotifyDepositConfirmed_NilSafe（TODO-014 M5）
// 固化 NotifyDepositConfirmed(nil) noop 契约：listener / 未来调用方在异常路径下
// 传 dep=nil 必须静默返回，不能 panic。
// 防御目的：未来重构若误删 nil 检查会被本测试当场抓住。
func TestPresaleDepositService_NotifyDepositConfirmed_NilSafe(t *testing.T) {
	// 用 buildSvcForConfirm 走构造器（larkAlerter 默认 noopAnomalyAlerter，无 side effect）
	svc := buildSvcForConfirm(t,
		newMockDepositRepo(),
		newMockRoundRepoFull(makeActiveRound("r1")),
		&mockHoldingRepo{},
		&mockOpsRepo{},
		newMockBindRepo(),
	)
	// 不期望 panic；webhook 也不应该被调用（在 nil 早返之前不触达 alerter）
	svc.NotifyDepositConfirmed(nil)
}
