package evm

import (
	"chain-consumer/global"
	"chain-consumer/internal"
	"chain-consumer/internal/mysql"
	"chain-consumer/service/evm/contract"
	"context"
	"strings"
	"testing"
	"time"

	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// OddFi 链上行为/管理员审计解析测试
//
// 用真实 BSC 测试网交易验证解析逻辑（不依赖 MySQL，断言解析出的内存行）。
// tx 来自 D:\everything_finance\org\contracts-business-layer\scenario_e2e_test.go 注释里的运行日志。
// RPC / 合约地址 / chain_id 与该 e2e 测试一致（BSC 测试网 chain_id=97）。
//
// 运行：go test -run TestParseOddFiOnchainActions -v ./service/evm/
// 跳过：go test -short ./service/evm/
// ============================================================

const (
	oddfiTestRPCURL  = "https://bnb-testnet.g.alchemy.com/v2/H35XdJCol-9YDMElNIXe3"
	oddfiTestChainID = 97

	// 测试网 4 个合约代理地址（与 scenario_e2e_test.go / md 一致）。
	oddfiTestBettingPool   = "0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F"
	oddfiTestStakingPool   = "0x65fd4A2529010693BA474d1993631e305a42E061"
	oddfiTestLiquidityPool = "0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f"
	oddfiTestODDToken      = "0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C"

	// scenario_e2e_test.go 运行日志里的真实交易哈希。
	txOpenMarket   = "0x615bd328db33b79c45b8d0f3b37f10edda926b95ef018cae6f0f7db9b9fd217c"
	txDepositMatch = "0x83182b95ffe1110fc1bb9b63aa554830090a4d8b07de89cc034e7d0ce4bce00a"
	txPlaceBet     = "0x1ada13a4514188f326866b94233b0f5a590811b40beca74ce0c7d16cc90e9e22"
	txSettleScore  = "0xe129603edaad87cb789d2a568e52a660c9ec12cceb8b7ab85e92e178ab12f2df"
	txFinalize     = "0xb6f7cb556c62dcb61e56a9dc42eaf3a2e25f368c96d9fd950014549e75f8049b"
	txClaimPayout  = "0x983e71654944409da98ff1013350c803872e04c91ba587fc26d2de49b7f70442"
	txRequestUnbond = "0x09a30407445f5cad99b29fe3d9000f663a76e46de3c8bb97ded395bd853c90b4"
)

// newOddfiTestService 构造一个仅用于解析的 EVMService（无 kafka/mysql/redis）。
func newOddfiTestService(t *testing.T) *EVMService {
	bpp, err := contract.NewBettingPoolFilterer(eth_common.HexToAddress(""), nil)
	require.NoError(t, err)
	spp, err := contract.NewStakingPoolFilterer(eth_common.HexToAddress(""), nil)
	require.NoError(t, err)
	lpp, err := contract.NewLiquidityPoolFilterer(eth_common.HexToAddress(""), nil)
	require.NoError(t, err)
	otp, err := contract.NewODDTokenFilterer(eth_common.HexToAddress(""), nil)
	require.NoError(t, err)

	return &EVMService{
		Chain:           internal.ChainBsc,
		chainID:         oddfiTestChainID,
		bettingParser:   bpp,
		stakingParser:   spp,
		liquidityParser: lpp,
		oddTokenParser:  otp,
		oddfiAddrs: buildOddFiAddrMap(global.OddFiConfig{
			ChainID:       oddfiTestChainID,
			BettingPool:   oddfiTestBettingPool,
			StakingPool:   oddfiTestStakingPool,
			LiquidityPool: oddfiTestLiquidityPool,
			ODDToken:      oddfiTestODDToken,
		}),
	}
}

// parseTxIntoBatch 拉取一笔交易的 receipt 日志，跑解析，返回 batch。
func parseTxIntoBatch(t *testing.T, ctx context.Context, eth *ethclient.Client, svc *EVMService, txHash string) *oddfiBatch {
	h := eth_common.HexToHash(txHash)
	rcpt, err := eth.TransactionReceipt(ctx, h)
	require.NoError(t, err, "fetch receipt %s", txHash)

	// tx.from（用于 operator=tx.from 的事件）。geth 从 RPC 响应缓存 from，任何 tx 类型可用。
	txObj, _, err := eth.TransactionByHash(ctx, h)
	require.NoError(t, err)
	from, err := eth.TransactionSender(ctx, txObj, rcpt.BlockHash, rcpt.TransactionIndex)
	require.NoError(t, err)

	blockTime := time.Now().UTC()
	if hdr, err := eth.HeaderByHash(ctx, rcpt.BlockHash); err == nil {
		blockTime = time.Unix(int64(hdr.Time), 0).UTC()
	}

	batch := &oddfiBatch{}
	for _, lg := range rcpt.Logs {
		svc.collectOddFiLog(*lg, from.Hex(), blockTime, batch)
	}
	t.Logf("tx=%s logs=%d → admin=%d user=%d claims=%d marketMap=%d poolMap=%d",
		txHash, len(rcpt.Logs), len(batch.adminRows), len(batch.userEvents),
		len(batch.claimParts), len(batch.marketMaps), len(batch.poolMaps))
	return batch
}

// adminByEvent 返回 batch 里指定 event_name 的第一条管理员行；无则 nil。
func adminByEvent(b *oddfiBatch, eventName string) *mysql.AdminOnchainAction {
	for _, r := range b.adminRows {
		if r.EventName == eventName {
			return r
		}
	}
	return nil
}

// userByAction 返回 batch userEvents 里指定 action_type 的第一行；无则 nil。
func userByAction(b *oddfiBatch, actionType string) *mysql.UserOnchainAction {
	for _, e := range b.userEvents {
		if e.row != nil && e.row.ActionType == actionType {
			return e.row
		}
	}
	return nil
}

func TestParseOddFiOnchainActions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping network integration test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	eth, err := ethclient.DialContext(ctx, oddfiTestRPCURL)
	if err != nil {
		t.Skipf("cannot dial RPC (network unavailable?): %v", err)
	}
	defer eth.Close()

	// 探活：拿不到链ID直接跳过（环境无外网时）。
	if _, err := eth.ChainID(ctx); err != nil {
		t.Skipf("RPC not reachable: %v", err)
	}

	svc := newOddfiTestService(t)

	// ── Step 1: OpenMarket → MarketOpened + OddsUpdated(admin) + market_match_map(+可能 pool_match_map) ──
	t.Run("OpenMarket", func(t *testing.T) {
		b := parseTxIntoBatch(t, ctx, eth, svc, txOpenMarket)
		mo := adminByEvent(b, "MarketOpened")
		require.NotNil(t, mo, "expect a MarketOpened admin row")
		assert.Equal(t, "BUSINESS_OPS", mo.Category)
		assert.Equal(t, strings.ToLower(oddfiTestBettingPool), mo.ContractAddress)
		assert.Equal(t, mo.TxFrom, mo.Operator, "MarketOpened operator should be tx.from")
		assert.Contains(t, mo.Params, "matchId")
		// 至少要建立一条盘口→比赛映射
		require.NotEmpty(t, b.marketMaps, "expect market_match_map row")
		assert.Len(t, b.marketMaps[0].MarketID, 66)
		assert.Len(t, b.marketMaps[0].MatchID, 66)
		// OpenMarket 同时刷新赔率
		assert.NotNil(t, adminByEvent(b, "OddsUpdated"))
	})

	// ── Step 2: DepositMatch → LIQUIDITY_DEPOSITED(user) ──
	t.Run("DepositMatch", func(t *testing.T) {
		b := parseTxIntoBatch(t, ctx, eth, svc, txDepositMatch)
		ld := userByAction(b, "LIQUIDITY_DEPOSITED")
		require.NotNil(t, ld, "expect a LIQUIDITY_DEPOSITED row")
		assert.Equal(t, strings.ToLower(oddfiTestLiquidityPool), ld.ContractAddress)
		require.NotNil(t, ld.PositionID)
		assert.Equal(t, "60", *ld.PositionID, "lp_position_id from e2e log = 60")
		assert.True(t, ld.Amount.Valid)
		require.NotNil(t, ld.Extra)
		assert.Contains(t, *ld.Extra, "poolId")
	})

	// ── Step 3: PlaceBet → BET_PLACED(user) ──
	t.Run("PlaceBet", func(t *testing.T) {
		b := parseTxIntoBatch(t, ctx, eth, svc, txPlaceBet)
		bp := userByAction(b, "BET_PLACED")
		require.NotNil(t, bp, "expect a BET_PLACED row")
		assert.Equal(t, strings.ToLower(oddfiTestBettingPool), bp.ContractAddress)
		require.NotNil(t, bp.BetID)
		// e2e 日志 bet_id 末两位 = 2f
		assert.True(t, strings.HasSuffix(*bp.BetID, "2f"), "bet_id should end with 2f, got %s", *bp.BetID)
		assert.True(t, bp.Amount.Valid)
		assert.Equal(t, "100000000000000000000", bp.Amount.Decimal.String(), "accepted=100 ODD")
	})

	// ── Step 4: Settle/Finalize → 新 score 结算事件 ──
	// 结算改用 SettleMarketBetsByScore/FinalizeMarketSettlement，经 delegatecall 在 BettingPool 地址发：
	//   settle  → MarketSettlementScoreBatchProcessed (topic0 0x7405c2f4...)
	//   finalize→ MarketSettlementFinalized          (topic0 0xe35ec182...)
	// 旧 MarketSettled 已不存在。同时验证结算副产物(PlatformReserveUpdated reason≠0 等)不被误收。
	t.Run("SettleFinalize", func(t *testing.T) {
		bScore := parseTxIntoBatch(t, ctx, eth, svc, txSettleScore)
		bFinal := parseTxIntoBatch(t, ctx, eth, svc, txFinalize)

		batch := adminByEvent(bScore, "MarketSettlementScoreBatchProcessed")
		require.NotNil(t, batch, "expect MarketSettlementScoreBatchProcessed in settle tx")
		assert.Equal(t, "BUSINESS_OPS", batch.Category)
		assert.Equal(t, batch.TxFrom, batch.Operator, "operator=tx.from")
		assert.Contains(t, batch.Params, "totalBetCount")

		fin := adminByEvent(bFinal, "MarketSettlementFinalized")
		require.NotNil(t, fin, "expect MarketSettlementFinalized in finalize tx")
		assert.Equal(t, "BUSINESS_OPS", fin.Category)
		assert.Contains(t, fin.Params, "resultKind")
		assert.Contains(t, fin.Params, "grossPayout")

		// 结算副产物 PlatformReserveUpdated(reason≠0) 必须被过滤掉
		assert.Nil(t, adminByEvent(bFinal, "PlatformReserveUpdated"),
			"settlement PlatformReserveUpdated(reason≠0) must be filtered out")
	})

	// ── Step 5: ClaimPayout → BetClaimed+PayoutClaimed 合并为一条 BET_CLAIMED ──
	t.Run("ClaimPayout", func(t *testing.T) {
		b := parseTxIntoBatch(t, ctx, eth, svc, txClaimPayout)
		require.NotEmpty(t, b.claimParts, "expect claim parts (BetClaimed/PayoutClaimed)")
		merged := mergeClaims(b.claimParts)
		require.NotEmpty(t, merged, "expect merged BET_CLAIMED")
		row := merged[0].row
		assert.Equal(t, "BET_CLAIMED", row.ActionType)
		require.NotNil(t, row.BetID)
		// 金额拆解应来自 PayoutClaimed
		assert.True(t, row.Amount.Valid, "netPayout should be set")
		assert.True(t, row.AmountGross.Valid, "grossPayout should be set")
	})

	// ── Step 6: RequestUnbond → LIQUIDITY_UNBOND_REQUESTED(user) ──
	t.Run("RequestUnbond", func(t *testing.T) {
		b := parseTxIntoBatch(t, ctx, eth, svc, txRequestUnbond)
		ur := userByAction(b, "LIQUIDITY_UNBOND_REQUESTED")
		require.NotNil(t, ur, "expect a LIQUIDITY_UNBOND_REQUESTED row")
		require.NotNil(t, ur.PositionID)
		require.NotNil(t, ur.Extra)
		assert.Contains(t, *ur.Extra, "unbondingEpoch")
	})
}
