package internal

import (
	"errors"
	"math"
	"oddfi-odds-engine/internal/model"
)

// ─── Slippage Tiers ──────────────────────────────────────────────────────────

// SlippageTier classifies a stake amount into a handling category.
type SlippageTier int

const (
	TierPriority SlippageTier = iota // ≤ $1,000  — no slippage, priority fill
	TierLight                        // $1,001 – $5,000  — light discount
	TierModerate                     // $5,001 – $10,000 — visible warning
	TierLarge                        // > $10,000 — requires explicit confirmation
)

// Slippage discount rates per tier (applied to the locked odds).
const (
	DiscountLight    = 0.010 // 1.0% odds reduction
	DiscountModerate = 0.025 // 2.5% odds reduction
	DiscountLarge    = 0.050 // 5.0% odds reduction
)

// ─── Preview Request / Response ──────────────────────────────────────────────

// PreviewRequest is the payload for POST /api/v1/bets/preview.
type PreviewRequest struct {
	MatchID   string
	Market    Market
	Line      float64
	OutcomeID string
	Stake     float64 // user-entered amount
	BaseOdds  float64 // current market odds before slippage
}

// PreviewResponse is returned to the frontend for Bet Slip display.
type PreviewResponse struct {
	Stake           float64
	BaseOdds        float64
	AdjustedOdds    float64
	EstimatedPayout float64
	SlippageTier    SlippageTier
	DiscountPct     float64 // e.g. 0.025 for 2.5%
	RequiresConfirm bool    // true only for TierLarge (>$10,000)
	WarningText     string  // non-empty for TierModerate and TierLarge
}

// ─── Preview ─────────────────────────────────────────────────────────────────

// Preview calculates the effective odds and payout for a given stake,
// applying the four-tier slippage rules.
func Preview(req PreviewRequest) PreviewResponse {
	tier := classifyStake(req.Stake)
	discount := discountForTier(tier)

	adjusted := RoundOdds(req.BaseOdds * (1 - discount))
	payout := req.Stake * adjusted

	resp := PreviewResponse{
		Stake:           req.Stake,
		BaseOdds:        req.BaseOdds,
		AdjustedOdds:    adjusted,
		EstimatedPayout: payout,
		SlippageTier:    tier,
		DiscountPct:     discount,
		RequiresConfirm: tier == TierLarge,
	}

	switch tier {
	case TierModerate:
		resp.WarningText = "大额下注将产生赔率折扣，实际赔率已在注单中更新"
	case TierLarge:
		resp.WarningText = "注单金额较大，赔率折扣显著，请确认后提交"
	}

	return resp
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// classifyStake maps a stake amount to its slippage tier.
//
//	≤ $1,000             → TierPriority  (no slippage)
//	$1,001 – $5,000      → TierLight
//	$5,001 – $10,000     → TierModerate
//	> $10,000            → TierLarge
func classifyStake(stake float64) SlippageTier {
	switch {
	case stake <= 1_000:
		return TierPriority
	case stake <= 5_000:
		return TierLight
	case stake <= 10_000:
		return TierModerate
	default:
		return TierLarge
	}
}

// discountForTier returns the odds discount rate for a given slippage tier.
func discountForTier(tier SlippageTier) float64 {
	switch tier {
	case TierLight:
		return DiscountLight
	case TierModerate:
		return DiscountModerate
	case TierLarge:
		return DiscountLarge
	default:
		return 0
	}
}

// ─── Error codes ─────────────────────────────────────────────────────────────

var (
	ErrInsufficientBalance   = errors.New("INSUFFICIENT_BALANCE")
	ErrBetTooLarge           = errors.New("BET_TOO_LARGE")
	ErrDailyLimitExceeded    = errors.New("DAILY_LIMIT_EXCEEDED")
	ErrOddsChanged           = errors.New("ODDS_CHANGED")
	ErrMarketClosed          = errors.New("MARKET_CLOSED")
	ErrInsufficientLiquidity = errors.New("INSUFFICIENT_LIQUIDITY")
)

// ─── VIP Tiers ───────────────────────────────────────────────────────────────

// VIPTier represents the user's staking tier.
type VIPTier int

const (
	TierNormal VIPTier = iota // 0 ODD staked
	TierVIP1                  // ≥ 1,000 ODD
	TierVIP2                  // ≥ 5,000 ODD
	TierVIP3                  // ≥ 20,000 ODD
)

// DailyLimit returns the maximum daily betting limit in USD for a given tier.
//
//	普通 → $1,000 | VIP1 → $5,000 | VIP2 → $10,000 | VIP3 → $15,000
func DailyLimit(tier VIPTier) float64 {
	switch tier {
	case TierVIP1:
		return 5_000
	case TierVIP2:
		return 10_000
	case TierVIP3:
		return 15_000
	default:
		return 1_000
	}
}

// ─── Single Bet Limit ────────────────────────────────────────────────────────

// SingleBetLimit returns the maximum allowed stake for a single bet,
// determined by the locked odds of the selection.
//
//	odds < 2.0  → $800
//	2.0 – 3.5   → $500
//	> 3.5       → $300
func SingleBetLimit(lockedOdds float64) float64 {
	switch {
	case lockedOdds < 2.0:
		return 800
	case lockedOdds <= 3.5:
		return 500
	default:
		return 300
	}
}

// ─── Validation Request / Result ─────────────────────────────────────────────

// BetRequest is the incoming bet placement payload.
type BetRequest struct {
	UserID     string
	MatchID    string
	Market     Market
	Line       float64
	OutcomeID  string
	Stake      float64 // amount in USD
	ClientOdds float64 // odds seen by user at submission time
	LockedOdds float64 // current odds locked by server
}

// UserState holds the runtime state needed for validation.
type UserState struct {
	AvailableBalance float64
	DailyUsed        float64 // amount already bet today
	VIPTier          VIPTier
}

// PoolState holds the BettingPool state at validation time.
type PoolState struct {
	AvailableBalance float64 // USDT available for payouts
	SignalColor      SignalColor
}

// ─── Validate ─────────────────────────────────────────────────────────────────

// Validate runs all 6 bet placement checks in order.
// Returns nil if the bet is accepted, or the first failing error.
func Validate(req BetRequest, user UserState, pool PoolState) error {
	// 1. Balance check
	if req.Stake > user.AvailableBalance {
		return ErrInsufficientBalance
	}

	// 2. Single bet limit (by odds tier)
	limit := SingleBetLimit(req.LockedOdds)
	if req.Stake > limit {
		return ErrBetTooLarge
	}

	// 3. Daily limit (by VIP tier)
	dailyMax := DailyLimit(user.VIPTier)
	if user.DailyUsed+req.Stake > dailyMax {
		return ErrDailyLimitExceeded
	}

	// 4. Odds drift check
	// If the odds moved more than 0.05 since the user submitted,
	// return 409 so the frontend can display the updated Bet Slip.
	if oddsChanged(req.ClientOdds, req.LockedOdds) {
		return ErrOddsChanged
	}

	// 5. Signal light — reject if heavy direction is red
	if !IsAccepting(pool.SignalColor) {
		return ErrMarketClosed
	}

	// 6. Liquidity check — potential payout must not exceed pool balance
	potentialPayout := req.Stake * req.LockedOdds
	if potentialPayout > pool.AvailableBalance {
		return ErrInsufficientLiquidity
	}

	return nil
}

// oddsChanged returns true when the drift between client-submitted odds
// and current server odds exceeds the 0.05 threshold.
func oddsChanged(client, server float64) bool {
	return math.Abs(server-client) > OddsChangedThresh
}

// ─── Signal Light ─────────────────────────────────────────────────────────────

// SignalColor represents the traffic-light risk state of a market direction.
type SignalColor int

const (
	SignalGreen  SignalColor = iota // $0 – $8,000   normal
	SignalYellow                    // $8,000 – $18,000   warn, continue
	SignalOrange                    // $18,000 – $28,000  limit
	SignalRed                       // > $28,000          stop
)

// Signal thresholds (worst-case loss in USD)
const (
	ThresholdYellow = 8_000.0
	ThresholdOrange = 18_000.0
	ThresholdRed    = 28_000.0
)

// Compression rate constants
const (
	UnitCompressYellow = 0.004 // 0.4% per $1,000 above yellow threshold
	UnitCompressOrange = 0.008 // 0.8% per $1,000 above orange threshold
	MaxCompressYellow  = 0.040 // 4.0% max from yellow band
	MaxCompressOrange  = 0.080 // 8.0% additional max from orange band
)

// GetSignal returns the signal color for a given worst-case loss value.
func GetSignal(worstLoss float64) SignalColor {
	switch {
	case worstLoss <= ThresholdYellow:
		return SignalGreen
	case worstLoss <= ThresholdOrange:
		return SignalYellow
	case worstLoss <= ThresholdRed:
		return SignalOrange
	default:
		return SignalRed
	}
}

// IsAccepting returns true if the market direction is still open for bets.
// Red signal stops accepting bets on the heavy direction.
func IsAccepting(sig SignalColor) bool {
	return sig != SignalRed
}

// CompressionRate calculates r, the odds compression ratio for the heavy direction.
//
// Green  (L ≤ $8k):              r = 0
// Yellow ($8k < L ≤ $18k):       r = min((L−8000)/1000 × 0.4%, 4.0%)
// Orange ($18k < L ≤ $28k):      r = 4.0% + min((L−18000)/1000 × 0.8%, 8.0%)
// Red    (L > $28k):              stop accepting — r not applied
func CompressionRate(worstLoss float64) float64 {
	switch {
	case worstLoss <= ThresholdYellow:
		return 0

	case worstLoss <= ThresholdOrange:
		excess := worstLoss - ThresholdYellow
		r := (excess / 1000) * UnitCompressYellow
		if r > MaxCompressYellow {
			r = MaxCompressYellow
		}
		return r

	case worstLoss <= ThresholdRed:
		// Yellow band fully triggered (4%) + orange increment
		excess := worstLoss - ThresholdOrange
		rOrange := (excess / 1000) * UnitCompressOrange
		if rOrange > MaxCompressOrange {
			rOrange = MaxCompressOrange
		}
		return MaxCompressYellow + rOrange

	default:
		// Red: return max compression — caller should check IsAccepting first
		return MaxCompressYellow + MaxCompressOrange // 12%
	}
}

// String returns a human-readable label for logging/debugging.
func (s SignalColor) String() string {
	switch s {
	case SignalGreen:
		return "GREEN"
	case SignalYellow:
		return "YELLOW"
	case SignalOrange:
		return "ORANGE"
	case SignalRed:
		return "RED"
	default:
		return "UNKNOWN"
	}
}

// ─── Constants ───────────────────────────────────────────────────────────────

const (
	PlatformMargin    = 0.10 // 10% platform margin (House Edge)
	FloatCoeff        = 1.0  // k = 1.0, symmetric float
	MaxCompressionPct = 0.12 // 12% max total compression (orange ceiling)
	MaxFloatPct       = 0.08 // 8% max float (anti-arbitrage cap)
	MinOdds           = 1.01 // absolute minimum odds
	OddsStep          = 0.01 // display precision
	OddsChangedThresh = 0.05 // WebSocket push threshold
)

// ─── Types ───────────────────────────────────────────────────────────────────

// Market identifies the bet market type.
type Market string

const (
	Market1X2 Market = "1x2"
	MarketAH  Market = "ah"
	MarketOU  Market = "ou"
)

// Outcome represents one selectable direction in a market.
type Outcome struct {
	ID           string
	Name         string
	BaseOdds     float64 // original opening odds, immutable reference
	CurrentOdds  float64 // live odds after dynamic adjustment
	TotalStake   float64 // cumulative accepted stake on this direction
	ManualOffset float64 // 人工调整 (±0.30)
}

// MarketState holds the full live state of one market line.
type MarketState struct {
	MatchID  string
	Market   Market
	Line     float64 // e.g. 2.5 for OU, -1 for AH
	Outcomes []model.Outcome
	Signal   SignalColor
}

// ─── Opening Odds ─────────────────────────────────────────────────────────────

// OpeningOdds converts Sportmonks reference odds into platform odds with 10% margin.
//
// Algorithm:
//  1. Derive implied probabilities: p_i = 1 / ref_i
//  2. Normalize to true probabilities: true_p_i = p_i / Σp_i
//  3. Apply platform margin: adj_p_i = true_p_i × (1 + PlatformMargin)
//  4. Platform odds: 1 / adj_p_i
//
// ref: map[outcomeID]referenceOdds
func OpeningOdds(ref map[string]float64) map[string]float64 {
	// Step 1 & 2: implied probs → normalize
	totalImplied := 0.0
	implied := make(map[string]float64, len(ref))
	for id, o := range ref {
		p := 1.0 / o
		implied[id] = p
		totalImplied += p
	}

	result := make(map[string]float64, len(ref))
	for id, p := range implied {
		trueP := p / totalImplied            // Step 2: normalize
		adjP := trueP * (1 + PlatformMargin) // Step 3: add margin
		result[id] = RoundOdds(1.0 / adjP)   // Step 4: odds
	}
	return result
}

// ─── Worst Loss ───────────────────────────────────────────────────────────────

// WorstLoss calculates the platform's worst-case payout for each outcome.
//
//	Lᵢ = Sᵢ × (Oᵢ − 1) − ΣSⱼ   (j ≠ i)
//
// Positive Lᵢ means platform loses if outcome i wins.
// Negative Lᵢ means platform profits if outcome i wins.
func WorstLoss(oddsList []model.Odd) []float64 {
	totalStake := 0.0
	for _, o := range oddsList {
		totalStake += o.TotalStake
	}

	losses := make([]float64, len(oddsList))
	for i, o := range oddsList {
		// 这里的 o.CurrentValue 就是你代码里的 CurrentOdds
		// 代表当前该选项的赔率数值
		otherStake := totalStake - o.TotalStake

		// 计算公式：该项总注额 * (当前赔率 - 1) - 其他项总注额
		losses[i] = o.TotalStake*(o.CurrentValue-1) - otherStake
	}
	return losses
}

// HeavyIndex returns the index of the outcome with the maximum worst loss.
// This is the "heavy" (重仓) direction that requires odds compression.
func HeavyIndex(losses []float64) int {
	idx := 0
	maxL := -1e18 // 初始化为一个极小值
	for i, l := range losses {
		if l > maxL {
			maxL = l
			idx = i
		}
	}
	return idx
}

// // ─── Dynamic Adjustment ───────────────────────────────────────────────────────

// // AdjustOdds recalculates all outcome odds after a new bet is placed.
// // Called asynchronously after each accepted bet.
// //
// // Returns the updated MarketState with new CurrentOdds and Signal.
// func AdjustOdds(state MarketState) MarketState {
// 	losses := WorstLoss(state.Outcomes)
// 	heavyIdx := HeavyIndex(losses)
// 	heavyLoss := losses[heavyIdx]

// 	state.Signal = GetSignal(heavyLoss)
// 	r := CompressionRate(heavyLoss)

// 	for i := range state.Outcomes {
// 		base := state.Outcomes[i].BaseOdds
// 		if i == heavyIdx {
// 			// Compress heavy direction
// 			compressed := base * (1 - r)
// 			compressed = math.Max(compressed, base*0.88) // floor: max 12% compression
// 			compressed = math.Max(compressed, MinOdds)
// 			state.Outcomes[i].CurrentOdds = RoundOdds(compressed)
// 		} else {
// 			// Float light directions
// 			floatRate := math.Min(r*FloatCoeff, MaxFloatPct)
// 			floated := base * (1 + floatRate)
// 			floated = math.Min(floated, base*1.08) // cap: anti-arbitrage
// 			state.Outcomes[i].CurrentOdds = RoundOdds(floated)
// 		}
// 	}

// 	return state
// }

// OddsDelta returns the absolute difference between two odds values.
// Used to decide whether to push a WebSocket update (threshold: 0.05).
func OddsDelta(prev, next float64) float64 {
	return math.Abs(next - prev)
}

// ShouldPushWS returns true if the odds change warrants a WebSocket broadcast.
func ShouldPushWS(prev, next float64) bool {
	return OddsDelta(prev, next) > OddsChangedThresh
}

// RoundOdds rounds to 2 decimal places with 0.01 step.
func RoundOdds(o float64) float64 {
	return math.Round(o/OddsStep) * OddsStep
}
