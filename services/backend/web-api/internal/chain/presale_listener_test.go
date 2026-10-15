package chain_test

// presale_listener_test.go
//
// TestPresaleListener 4 case 覆盖（B2 DoD）：
//   - HappyPath：正常 Transfer → deposit created + IncrSoldAndRaised + UpsertInvest（INV-7：referral_reward_odd = shares×pct/100）
//   - Overflow：IncrSoldAndRaised 返回 ErrCapacityExceeded → MarkAnomaly(overflow)，不 UpsertInvest（INV-1）
//   - Unclaimed：user not found → opsEvent(unclaimed)，不创建 deposit
//   - BoundAfterTx：bind.BoundAt > blockTs → referralRewardOdd=0，不 UpsertReferral（INV-6）

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"math/big"
	"strings"
	"testing"

	"everything_finance/org/web-api/internal/chain"
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
// minimal fake SQL driver for transaction support in tests
// ===========================

func init() {
	sql.Register("fakemysql", &fakeDriver{})
}

type fakeDriver struct{}
type fakeConn struct{}
type fakeTx struct{}
type fakeStmt struct{ query string }
type fakeRows struct {
	cols    []string
	vals    []driver.Value
	yielded bool
}
type fakeResult struct{}

func (*fakeDriver) Open(_ string) (driver.Conn, error) { return &fakeConn{}, nil }
func (*fakeConn) Prepare(query string) (driver.Stmt, error) {
	return &fakeStmt{query: query}, nil
}
func (*fakeConn) Close() error              { return nil }
func (*fakeConn) Begin() (driver.Tx, error) { return &fakeTx{}, nil }
func (*fakeTx) Commit() error               { return nil }
func (*fakeTx) Rollback() error             { return nil }
func (*fakeStmt) Close() error              { return nil }
func (*fakeStmt) NumInput() int             { return -1 }
func (*fakeStmt) Exec(_ []driver.Value) (driver.Result, error) {
	return &fakeResult{}, nil
}
func (s *fakeStmt) Query(_ []driver.Value) (driver.Rows, error) {
	// GORM mysql driver runs "SELECT VERSION()" and similar during Open.
	// Return a single-column single-row result so gorm.Open succeeds.
	return &fakeRows{cols: []string{"version"}, vals: []driver.Value{"8.0.0-fake"}}, nil
}
func (*fakeResult) LastInsertId() (int64, error) { return 1, nil }
func (*fakeResult) RowsAffected() (int64, error) { return 1, nil }
func (r *fakeRows) Columns() []string            { return r.cols }
func (r *fakeRows) Close() error                 { return nil }
func (r *fakeRows) Next(dest []driver.Value) error {
	if r.yielded {
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

// ===========================
// mock BscClient
// ===========================

type mockBscClient struct {
	headBlock    uint64
	blockHeaders map[uint64]*types.Header
	logs         []types.Log
	logsErr      error
}

func (m *mockBscClient) TransactionReceipt(_ context.Context, _ common.Hash) (*types.Receipt, error) {
	return nil, errors.New("not implemented in listener test")
}
func (m *mockBscClient) FilterLogs(_ context.Context, _ ethereum.FilterQuery) ([]types.Log, error) {
	return m.logs, m.logsErr
}
func (m *mockBscClient) BlockNumber(_ context.Context) (uint64, error) {
	return m.headBlock, nil
}
func (m *mockBscClient) HeaderByNumber(_ context.Context, number *big.Int) (*types.Header, error) {
	if h, ok := m.blockHeaders[number.Uint64()]; ok {
		return h, nil
	}
	return &types.Header{Time: 1_700_000_000}, nil
}

var _ service.BscClient = (*mockBscClient)(nil)

// ===========================
// mock PresaleDepositRepository
// ===========================

type listenerDepositRepo struct {
	createdDeposits []*model.PresaleDeposit
	confirmCalled   []uint64
	anomalyCalled   map[uint64]string
	existingByUK    map[string]*model.PresaleDeposit
	deposits        map[uint64]*model.PresaleDeposit // by ID, for pre-seeding existing records
	nextID          uint64
}

func newListenerDepositRepo() *listenerDepositRepo {
	return &listenerDepositRepo{
		anomalyCalled: make(map[uint64]string),
		existingByUK:  make(map[string]*model.PresaleDeposit),
		deposits:      make(map[uint64]*model.PresaleDeposit),
		nextID:        1,
	}
}

func ukKey(txHash string, logIndex uint) string {
	return fmt.Sprintf("%s:%d", strings.ToLower(txHash), logIndex)
}

func (m *listenerDepositRepo) CreateOrGet(_ context.Context, _ *gorm.DB, deposit *model.PresaleDeposit) (*model.PresaleDeposit, bool, error) {
	k := ukKey(deposit.TxHash, deposit.LogIndex)
	if existing, ok := m.existingByUK[k]; ok {
		return existing, false, nil
	}
	deposit.ID = m.nextID
	m.nextID++
	m.createdDeposits = append(m.createdDeposits, deposit)
	m.existingByUK[k] = deposit
	return deposit, true, nil
}
func (m *listenerDepositRepo) GetByTxHash(_ context.Context, _ string, _ uint64) (*model.PresaleDeposit, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerDepositRepo) ListByUser(_ context.Context, _ uint64, _ string, _, _ int) ([]*model.PresaleDeposit, int64, error) {
	return nil, 0, errors.New("not implemented")
}
func (m *listenerDepositRepo) ConfirmDeposit(_ context.Context, _ *gorm.DB, depositID uint64, _ int64) error {
	m.confirmCalled = append(m.confirmCalled, depositID)
	return nil
}
func (m *listenerDepositRepo) MarkAnomaly(_ context.Context, _ *gorm.DB, depositID uint64, reason string) error {
	m.anomalyCalled[depositID] = reason
	return nil
}
func (m *listenerDepositRepo) ListPendingByBlockThreshold(_ context.Context, _ uint64) ([]*model.PresaleDeposit, error) {
	return nil, errors.New("not implemented")
}
// UpdateReferrerIfNull mock：B7 cmd/inv6-backfill 工具用，listener 路径不调用，stub 返回 true
func (m *listenerDepositRepo) UpdateReferrerIfNull(_ context.Context, _ *gorm.DB, _ uint64, _ uint64, _ string, _, _ decimal.Decimal) (bool, error) {
	return true, nil
}

func (m *listenerDepositRepo) ListByReferrerUserID(_ context.Context, _ uint64, _ []uint64) ([]*model.PresaleDeposit, error) {
	return nil, errors.New("not implemented")
}

var _ repository.PresaleDepositRepository = (*listenerDepositRepo)(nil)

// ===========================
// mock PresaleRoundRepository
// ===========================

type listenerRoundRepo struct {
	activeRounds []*model.PresaleRound
	incrErr      error
	incrCalled   int
}

func (m *listenerRoundRepo) GetByID(_ context.Context, id string) (*model.PresaleRound, error) {
	for _, r := range m.activeRounds {
		if r.ID == id {
			return r, nil
		}
	}
	return nil, repository.ErrRoundNotFound
}
func (m *listenerRoundRepo) List(_ context.Context) ([]*model.PresaleRound, error) { return nil, nil }
func (m *listenerRoundRepo) ListActive(_ context.Context) ([]*model.PresaleRound, error) {
	return m.activeRounds, nil
}
func (m *listenerRoundRepo) ListAutoAdvanceable(_ context.Context, _ int64) ([]*model.PresaleRound, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerRoundRepo) AdvanceStatus(_ context.Context, _, _, _ string) error { return nil }
func (m *listenerRoundRepo) IncrSoldAndRaised(_ context.Context, _ *gorm.DB, _ string, _, _ decimal.Decimal) error {
	m.incrCalled++
	return m.incrErr
}
func (m *listenerRoundRepo) FindUpcomingNearest(_ context.Context) (*model.PresaleRound, error) {
	return nil, repository.ErrRoundNotFound
}
func (m *listenerRoundRepo) TotalRaisedUsd(_ context.Context) (decimal.Decimal, error) {
	return decimal.Zero, nil
}

var _ repository.PresaleRoundRepository = (*listenerRoundRepo)(nil)

// ===========================
// mock PresaleHoldingRepository
// ===========================

type listenerHoldingRepo struct {
	upsertInvestCalled   []uint64
	upsertReferralCalled []uint64
}

func (m *listenerHoldingRepo) UpsertInvest(_ context.Context, _ *gorm.DB, userID uint64, _ string, _, _, _ decimal.Decimal) error {
	m.upsertInvestCalled = append(m.upsertInvestCalled, userID)
	return nil
}
func (m *listenerHoldingRepo) UpsertReferral(_ context.Context, _ *gorm.DB, referrerID uint64, _ string, _ decimal.Decimal) error {
	m.upsertReferralCalled = append(m.upsertReferralCalled, referrerID)
	return nil
}
func (m *listenerHoldingRepo) ListByUser(_ context.Context, _ uint64) ([]*model.PresaleHolding, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerHoldingRepo) SumReferralOdd(_ context.Context, _ uint64) (decimal.Decimal, error) {
	return decimal.Zero, errors.New("not implemented")
}

var _ repository.PresaleHoldingRepository = (*listenerHoldingRepo)(nil)

// ===========================
// mock PresaleOpsEventRepository
// ===========================

type listenerOpsRepo struct {
	events []*model.PresaleOpsEvent
}

func (m *listenerOpsRepo) Create(_ context.Context, _ *gorm.DB, e *model.PresaleOpsEvent) error {
	m.events = append(m.events, e)
	return nil
}
func (m *listenerOpsRepo) ListPending(_ context.Context, _ int) ([]*model.PresaleOpsEvent, error) {
	return nil, nil
}
func (m *listenerOpsRepo) UpdateStatus(_ context.Context, _ *gorm.DB, _ uint64, _ string) error {
	return nil
}

var _ repository.PresaleOpsEventRepository = (*listenerOpsRepo)(nil)

// ===========================
// mock PresaleEventCursorRepository
// ===========================

type listenerCursorRepo struct {
	cursors    map[string]uint64
	saveCalled int
}

func newListenerCursorRepo(vaultAddr string, fromBlock uint64) *listenerCursorRepo {
	return &listenerCursorRepo{
		cursors: map[string]uint64{strings.ToLower(vaultAddr): fromBlock},
	}
}

func (m *listenerCursorRepo) Load(_ context.Context, vaultAddress string) (*model.PresaleEventCursor, error) {
	block := m.cursors[strings.ToLower(vaultAddress)]
	return &model.PresaleEventCursor{VaultAddress: vaultAddress, LastBlockNumber: block}, nil
}
func (m *listenerCursorRepo) Save(_ context.Context, _ *gorm.DB, vaultAddress string, blockNumber uint64, _ uint) error {
	m.saveCalled++
	m.cursors[strings.ToLower(vaultAddress)] = blockNumber
	return nil
}
func (m *listenerCursorRepo) EnsureAll(_ context.Context, _ []string, _ uint64) error {
	return nil
}

var _ repository.PresaleEventCursorRepository = (*listenerCursorRepo)(nil)

// ===========================
// mock UserReferralBindRepository
// ===========================

type listenerBindRepo struct {
	binds map[uint64]*model.UserReferralBind
}

func newListenerBindRepo(binds ...*model.UserReferralBind) *listenerBindRepo {
	m := &listenerBindRepo{binds: make(map[uint64]*model.UserReferralBind)}
	for _, b := range binds {
		m.binds[b.UserID] = b
	}
	return m
}

func (m *listenerBindRepo) GetByUserID(_ context.Context, userID uint64) (*model.UserReferralBind, error) {
	if b, ok := m.binds[userID]; ok {
		return b, nil
	}
	return nil, nil
}
func (m *listenerBindRepo) CreateIdempotent(_ context.Context, _ *gorm.DB, _ *model.UserReferralBind) (bool, error) {
	return false, errors.New("not implemented")
}
func (m *listenerBindRepo) ListByReferrer(_ context.Context, _ uint64, _, _ int) ([]*model.UserReferralBind, int64, error) {
	return nil, 0, errors.New("not implemented")
}
func (m *listenerBindRepo) ListByReferrerFiltered(_ context.Context, _ uint64, _ string, _, _ int) ([]*model.UserReferralBind, int64, error) {
	return nil, 0, errors.New("not implemented")
}

var _ repository.UserReferralBindRepository = (*listenerBindRepo)(nil)

// ===========================
// mock UserRepo (full interface)
// ===========================

type listenerUserRepo struct {
	users map[string]*model.User
}

func newListenerUserRepo(users ...*model.User) *listenerUserRepo {
	m := &listenerUserRepo{users: make(map[string]*model.User)}
	for _, u := range users {
		m.users[strings.ToLower(u.SigningAddress)] = u
	}
	return m
}

func (m *listenerUserRepo) GetByWalletAddress(_ context.Context, address string) (*model.User, error) {
	if u, ok := m.users[strings.ToLower(address)]; ok {
		return u, nil
	}
	return nil, nil
}

// Stub implementations for the rest of the UserRepo interface
func (m *listenerUserRepo) GetUserInfoByID(_ context.Context, _ uint64) (*model.User, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetByEmail(_ context.Context, _ string) (*model.User, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetDepositAddress(_ context.Context, _ uint64, _ string) (*model.DepositAddress, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetUserDepositAddress(_ context.Context, _ uint64, _ string) (*model.UserDepositAddress, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) CreateAllUserIDWithSigningAddress(_ context.Context, _, _ string) (*model.User, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) Create(_ context.Context, _ *model.User) error {
	return errors.New("not implemented")
}
func (m *listenerUserRepo) Update(_ context.Context, _ *model.User) error {
	return errors.New("not implemented")
}
func (m *listenerUserRepo) Delete(_ context.Context, _ uint64) error {
	return errors.New("not implemented")
}
func (m *listenerUserRepo) GetBalanceByUserID(_ context.Context, _ uint64) (*model.UserBalance, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) BetUserBalanceByUserID(_ context.Context, _ uint64, _ decimal.Decimal) error {
	return errors.New("not implemented")
}
func (m *listenerUserRepo) ProcessAtomicTransfer(_ context.Context, _ uint64, _ int64, _ decimal.Decimal, _ decimal.Decimal, _ string, _ string, _ string, _ decimal.Decimal, _ string) (uint64, int64, error) {
	return 0, 0, errors.New("not implemented")
}
func (m *listenerUserRepo) CreateBannerBetOrder(_ context.Context, _ uint64, _ *model.BannerBetPlaceRequest, _ decimal.Decimal, _ decimal.Decimal) (*model.BannerBetPlaceResponse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) CancelUserBet(_ context.Context, _ uint64, _ []uint64) (*model.ModifyBalanceRespnse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetBetHoldingByUserID(_ context.Context, _ uint64) (*model.BetHoldingResponse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetBetHoldingByOrders(_ context.Context, _ []uint64) (*model.BetHoldingResponse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetBannerBetHoldingByUserID(_ context.Context, _ uint64) (*model.BannerBetHoldingResponse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetBannerBetHoldingByOrders(_ context.Context, _ []uint64) (*model.BetHoldingResponse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetBetClaimByUserID(_ context.Context, _ uint64, _ uint64) (*model.BetClaimResponse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) ClaimBetByUserID(_ context.Context, _ uint64, _ uint64, _ decimal.Decimal) (*model.BetClaimResponse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) BetUserBalance(_ context.Context, _ uint64, _ []int64, _ []decimal.Decimal, _ []decimal.Decimal, _ string, _ []string, _ []string, _ []decimal.Decimal, _ string) (*model.ModifyBalanceRespnse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetAssetLedgersByUserID(_ context.Context, _ uint64, _ model.AssetLedgerRequest, _ bool) (*model.AssetLedgersResponse, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetClaimedBetIDsByUserIDAndBetIDs(_ context.Context, _ uint64, _ []uint64) (map[uint64]struct{}, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) WithdrawApply(_ context.Context, _ uint64, _ model.WithdrawRecord) error {
	return errors.New("not implemented")
}
func (m *listenerUserRepo) GetWithDrawRecordsByUserID(_ context.Context, _ uint64) ([]model.WithdrawRecord, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) WithDrawCannel(_ context.Context, _ uint64, _ string) error {
	return errors.New("not implemented")
}
func (m *listenerUserRepo) GetPendingOrders(_ context.Context, _ string) ([]model.WithdrawRecord, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) VerifyAdminCredentials(_ context.Context, _, _ string) (bool, error) {
	return false, errors.New("not implemented")
}
func (m *listenerUserRepo) ApproveWithdrawOrder(_ context.Context, _, _, _ string, _ bool) error {
	return errors.New("not implemented")
}
func (m *listenerUserRepo) GetWithdrawRecordsByOrderSns(_ context.Context, _ []string) ([]model.WithdrawRecord, error) {
	return nil, errors.New("not implemented")
}
func (m *listenerUserRepo) GetWithdrawRecordsByUserIDAndOrderSns(_ context.Context, _ uint64, _ []string) ([]model.WithdrawRecord, error) {
	return nil, errors.New("not implemented")
}

var _ repository.UserRepo = (*listenerUserRepo)(nil)

// ===========================
// helpers
// ===========================

var testTransferSig = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))

const (
	testVault    = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA01"
	testUsdt     = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB01"
	testFromAddr = "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC01"
	testTxHash   = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
)

func makeTransferLog(from, to string, amountWei *big.Int, blockNumber uint64, logIndex uint) types.Log {
	fromPadded := common.HexToHash(from)
	toPadded := common.HexToHash(to)

	amountBytes := make([]byte, 32)
	amountWei.FillBytes(amountBytes)

	return types.Log{
		Address:     common.HexToAddress(testUsdt),
		Topics:      []common.Hash{testTransferSig, fromPadded, toPadded},
		Data:        amountBytes,
		BlockNumber: blockNumber,
		TxHash:      common.HexToHash(testTxHash),
		Index:       logIndex,
	}
}

func usdtWei(usdt int64) *big.Int {
	// usdt * 10^18
	result := new(big.Int).SetInt64(usdt)
	result.Mul(result, new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil))
	return result
}

func makePresaleCfg() *config.PresaleConfig {
	return &config.PresaleConfig{
		VaultPool:            []string{testVault},
		UsdtAddress:          testUsdt,
		ConfirmBlocks:        3,
		BoundaryToleranceMin: 5,
		PollIntervalSec:      6,
		RedisLeaderKey:       "presale:leader",
		RedisLeaderTTLSec:    30,
	}
}

func makeActiveRoundForListener(blockTs int64) *model.PresaleRound {
	return &model.PresaleRound{
		ID:                "round-test",
		Status:            model.RoundStatusActive,
		PriceUsd:          decimal.NewFromFloat(0.05),
		SupplyOdd:         decimal.NewFromInt(10_000_000),
		SoldOdd:           decimal.Zero,
		RaisedUsd:         decimal.Zero,
		ReferralRewardPct: decimal.NewFromInt(10),
		StartTs:           blockTs - 3_600_000,
		EndTs:             blockTs + 3_600_000,
	}
}

// openFakeGORM opens a gorm.DB backed by the registered fake SQL driver
// This gives us a real *gorm.DB for Transaction() to work against
func openFakeGORM(t *testing.T) *gorm.DB {
	t.Helper()
	sqlDB, err := sql.Open("fakemysql", "fake")
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

// listenerDepositSvc is a minimal PresaleDepositService stub for listener tests
// FindRound is backed by the listener's own roundRepo
//
// ISSUE-005：notifyCalls 捕获 processLog 事务外的 NotifyDepositConfirmed 调用，
// 测试用它验证四条路径（isNew=true / isNew=false pending / 幂等 / rollback）。
type listenerDepositSvc struct {
	roundRepo   repository.PresaleRoundRepository
	cfg         *config.PresaleConfig
	notifyCalls []*model.PresaleDeposit
}

func (s *listenerDepositSvc) FindRound(ctx context.Context, blockTsMs int64) (*model.PresaleRound, error) {
	toleranceMs := int64(s.cfg.BoundaryToleranceMin) * 60 * 1000
	rounds, err := s.roundRepo.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	for _, r := range rounds {
		if blockTsMs >= r.StartTs && blockTsMs <= r.EndTs {
			return r, nil
		}
		if blockTsMs > r.EndTs && blockTsMs <= r.EndTs+toleranceMs {
			return r, nil
		}
	}
	return nil, service.ErrNoActiveRound
}
func (s *listenerDepositSvc) ReportTx(_ context.Context, _ uint64, _ string, _ service.ReportTxRequest) (*service.ReportTxResponse, error) {
	return nil, errors.New("not implemented")
}
func (s *listenerDepositSvc) GetByTxHash(_ context.Context, _ uint64, _ string) (*service.DepositDetail, error) {
	return nil, errors.New("not implemented")
}
func (s *listenerDepositSvc) ListByUser(_ context.Context, _ uint64, _ string, _, _ int) (*service.DepositListResponse, error) {
	return nil, errors.New("not implemented")
}
func (s *listenerDepositSvc) GetPosition(_ context.Context, _ uint64) (*service.PositionResponse, error) {
	return nil, errors.New("not implemented")
}
func (s *listenerDepositSvc) ConfirmDeposit(_ context.Context, _ *gorm.DB, _ uint64, _ int64) error {
	return nil
}
func (s *listenerDepositSvc) NotifyDepositConfirmed(dep *model.PresaleDeposit) {
	s.notifyCalls = append(s.notifyCalls, dep)
}

var _ service.PresaleDepositService = (*listenerDepositSvc)(nil)

// ===========================
// fixture builder
// ===========================

type listenerFixture struct {
	bscClient   *mockBscClient
	depositRepo *listenerDepositRepo
	roundRepo   *listenerRoundRepo
	holdingRepo *listenerHoldingRepo
	opsRepo     *listenerOpsRepo
	cursorRepo  *listenerCursorRepo
	depositSvc  *listenerDepositSvc // ISSUE-005：暴露给测试断言 NotifyDepositConfirmed 调用
}

func buildListener(t *testing.T, blockTs int64, user *model.User, bind *model.UserReferralBind) (*chain.PresaleListener, *listenerFixture) {
	t.Helper()
	cfg := makePresaleCfg()
	db := openFakeGORM(t)

	round := makeActiveRoundForListener(blockTs)
	roundRepo := &listenerRoundRepo{activeRounds: []*model.PresaleRound{round}}
	depositRepo := newListenerDepositRepo()
	holdingRepo := &listenerHoldingRepo{}
	opsRepo := &listenerOpsRepo{}
	cursorRepo := newListenerCursorRepo(testVault, 100)

	var bindRepoInst *listenerBindRepo
	if bind != nil {
		bindRepoInst = newListenerBindRepo(bind)
	} else {
		bindRepoInst = newListenerBindRepo()
	}

	var userRepoInst *listenerUserRepo
	if user != nil {
		userRepoInst = newListenerUserRepo(user)
	} else {
		userRepoInst = newListenerUserRepo()
	}

	depositSvc := &listenerDepositSvc{roundRepo: roundRepo, cfg: cfg}

	bsc := &mockBscClient{
		headBlock: 110, // safeBlock = 110-3 = 107, cursor=100 → fromBlock=101
		blockHeaders: map[uint64]*types.Header{
			105: {Time: uint64(blockTs / 1000)},
		},
	}

	fix := &listenerFixture{
		bscClient:   bsc,
		depositRepo: depositRepo,
		roundRepo:   roundRepo,
		holdingRepo: holdingRepo,
		opsRepo:     opsRepo,
		cursorRepo:  cursorRepo,
		depositSvc:  depositSvc,
	}

	listener := chain.NewPresaleListener(
		cfg, db, bsc, depositSvc,
		depositRepo, roundRepo, holdingRepo, opsRepo,
		cursorRepo, bindRepoInst, userRepoInst, nil,
	)
	return listener, fix
}

// ===========================
// Tests
// ===========================

// TestPresaleListener_HappyPath: 正常 Transfer → deposit created + IncrSoldAndRaised + UpsertInvest
// INV-7: referral_reward_odd = shares_odd × 10% when bind is valid (bound_at < blockTs)
func TestPresaleListener_HappyPath(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	blockNumber := uint64(105)
	referrerID := uint64(999)

	user := &model.User{UserID: 1001, SigningAddress: testFromAddr}
	bind := &model.UserReferralBind{
		UserID:         1001,
		ReferrerUserID: referrerID,
		ReferrerEoa:    "0xreferrer",
		BoundAt:        blockTs - 1000, // bound BEFORE block → valid (INV-6)
	}

	// 100 USDT, price=0.05 → shares=2000, referral=200 (10%)
	log := makeTransferLog(testFromAddr, testVault, usdtWei(100), blockNumber, 0)

	listener, fix := buildListener(t, blockTs, user, bind)
	fix.bscClient.logs = []types.Log{log}

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	if len(fix.depositRepo.createdDeposits) != 1 {
		t.Fatalf("expected 1 deposit created, got %d", len(fix.depositRepo.createdDeposits))
	}
	dep := fix.depositRepo.createdDeposits[0]
	if dep.UserID != 1001 {
		t.Errorf("deposit.UserID: want 1001, got %d", dep.UserID)
	}
	if dep.Status != model.PresaleDepositStatusConfirmed {
		t.Errorf("deposit.Status: want confirmed, got %s", dep.Status)
	}

	// INV-7: 100 USDT / 0.05 price = 2000 shares; 2000 × 10% = 200 referral
	expectedReferral := decimal.NewFromInt(200)
	if !dep.ReferralRewardOdd.Equal(expectedReferral) {
		t.Errorf("referral_reward_odd: want %s, got %s", expectedReferral, dep.ReferralRewardOdd)
	}

	if fix.roundRepo.incrCalled != 1 {
		t.Errorf("IncrSoldAndRaised should be called once, got %d", fix.roundRepo.incrCalled)
	}
	if len(fix.holdingRepo.upsertInvestCalled) != 1 {
		t.Errorf("UpsertInvest should be called once, got %d", len(fix.holdingRepo.upsertInvestCalled))
	}
	if len(fix.holdingRepo.upsertReferralCalled) != 1 {
		t.Errorf("UpsertReferral should be called once (INV-7), got %d", len(fix.holdingRepo.upsertReferralCalled))
	}
	if fix.holdingRepo.upsertReferralCalled[0] != referrerID {
		t.Errorf("UpsertReferral referrerID: want %d, got %d", referrerID, fix.holdingRepo.upsertReferralCalled[0])
	}
	if fix.cursorRepo.saveCalled != 1 {
		t.Errorf("cursor Save should be called once, got %d", fix.cursorRepo.saveCalled)
	}
}

// TestPresaleListener_Overflow: IncrSoldAndRaised → ErrCapacityExceeded → anomaly, no UpsertInvest (INV-1)
func TestPresaleListener_Overflow(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	blockNumber := uint64(105)

	user := &model.User{UserID: 1002, SigningAddress: testFromAddr}
	log := makeTransferLog(testFromAddr, testVault, usdtWei(50), blockNumber, 0)

	listener, fix := buildListener(t, blockTs, user, nil)
	fix.bscClient.logs = []types.Log{log}
	fix.roundRepo.incrErr = repository.ErrCapacityExceeded

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	if len(fix.depositRepo.createdDeposits) != 1 {
		t.Fatalf("expected deposit to be created before overflow, got %d", len(fix.depositRepo.createdDeposits))
	}
	dep := fix.depositRepo.createdDeposits[0]

	if reason, ok := fix.depositRepo.anomalyCalled[dep.ID]; !ok {
		t.Error("MarkAnomaly should have been called for overflow")
	} else if reason != model.AnomalyOverflow {
		t.Errorf("anomaly reason: want overflow, got %s", reason)
	}
	if len(fix.holdingRepo.upsertInvestCalled) != 0 {
		t.Errorf("UpsertInvest must NOT be called on overflow (INV-1), got %d calls", len(fix.holdingRepo.upsertInvestCalled))
	}

	foundOverflow := false
	for _, e := range fix.opsRepo.events {
		if e.EventType == model.AnomalyOverflow {
			foundOverflow = true
		}
	}
	if !foundOverflow {
		t.Error("overflow ops event should be created")
	}

	// ISSUE-005：overflow 早退分支（MarkAnomaly 后 return nil）须**不发推**
	// （notifyDeposit 在 tx 闭包末尾才赋值，overflow return nil 早于赋值）
	if got := len(fix.depositSvc.notifyCalls); got != 0 {
		t.Errorf("NotifyDepositConfirmed must NOT be called on overflow path, got %d", got)
	}
}

// TestPresaleListener_Unclaimed: user not found → unclaimed ops event, no deposit (INV-3 adjacent)
func TestPresaleListener_Unclaimed(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	blockNumber := uint64(105)

	log := makeTransferLog(testFromAddr, testVault, usdtWei(50), blockNumber, 0)

	listener, fix := buildListener(t, blockTs, nil, nil) // no user
	fix.bscClient.logs = []types.Log{log}

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	if len(fix.depositRepo.createdDeposits) != 0 {
		t.Errorf("no deposit should be created for unclaimed, got %d", len(fix.depositRepo.createdDeposits))
	}

	foundUnclaimed := false
	for _, e := range fix.opsRepo.events {
		if e.EventType == model.AnomalyUnclaimed {
			foundUnclaimed = true
		}
	}
	if !foundUnclaimed {
		t.Error("unclaimed ops event should be created")
	}
}

// TestPresaleListener_BoundAfterTx: bind.BoundAt > blockTs → referralRewardOdd=0, no UpsertReferral (INV-6)
func TestPresaleListener_BoundAfterTx(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	blockNumber := uint64(105)

	user := &model.User{UserID: 1003, SigningAddress: testFromAddr}
	bind := &model.UserReferralBind{
		UserID:         1003,
		ReferrerUserID: 888,
		ReferrerEoa:    "0xreferrer",
		BoundAt:        blockTs + 5000, // AFTER block → INV-6 disqualifies
	}
	log := makeTransferLog(testFromAddr, testVault, usdtWei(100), blockNumber, 0)

	listener, fix := buildListener(t, blockTs, user, bind)
	fix.bscClient.logs = []types.Log{log}

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	if len(fix.depositRepo.createdDeposits) != 1 {
		t.Fatalf("expected 1 deposit, got %d", len(fix.depositRepo.createdDeposits))
	}
	dep := fix.depositRepo.createdDeposits[0]

	// INV-6: referral_reward_odd must be 0
	if !dep.ReferralRewardOdd.IsZero() {
		t.Errorf("referral_reward_odd should be 0 when bound_at > block_ts, got %s", dep.ReferralRewardOdd)
	}
	if len(fix.holdingRepo.upsertReferralCalled) != 0 {
		t.Errorf("UpsertReferral should NOT be called when INV-6 fails, got %d calls", len(fix.holdingRepo.upsertReferralCalled))
	}
	if len(fix.holdingRepo.upsertInvestCalled) != 1 {
		t.Errorf("UpsertInvest should still be called, got %d", len(fix.holdingRepo.upsertInvestCalled))
	}
}

// ===========================
// M1: 双轨竞态测试
// ===========================

// TestPresaleListener_DualTrack_FrontendFirst：前端先 ReportTx 落 pending，Worker 后扫到同 tx。
// 期望：deposit 最终 status=confirmed；IncrSoldAndRaised 调用 1 次；UpsertInvest 调用 1 次。
func TestPresaleListener_DualTrack_FrontendFirst(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	blockNumber := uint64(105)

	user := &model.User{UserID: 2001, SigningAddress: testFromAddr}
	log := makeTransferLog(testFromAddr, testVault, usdtWei(100), blockNumber, 0)

	listener, fix := buildListener(t, blockTs, user, nil)
	fix.bscClient.logs = []types.Log{log}

	// 模拟前端先 ReportTx：在 depositRepo 中预置一条 pending deposit，isNew=false
	txHashLower := strings.ToLower(testTxHash)
	pendingDeposit := &model.PresaleDeposit{
		ID:       42,
		TxHash:   txHashLower,
		LogIndex: 0,
		UserID:   2001,
		Status:   model.PresaleDepositStatusPending,
		Source:   model.PresaleDepositSourceFrontend,
	}
	fix.depositRepo.existingByUK[ukKey(txHashLower, 0)] = pendingDeposit
	fix.depositRepo.deposits = map[uint64]*model.PresaleDeposit{42: pendingDeposit}

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	// Worker 扫到时 isNew=false（前端已 pending），应调用 ConfirmDeposit 推进状态
	if len(fix.depositRepo.confirmCalled) != 1 {
		t.Errorf("ConfirmDeposit should be called once (pending→confirmed), got %d", len(fix.depositRepo.confirmCalled))
	}
	if fix.depositRepo.confirmCalled[0] != 42 {
		t.Errorf("ConfirmDeposit called on wrong ID: want 42, got %d", fix.depositRepo.confirmCalled[0])
	}

	// IncrSoldAndRaised 和 UpsertInvest 各调 1 次（不重复入账）
	if fix.roundRepo.incrCalled != 1 {
		t.Errorf("IncrSoldAndRaised should be called once, got %d", fix.roundRepo.incrCalled)
	}
	if len(fix.holdingRepo.upsertInvestCalled) != 1 {
		t.Errorf("UpsertInvest should be called once, got %d", len(fix.holdingRepo.upsertInvestCalled))
	}
}

// TestPresaleListener_DualTrack_WorkerFirst：Worker 先扫到并落 confirmed，ReportTx 后到（isNew=false, existing.Status=confirmed）。
// 期望：重复扫块时直接幂等返回，Incr/Upsert 不重复调用。
func TestPresaleListener_DualTrack_WorkerFirst(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	blockNumber := uint64(105)

	user := &model.User{UserID: 2002, SigningAddress: testFromAddr}
	log := makeTransferLog(testFromAddr, testVault, usdtWei(100), blockNumber, 0)

	listener, fix := buildListener(t, blockTs, user, nil)
	fix.bscClient.logs = []types.Log{log}

	// 第一次扫块：Worker 先落 confirmed（isNew=true）
	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce first pass: %v", err)
	}

	if fix.roundRepo.incrCalled != 1 {
		t.Fatalf("first pass: IncrSoldAndRaised should be called once, got %d", fix.roundRepo.incrCalled)
	}
	if len(fix.holdingRepo.upsertInvestCalled) != 1 {
		t.Fatalf("first pass: UpsertInvest should be called once, got %d", len(fix.holdingRepo.upsertInvestCalled))
	}

	// 将已存 deposit 的 status 升为 confirmed（模拟 Worker 已 confirmed）
	for _, dep := range fix.depositRepo.existingByUK {
		dep.Status = model.PresaleDepositStatusConfirmed
	}

	// 重置游标，让第二次扫块能重放同一 block 范围
	fix.cursorRepo.cursors[strings.ToLower(testVault)] = 100

	// 第二次扫块：模拟重复扫块（uk 冲突 → isNew=false, existing.Status=confirmed → noop）
	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce second pass: %v", err)
	}

	// 不重复 Incr/Upsert
	if fix.roundRepo.incrCalled != 1 {
		t.Errorf("second pass: IncrSoldAndRaised must NOT be called again (idempotent), got %d total", fix.roundRepo.incrCalled)
	}
	if len(fix.holdingRepo.upsertInvestCalled) != 1 {
		t.Errorf("second pass: UpsertInvest must NOT be called again (idempotent), got %d total", len(fix.holdingRepo.upsertInvestCalled))
	}
	// ConfirmDeposit 不应被调（已经 confirmed）
	if len(fix.depositRepo.confirmCalled) != 0 {
		t.Errorf("ConfirmDeposit should NOT be called for already-confirmed deposit, got %d", len(fix.depositRepo.confirmCalled))
	}
}

// ===========================
// M2: 多金库切换测试
// ===========================

// TestPresaleListener_MultiVault：两个 vault 各自有不同 log，ScanOnce 后各自 cursor 独立推进。
func TestPresaleListener_MultiVault(t *testing.T) {
	const (
		testVault1 = "0xAA00000000000000000000000000000000000001"
		testVault2 = "0xAA00000000000000000000000000000000000002"
		txHash1    = "0x1111111111111111111111111111111111111111111111111111111111111111"
		txHash2    = "0x2222222222222222222222222222222222222222222222222222222222222222"
	)

	blockTs := int64(1_700_000_000_000)
	user := &model.User{UserID: 3001, SigningAddress: testFromAddr}

	cfg := &config.PresaleConfig{
		VaultPool:            []string{testVault1, testVault2},
		UsdtAddress:          testUsdt,
		ConfirmBlocks:        3,
		BoundaryToleranceMin: 5,
		PollIntervalSec:      6,
		RedisLeaderKey:       "presale:leader",
		RedisLeaderTTLSec:    30,
	}

	db := openFakeGORM(t)
	round := makeActiveRoundForListener(blockTs)
	roundRepo := &listenerRoundRepo{activeRounds: []*model.PresaleRound{round}}
	depositRepo := newListenerDepositRepo()
	holdingRepo := &listenerHoldingRepo{}
	opsRepo := &listenerOpsRepo{}
	bindRepo := newListenerBindRepo()
	userRepo := newListenerUserRepo(user)
	depositSvc := &listenerDepositSvc{roundRepo: roundRepo, cfg: cfg}

	// 规范化 vault 地址（lowercase checksummed hex），确保 cursorRepo + vaultLogs map key 一致
	v1 := strings.ToLower(common.HexToAddress(testVault1).Hex())
	v2 := strings.ToLower(common.HexToAddress(testVault2).Hex())

	// 两个 vault 各自独立游标，起点都是 block 100
	cursorRepo := &listenerCursorRepo{
		cursors: map[string]uint64{
			v1: 100,
			v2: 100,
		},
	}

	// log for vault1（block 105, logIndex 0）—— Topics[2] 使用 address hash（前12字节零填充）
	log1 := types.Log{
		Address:     common.HexToAddress(testUsdt),
		Topics:      []common.Hash{testTransferSig, common.HexToHash(testFromAddr), common.BytesToHash(common.HexToAddress(testVault1).Bytes())},
		Data:        func() []byte { b := make([]byte, 32); usdtWei(50).FillBytes(b); return b }(),
		BlockNumber: 105,
		TxHash:      common.HexToHash(txHash1),
		Index:       0,
	}
	// log for vault2（block 105, logIndex 0）
	log2 := types.Log{
		Address:     common.HexToAddress(testUsdt),
		Topics:      []common.Hash{testTransferSig, common.HexToHash(testFromAddr), common.BytesToHash(common.HexToAddress(testVault2).Bytes())},
		Data:        func() []byte { b := make([]byte, 32); usdtWei(80).FillBytes(b); return b }(),
		BlockNumber: 105,
		TxHash:      common.HexToHash(txHash2),
		Index:       0,
	}

	// mock BSC client：FilterLogs 按 vault address 分发不同 log
	bsc := &multiVaultBscClient{
		headBlock: 110,
		vaultLogs: map[string][]types.Log{
			v1: {log1},
			v2: {log2},
		},
		blockHeaders: map[uint64]*types.Header{
			105: {Time: uint64(blockTs / 1000)},
		},
	}

	listener := chain.NewPresaleListener(
		cfg, db, bsc, depositSvc,
		depositRepo, roundRepo, holdingRepo, opsRepo,
		cursorRepo, bindRepo, userRepo, nil,
	)

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	// 两个 vault 各自游标应独立推进到 safeBlock=107（使用规范化地址作 key）
	safeBlock := uint64(107)
	if got := cursorRepo.cursors[v1]; got != safeBlock {
		t.Errorf("vault1 cursor: want %d, got %d", safeBlock, got)
	}
	if got := cursorRepo.cursors[v2]; got != safeBlock {
		t.Errorf("vault2 cursor: want %d, got %d", safeBlock, got)
	}

	// cursorRepo 中有 2 个独立游标
	if len(cursorRepo.cursors) != 2 {
		t.Errorf("expected 2 independent cursors, got %d", len(cursorRepo.cursors))
	}

	// processLog 各调用一次（两个 vault 各处理一条 log）
	if len(depositRepo.createdDeposits) != 2 {
		t.Errorf("expected 2 deposits (one per vault), got %d", len(depositRepo.createdDeposits))
	}

	// Save 应调用 2 次（每个 vault 一次）
	if cursorRepo.saveCalled != 2 {
		t.Errorf("cursor Save should be called twice (one per vault), got %d", cursorRepo.saveCalled)
	}
}

// multiVaultBscClient mock BscClient，按 vault 地址分发不同 log（M2 测试专用）
type multiVaultBscClient struct {
	headBlock    uint64
	blockHeaders map[uint64]*types.Header
	vaultLogs    map[string][]types.Log
}

func (m *multiVaultBscClient) TransactionReceipt(_ context.Context, _ common.Hash) (*types.Receipt, error) {
	return nil, errors.New("not implemented")
}
func (m *multiVaultBscClient) FilterLogs(_ context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	// 从 Topics[2] 提取 vault 地址（to 字段，32字节 hash 中最后20字节是地址）
	// 使用 common.HexToAddress 规范化，确保与 map key 形式一致
	if len(q.Topics) >= 3 && len(q.Topics[2]) > 0 {
		toHash := q.Topics[2][0]
		vaultAddr := strings.ToLower(common.HexToAddress(toHash.Hex()).Hex())
		if logs, ok := m.vaultLogs[vaultAddr]; ok {
			return logs, nil
		}
	}
	return nil, nil
}
func (m *multiVaultBscClient) BlockNumber(_ context.Context) (uint64, error) {
	return m.headBlock, nil
}
func (m *multiVaultBscClient) HeaderByNumber(_ context.Context, number *big.Int) (*types.Header, error) {
	if h, ok := m.blockHeaders[number.Uint64()]; ok {
		return h, nil
	}
	return &types.Header{Time: uint64(1_700_000_000)}, nil
}

var _ service.BscClient = (*multiVaultBscClient)(nil)

// ===========================
// BUG-001: INV-6 跨时钟域容差表格驱动测试
//
// 容差常量 service.Inv6BoundAtClockSkewMs = 5000ms。
// 比较公式：`bind.BoundAt - Inv6BoundAtClockSkewMs < blockTs` → 命中 → 计返佣。
//
// 注意：buildListener 把 blockTs 转成 header.Time = blockTs/1000，processLog 内再 *1000 还原。
// 因此 blockTs 必须传**整秒**值（末三位 000），还原后才能精确匹配测试预期。
// 这正是真实生产中"秒粒度填零"的精确还原。
//
// 详见 .progress/bug/BUG-001-inv6-cross-clock-domain/BD.md §5.1
// ===========================

func TestPresaleListener_Inv6_ClockSkewTolerance(t *testing.T) {
	const blockTs = int64(1_700_000_000_000) // 整秒（末三位 000）
	const blockNumber = uint64(105)
	const referrerID = uint64(7777)

	cases := []struct {
		name              string
		boundAtOffsetMs   int64 // bound_at = blockTs + offset
		expectReferral    bool  // 是否期望计返佣（UpsertReferral 被调）
		knownIssue        bool  // 标记容差残留：实际为"先买后绑" but 容差吸收为有效返佣
	}{
		{
			name:            "#1 先绑后买 同秒 ms 反超（主 bug 场景）",
			boundAtOffsetMs: +800, // bound_at = blockTs + 800ms（同秒内 ms > 秒粒度填零）
			expectReferral:  true,
		},
		{
			name:            "#2 先绑后买 边界态相等",
			boundAtOffsetMs: 0, // bound_at == blockTs（差 0）
			expectReferral:  true, // 容差覆盖
		},
		{
			name:            "#3 先绑后买 容差边缘内",
			boundAtOffsetMs: +4999, // 差 4999ms < 5000ms 容差
			expectReferral:  true,
		},
		{
			name:            "#4 先绑后买 容差外",
			boundAtOffsetMs: +5001, // 差 5001ms > 5000ms 容差 → 拒绝
			expectReferral:  false,
		},
		{
			name:            "#5 先买后绑 分钟级（正常反作弊）",
			boundAtOffsetMs: -60_000, // bound_at 比 blockTs 早 1 分钟（即 tx 已上链后 60s 才绑定）
			expectReferral:  true,    // 注意：bound_at < blockTs，INV-6 正向满足 → 不拒绝（这是先买后绑的"早绑"形态，业务上算正常先绑）
		},
		// 上面 #5 的语义解释：BoundAt - 60000 < blockTs，比较通过 = 返佣。
		// 此处保留以验证"正常先绑后买（时间充足）"路径不会被本次修复破坏。
		{
			name:            "#6 先买后绑 真实形态（bound_at 晚于 blockTs 容差外）",
			boundAtOffsetMs: +60_000, // bound_at 比 blockTs 晚 60s → 反作弊场景
			expectReferral:  false,   // 容差外，正确拒绝
		},
		{
			name:            "#7 先买后绑 容差内（known issue）",
			boundAtOffsetMs: +3000, // bound_at 晚 3s，但容差 5s 吸收 → 误判为有效
			expectReferral:  true,  // 当前方案 A 已知残留风险
			knownIssue:      true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			user := &model.User{UserID: 1001, SigningAddress: testFromAddr}
			bind := &model.UserReferralBind{
				UserID:         1001,
				ReferrerUserID: referrerID,
				ReferrerEoa:    "0xreferrer",
				BoundAt:        blockTs + tc.boundAtOffsetMs,
			}
			log := makeTransferLog(testFromAddr, testVault, usdtWei(100), blockNumber, 0)

			listener, fix := buildListener(t, blockTs, user, bind)
			fix.bscClient.logs = []types.Log{log}

			if err := listener.ScanOnce(context.Background()); err != nil {
				t.Fatalf("ScanOnce: %v", err)
			}

			if len(fix.depositRepo.createdDeposits) != 1 {
				t.Fatalf("expected 1 deposit, got %d", len(fix.depositRepo.createdDeposits))
			}
			dep := fix.depositRepo.createdDeposits[0]

			if tc.expectReferral {
				if dep.ReferralRewardOdd.IsZero() {
					t.Errorf("expected referral reward > 0, got 0 (knownIssue=%v)", tc.knownIssue)
				}
				if len(fix.holdingRepo.upsertReferralCalled) != 1 {
					t.Errorf("expected UpsertReferral called once, got %d", len(fix.holdingRepo.upsertReferralCalled))
				}
			} else {
				if !dep.ReferralRewardOdd.IsZero() {
					t.Errorf("expected referral reward = 0, got %s", dep.ReferralRewardOdd)
				}
				if len(fix.holdingRepo.upsertReferralCalled) != 0 {
					t.Errorf("expected UpsertReferral NOT called, got %d calls", len(fix.holdingRepo.upsertReferralCalled))
				}
			}
		})
	}
}

// TestPresaleListener_Inv6_NoBind: 无绑定关系 → 不计返佣（BD §5.1 #8）
func TestPresaleListener_Inv6_NoBind(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	blockNumber := uint64(105)

	user := &model.User{UserID: 2001, SigningAddress: testFromAddr}
	log := makeTransferLog(testFromAddr, testVault, usdtWei(100), blockNumber, 0)

	listener, fix := buildListener(t, blockTs, user, nil) // bind=nil
	fix.bscClient.logs = []types.Log{log}

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	if len(fix.depositRepo.createdDeposits) != 1 {
		t.Fatalf("expected 1 deposit, got %d", len(fix.depositRepo.createdDeposits))
	}
	dep := fix.depositRepo.createdDeposits[0]
	if !dep.ReferralRewardOdd.IsZero() {
		t.Errorf("no bind → referral reward must be 0, got %s", dep.ReferralRewardOdd)
	}
	if len(fix.holdingRepo.upsertReferralCalled) != 0 {
		t.Errorf("no bind → UpsertReferral must NOT be called, got %d", len(fix.holdingRepo.upsertReferralCalled))
	}
}

// ===========================
// ISSUE-005：deposit_confirmed Lark 推送回归测试
// ===========================
//
// 根因：processLog 在事务内/外都没调 service.ConfirmDeposit，发推代码（仅在
// doConfirm step 7）永不触发，运营 Lark 群收不到入金确认卡片。
// 修复：tx commit 成功后调 depositSvc.NotifyDepositConfirmed(dep) 一次，并通过
// 「tx 闭包末尾才赋值 notifyDeposit」保证幂等/overflow/rollback 路径自然跳过。
//
// 这 4 条用例分别钉死 §6.1～§6.4 的预期行为。

// §6.1 — isNew=true 路径（链上首见 INSERT confirmed）须发推一次
func TestPresaleListener_ISSUE005_NotifyOnIsNewConfirm(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	user := &model.User{UserID: 2001, SigningAddress: testFromAddr}

	listener, fix := buildListener(t, blockTs, user, nil)
	fix.bscClient.logs = []types.Log{
		makeTransferLog(testFromAddr, testVault, usdtWei(50), 105, 0),
	}

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	if got := len(fix.depositSvc.notifyCalls); got != 1 {
		t.Fatalf("NotifyDepositConfirmed should be called once on isNew=true happy path, got %d", got)
	}
	notified := fix.depositSvc.notifyCalls[0]
	if notified == nil {
		t.Fatal("notify dep is nil")
	}
	if notified.Status != model.PresaleDepositStatusConfirmed {
		t.Errorf("notified dep.Status: want confirmed, got %s", notified.Status)
	}
	if notified.UserID != user.UserID {
		t.Errorf("notified dep.UserID: want %d, got %d", user.UserID, notified.UserID)
	}
}

// §6.2 — isNew=false existing.Status=pending 路径（前端先 pending、worker 推进）
// confirm 推进后须发推一次
func TestPresaleListener_ISSUE005_NotifyOnPendingPromote(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	user := &model.User{UserID: 2002, SigningAddress: testFromAddr}

	listener, fix := buildListener(t, blockTs, user, nil)
	log := makeTransferLog(testFromAddr, testVault, usdtWei(50), 105, 0)
	fix.bscClient.logs = []types.Log{log}

	// 预置一条 pending 记录（模拟前端先 ReportTx）→ CreateOrGet 返回 isNew=false
	existing := &model.PresaleDeposit{
		ID:       9999,
		TxHash:   strings.ToLower(log.TxHash.Hex()),
		LogIndex: 0,
		UserID:   user.UserID,
		Status:   model.PresaleDepositStatusPending,
	}
	fix.depositRepo.existingByUK[ukKey(existing.TxHash, existing.LogIndex)] = existing
	fix.depositRepo.deposits[existing.ID] = existing

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	if got := len(fix.depositRepo.confirmCalled); got != 1 {
		t.Fatalf("depositRepo.ConfirmDeposit should be called once, got %d", got)
	}
	if got := len(fix.depositSvc.notifyCalls); got != 1 {
		t.Fatalf("NotifyDepositConfirmed should be called once after pending→confirmed promote, got %d", got)
	}
	if fix.depositSvc.notifyCalls[0].ID != existing.ID {
		t.Errorf("notified dep.ID: want %d (existing), got %d",
			existing.ID, fix.depositSvc.notifyCalls[0].ID)
	}
}

// §6.3 — isNew=false existing.Status=confirmed 路径（幂等重入）
// 已 confirmed 的 deposit 重复扫块（链上 reorg / cursor 回拨）须**不发推**
func TestPresaleListener_ISSUE005_NoNotifyOnIdempotentReConfirm(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	user := &model.User{UserID: 2003, SigningAddress: testFromAddr}

	listener, fix := buildListener(t, blockTs, user, nil)
	log := makeTransferLog(testFromAddr, testVault, usdtWei(50), 105, 0)
	fix.bscClient.logs = []types.Log{log}

	// 预置同 uk_ 的 confirmed 记录 → CreateOrGet 返回 isNew=false + status=confirmed
	// processLog 在 line 387 早退，不动 sold/holding 也不发推
	existing := &model.PresaleDeposit{
		ID:       8888,
		TxHash:   strings.ToLower(log.TxHash.Hex()),
		LogIndex: 0,
		UserID:   user.UserID,
		Status:   model.PresaleDepositStatusConfirmed,
	}
	fix.depositRepo.existingByUK[ukKey(existing.TxHash, existing.LogIndex)] = existing
	fix.depositRepo.deposits[existing.ID] = existing

	if err := listener.ScanOnce(context.Background()); err != nil {
		t.Fatalf("ScanOnce: %v", err)
	}

	if got := len(fix.depositSvc.notifyCalls); got != 0 {
		t.Fatalf("NotifyDepositConfirmed must NOT be called on idempotent re-confirm, got %d", got)
	}
	if got := fix.roundRepo.incrCalled; got != 0 {
		t.Errorf("IncrSoldAndRaised must NOT be called on idempotent re-confirm, got %d", got)
	}
}

// §6.4 — 事务 rollback 路径（IncrSoldAndRaised 返回非预期 error）
// tx commit 失败时须**不发推**（避免 race：推送已发但状态未落库）
func TestPresaleListener_ISSUE005_NoNotifyOnTxRollback(t *testing.T) {
	blockTs := int64(1_700_000_000_000)
	user := &model.User{UserID: 2004, SigningAddress: testFromAddr}

	listener, fix := buildListener(t, blockTs, user, nil)
	fix.bscClient.logs = []types.Log{
		makeTransferLog(testFromAddr, testVault, usdtWei(50), 105, 0),
	}
	// 强制 IncrSoldAndRaised 返回非 overflow 的错误 → tx 闭包 return err → 整事务 rollback
	fix.roundRepo.incrErr = errors.New("simulated db failure")

	// scanVault 内对 processLog 返回的 error 做容错（log + 继续），不会让 ScanOnce 整体失败
	_ = listener.ScanOnce(context.Background())

	// 强约束 rollback 语义真实发生（IncrSoldAndRaised 被调到了才报错，而非 tx 提前短路）
	// 避免未来重构静默把 incr 调用路径搬走、让 "notifyCalls=0" 退化成假阴性证据
	if got := fix.roundRepo.incrCalled; got != 1 {
		t.Fatalf("IncrSoldAndRaised should be reached (then fail) before rollback, incrCalled=%d", got)
	}
	if got := len(fix.depositSvc.notifyCalls); got != 0 {
		t.Fatalf("NotifyDepositConfirmed must NOT be called on tx rollback, got %d", got)
	}
}
