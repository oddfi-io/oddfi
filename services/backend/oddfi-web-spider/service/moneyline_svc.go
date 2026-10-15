package service

import (
	"context"
	"fmt"
	"log"
	"math"
	"oddfi-web-spider/client"
	"oddfi-web-spider/model"
	"oddfi-web-spider/storage"
	"oddfi-web-spider/utils"
	"strconv"
	"strings"
	"time"
)

const anomalySincePrefix = "anomaly_since="

type MoneylineService struct {
	restClient *client.RestClient
	repo       *storage.MoneylineRepo
	now        func() time.Time
}

// NewMoneylineService 构造 Moneyline 采集服务。
// now 以函数注入，是为了让状态机测试能固定时间，避免 cadence/窗口判断因为真实时间漂移而变成不稳定测试。
func NewMoneylineService(rc *client.RestClient, repo *storage.MoneylineRepo) *MoneylineService {
	return &MoneylineService{
		restClient: rc,
		repo:       repo,
		now:        time.Now,
	}
}

// RefreshActiveSet 定期把白名单内、进入 14 天窗口的 fixture 放入采集状态机。
// 这里只做“启动/纠偏”，不会覆盖已有 POLLING fixture 的 next_poll_at，避免 10 分钟刷新任务破坏按生命周期计算出的精细采集节奏。
func (s *MoneylineService) RefreshActiveSet(ctx context.Context) error {
	now := s.now()
	fixtureIDs := utils.MoneylineWhitelistIDs()
	fixtures, err := s.repo.FindWhitelistFixturesInWindow(ctx, fixtureIDs, now.Add(-3*time.Hour), now.AddDate(0, 0, 14))
	if err != nil {
		return err
	}

	ids := make([]int64, 0, len(fixtures))
	for _, fixture := range fixtures {
		ids = append(ids, fixture.ID)
	}
	existingStatuses, err := s.repo.FindStatuses(ctx, ids)
	if err != nil {
		return err
	}

	statuses := make([]model.MoneylineCollectionStatus, 0, len(fixtures))
	for _, fixture := range fixtures {
		existing, hasExisting := existingStatuses[fixture.ID]
		if hasExisting && (existing.Status == utils.MoneylineStatusDone || existing.Status == utils.MoneylineStatusStopped) {
			continue
		}
		stateClass := utils.ClassifyMoneylineState(fixture.StateID)
		if hasExisting && existing.Status == utils.MoneylineStatusPolling && (stateClass == utils.FixtureStatePending || stateClass == utils.FixtureStateLive) {
			// RefreshActiveSet 只负责启动/纠偏活跃集合，不能每 10 分钟把已调度 fixture 的 next_poll_at 重置为 now，否则会破坏分阶段 cadence。
			continue
		}
		if hasExisting && existing.Status == utils.MoneylineStatusAnomaly && stateClass == utils.FixtureStateAnomaly {
			continue
		}
		status, ok := s.buildRefreshStatus(now, fixture, existing, hasExisting)
		if ok {
			statuses = append(statuses, status)
		}
	}

	if err := s.repo.UpsertStatuses(ctx, statuses); err != nil {
		return err
	}
	log.Printf("[Moneyline] RefreshActiveSet 完成，候选=%d upsert=%d", len(fixtures), len(statuses))
	return nil
}

// buildRefreshStatus 根据 fixture 当前状态生成状态机的初始化记录。
// 状态初始化必须和 OnFixtureUpdate 使用同一套 state 分类，否则重启后可能把异常/终态比赛重新拉回高频采集。
func (s *MoneylineService) buildRefreshStatus(now time.Time, fixture model.Fixture, existing model.MoneylineCollectionStatus, hasExisting bool) (model.MoneylineCollectionStatus, bool) {
	status := model.MoneylineCollectionStatus{FixtureID: fixture.ID, Status: utils.MoneylineStatusPending}
	if hasExisting {
		status = existing
	}

	switch utils.ClassifyMoneylineState(fixture.StateID) {
	case utils.FixtureStatePending, utils.FixtureStateLive:
		next := initialMoneylinePollAt(now, fixture)
		status.Status = utils.MoneylineStatusPolling
		status.NextPollAt = &next
		status.LastStateID = intPtr(fixture.StateID)
		status.Notes = ""
		return status, true
	case utils.FixtureStateAnomaly:
		next := now.Add(30 * time.Minute)
		status.Status = utils.MoneylineStatusAnomaly
		status.NextPollAt = &next
		status.LastStateID = intPtr(fixture.StateID)
		status.Notes = buildAnomalyNote(now)
		return status, true
	case utils.FixtureStateTerminal:
		status.Status = utils.MoneylineStatusDone
		status.NextPollAt = nil
		status.LastStateID = intPtr(fixture.StateID)
		status.Notes = "terminal fixture discovered by refresh"
		return status, true
	default:
		return status, false
	}
}

// initialMoneylinePollAt 给首次进入 POLLING 的 fixture 做确定性错峰。
// 部署重启时可能一次发现几百场候选比赛，如果全部 next_poll_at=now，会瞬间把 due 队列和 SportMonks 额度打满；按 fixture_id 分散到半个 cadence 内，可以保留采集时效又避免启动雪崩。
func initialMoneylinePollAt(now time.Time, fixture model.Fixture) time.Time {
	cadence, ok := utils.MoneylineCadence(now, fixture.StartingAt, fixture.StateID)
	if !ok {
		return now
	}
	maxStagger := cadence / 2
	if maxStagger > 10*time.Minute {
		maxStagger = 10 * time.Minute
	}
	if maxStagger <= 0 {
		return now
	}
	seconds := int64(maxStagger / time.Second)
	if seconds <= 0 {
		return now
	}
	offset := time.Duration(fixture.ID%seconds) * time.Second
	return now.Add(offset)
}

// CaptureSnapshot 拉取单场 Moneyline 最小响应并推进状态机。
// 拉取失败时会延后 next_poll_at，防止网络抖动导致 runner 每 30 秒重复提交同一 fixture 打满上游配额。
func (s *MoneylineService) CaptureSnapshot(ctx context.Context, fixtureID int64) error {
	raw, err := s.restClient.GetMoneylineFixtureByID(ctx, strconv.FormatInt(fixtureID, 10))
	if err != nil {
		s.deferAfterCaptureError(ctx, fixtureID, err)
		return err
	}
	return s.OnFixtureUpdate(ctx, &raw)
}

// OnFixtureUpdate 是 moneyline 状态机的唯一推进入口。
// runner 主动采集和 spider 全量同步都会走这里，保证同一场比赛无论从哪个链路拿到 SportMonks 快照，采停规则都完全一致。
func (s *MoneylineService) OnFixtureUpdate(ctx context.Context, fixture *model.APIFixture) error {
	if fixture == nil || fixture.ID == 0 || !utils.IsMoneylineFixtureWhitelisted(fixture.ID) {
		return nil
	}

	now := s.now()
	existing, err := s.repo.GetStatus(ctx, fixture.ID)
	if err != nil {
		return err
	}

	stateClass := utils.ClassifyMoneylineState(fixture.StateID)
	if stateClass == utils.FixtureStateTerminal {
		return s.handleTerminalFixture(ctx, existing, fixture, now)
	}

	startAt, ok := parseSportMonksTime(fixture.StartingAt)
	if !ok {
		return s.upsertFromExisting(ctx, existing, fixture.ID, utils.MoneylineStatusPending, fixture.StateID, nil, "missing or invalid starting_at")
	}

	if !utils.IsWithinMoneylineWindow(now, startAt) {
		if now.Before(startAt.AddDate(0, 0, -14)) {
			return s.upsertFromExisting(ctx, existing, fixture.ID, utils.MoneylineStatusPending, fixture.StateID, nil, "outside 14d collection window")
		}
		return s.upsertFromExisting(ctx, existing, fixture.ID, utils.MoneylineStatusStopped, fixture.StateID, nil, "fixture exceeded collection window without terminal state")
	}

	switch stateClass {
	case utils.FixtureStateAnomaly:
		return s.handleAnomalyFixture(ctx, existing, fixture, now)
	case utils.FixtureStatePending, utils.FixtureStateLive:
		return s.capturePollableFixture(ctx, existing, fixture, startAt, now)
	default:
		next := now.Add(30 * time.Minute)
		return s.upsertFromExisting(ctx, existing, fixture.ID, utils.MoneylineStatusAnomaly, fixture.StateID, &next, "unknown state_id; retry as anomaly")
	}
}

// capturePollableFixture 处理赛前/赛中可采状态。
// 快照写入和状态推进放在同一逻辑里，是为了保证 capture_count、last_captured_at 与真实写入的三方快照保持一致。
func (s *MoneylineService) capturePollableFixture(ctx context.Context, existing *model.MoneylineCollectionStatus, fixture *model.APIFixture, startAt, now time.Time) error {
	next, ok := utils.NextMoneylinePollAt(now, startAt, fixture.StateID)
	if !ok {
		next = nil
	}

	snapshots, complete, err := buildMoneylineSnapshots(fixture, now)
	if err != nil {
		return s.upsertFromExisting(ctx, existing, fixture.ID, utils.MoneylineStatusPolling, fixture.StateID, next, err.Error())
	}
	if !complete {
		// 三方缺任意一方时不写半套快照，否则前端折线会把 Home/Draw/Away 时间轴拉散，误导概率走势。
		return s.upsertFromExisting(ctx, existing, fixture.ID, utils.MoneylineStatusPolling, fixture.StateID, next, "moneyline odds incomplete; skip snapshot")
	}

	if err := s.repo.InsertSnapshots(ctx, snapshots); err != nil {
		return err
	}

	status := mergeStatus(existing, fixture.ID)
	status.Status = utils.MoneylineStatusPolling
	status.LastStateID = intPtr(fixture.StateID)
	status.LastCapturedAt = &now
	status.NextPollAt = next
	status.Notes = ""
	status.CaptureCount++
	if status.FirstCapturedAt == nil {
		status.FirstCapturedAt = &now
	}
	return s.repo.UpsertStatus(ctx, status)
}

// handleTerminalFixture 处理完赛/作废等终态。
// 终态需要至少观察两次才 COMPLETED，是为了抵抗 SportMonks 短暂状态闪烁；首次终态仍保留最后完整赔率，方便前端图表收口。
func (s *MoneylineService) handleTerminalFixture(ctx context.Context, existing *model.MoneylineCollectionStatus, fixture *model.APIFixture, now time.Time) error {
	snapshots, complete, err := buildMoneylineSnapshots(fixture, now)
	insertedSnapshot := false
	if err == nil && complete {
		// 终态确认前仍保留最后一次完整赔率快照，方便前端图上看到临近结束前的最后价格。
		if insertErr := s.repo.InsertSnapshots(ctx, snapshots); insertErr != nil {
			return insertErr
		}
		insertedSnapshot = true
	}

	if existing != nil && existing.Status == utils.MoneylineStatusPolling {
		if existing.LastStateID == nil || *existing.LastStateID != fixture.StateID {
			next := now.Add(time.Minute)
			status := mergeStatus(existing, fixture.ID)
			status.Status = utils.MoneylineStatusPolling
			status.LastStateID = intPtr(fixture.StateID)
			status.NextPollAt = &next
			status.Notes = "terminal state observed once; waiting confirmation"
			if insertedSnapshot {
				status.LastCapturedAt = &now
				status.CaptureCount++
				if status.FirstCapturedAt == nil {
					status.FirstCapturedAt = &now
				}
			}
			return s.repo.UpsertStatus(ctx, status)
		}
	}

	status := mergeStatus(existing, fixture.ID)
	status.Status = utils.MoneylineStatusDone
	status.LastStateID = intPtr(fixture.StateID)
	status.NextPollAt = nil
	status.Notes = "terminal state confirmed"
	if insertedSnapshot {
		status.LastCapturedAt = &now
		status.CaptureCount++
		if status.FirstCapturedAt == nil {
			status.FirstCapturedAt = &now
		}
	}
	return s.repo.UpsertStatus(ctx, status)
}

// handleAnomalyFixture 处理延期、中断等暂时性异常。
// PRD 的表结构没有单独 anomaly_since 字段，因此把首次异常时间写入 notes，用最小 schema 变更实现“连续 6 小时异常停采”。
func (s *MoneylineService) handleAnomalyFixture(ctx context.Context, existing *model.MoneylineCollectionStatus, fixture *model.APIFixture, now time.Time) error {
	since := now
	if existing != nil && existing.Status == utils.MoneylineStatusAnomaly {
		if parsed, ok := parseAnomalySince(existing.Notes); ok {
			since = parsed
		}
	}
	if now.Sub(since) >= 6*time.Hour {
		return s.upsertFromExisting(ctx, existing, fixture.ID, utils.MoneylineStatusStopped, fixture.StateID, nil, "anomaly state lasted over 6h")
	}

	next := now.Add(30 * time.Minute)
	// anomaly_since 放在 notes 里，是因为 PRD 的状态表没有单独字段；必须保留首次异常时间才能判断“连续 6 小时”。
	return s.upsertFromExisting(ctx, existing, fixture.ID, utils.MoneylineStatusAnomaly, fixture.StateID, &next, buildAnomalyNote(since))
}

// upsertFromExisting 只改状态机推进字段，保留已有首次采集时间和累计次数。
// 这样赔率缺失、窗口外、异常等非快照路径不会误伤历史统计字段。
func (s *MoneylineService) upsertFromExisting(ctx context.Context, existing *model.MoneylineCollectionStatus, fixtureID int64, statusText string, stateID int, next *time.Time, notes string) error {
	status := mergeStatus(existing, fixtureID)
	status.Status = statusText
	status.LastStateID = intPtr(stateID)
	status.NextPollAt = next
	status.Notes = truncateNote(notes)
	return s.repo.UpsertStatus(ctx, status)
}

// deferAfterCaptureError 把失败 fixture 延后重试。
// 失败时不直接 STOPPED，是因为 SportMonks 或网络短时错误不代表比赛生命周期结束。
func (s *MoneylineService) deferAfterCaptureError(ctx context.Context, fixtureID int64, err error) {
	existing, getErr := s.repo.GetStatus(ctx, fixtureID)
	if getErr != nil {
		log.Printf("[Moneyline] 查询采集状态失败 fixture=%d err=%v", fixtureID, getErr)
		return
	}
	if existing == nil {
		return
	}
	next := s.now().Add(5 * time.Minute)
	// SportMonks 短时错误不能让 next_poll_at 停在过去，否则 runner 会在每个 tick 反复打同一场比赛。
	if upsertErr := s.upsertFromExisting(ctx, existing, fixtureID, existing.Status, valueOrZero(existing.LastStateID), &next, fmt.Sprintf("fetch error: %v", err)); upsertErr != nil {
		log.Printf("[Moneyline] 延后失败采集状态失败 fixture=%d err=%v", fixtureID, upsertErr)
	}
}

// buildMoneylineSnapshots 从 SportMonks odds 中提取 Home/Draw/Away，并计算去水后的三方归一化概率。
// 归一化使用 1/odds 的三方占比，而不是直接信任单条 probability，是为了消除 bookmaker over-round 后让折线更接近真实隐含概率走势。
func buildMoneylineSnapshots(fixture *model.APIFixture, capturedAt time.Time) ([]model.MoneylineSnapshot, bool, error) {
	type parsedOdd struct {
		value       float64
		probability float64
	}
	oddsByLabel := make(map[string]parsedOdd, 3)
	for _, odd := range fixture.Odds {
		label, ok := normalizeMoneylineLabel(odd.Label)
		if !ok || odd.MarketID != utils.MoneylineMarketID || odd.BookmakerID != utils.MoneylineBookmakerID {
			continue
		}
		value, err := parsePositiveFloat(odd.Value)
		if err != nil {
			return nil, false, fmt.Errorf("invalid moneyline odd value label=%s value=%q", label, odd.Value)
		}
		probability, err := parseProbability(odd.Probability, value)
		if err != nil {
			return nil, false, fmt.Errorf("invalid moneyline probability label=%s probability=%q", label, odd.Probability)
		}
		oddsByLabel[label] = parsedOdd{value: value, probability: probability}
	}

	labels := []string{utils.MoneylineLabelHome, utils.MoneylineLabelDraw, utils.MoneylineLabelAway}
	for _, label := range labels {
		if _, ok := oddsByLabel[label]; !ok {
			return nil, false, nil
		}
	}

	inverseTotal := 0.0
	for _, label := range labels {
		inverseTotal += 1 / oddsByLabel[label].value
	}
	if inverseTotal <= 0 {
		return nil, false, fmt.Errorf("invalid moneyline overround total")
	}

	snapshots := make([]model.MoneylineSnapshot, 0, len(labels))
	for _, label := range labels {
		odd := oddsByLabel[label]
		normalized := (1 / odd.value) / inverseTotal * 100
		snapshots = append(snapshots, model.MoneylineSnapshot{
			FixtureID:     fixture.ID,
			MarketID:      utils.MoneylineMarketID,
			BookmakerID:   utils.MoneylineBookmakerID,
			Label:         label,
			Value:         round3(odd.value),
			Probability:   round3(odd.probability),
			NormalizedPct: round3(normalized),
			StateID:       fixture.StateID,
			CapturedAt:    capturedAt,
		})
	}
	return snapshots, true, nil
}

func normalizeMoneylineLabel(label string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(label)) {
	case "home":
		return utils.MoneylineLabelHome, true
	case "draw":
		return utils.MoneylineLabelDraw, true
	case "away":
		return utils.MoneylineLabelAway, true
	default:
		return "", false
	}
}

// parseProbability 兼容 SportMonks 返回空 probability 的情况。
// 为空时用 1/odds 兜底，是为了不因为上游偶发字段缺失丢掉本来完整的三方价格快照。
func parseProbability(raw string, oddValue float64) (float64, error) {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, "%", ""))
	if raw == "" {
		return 100 / oddValue, nil
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, err
	}
	if value < 0 {
		return 0, fmt.Errorf("negative probability")
	}
	return value, nil
}

// parsePositiveFloat 对赔率做正数校验。
// Moneyline 概率归一化要做倒数运算，0 或负数会放大成错误曲线，所以在入库前直接拒绝。
func parsePositiveFloat(raw string) (float64, error) {
	value, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return 0, err
	}
	if value <= 0 {
		return 0, fmt.Errorf("non-positive decimal")
	}
	return value, nil
}

// parseSportMonksTime 同时支持普通 datetime 和 RFC3339。
// SportMonks 不同 include/locale 下时间格式可能不完全一致，统一在状态机边界做兼容，避免调用方分散处理。
func parseSportMonksTime(raw string) (time.Time, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, false
	}
	t, err := time.ParseInLocation(time.DateTime, value, time.Local)
	if err == nil {
		return t, true
	}
	t, err = time.Parse(time.RFC3339, value)
	if err == nil {
		return t, true
	}
	return time.Time{}, false
}

func mergeStatus(existing *model.MoneylineCollectionStatus, fixtureID int64) model.MoneylineCollectionStatus {
	if existing != nil {
		return *existing
	}
	return model.MoneylineCollectionStatus{
		FixtureID: fixtureID,
		Status:    utils.MoneylineStatusPending,
	}
}

func buildAnomalyNote(since time.Time) string {
	return anomalySincePrefix + since.Format(time.RFC3339)
}

func parseAnomalySince(notes string) (time.Time, bool) {
	if !strings.HasPrefix(notes, anomalySincePrefix) {
		return time.Time{}, false
	}
	t, err := time.Parse(time.RFC3339, strings.TrimPrefix(notes, anomalySincePrefix))
	return t, err == nil
}

func truncateNote(note string) string {
	note = strings.TrimSpace(note)
	if len(note) <= 512 {
		return note
	}
	return note[:512]
}

func round3(value float64) float64 {
	return math.Round(value*1000) / 1000
}

func valueOrZero(ptr *int) int {
	if ptr == nil {
		return 0
	}
	return *ptr
}
