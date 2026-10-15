package evm

import (
	"chain-consumer/internal/mysql"
	"encoding/json"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/shopspring/decimal"
)

// logMeta 一条日志的公共链上溯源信息，供 admin/user 两张表共用。
// 地址/哈希一律小写存储，避免 checksum 大小写导致查不到。
type logMeta struct {
	chainID         uint
	contractAddress string // log.Address 小写
	blockNumber     uint64
	blockTime       time.Time
	txHash          string // 小写
	txFrom          string // 小写
	logIndex        uint
	blockHash       string // 小写
}

func newLogMeta(l types.Log, chainID uint, txFrom string, blockTime time.Time) logMeta {
	return logMeta{
		chainID:         chainID,
		contractAddress: addrLower(l.Address),
		blockNumber:     l.BlockNumber,
		blockTime:       blockTime,
		txHash:          strings.ToLower(l.TxHash.Hex()),
		txFrom:          strings.ToLower(txFrom),
		logIndex:        l.Index,
		blockHash:       strings.ToLower(l.BlockHash.Hex()),
	}
}

// oddfiBatch 一个 Kafka 消息(单区块)解析出的全部待入库行。
// userEvents/claimParts 是中间态，需在 handler 里做 BetClaimed+PayoutClaimed 合并与 match_id 回填后才落库。
type oddfiBatch struct {
	adminRows        []*mysql.AdminOnchainAction
	marketMaps       []*mysql.MarketMatchMap
	poolMaps         []*mysql.PoolMatchMap
	userEvents       []*userEvent            // 可直接成行的用户事件（可能需 match_id 回填）
	claimParts       []*claimPart            // BetClaimed/PayoutClaimed 碎片，待按 (tx,betId) 合并
	settlementOrders []*mysql.OnchainTxOrder // MarketSettlementFinalized → onchain_tx_orders 结算行(直接 INSERT)
	cashOuts         []*cashOutUpdate        // BetCashedOut → UPDATE 原 place_bet 行结算态(与 settlementOrders 的 INSERT 不同，这是 UPDATE)
}

// cashOutUpdate 一笔 BetCashedOut 对原 place_bet 行的结算回写载荷。
type cashOutUpdate struct {
	betID           string    // = onchain_tx_orders.onchain_bet_id
	actualPayoutWei string    // cashOutAmount 原始 wei（用户实收，已扣 fee）
	settledAt       time.Time // 区块时间
}

func (b *oddfiBatch) empty() bool {
	return b == nil || (len(b.adminRows) == 0 && len(b.marketMaps) == 0 &&
		len(b.poolMaps) == 0 && len(b.userEvents) == 0 && len(b.claimParts) == 0 &&
		len(b.cashOuts) == 0)
}

// ───────────────────────── 编码助手（保证 JSON 可回读、地址统一小写） ─────────────────────────

// addrLower 地址转小写 0x 字符串。
func addrLower(a common.Address) string { return strings.ToLower(a.Hex()) }

// hashHex bytes32 转 0x+64hex（common.Hash.Hex() 本身即小写）。
func hashHex(b [32]byte) string { return common.Hash(b).Hex() }

// bigStr 大整数转十进制字符串；nil 视为 "0"。JSON 内一律用它，绝不写 JSON number 以防读回丢精度。
func bigStr(x *big.Int) string {
	if x == nil {
		return "0"
	}
	return x.String()
}

// jsonStr 把参数 map 序列化为合法 JSON 文本；失败或空时返回 "{}"（空串不是合法 JSON，禁止写入 JSON 列）。
func jsonStr(m map[string]any) string {
	if len(m) == 0 {
		return "{}"
	}
	b, err := json.Marshal(m)
	if err != nil || len(b) == 0 {
		return "{}"
	}
	return string(b)
}

// jsonPtr 同 jsonStr 但返回 *string，用于可空 JSON 列（extra）；空 map 返回 nil 以存 NULL。
func jsonPtr(m map[string]any) *string {
	if len(m) == 0 {
		return nil
	}
	b, err := json.Marshal(m)
	if err != nil || len(b) == 0 {
		return nil
	}
	s := string(b)
	return &s
}

func ptrStr(s string) *string { return &s }

// nullDecFromBig 把 *big.Int 转成 decimal.NullDecimal（nil → NULL）。
func nullDecFromBig(x *big.Int) decimal.NullDecimal {
	if x == nil {
		return decimal.NullDecimal{}
	}
	return decimal.NullDecimal{Decimal: decimal.NewFromBigInt(x, 0), Valid: true}
}

// unixToUTC 把秒级时间戳转 *time.Time(UTC)；0 视为无值返回 nil。
func unixToUTC(sec uint64) *time.Time {
	if sec == 0 {
		return nil
	}
	t := time.Unix(int64(sec), 0).UTC()
	return &t
}

// ───────────────────────── 角色 bytes32 → 可读名（params 内附） ─────────────────────────

var roleNameByHash = func() map[string]string {
	m := map[string]string{
		// DEFAULT_ADMIN_ROLE 为全零
		"0x0000000000000000000000000000000000000000000000000000000000000000": "DEFAULT_ADMIN_ROLE",
	}
	for _, name := range []string{"UPGRADER_ROLE", "PAUSER_ROLE", "SETTLER_ROLE", "OPERATOR_ROLE", "KEEPER_ROLE"} {
		m[crypto.Keccak256Hash([]byte(name)).Hex()] = name
	}
	return m
}()

// roleName 返回角色 bytes32 的可读名；未知返回空串。
func roleName(roleHash string) string {
	return roleNameByHash[strings.ToLower(roleHash)]
}

// parseBlockTime 从 EvmResult.Block 取区块时间(UTC)。
// 事件本身不带时间，整块共用。取不到(Block为空/无timestamp/解析失败)时回退到当前时间。
func parseBlockTime(raw json.RawMessage) time.Time {
	now := time.Now().UTC()
	if len(raw) == 0 {
		return now
	}
	var b EvmDataBlock
	if err := json.Unmarshal(raw, &b); err != nil || b.Timestamp == "" {
		return now
	}
	ts := b.Timestamp
	var (
		sec int64
		err error
	)
	if strings.HasPrefix(ts, "0x") || strings.HasPrefix(ts, "0X") {
		sec, err = strconv.ParseInt(ts[2:], 16, 64)
	} else {
		sec, err = strconv.ParseInt(ts, 10, 64)
	}
	if err != nil || sec <= 0 {
		return now
	}
	return time.Unix(sec, 0).UTC()
}

// collectOddFiLog 若日志来源于配置的 OddFi 合约，解析其 admin/user/映射 事件并追加到 batch。
func (s *EVMService) collectOddFiLog(l types.Log, txFrom string, blockTime time.Time, batch *oddfiBatch) {
	kind, ok := s.oddfiAddrs[strings.ToLower(l.Address.Hex())]
	if !ok {
		return
	}
	meta := newLogMeta(l, uint(s.chainID), txFrom, blockTime)
	if row := s.parseAdminAction(l, kind, meta); row != nil {
		batch.adminRows = append(batch.adminRows, row)
	}
	s.collectUserAndMaps(l, kind, meta, batch)
	s.collectSettlementOrder(l, kind, meta, batch)
}
