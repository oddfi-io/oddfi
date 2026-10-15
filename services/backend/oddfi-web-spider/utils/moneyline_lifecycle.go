package utils

import (
	"strconv"
	"time"
)

const (
	MoneylineMarketID      = 1
	MoneylineBookmakerID   = 20
	MoneylineLabelHome     = "Home"
	MoneylineLabelDraw     = "Draw"
	MoneylineLabelAway     = "Away"
	MoneylineStatusPending = "PENDING"
	MoneylineStatusPolling = "POLLING"
	MoneylineStatusDone    = "COMPLETED"
	MoneylineStatusStopped = "STOPPED"
	MoneylineStatusAnomaly = "ANOMALY"
)

type FixtureStateClass string

const (
	FixtureStatePending  FixtureStateClass = "PENDING"
	FixtureStateLive     FixtureStateClass = "LIVE"
	FixtureStateTerminal FixtureStateClass = "TERMINAL"
	FixtureStateAnomaly  FixtureStateClass = "ANOMALY"
	FixtureStateUnknown  FixtureStateClass = "UNKNOWN"
)

var moneylinePendingStates = map[int]struct{}{
	1:  {},
	13: {},
	26: {},
}

var moneylineLiveStates = map[int]struct{}{
	2:  {},
	3:  {},
	4:  {},
	6:  {},
	9:  {},
	21: {},
	22: {},
	23: {},
	25: {},
}

var moneylineTerminalStates = map[int]struct{}{
	5:  {},
	7:  {},
	8:  {},
	12: {},
	14: {},
	15: {},
	17: {},
	20: {},
}

var moneylineAnomalyStates = map[int]struct{}{
	10: {},
	11: {},
	16: {},
	18: {},
	19: {},
}

var moneylineWhitelist map[int64]struct{}

// ClassifyMoneylineState 把 SportMonks state_id 归到 moneyline 状态机需要的少数几类。
// 这里集中维护字典，是为了避免 runner、service、API 分散硬编码后出现采停口径不一致。
func ClassifyMoneylineState(stateID int) FixtureStateClass {
	if _, ok := moneylinePendingStates[stateID]; ok {
		return FixtureStatePending
	}
	if _, ok := moneylineLiveStates[stateID]; ok {
		return FixtureStateLive
	}
	if _, ok := moneylineTerminalStates[stateID]; ok {
		return FixtureStateTerminal
	}
	if _, ok := moneylineAnomalyStates[stateID]; ok {
		return FixtureStateAnomaly
	}
	return FixtureStateUnknown
}

func IsMoneylinePollableState(stateID int) bool {
	class := ClassifyMoneylineState(stateID)
	return class == FixtureStatePending || class == FixtureStateLive
}

func IsMoneylineTerminalState(stateID int) bool {
	return ClassifyMoneylineState(stateID) == FixtureStateTerminal
}

func IsMoneylineAnomalyState(stateID int) bool {
	return ClassifyMoneylineState(stateID) == FixtureStateAnomaly
}

func IsMoneylineLiveState(stateID int) bool {
	return ClassifyMoneylineState(stateID) == FixtureStateLive
}

func IsWithinMoneylineWindow(now, startAt time.Time) bool {
	return !now.Before(startAt.AddDate(0, 0, -14)) && now.Before(startAt.Add(3*time.Hour))
}

// MoneylineCadence 根据比赛生命周期计算下一次采集间隔。
// PRD 的启动窗口是赛前 14 天，但表格第一档从赛前 7 天开始；为避免 14~7 天窗口内进入 POLLING 后没有 next_poll_at，
// 这里把 14~7 天也按“远期”低频 30 分钟处理，既不漏采开盘早期走势，也不会明显增加配额压力。
func MoneylineCadence(now, startAt time.Time, stateID int) (time.Duration, bool) {
	switch ClassifyMoneylineState(stateID) {
	case FixtureStateLive:
		return time.Minute, true
	case FixtureStateAnomaly:
		return 30 * time.Minute, true
	case FixtureStatePending:
		if now.Before(startAt.Add(-24 * time.Hour)) {
			return 30 * time.Minute, true
		}
		if now.Before(startAt.Add(-time.Hour)) {
			return 10 * time.Minute, true
		}
		// 开赛前最后 1 小时以及开赛点附近仍显示未开始时使用 2 分钟，兼容上游状态延迟切换。
		return 2 * time.Minute, true
	default:
		return 0, false
	}
}

func NextMoneylinePollAt(now, startAt time.Time, stateID int) (*time.Time, bool) {
	cadence, ok := MoneylineCadence(now, startAt, stateID)
	if !ok {
		return nil, false
	}
	next := now.Add(cadence)
	return &next, true
}

// 返回一个包含所有允许进行金钱线投注的体育赛事ID的白名单
func MoneylineWhitelist() map[int64]struct{} {
	if moneylineWhitelist != nil {
		return moneylineWhitelist
	}
	ids := make(map[int64]struct{}, len(FixtureWorldCupAllIDs)+len(FixtureEuAllIDs)+len(FixtureOtherAllIDs))
	addIDs := func(rawIDs []string) {
		for _, raw := range rawIDs {
			id, err := strconv.ParseInt(raw, 10, 64)
			if err == nil {
				ids[id] = struct{}{}
			}
		}
	}
	addIDs(FixtureWorldCupAllIDs)
	addIDs(FixtureEuAllIDs)
	addIDs(FixtureOtherAllIDs)
	moneylineWhitelist = ids
	return moneylineWhitelist
}

func IsMoneylineFixtureWhitelisted(fixtureID int64) bool {
	_, ok := MoneylineWhitelist()[fixtureID]
	return ok
}

func MoneylineWhitelistIDs() []int64 {
	whitelist := MoneylineWhitelist()
	ids := make([]int64, 0, len(whitelist))
	for id := range whitelist {
		ids = append(ids, id)
	}
	return ids
}
