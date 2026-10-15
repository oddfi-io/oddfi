

- **文档定位**：欧冠市场 5 分钟一轮 mock 结算活动后端实现规范——内存常量盘口表 + `ticker` 自动结算 + `rand` 随机出比分，后端拷贝 §二 数据表 + §三 伪代码即可上线

- **活动节奏**：`settle_period_sec = 300`（5 min/轮），`0–240s` 接单 / `240s` 封盘 / `300s` 结算并立即开下一轮，`loop = true` 循环复用同一批场次

- **市场归属**：挂载 `market_group = 欧冠 / UEFA Champions League`，1 场 mock 比赛（葡萄牙 vs 阿根廷），mock 阶段单场即可跑通端到端，无需多场

- **盘口覆盖**：含 `1x2`（3 档）+ `handicap` 亚洲让分（`-0.5` / `-1.0` / `-1.5` 主客两侧）+ `overunder` 亚洲总分（`1.5` / `2.5` / `3.5` 大小），共 9 条线 / 15 个下注选项，字段对齐 [[08. Match_结算_后端实现]] 

§2.1 `Bet`
- **结算策略**：第 300 秒 `rand.Intn(5)` 生成主客比分（`[0, 4]` 均匀分布，方向完全随机），循环调 `judgeBet` 写回 `Outcome{Status, Payout}`，复用 §二 现有判定逻辑零改动

- **落地路径**：内存常量 `MockMatches` → `internal/service/mock_data.go`；`StartMockSettleLoop` → `internal/service/mock_settle.go`；`cmd/server/main.go` 启动时 `go StartMockSettleLoop()`

- **硬结论**：本文档 = 5 分钟 mock 结算活动唯一真源；§二 盘口表 = 后端内存常量；§三 ticker = 后端协程


## 一、活动配置

| 字段                 | 值                             | 说明                                            |
| -------------------- | ------------------------------ | ----------------------------------------------- |
| `activity_id`        | `UCL_MOCK_5MIN`                | 活动唯一标识                                    |
| `market_group`       | `欧冠 / UEFA Champions League` | 挂载市场                                        |
| `settle_period_sec`  | `300`                          | 每 5 分钟结算一轮                               |
| `bet_open_sec`       | `0 – 240`                      | 第 0–240 秒开盘接单                             |
| `bet_close_sec`      | `240`                          | 第 240 秒封盘，拒收新注单                       |
| `settle_at_sec`      | `300`                          | 第 300 秒触发 `judgeBet`，比分随机生成          |
| `score_random_range` | `Home, Away ∈ [0, 4]`          | `rand.Intn(5)` 主客独立均匀分布                 |
| `loop`               | `true`                         | 第 300 秒结算完立即开下一轮，循环复用同一批场次 |

---

## 二、场次盘口表（写死内存常量 `MockMatches`）

### 2.0 盘口规格（共 9 条线 · 单场全出齐）

| 玩法                  |  `market`   |     盘口线 `line`      | 可能结果                                   |
| --------------------- | :---------: | :--------------------: | ------------------------------------------ |
| 胜平负 `1×2`          |    `1x2`    |           —            | 赢 / 输（`label` 三选一：`1` / `X` / `2`） |
| 让球 `Asian Handicap` | `handicap`  | `-0.5` / `-1` / `-1.5` | 赢 / 输；`-1` 整数盘可走水 `PUSH`          |
| 大小球 `Over/Under`   | `overunder` | `1.5` / `2.5` / `3.5`  | 赢 / 输                                    |

> **走水规则**：扣 10% 手续费后退还本金（退还 = `stake × 90%`），由 `judgeBet` 在让球整数线 + 分差等于盘口时自动判 `PUSH`。
> **无半赢 / 半输**：不使用四分之一线（`-0.25` / `-0.75` / `2.25` / `2.75` 等一律不挂）。

### 2.1 单场比赛盘口明细（葡萄牙 vs 阿根廷）

| `match_id` | 主队 `home` | 客队 `away` |  `market`   | `line` | `label` / `selection` | `odds` |
| :--------: | :---------: | :---------: | :---------: | :----: | :-------------------: | :----: |
|   `M001`   |   葡萄牙    |   阿根廷    |    `1x2`    |   —    |       `1` 主胜        | `2.10` |
|   `M001`   |   葡萄牙    |   阿根廷    |    `1x2`    |   —    |        `X` 平         | `3.40` |
|   `M001`   |   葡萄牙    |   阿根廷    |    `1x2`    |   —    |       `2` 客胜        | `3.20` |
|   `M001`   |   葡萄牙    |   阿根廷    | `handicap`  | `-0.5` |       `1` 主让        | `1.95` |
|   `M001`   |   葡萄牙    |   阿根廷    | `handicap`  | `-0.5` |       `2` 客受        | `1.85` |
|   `M001`   |   葡萄牙    |   阿根廷    | `handicap`  | `-1.0` |       `1` 主让        | `2.50` |
|   `M001`   |   葡萄牙    |   阿根廷    | `handicap`  | `-1.0` |       `2` 客受        | `1.55` |
|   `M001`   |   葡萄牙    |   阿根廷    | `handicap`  | `-1.5` |       `1` 主让        | `3.10` |
|   `M001`   |   葡萄牙    |   阿根廷    | `handicap`  | `-1.5` |       `2` 客受        | `1.35` |
|   `M001`   |   葡萄牙    |   阿根廷    | `overunder` | `1.5`  |       `over` 大       | `1.40` |
|   `M001`   |   葡萄牙    |   阿根廷    | `overunder` | `1.5`  |      `under` 小       | `2.85` |
|   `M001`   |   葡萄牙    |   阿根廷    | `overunder` | `2.5`  |       `over` 大       | `1.90` |
|   `M001`   |   葡萄牙    |   阿根廷    | `overunder` | `2.5`  |      `under` 小       | `1.90` |
|   `M001`   |   葡萄牙    |   阿根廷    | `overunder` | `3.5`  |       `over` 大       | `2.70` |
|   `M001`   |   葡萄牙    |   阿根廷    | `overunder` | `3.5`  |      `under` 小       | `1.45` |

> 字段语义与 [[08. Match_结算_后端实现]] §2.1 `Bet` 完全对齐：`market` ∈ `{1x2, handicap, overunder}`；`label` ∈ `{1, X, 2}`（仅 `1x2` / `handicap`）；`selection` ∈ `{over, under}`（仅 `overunder`）；`line` 让球填负值（主让），大小球填总分线；走水档（让球整数线 + 分差等于盘口）由 `judgeBet` 自动判 `PUSH`，无需 mock 表额外标注。
> 共 9 条线 = `1x2` 1 条 + `handicap` 3 条 + `overunder` 3 条 = 9；下注选项 = 3 + 3×2 + 3×2 = 15 个。

---

## 三、结算 ticker 伪代码（拷入 `internal/service/mock_settle.go`）

```go
package service

import (
	"math/rand"
	"time"
)

// Match 与盘口选项的轻量结构（字段名按既有 model 微调）
type MockMatch struct {
	ID       string
	Home     string
	Away     string
	Markets  []MockMarket
}

type MockMarket struct {
	Market    string  // "1x2" | "handicap" | "overunder"
	Line      float64 // 让球负值 / 大小球总分线，1x2 填 0
	Label     string  // "1" / "X" / "2"，仅 1x2 / handicap
	Selection string  // "over" / "under"，仅 overunder
	Odds      float64
}

// MockMatches 启动时从 §二 表硬编码加载（mock 阶段单场即可）
var MockMatches = []MockMatch{
	{ID: "M001", Home: "葡萄牙", Away: "阿根廷", Markets: []MockMarket{
		{Market: "1x2", Label: "1", Odds: 2.10},
		{Market: "1x2", Label: "X", Odds: 3.40},
		{Market: "1x2", Label: "2", Odds: 3.20},
		{Market: "handicap", Line: -0.5, Label: "1", Odds: 1.95},
		{Market: "handicap", Line: -0.5, Label: "2", Odds: 1.85},
		{Market: "handicap", Line: -1.0, Label: "1", Odds: 2.50},
		{Market: "handicap", Line: -1.0, Label: "2", Odds: 1.55},
		{Market: "handicap", Line: -1.5, Label: "1", Odds: 3.10},
		{Market: "handicap", Line: -1.5, Label: "2", Odds: 1.35},
		{Market: "overunder", Line: 1.5, Selection: "over",  Odds: 1.40},
		{Market: "overunder", Line: 1.5, Selection: "under", Odds: 2.85},
		{Market: "overunder", Line: 2.5, Selection: "over",  Odds: 1.90},
		{Market: "overunder", Line: 2.5, Selection: "under", Odds: 1.90},
		{Market: "overunder", Line: 3.5, Selection: "over",  Odds: 2.70},
		{Market: "overunder", Line: 3.5, Selection: "under", Odds: 1.45},
	}},
}

// StartMockSettleLoop 启动 5 分钟一轮的结算协程，main.go 中 go 起
func StartMockSettleLoop() {
	ticker := time.NewTicker(300 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		settleRound()
	}
}

func settleRound() {
	for _, m := range MockMatches {
		// 随机比分：主客独立 [0, 4] 均匀分布，方向完全随机
		score := Score{
			Home: rand.Intn(5),
			Away: rand.Intn(5),
		}
		// 拉该 match 本轮所有 PENDING 注单，逐一调 judgeBet
		for _, bet := range fetchPendingBets(m.ID) {
			outcome := judgeBet(bet, score) // 复用 [[08]] §2.2 主分发
			persistOutcome(bet.ID, outcome) // 写回 status / payout
		}
		recordMatchScore(m.ID, score)       // 比分留档供前端展示
	}
}
```

---

## 四、后端落地 checklist

|  #   | 步骤                                                         | 落位文件                                      |
| :--: | ------------------------------------------------------------ | --------------------------------------------- |
|  1   | 把 §二 表写成 `MockMatches` 内存常量                         | `internal/service/mock_data.go`               |
|  2   | 实现 `StartMockSettleLoop` / `settleRound`                   | `internal/service/mock_settle.go`             |
|  3   | 启动时 `go StartMockSettleLoop()` 起协程                     | `cmd/server/main.go`                          |
|  4   | `settleRound` 调 `rand.Intn(5)` 生成比分，循环 `judgeBet`    | `internal/service/mock_settle.go`             |
|  5   | `judgeBet` 输出 `Outcome{Status, Payout}` 落库               | 复用 [[08. Match_结算_后端实现]] §二 现有实现 |
|  6   | 状态机由 `bet_open_sec` / `bet_close_sec` / `settle_at_sec` 驱动：0–240s 接单，240s 封盘拒新单，300s 结算并开下一轮 | 接单层判定                                    |
|  7   | 前端拉欧冠市场列表时，把 `MockMatches` 单场（`M001`）以正常 `match` 结构返回，附当前轮剩余秒数 | 列表接口                                      |

> 上线真实赛事源后：① 替换 `MockMatches` 为接口拉取；② 删除 `rand.Intn` 改为读真实比分；③ `judgeBet` 与 `settleRound` 主体零改动。

---

## 五、代码对位

| 模块                                           | 文件                                 | 本文档章节                       |
| ---------------------------------------------- | ------------------------------------ | -------------------------------- |
| 活动配置常量                                   | `internal/service/mock_data.go`      | §一                              |
| 盘口表常量 `MockMatches`                       | `internal/service/mock_data.go`      | §二                              |
| 结算协程 `StartMockSettleLoop` / `settleRound` | `internal/service/mock_settle.go`    | §三                              |
| 启动入口 `go StartMockSettleLoop()`            | `cmd/server/main.go`                 | §四                              |
| 判定主函数 `judgeBet`                          | `internal/service/settle_service.go` | [[08. Match_结算_后端实现]] §2.2 |

---

## 六、待确认

> 暂无未决项。