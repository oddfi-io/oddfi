本服务需要实现以下三个模块
- 结算引擎总模块
- 结算核心模块
- 风控模块

# 模块一：结算引擎模块

- **触发时机**： 结算服务 30s 轮询 `GET /v3/football/fixtures/{fixture_id}?include=scores;state`；`state_id ∈ {5, 7, 8}`（`FT` / `AET` / `FT_PEN`）进入结算， 对应 `result=final` + `action=settle`
    
- **比分提取**： `FT(5)` 取 `description=CURRENT`； `AET(7)` / `FT_PEN(8)` 取 `description=2ND_HALF`（90 分钟原始比分）； 抽出 `home_goals` / `away_goals` / `total_goals`
    
- **九条玩法判定**：
    
    - `1x2`（Home / Draw / Away）
        
    - 让球 `-0.5` / `-1` / `-1.5`
        
    - 大小球 `1.5` / `2.5` / `3.5`
        
    - 结果写 `bets.status ∈ {WON, LOST, PUSH, VOID}`
        
- **派彩公式**：
    
    - `WON = bet_amount × odds`
        
    - `PUSH = bet_amount × (1 - PushFeeRate)`（`PushFeeRate=0.10`，走水扣 10%）
        
    - `LOST = 0` · `VOID = bet_amount × 100%`
        

  

- **资金路径**：
    
    - 结算时 `Bet -= bet_amount`；
        
    - `WON` / `PUSH` / `VOID` 挂 `claimable += payout` 等用户 Claim；
        
    - `LOST` 无 claimable 动作，净减 `bet_amount`
        
    

    
    
- **硬结论**：**结算链路固定四段——判定** **`WON/LOST/PUSH/VOID`** **→ 算** **`payout`** **→ 挂** **`claimable`** **→ 用户 Claim 落入** **`Cash`****；****`LOST`** **不走 Claim，未 Claim 的 payout 仅动** **`claimable`** **不动** **`Cash`**
    

---

#  结算链路总表

一行 = 一种注单结果的完整闭环，左到右读完即通。

|   |   |   |   |   |
|---|---|---|---|---|
|**数据接口**|**判定条件**|**判定结算**|**入账**|**消费**|
|• 轮询 GET /v3/football/fixtures/{fixture_id}?include=scores;state（30s） • 进入结算：state_id ∈ {5 FT, 7 AET, 8 FT_PEN} • 比分字段：FT → description=CURRENT；AET / FT_PEN → description=2ND_HALF • 取值：H = home_goals / A = away_goals / T = H + A|• 1x2：H > A / H = A / H < A • 让球主队：H - A > handicap_line • 大小：Over T ≥ line / Under T ≤ line • 9 条详见附表|• bets.status = WON • payout = bet_amount × odds|• 单 DB 事务 • Bet -= bet_amount • claimable += bet_amount × odds • 广播 WS bet.settled|• 前端渲 Claim 按钮 • POST /v1/bet/:id/claim（幂等：WHERE claimed_at IS NULL） • claimable -= payout • cash += payout • UPDATE bets SET claimed_at=now()（status=WON 保持不变） • 写 balance_logs(reason=claim) • 广播 WS bet.claimed|
|同上|• 整数让球盘打平 • 让球 -1 且 H - A = 1|• bets.status = PUSH • payout = bet_amount × (1 - PushFeeRate) • PushFeeRate = 0.10（走水扣 10%）|• 单 DB 事务 • Bet -= bet_amount • claimable += bet_amount × 0.9 • 广播 WS bet.settled|同 WON 流程|
|同上|反条件任一命中： • 1x2 非命中方 • 让球 H - A ≤ line（非 push 区） • 大小反区间|• bets.status = LOST • payout = 0|• Bet -= bet_amount • claimable 不变 • 广播 WS bet.settled • Total 净减 bet_amount 计入平台净收入|无 Claim（LOST 无派彩）|
|异常入口（详见 09. Match_比赛状态）： • state_id ∈ {12 CANCELLED, 14 WO, 15 ABANDONED, 17 AWARDED} • 或 10/11 延期 > 48h 自动升级|• 全部注单无条件 VOID|• bets.status = VOID • payout = bet_amount × 100%|• Bet -= bet_amount • claimable += bet_amount • 广播 WS bet.settled|同 WON 流程 • cash += bet_amount|

> 账户恒等式：`Total = Bet + Cash + Claimable + Liquidity`；`WON` / `PUSH` / `VOID` Total 不变，仅 `LOST` 净减 `bet_amount`。

---

# 二、九条玩法判定（附表）

`judgeBet` 逐笔执行，主队视角；客队 `label="2"` 时 `diff` 取反为 `A - H`：

|**玩法**|**盘口线**|**WON**|**PUSH**|**LOST**|
|---|---|---|---|---|
|1x2 Home|—|H > A|—|其余|
|1x2 Draw|—|H = A|—|其余|
|1x2 Away|—|H < A|—|其余|
|让球 -0.5|-0.5|H - A > 0|不可能|H - A ≤ 0|
|让球 -1|-1|H - A > 1|H - A = 1|H - A < 1|
|让球 -1.5|-1.5|H - A > 1|不可能|H - A ≤ 1|
|大小球 1.5 Over|1.5|T ≥ 2|—|T ≤ 1|
|大小球 1.5 Under|1.5|T ≤ 1|—|T ≥ 2|
|大小球 2.5 Over|2.5|T ≥ 3|—|T ≤ 2|
|大小球 2.5 Under|2.5|T ≤ 2|—|T ≥ 3|
|大小球 3.5 Over|3.5|T ≥ 4|—|T ≤ 3|
|大小球 3.5 Under|3.5|T ≤ 3|—|T ≥ 4|

> 整数让球盘（`-1`）有走水档；半球盘（`-0.5` / `-1.5`）永不走水。
> 
> `judgeBet` 正式实现代码 + 24 条 E2E 测试用例 + Go 测试代码 + 后端适配清单详见 04. Bet_结算_后端实现规范。

---

# 三、关键接口

### 3.1 GET /v1/match/:id/state

**用途**：查询某场比赛当前状态（结算服务、前端 UI、赔率服务共用）。

**请求**

|   |   |   |   |   |
|---|---|---|---|---|
|字段|位置|类型|必填|说明|
|match_id|path|string|✅|SportMonks fixture_id|

**响应示例**

```JSON
{
  "match_id":   "18535049",
  "state_id":   7,
  "state_name": "AET",
  "result":     "final",
  "action":     "settle",
  "score":      { "home": 2, "away": 2 },
  "ot_score":   { "home": 1, "away": 0 },
  "pen_score":  null,
  "source":     "sportmonks",
  "updated_at": 1744905600000
}
```

# 代码对位

|        |                                                    |                                    |
| ------ | -------------------------------------------------- | ---------------------------------- |
| **模块** | **文件**                                             | **说明**                             |
| 轮询调度   | internal/service/settle_service.go:PollLiveMatches | 30s 轮询所有 in-play 比赛                |
| 状态分发   | internal/service/settle_service.go:handleState     | switch state_id 分流，5/7/8 进结算       |
| 比分提取   | internal/service/settle_service.go:extractScore    | FT 取 CURRENT；AET/FT_PEN 取 2ND_HALF |
| 九条判定   | internal/service/settle_service.go:judgeBet        | 1x2 / handicap / overunder 分支      |
| 派彩计算   | internal/service/settle_service.go:calcPayout      | WON × odds / PUSH × 0.9 / VOID × 1 |
| 批量结算   | internal/service/settle_service.go:settleMatch     | 单事务 Bet -= + claimable +=          |
| 枚举映射   | internal/model/match_state.go                      | state_id → result / action 常量      |


---

# 五、state_id → result / action 映射

- **解决问题**：SportMonks 官方 `24` 个 `state_id`（ID 区间 `1-22, 25-26`，`23/24` 为官方保留位）枚举过细，业务层需要统一语义
    
- **处理数据**：`state_id` → `result`（6 种：`scheduled` / `live` / `final` / `pending` / `canceled` / `void`）+ `action`（4 种：`none` / `settle` / `hold` / `refund`）归一映射表
    
- **达到效果**：客户端 / 订单 / 结算只看 `result` + `action`，不接入 SportMonks 私有枚举；未知 `state_id` 一律降级 `pending / hold`
    

SportMonks 官方 `24` 个 `state_id` 由服务端归一为 `6` 种 `result` + `4` 种 `action`；客户端只能传 `state_id + 比分`，不接受传入结果态。来源：SportMonks v3 docs `definitions/states`（核对日期 `2026-04-21`）。

|   |   |   |   |   |   |
|---|---|---|---|---|---|
|state_id|SportMonks|含义|阶段|result|action|
|1|NS|未开始|赛前|scheduled|none|
|2|INPLAY_1ST_HALF|上半场进行|赛中|live|none|
|3|HT|中场休息|赛中|live|none|
|4|BREAK|常规时间结束待加时|赛中|live|none|
|5|FT|常规结束|终局|final|settle|
|6|INPLAY_ET|加时进行|赛中|live|none|
|7|AET|加时后结束|终局|final|settle|
|8|FT_PEN|点球后结束|终局|final|settle|
|9|INPLAY_PENALTIES|点球大战进行|赛中|live|none|
|10|POSTPONED|延期|异常|pending|hold|
|11|SUSPENDED|暂停|异常|pending|hold|
|12|CANCELLED|取消|异常|canceled|refund|
|13|TBA|时间未定|赛前|scheduled|none|
|14|WO|弃权|异常|void|refund|
|15|ABANDONED|中止|异常|void|refund|
|16|DELAYED|开球延迟|异常|pending|hold|
|17|AWARDED|判定|异常|void|refund|
|18|INTERRUPTED|临时中断（天气等）|异常|pending|hold|
|19|AWAITING_UPDATES|数据延迟|异常|pending|hold|
|20|DELETED|已删除|异常|void|refund|
|21|EXTRA_TIME_BREAK|加时半场休息|赛中|live|none|
|22|INPLAY_2ND_HALF|下半场进行|赛中|live|none|
|25|PEN_BREAK|等待点球大战开始|赛中|live|none|
|26|PENDING|等待数据更新验证|异常|pending|hold|

> **保留位处理**：`state_id ∈ {23, 24}` 为 SportMonks 官方保留位（文档直接跳号未分配），生产环境若命中视为未知枚举，降级 `pending / hold` 并推运营告警，走本文 §二 第 `6` 行 `状态卡死` 分支。
> 
> **结算入口**：仅 `{5 FT, 7 AET, 8 FT_PEN}` 触发 `action=settle`，详见 08. Match_结算_PRD。
> 
> **VOID 全退入口**：`{12 CANCELLED, 14 WO, 15 ABANDONED, 17 AWARDED, 20 DELETED}` 五态触发 `action=refund`，全部注单无条件 VOID。
> 
> **历史映射勘误**：旧版（`_v1`）误将 `state_id=4` 标为 `INPLAY_2ND_HALF`——官方 `4` 是 `BREAK`（常规时间结束），`22` 才是 `INPLAY_2ND_HALF`；后端 `internal/service/settle_service.go:handleState` 的 switch 分支须以本表为准重新核对。


# 模块2：结算逻辑模块

> 关联：结算引擎模块

---

**概述**：

- **文档定位**：结算服务后端实现规范——`judgeBet` 全量判定逻辑 Go 代码 + `24` 条 E2E 测试用例 + `settle_service_test.go` 代码，后端照搬即可落地
    
- **判定三分支**：`1x2` · `handicap`（让球）· `overunder`（大小球），`judgeBet` 按 `bet.market` 分发到三个子函数
    
- **参数对齐**：`Bet`（`Label` / `Market` / `HandicapLine` / `Selection` / `BetAmount` / `Odds`）· `Score`（`Home` / `Away`）· `Outcome`（`Status` / `Payout`）· `PushFeeRate = 0.10`
    
- **E2E 覆盖**：客队 9 + 主队 9 + 大小球 6 = `24` 条用例，MECE 覆盖 `WON` / `PUSH` / `LOST` 全分支，走水档 `PUSH = 90`
    
- **落地路径**：正式实现 → `internal/service/settle_service.go`（§二）；测试 → `internal/service/settle_service_test.go`（§三）；拷贝即用，字段名按实际 model 微调
    
- **CI 红线**：`go test ./internal/service/... -run TestJudgeBet -v` 必须全绿，`judgeBet` 函数覆盖率 `≥ 95%`
    
- **硬结论**：**本文档 =** **`settle_service.go`** **判定逻辑的唯一真源；任何分支改动必须同步 §二 实现 + §一 用例 + §三 测试三处，三者不一致的 PR 不得合并**
    

---

## 2.1、24 条 E2E 测试用例

统一前置：`bet_amount = 100`，`PushFeeRate = 0.10`，`payout` 公式 `WON = bet × odds` / `PUSH = bet × 0.9` / `LOST = 0`。

### 1.1 客队 `label="2"` 分支（9 条，`diff = A - H`）

|   |   |   |   |   |   |   |   |   |
|---|---|---|---|---|---|---|---|---|
|**#**|**用例**|**盘口**|**label**|**H**|**A**|**diff**|**status**|**payout**|
|1|1x2 客胜命中|—|2|1|2|1|WON|100 × odds|
|2|1x2 客胜未命中|—|2|2|1|−1|LOST|0|
|3|让球 -0.5 命中|-0.5|2|1|2|1|WON|100 × odds|
|4|让球 -0.5 未命中|-0.5|2|2|2|0|LOST|0|
|5|让球 -1 命中|-1|2|0|2|2|WON|100 × odds|
|6|让球 -1 走水|-1|2|1|2|1|PUSH|90|
|7|让球 -1 未命中|-1|2|2|2|0|LOST|0|
|8|让球 -1.5 命中|-1.5|2|0|2|2|WON|100 × odds|
|9|让球 -1.5 未命中|-1.5|2|1|2|1|LOST|0|

### 1.2 主队 `label="1"` 分支（9 条，`diff = H - A`）

|   |   |   |   |   |   |   |   |   |
|---|---|---|---|---|---|---|---|---|
|**#**|**用例**|**盘口**|**label**|**H**|**A**|**diff**|**status**|**payout**|
|10|1x2 主胜命中|—|1|2|1|1|WON|100 × odds|
|11|1x2 主胜未命中|—|1|1|2|−1|LOST|0|
|12|让球 -0.5 命中|-0.5|1|2|1|1|WON|100 × odds|
|13|让球 -0.5 未命中|-0.5|1|2|2|0|LOST|0|
|14|让球 -1 命中|-1|1|2|0|2|WON|100 × odds|
|15|让球 -1 走水|-1|1|2|1|1|PUSH|90|
|16|让球 -1 未命中|-1|1|2|2|0|LOST|0|
|17|让球 -1.5 命中|-1.5|1|2|0|2|WON|100 × odds|
|18|让球 -1.5 未命中|-1.5|1|2|1|1|LOST|0|

### 1.3 大小球分支（6 条，仅依赖 `T = H + A`）

|   |   |   |   |   |   |   |   |   |
|---|---|---|---|---|---|---|---|---|
|**#**|**用例**|**盘口**|**方向**|**H**|**A**|**T**|**status**|**payout**|
|19|大 1.5 命中|1.5|over|1|1|2|WON|100 × odds|
|20|大 1.5 未命中|1.5|over|0|1|1|LOST|0|
|21|小 2.5 命中|2.5|under|1|1|2|WON|100 × odds|
|22|小 2.5 未命中|2.5|under|2|1|3|LOST|0|
|23|大 3.5 命中|3.5|over|2|2|4|WON|100 × odds|
|24|大 3.5 未命中|3.5|over|1|2|3|LOST|0|

> 覆盖原则：每条判定规则（`WON` / `PUSH` / `LOST`）至少 1 命中 + 1 反例；整数让球盘额外覆盖 `PUSH` 走水档；大小球无 `label` 维度，不做主客镜像。

---

## 2.2、Go 正式实现代码

拷入后端仓 `internal/service/settle_service.go` + `internal/model/bet.go`。核心 `judgeBet` 按 `market` 分发到三个子函数，全部纯函数，无 DB / 无副作用，方便单测。

### 2.1 数据结构与常量

```Go
package service

import "math"

const PushFeeRate = 0.10

type BetStatus string

const (
        StatusWon  BetStatus = "WON"
        StatusLost BetStatus = "LOST"
        StatusPush BetStatus = "PUSH"
        StatusVoid BetStatus = "VOID"
)

type Bet struct {
        ID           string
        MatchID      string
        UserID       string
        Label        string  // "1" 主队 / "2" 客队 / "X" 平（仅 1x2）
        Market       string  // "1x2" | "handicap" | "overunder"
        HandicapLine float64 // 让球盘口线（负数，如 -0.5 / -1 / -1.5）或大小球盘口线（1.5 / 2.5 / 3.5）
        Selection    string  // "over" | "under"（仅 overunder）
        BetAmount    float64
        Odds         float64
}

type Score struct {
        Home int
        Away int
}

type Outcome struct {
        Status BetStatus
        Payout float64
}
```

### 2.2 `judgeBet` 主分发

```Go
func judgeBet(b Bet, s Score) Outcome {
        switch b.Market {
        case "1x2":
                return judge1x2(b, s)
        case "handicap":
                return judgeHandicap(b, s)
        case "overunder":
                return judgeOverUnder(b, s)
        default:
                return Outcome{Status: StatusVoid, Payout: b.BetAmount}
        }
}
```

### 2.3 `1x2` 判定（Home / Draw / Away）

```Go
func judge1x2(b Bet, s Score) Outcome {
        var won bool
        switch b.Label {
        case "1":
                won = s.Home > s.Away
        case "X":
                won = s.Home == s.Away
        case "2":
                won = s.Home < s.Away
        }
        if won {
                return Outcome{Status: StatusWon, Payout: b.BetAmount * b.Odds}
        }
        return Outcome{Status: StatusLost, Payout: 0}
}
```

### 2.4 让球判定（`-0.5` / `-1` / `-1.5` 三档）

```Go
func judgeHandicap(b Bet, s Score) Outcome {
        var diff int
        if b.Label == "1" {
                diff = s.Home - s.Away
        } else { // "2"
                diff = s.Away - s.Home
        }
        threshold := -b.HandicapLine
        isInteger := b.HandicapLine == math.Floor(b.HandicapLine)

        switch {
        case float64(diff) > threshold:
                return Outcome{Status: StatusWon, Payout: b.BetAmount * b.Odds}
        case isInteger && float64(diff) == threshold:
                return Outcome{Status: StatusPush, Payout: b.BetAmount * (1 - PushFeeRate)}
        default:
                return Outcome{Status: StatusLost, Payout: 0}
        }
}
```

### 2.5 大小球判定（`over` / `under`）

```Go
func judgeOverUnder(b Bet, s Score) Outcome {
        total := float64(s.Home + s.Away)
        var won bool
        switch b.Selection {
        case "over":
                won = total > b.HandicapLine
        case "under":
                won = total < b.HandicapLine
        }
        if won {
                return Outcome{Status: StatusWon, Payout: b.BetAmount * b.Odds}
        }
        return Outcome{Status: StatusLost, Payout: 0}
}
```

### 2.6 `calcPayout` 独立版（可选，用于 VOID 等旁路）

```Go
func calcPayout(bet, odds float64, status BetStatus) float64 {
        switch status {
        case StatusWon:
                return bet * odds
        case StatusPush:
                return bet * (1 - PushFeeRate)
        case StatusVoid:
                return bet
        default: // StatusLost
                return 0
        }
}
```

> `judgeBet` 已内联派彩计算；`calcPayout` 独立导出仅供异常流程（`state_id ∈ {12 CANCELLED, 14 WO, 15 ABANDONED, 17 AWARDED, 20 DELETED}` 五态 VOID 全单退款，或 `{10, 11, 16, 18, 19, 26}` 滞留 `> 48h` 运营 `override` 升级 VOID）调用，避免重复硬编码 `0.10`。完整 `state_id → result / action` 归一表见 09. Match_异常处理与并发一致性 §一。

---

## 2.3、Go 测试代码

拷入后端仓 `internal/service/settle_service_test.go`。三个 `Test*` 函数拼在同一文件即可。

### 3.1 客队 `label="2"` 测试（Case 1–9）

```Go
func TestJudgeBet_AwayLabel(t *testing.T) {
        tests := []struct {
                name       string
                bet        Bet
                score      Score
                wantStatus BetStatus
                wantPayout float64
        }{
                {"1x2 客胜命中",      Bet{Label: "2", Market: "1x2",      BetAmount: 100, Odds: 2.0}, Score{1, 2}, StatusWon,  200},
                {"1x2 客胜未命中",    Bet{Label: "2", Market: "1x2",      BetAmount: 100, Odds: 2.0}, Score{2, 1}, StatusLost, 0},
                {"让球 -0.5 命中",    Bet{Label: "2", Market: "handicap", HandicapLine: -0.5, BetAmount: 100, Odds: 1.9}, Score{1, 2}, StatusWon,  190},
                {"让球 -0.5 未命中",  Bet{Label: "2", Market: "handicap", HandicapLine: -0.5, BetAmount: 100, Odds: 1.9}, Score{2, 2}, StatusLost, 0},
                {"让球 -1 命中",      Bet{Label: "2", Market: "handicap", HandicapLine: -1.0, BetAmount: 100, Odds: 2.1}, Score{0, 2}, StatusWon,  210},
                {"让球 -1 走水",      Bet{Label: "2", Market: "handicap", HandicapLine: -1.0, BetAmount: 100, Odds: 2.1}, Score{1, 2}, StatusPush, 90},
                {"让球 -1 未命中",    Bet{Label: "2", Market: "handicap", HandicapLine: -1.0, BetAmount: 100, Odds: 2.1}, Score{2, 2}, StatusLost, 0},
                {"让球 -1.5 命中",    Bet{Label: "2", Market: "handicap", HandicapLine: -1.5, BetAmount: 100, Odds: 2.5}, Score{0, 2}, StatusWon,  250},
                {"让球 -1.5 未命中",  Bet{Label: "2", Market: "handicap", HandicapLine: -1.5, BetAmount: 100, Odds: 2.5}, Score{1, 2}, StatusLost, 0},
        }

        for _, tt := range tests {
                t.Run(tt.name, func(t *testing.T) {
                        got := judgeBet(tt.bet, tt.score)
                        if got.Status != tt.wantStatus {
                                t.Errorf("status: got %v, want %v", got.Status, tt.wantStatus)
                        }
                        if got.Payout != tt.wantPayout {
                                t.Errorf("payout: got %.2f, want %.2f", got.Payout, tt.wantPayout)
                        }
                })
        }
}
```

### 3.2 主队 `label="1"` 测试（Case 10–18）

```Go
func TestJudgeBet_HomeLabel(t *testing.T) {
        tests := []struct {
                name       string
                bet        Bet
                score      Score
                wantStatus BetStatus
                wantPayout float64
        }{
                {"1x2 主胜命中",      Bet{Label: "1", Market: "1x2",      BetAmount: 100, Odds: 2.0}, Score{2, 1}, StatusWon,  200},
                {"1x2 主胜未命中",    Bet{Label: "1", Market: "1x2",      BetAmount: 100, Odds: 2.0}, Score{1, 2}, StatusLost, 0},
                {"让球 -0.5 命中",    Bet{Label: "1", Market: "handicap", HandicapLine: -0.5, BetAmount: 100, Odds: 1.9}, Score{2, 1}, StatusWon,  190},
                {"让球 -0.5 未命中",  Bet{Label: "1", Market: "handicap", HandicapLine: -0.5, BetAmount: 100, Odds: 1.9}, Score{2, 2}, StatusLost, 0},
                {"让球 -1 命中",      Bet{Label: "1", Market: "handicap", HandicapLine: -1.0, BetAmount: 100, Odds: 2.1}, Score{2, 0}, StatusWon,  210},
                {"让球 -1 走水",      Bet{Label: "1", Market: "handicap", HandicapLine: -1.0, BetAmount: 100, Odds: 2.1}, Score{2, 1}, StatusPush, 90},
                {"让球 -1 未命中",    Bet{Label: "1", Market: "handicap", HandicapLine: -1.0, BetAmount: 100, Odds: 2.1}, Score{2, 2}, StatusLost, 0},
                {"让球 -1.5 命中",    Bet{Label: "1", Market: "handicap", HandicapLine: -1.5, BetAmount: 100, Odds: 2.5}, Score{2, 0}, StatusWon,  250},
                {"让球 -1.5 未命中",  Bet{Label: "1", Market: "handicap", HandicapLine: -1.5, BetAmount: 100, Odds: 2.5}, Score{2, 1}, StatusLost, 0},
        }

        for _, tt := range tests {
                t.Run(tt.name, func(t *testing.T) {
                        got := judgeBet(tt.bet, tt.score)
                        if got.Status != tt.wantStatus {
                                t.Errorf("status: got %v, want %v", got.Status, tt.wantStatus)
                        }
                        if got.Payout != tt.wantPayout {
                                t.Errorf("payout: got %.2f, want %.2f", got.Payout, tt.wantPayout)
                        }
                })
        }
}
```

### 3.3 大小球测试（Case 19–24）

```Go
func TestJudgeBet_OverUnder(t *testing.T) {
        tests := []struct {
                name       string
                bet        Bet
                score      Score
                wantStatus BetStatus
                wantPayout float64
        }{
                {"大 1.5 命中",   Bet{Market: "overunder", HandicapLine: 1.5, Selection: "over",  BetAmount: 100, Odds: 1.8}, Score{1, 1}, StatusWon,  180},
                {"大 1.5 未命中", Bet{Market: "overunder", HandicapLine: 1.5, Selection: "over",  BetAmount: 100, Odds: 1.8}, Score{0, 1}, StatusLost, 0},
                {"小 2.5 命中",   Bet{Market: "overunder", HandicapLine: 2.5, Selection: "under", BetAmount: 100, Odds: 1.9}, Score{1, 1}, StatusWon,  190},
                {"小 2.5 未命中", Bet{Market: "overunder", HandicapLine: 2.5, Selection: "under", BetAmount: 100, Odds: 1.9}, Score{2, 1}, StatusLost, 0},
                {"大 3.5 命中",   Bet{Market: "overunder", HandicapLine: 3.5, Selection: "over",  BetAmount: 100, Odds: 2.2}, Score{2, 2}, StatusWon,  220},
                {"大 3.5 未命中", Bet{Market: "overunder", HandicapLine: 3.5, Selection: "over",  BetAmount: 100, Odds: 2.2}, Score{1, 2}, StatusLost, 0},
        }

        for _, tt := range tests {
                t.Run(tt.name, func(t *testing.T) {
                        got := judgeBet(tt.bet, tt.score)
                        if got.Status != tt.wantStatus {
                                t.Errorf("status: got %v, want %v", got.Status, tt.wantStatus)
                        }
                        if got.Payout != tt.wantPayout {
                                t.Errorf("payout: got %.2f, want %.2f", got.Payout, tt.wantPayout)
                        }
                })
        }
}
```

---

## 2.4、后端适配与执行

### 4.1 类型 / 常量落位清单

|**符号**|**定义位置**|**落位文件**|
|---|---|---|
|Bet / Score / Outcome|§2.1|internal/model/bet.go|
|BetStatus 枚举|§2.1|internal/model/bet_status.go|
|PushFeeRate = 0.10|§2.1|internal/service/settle_service.go 包级常量|
|judgeBet / judge1x2 / judgeHandicap / judgeOverUnder|§2.2–§2.5|internal/service/settle_service.go|
|calcPayout（VOID 旁路）|§2.6|internal/service/settle_service.go|
|TestJudgeBet_*|§三|internal/service/settle_service_test.go|

> 字段名与后端既有 model 冲突时，按既有命名全局 sed 替换即可，逻辑不变。

### 4.2 执行命令

```Bash
# 全量跑测试
go test ./internal/service/... -run TestJudgeBet -v

# 单测某一类
go test ./internal/service/... -run TestJudgeBet_AwayLabel -v

# 覆盖率
go test ./internal/service/... -run TestJudgeBet -cover
```

### 4.3 CI 红线

|**检查项**|**阈值**|
|---|---|
|TestJudgeBet_* 全绿|失败直接阻断合并|
|judgeBet 函数覆盖率|≥ 95%|
|新增盘口 / 新玩法|必须同步 §一 用例 + §二 实现 + §三 测试三处|

---

## 2.6、代码对位

|   |   |   |
|---|---|---|
|**模块**|**文件**|**本文档章节**|
|判定主函数|internal/service/settle_service.go:judgeBet|§2.2|
|1x2 子分支|internal/service/settle_service.go:judge1x2|§2.3|
|让球子分支|internal/service/settle_service.go:judgeHandicap|§2.4|
|大小球子分支|internal/service/settle_service.go:judgeOverUnder|§2.5|
|派彩计算|internal/service/settle_service.go:calcPayout|§2.6|
|注单结构体|internal/model/bet.go:Bet|§2.1|
|状态枚举|internal/model/bet_status.go|§2.1|
|测试文件|internal/service/settle_service_test.go|§三|

---

## 模块3：风控模块

- **范围**：业务层（异常识别 + 处置决策 + 资金落地）+ 技术层（并发一致性 + `resettle` 时序 + 失败恢复），合并原 09 数据监控与原 10 Resettle 并发一致性
    
- **六列闭环动线**：`怎么发现` → `监控逻辑` → `异常场景` → `自动化方案 + 机制优先级` → `人工方案` → `兜底方案`，`8` 行业务场景一行一闭环贯穿 MECE 四类异常
    
- **MECE 四类异常**：`状态异常`（`state_id ∈ {10,11,12,16,18,19,26}` 延期 / 暂停 / 取消 / 延迟 / 临时中断 / 数据延迟 / 待验证）· `比分 / 判决异常`（双源比对 / 官方更正 / `{14,15,17,20}` disputed / 已删除）· `数据层异常`（双源失联 / `{23,24}` 保留位未知枚举 / 同值滞留 `> 30min`）· `结算后追溯`（官方改判 / 单笔争议）