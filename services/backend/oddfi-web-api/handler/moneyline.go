package handler

import (
	"math"
	"net/http"
	"oddfi-web-api/model"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const moneylineAutoMaxPrematchPoints = 100

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

// GetMoneylineHistory godoc
// @Summary 获取 Moneyline Home/Draw/Away 历史概率曲线
// @Tags market
// @Produce json
// @Param fixtureId path int true "SportMonks fixture id"
// @Param downsample query string false "auto 或 none，默认 auto"
// @Success 200 {object} model.Response
// @Router /api/v1/moneyline/history/{fixtureId} [get]
func GetMoneylineHistory(c *gin.Context) {
	if moneylineRepo == nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Msg: "moneyline repo not initialized"})
		return
	}

	fixtureID, err := strconv.ParseInt(c.Param("fixtureId"), 10, 64)
	if err != nil || fixtureID <= 0 {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "fixtureId 参数格式错误，必须为正整数"})
		return
	}

	snapshots, fixture, err := moneylineRepo.GetHistory(c.Request.Context(), fixtureID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Msg: "failed to query moneyline history"})
		return
	}

	downsampleMode := strings.ToLower(strings.TrimSpace(c.DefaultQuery("downsample", "auto")))
	history := buildMoneylineHistoryResponse(snapshots, fixture, downsampleMode)
	c.JSON(http.StatusOK, model.Response{Code: 200, Msg: "success", Data: history})
}

// buildMoneylineHistoryResponse 把数据库行按 Home/Draw/Away 拆成前端图表需要的三条序列。
// 拆分后再分别降采样，是为了保证三方曲线各自首尾点和赛中点不被另一方数据分布影响。
func buildMoneylineHistoryResponse(snapshots []model.MoneylineSnapshotDB, fixture *model.FixtureDB, downsampleMode string) model.MoneylineHistoryResponse {
	response := model.MoneylineHistoryResponse{
		Home: make([]model.MoneylineHistoryPoint, 0),
		Draw: make([]model.MoneylineHistoryPoint, 0),
		Away: make([]model.MoneylineHistoryPoint, 0),
	}
	if fixture != nil {
		response.Fixture = &model.MoneylineHistoryFixture{
			ID:         fixture.ID,
			StateID:    fixture.StateID,
			StartingAt: fixture.StartingAt.Format(time.DateTime),
		}
	}

	for _, snapshot := range snapshots {
		point := model.MoneylineHistoryPoint{
			CapturedAt:    snapshot.CapturedAt.Format(time.RFC3339Nano),
			Value:         formatDecimalOdds(snapshot.Value),
			Probability:   snapshot.Probability,
			NormalizedPct: snapshot.NormalizedPct,
			StateID:       snapshot.StateID,
		}
		switch strings.ToLower(snapshot.Label) {
		case "home":
			response.Home = append(response.Home, point)
		case "draw":
			response.Draw = append(response.Draw, point)
		case "away":
			response.Away = append(response.Away, point)
		}
	}

	if downsampleMode != "none" {
		response.Home = downsampleMoneylineAuto(response.Home)
		response.Draw = downsampleMoneylineAuto(response.Draw)
		response.Away = downsampleMoneylineAuto(response.Away)
	}
	return response
}

// downsampleMoneylineAuto 控制默认响应体大小。
// 赛前 14 天点位可能上千，默认保留最多 100 点；赛中点位数量有限且变化剧烈，因此必须全量返回。
func downsampleMoneylineAuto(points []model.MoneylineHistoryPoint) []model.MoneylineHistoryPoint {
	if len(points) <= moneylineAutoMaxPrematchPoints {
		return points
	}

	liveStart := -1
	for i, point := range points {
		if _, ok := moneylineLiveStates[point.StateID]; ok {
			liveStart = i
			break
		}
	}
	if liveStart >= 0 {
		prematch := downsampleUniform(points[:liveStart], moneylineAutoMaxPrematchPoints)
		// 赛中点位本身最多约 120 个，保留全量，避免临场/滚球阶段的概率跳变被降采样抹平。
		return append(prematch, points[liveStart:]...)
	}
	return downsampleUniform(points, moneylineAutoMaxPrematchPoints)
}

// downsampleUniform 做均匀抽样并强制保留首尾点。
// 首尾点分别代表开盘价和最新价，丢失任一端都会让前端趋势边界失真。
func downsampleUniform(points []model.MoneylineHistoryPoint, maxPoints int) []model.MoneylineHistoryPoint {
	if len(points) <= maxPoints || maxPoints <= 0 {
		return points
	}
	if maxPoints == 1 {
		return points[:1]
	}

	result := make([]model.MoneylineHistoryPoint, 0, maxPoints)
	lastIdx := -1
	step := float64(len(points)-1) / float64(maxPoints-1)
	for i := 0; i < maxPoints; i++ {
		idx := int(math.Round(float64(i) * step))
		if idx <= lastIdx {
			idx = lastIdx + 1
		}
		if idx >= len(points) {
			idx = len(points) - 1
		}
		result = append(result, points[idx])
		lastIdx = idx
	}
	// 降采样必须保留首尾点，否则 14 天曲线会丢失开盘价或最新价，前端展示的趋势边界会失真。
	result[0] = points[0]
	result[len(result)-1] = points[len(points)-1]
	return result
}

func formatDecimalOdds(value float64) string {
	raw := strconv.FormatFloat(value, 'f', 3, 64)
	raw = strings.TrimRight(raw, "0")
	if strings.HasSuffix(raw, ".") {
		return raw + "00"
	}
	if dot := strings.Index(raw, "."); dot >= 0 && len(raw)-dot-1 == 1 {
		return raw + "0"
	}
	return raw
}
