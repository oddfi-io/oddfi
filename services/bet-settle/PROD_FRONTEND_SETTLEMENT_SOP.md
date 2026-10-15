# 线上下注结算前端测试验收 SOP

本文档面向测试前端同学，用于在正式页面完整验证一次「选比赛 -> 下注 -> 等待完赛 -> 自动结算 -> 页面和资金展示」链路。

前提假设：已按 [PROD_RUNBOOK.md](./PROD_RUNBOOK.md) 完成后端、spider、数据库、worker、资金字段和线上配置准备。`oddfi-bet-settle` 本身不提供页面和 HTTP API；测试入口是正式前端页面，接口由 `web-api` 承接，结算由后台 worker 轮询数据库完成。

文档里的“今天、今晚、明天”均指测试执行当天和次日；记录时间时优先写页面展示时区，同时补充北京时间，避免跨时区赛事排查时对不上数据库时间。

## 1. 测试目标

本 SOP 要验收 4 件事：

1. 前端正式页面能选到今天正在比赛，或未来 36 小时内预计会结束的真实赛事并成功下注。
2. 下注后，注单能进入未结状态，用户资金从可用余额进入投注锁定余额。
3. 赛事完赛或退款态落库后，worker 能把注单结算为 `WON / LOST / PUSH / VOID`。
4. 页面、注单表、赛果结算状态、用户资金承接账户能互相对齐。

## 2. 角色分工

测试前端同学负责：

- 使用线上测试账号登录正式页面。
- 选择赛事、点击赔率、提交下注。
- 保存下注前后截图、注单号、赛事信息、页面展示金额。
- 等待比赛结束后复查页面状态。
- 记录异常现象和复现路径。

后端或运维同学负责协助：

- 确认测试账号资金和权限可用。
- 必要时执行 SQL 查询下注、赛果和资金状态。
- 查看 `oddfi-bet-settle` worker 日志和 `oddfi_fixture_results.remark`。
- 判断异常属于前端展示、`web-api`、spider 采集、worker 结算还是资金数据问题。

## 3. 测试账号和资金准备

使用测试专用账号，不使用真实用户账号。

测试前确认：

- 账号可以登录正式页面。
- 账号有足够可用余额，建议每笔只下最小金额。
- 账号最好只有一个币种或一条可扣余额行，避免当前注单表缺少 `coin_symbol` 导致结算时无法判断扣哪条余额。
- 页面能看到余额、未结注单、已结注单、可领取金额或等价展示。
- 如页面有 Claim 功能，本 SOP 只覆盖结算到账到 `claimable_balance`，Claim 是否把可领取转入可用余额属于另一个验收点。

下注前记录一张截图或表格：

| 项目 | 记录值 |
| --- | --- |
| 测试账号 user_id / 钱包地址 |  |
| 页面可用余额 |  |
| 页面投注锁定金额 |  |
| 页面可领取金额 |  |
| 测试开始时间 |  |

如果测试同学没有 `user_id`，可以记录登录手机号、邮箱、钱包地址或页面账号 ID，由后端同学映射到数据库 `user_id`。

## 4. 指定用户灰度测试模式

如果线上还残留旧测试注单，或正式上线前只想跑通一个新注册用户的完整链路，可以让 `oddfi-bet-settle` 只结算指定 `user_id` 的注单。

适用场景：

- 新注册一个网站用户和新钱包。
- 该用户上线前没有任何下注记录。
- 只验证这个用户从下注到结算的链路。
- 暂时不处理其他用户或旧测试注单。

### 4.1 配置指定用户

后端或运维同学修改镜像构建时使用的生产配置 `config/config_prod.yaml`：

```yaml
settlement:
  user_id: 204xxxxxxxxxxxxxxx
```

说明：

- `settlement.user_id` 必须填新注册测试用户的数据库 `user_id`。
- `user_id: 0` 表示不限制用户，worker 会按原逻辑扫描所有 `PENDING / live` 注单。
- 线上单用户灰度期间不要保留 `0`，否则旧测试注单仍可能被 worker 扫到。
- 修改配置后必须重新构建并重启 `oddfi-bet-settle` worker；当前 Docker 镜像会把 `config/` 目录打包进去，运行时不会再从宿主机挂载覆盖配置。

重启后日志应出现类似：

```text
[settlement] scoped to user_id=204xxxxxxxxxxxxxxx
```

如果没有这行日志，先不要下注测试，说明 worker 可能没有读取到新的配置文件。

### 4.2 指定用户下注前核对

确认这个用户没有历史下注：

```sql
SELECT id, user_id, odd_id, status, stake, odds, created_at
FROM user_bet_holding
WHERE user_id = <TEST_USER_ID>
ORDER BY id DESC
LIMIT 20;
```

期望：0 行。

确认这个用户有且只有一条可用于下注结算的余额行：

```sql
SELECT
  id AS balance_id,
  user_id,
  coin_symbol,
  available_balance,
  bet_lock_balance,
  claimable_balance,
  update_time
FROM user_balance
WHERE user_id = <TEST_USER_ID>
ORDER BY id;
```

期望：

- 有一条余额行。
- `available_balance` 足够下注。
- `bet_lock_balance` 初始为 0，或能明确解释已有锁定来源。
- 不存在多条都可能被结算 worker 扣减的余额行。

### 4.3 指定用户下注后核对

下注成功后，只看这个用户的候选数据：

```sql
SELECT
  b.id AS bet_id,
  b.user_id,
  b.odd_id,
  b.status AS bet_status,
  b.market,
  b.label,
  b.handicap_line,
  b.stake,
  b.odds,
  o.fixture_id,
  fr.state_id,
  fr.state_code,
  fr.home_score_full,
  fr.away_score_full,
  fr.settlement_status,
  fr.remark,
  ub.id AS balance_id,
  ub.bet_lock_balance,
  ub.claimable_balance
FROM user_bet_holding AS b
JOIN oddfi_odds AS o ON o.odd_id = b.odd_id
JOIN oddfi_fixture_results AS fr ON fr.fixture_id = o.fixture_id
LEFT JOIN user_balance AS ub ON ub.user_id = b.user_id
WHERE b.user_id = <TEST_USER_ID>
  AND b.status IN ('PENDING', 'live')
ORDER BY fr.updated_at DESC, b.id DESC;
```

期望：

- 只出现新注册测试用户的注单。
- `market / label / handicap_line / stake / odds` 都完整。
- `odd_id -> fixture_id -> fixture_results` 链路能连上。

### 4.4 确认其他用户不会被本轮 worker 结算

单用户灰度期间，worker 的代码会在两个位置过滤 `user_id`：

- 候选赛事查询：只把指定用户的未结注单拉入本轮候选。
- 同场锁单结算：即使同一个 `fixture_id` 下还有其他用户注单，也只锁定和更新指定用户。

可以用下面 SQL 观察是否还有其他用户旧单，但这些旧单不应在本轮 worker 中被处理：

```sql
SELECT id, user_id, odd_id, status, stake, odds, market, label, created_at
FROM user_bet_holding
WHERE user_id <> <TEST_USER_ID>
  AND status IN ('PENDING', 'live')
ORDER BY created_at DESC
LIMIT 100;
```

注意：`oddfi_fixture_results.settlement_status` 是赛事级字段，不是用户级字段。单用户灰度模式下，最终是否通过应优先看指定用户的 `user_bet_holding.status / actual_payout` 和 `user_balance.bet_lock_balance / claimable_balance`，不要只看赛事级 `settlement_status`。

### 4.5 灰度结束后的动作

单用户测试通过后有两种选择：

1. 继续保留 `settlement.user_id=<TEST_USER_ID>`，只反复验证这个测试用户。
2. 正式全量前先清理旧测试注单，再把 `settlement.user_id` 改回 `0`，重启 worker，让它处理所有用户。

不要在旧测试注单还没清理时直接改回 `0`。

## 5. 选择测试赛事

优先选择「今天正在比赛」且仍然允许下注的足球赛事；如果没有合适的 live 赛事，选择今晚或明天开赛、预计未来 36 小时内结束的赛事。

页面选择路径按实际产品命名执行，通常是：

1. 打开正式前端页面。
2. 登录测试账号。
3. 进入 `Sports / Football / Soccer`。
4. 优先点 `Live / In Play / 滚球 / 进行中`。
5. 如果没有可下注 live 赛事，切到 `Today / 今日` 或 `Upcoming / 即将开始`。
6. 选择一场预计今晚或明天会结束的赛事。

选择标准：

- 赛事必须有可点击赔率。
- 优先选 `Fulltime Result / 1X2 / 胜平负`，因为页面和结算结果最容易人工核对。
- 其次可补充 `Asian Handicap / 让球`、`Over Under / 大小球`。
- 不要选择页面已经显示 `Suspended / Stopped / Closed / 封盘` 的盘口。
- 不要选择距离页面封盘只剩几秒的盘口，避免提交下注时赔率失效。
- 不要选择测试同学不确定规则的特殊玩法，本 worker 当前只可靠处理 `1x2`、`asian_handicap`、`asian_over_under`。

记录赛事信息：

| 项目 | 记录值 |
| --- | --- |
| 赛事名称 |  |
| 联赛 |  |
| 页面开赛时间 |  |
| 页面当前状态 |  |
| 选择的玩法 |  |
| 选择的投注项 |  |
| 页面赔率 |  |
| 页面链接或 fixture_id |  |

如果页面没有展示 `fixture_id`，后端可以用下面 SQL 辅助找候选赛事：

```sql
SELECT
  f.id AS fixture_id,
  f.name,
  f.starting_at,
  f.state_id AS fixture_state_id,
  fr.state_id AS result_state_id,
  fr.state_code,
  fr.settlement_status,
  COUNT(o.odd_id) AS odds_count
FROM oddfi_fixtures AS f
JOIN oddfi_fixture_results AS fr ON fr.fixture_id = f.id
JOIN oddfi_odds AS o ON o.fixture_id = f.id
WHERE f.starting_at BETWEEN NOW() - INTERVAL 4 HOUR AND NOW() + INTERVAL 36 HOUR
  AND o.stopped = 0
GROUP BY f.id, f.name, f.starting_at, f.state_id, fr.state_id, fr.state_code, fr.settlement_status
ORDER BY f.starting_at ASC
LIMIT 50;
```

## 6. 正式页面下注步骤

按真实用户路径操作，不直接改数据库造单。

1. 打开目标赛事详情页。
2. 选择一个简单盘口，推荐先选 `Fulltime Result / 1X2 / 胜平负`。
3. 点击赔率按钮，让投注项进入 bet slip。
4. 输入最小测试下注金额。
5. 核对 bet slip 中的赛事、玩法、投注项、赔率、下注金额、预计派彩。
6. 点击 `Place Bet / Submit / Confirm / 确认下注`。
7. 等待页面返回下注成功。
8. 进入 `My Bets / Open Bets / 未结注单`，确认刚才的注单存在。

下注成功后必须记录：

| 项目 | 记录值 |
| --- | --- |
| 注单号 / bet_id / order_id |  |
| 下注时间 |  |
| odd_id 或页面盘口 ID |  |
| market |  |
| label / selection |  |
| handicap line / total line |  |
| stake |  |
| odds |  |
| estimated payout |  |
| 页面注单状态 |  |

下注成功后的页面预期：

- 注单出现在未结注单列表。
- 状态通常是 `PENDING`、`live`、`Open`、`Unsettled` 或页面等价文案。
- 页面可用余额应减少。
- 页面投注锁定金额或未结投注金额应增加。
- 预计派彩只代表下注时预估，不等于最终 `actual_payout`。

## 7. 下注后数据库核对

如测试同学没有数据库权限，把注单号、账号、赛事名称和下注时间发给后端同学执行。

用注单号核对单笔下注：

```sql
SELECT
  b.id AS bet_id,
  b.user_id,
  b.odd_id,
  b.status AS bet_status,
  b.market,
  b.label,
  b.handicap_line,
  b.stake,
  b.odds,
  b.payout AS estimated_payout,
  b.actual_payout,
  b.created_at,
  b.updated_at,
  o.fixture_id,
  o.market_id,
  o.label AS odd_label,
  o.handicap,
  o.total,
  o.selection,
  fr.state_id,
  fr.state_code,
  fr.state_name,
  fr.home_score_full,
  fr.away_score_full,
  fr.settlement_status,
  fr.remark
FROM user_bet_holding AS b
JOIN oddfi_odds AS o ON o.odd_id = b.odd_id
LEFT JOIN oddfi_fixture_results AS fr ON fr.fixture_id = o.fixture_id
WHERE b.id = <BET_ID>;
```

下注后未完赛时的预期：

- `b.status IN ('PENDING', 'live')`
- `b.stake` 等于页面下注金额。
- `b.odds` 等于下注时赔率快照。
- `o.fixture_id` 能关联到 `oddfi_fixture_results.fixture_id`。
- 如果赛事仍未终局，`fr.settlement_status` 可以仍是 `PENDING`。

核对用户资金：

```sql
SELECT
  user_id,
  coin_symbol,
  available_balance,
  bet_lock_balance,
  claimable_balance,
  update_time
FROM user_balance
WHERE user_id = <USER_ID>;
```

下注后资金预期：

- `bet_lock_balance` 至少包含本次下注金额。
- `claimable_balance` 此时不应因为这笔注单增加。
- 如果页面展示和数据库金额有差异，先确认页面是否有缓存、汇率换算、精度截断或多币种聚合。

## 8. 等待完赛和结算

测试同学需要等到目标赛事进入终局或退款态。

正常触发结算的赛事状态：

| state_id | code | 含义 | worker 动作 |
| --- | --- | --- | --- |
| 5 | FT | 常规终场 | 正常结算 |
| 7 | AET | 加时结束 | 正常结算 |
| 8 | FT_PEN | 点球结束 | 正常结算 |

触发全单退款的赛事状态：

| state_id | code | 含义 | worker 动作 |
| --- | --- | --- | --- |
| 12 | CANCELLED | 取消 | VOID 退款 |
| 14 | WO | Walkover | VOID 退款 |
| 15 | ABANDONED | 腰斩 | VOID 退款 |
| 17 | AWARDED | 官方判定 | VOID 退款 |
| 20 | DELETED | 数据源删除 | VOID 退款 |

不会推进资金的状态：

- 未开赛、进行中、半场、加时中、点球中。
- 延期、暂停、等待更新、延迟开赛。
- 未知状态。

等待建议：

- 页面或官方数据源显示 `FT / AET / FT_PEN` 后，不要立刻判失败。
- spider 需要先把赛果写入 `oddfi_fixture_results`。
- worker 是后台轮询，当前代码每 30 秒检查一次候选赛事。
- 正常情况下给 1 到 5 分钟缓冲；超过 10 分钟仍未结算再进入异常排查。

## 9. 页面验收结算结果

比赛结束后刷新页面并检查：

1. 注单是否从 `Open Bets / 未结注单` 移到 `Settled Bets / 已结注单`。
2. 注单状态是否变为 `WON / LOST / PUSH / VOID` 或页面等价文案。
3. 页面展示的最终比分是否与赛事结果一致。
4. 页面展示的实际派彩是否符合公式。
5. 页面可领取金额是否按结算结果变化。

派彩公式：

| 结算状态 | actual_payout | 资金预期 |
| --- | --- | --- |
| WON | `stake * odds` | 扣 `bet_lock_balance`，增加 `claimable_balance` |
| LOST | `0` | 只扣 `bet_lock_balance`，不增加 `claimable_balance` |
| PUSH | `stake * 0.9` | 扣 `bet_lock_balance`，增加 `claimable_balance` |
| VOID | `stake` | 扣 `bet_lock_balance`，增加 `claimable_balance` |

页面验收通过标准：

- 注单最终状态明确，不再显示为未结。
- `WON / PUSH / VOID` 时，页面可领取金额增加对应派彩。
- `LOST` 时，页面可领取金额不因为该注单增加。
- 页面展示的注单状态、最终比分、stake、odds、actual payout 能和数据库核对一致。

## 10. 数据库验收结算结果

用注单号复查：

```sql
SELECT
  b.id AS bet_id,
  b.user_id,
  b.odd_id,
  b.market,
  b.label,
  b.handicap_line,
  b.stake,
  b.odds,
  b.status AS bet_status,
  b.actual_payout,
  b.updated_at AS bet_updated_at,
  o.fixture_id,
  fr.state_id,
  fr.state_code,
  fr.home_score_full,
  fr.away_score_full,
  fr.settlement_status,
  fr.remark,
  fr.updated_at AS fixture_result_updated_at
FROM user_bet_holding AS b
JOIN oddfi_odds AS o ON o.odd_id = b.odd_id
JOIN oddfi_fixture_results AS fr ON fr.fixture_id = o.fixture_id
WHERE b.id = <BET_ID>;
```

结算成功预期：

- `b.status IN ('WON', 'LOST', 'PUSH', 'VOID')`
- `b.actual_payout` 符合第 9 节派彩公式。
- `fr.settlement_status = 'PROCESSED'`
- `fr.remark` 为空或没有错误信息。
- `fr.state_id IN (5, 7, 8, 12, 14, 15, 17, 20)`

复查资金：

```sql
SELECT
  user_id,
  coin_symbol,
  available_balance,
  bet_lock_balance,
  claimable_balance,
  update_time
FROM user_balance
WHERE user_id = <USER_ID>;
```

资金验收口径：

- 结算成功后，`bet_lock_balance` 应减少本笔 `stake`。
- `WON / PUSH / VOID`：`claimable_balance` 应增加本笔 `actual_payout`。
- `LOST`：`claimable_balance` 不应因为本笔注单增加。
- 如果同一账号同时有多笔下注，需要按下注前快照和所有结算注单合计核对，不要只看单笔差值。

## 11. 一次完整验收记录模板

建议测试同学每次验收填写一行，方便后端排查。

| 字段 | 内容 |
| --- | --- |
| 测试环境 | prod / pre-prod |
| 测试账号 |  |
| user_id |  |
| 赛事名称 |  |
| fixture_id |  |
| 开赛时间 |  |
| 下注时间 |  |
| bet_id |  |
| odd_id |  |
| market |  |
| label / selection |  |
| handicap / total |  |
| stake |  |
| odds |  |
| 下注后页面状态 |  |
| 完赛状态 | FT / AET / FT_PEN / CANCELLED / other |
| 最终比分 |  |
| 页面结算状态 | WON / LOST / PUSH / VOID |
| 数据库结算状态 | WON / LOST / PUSH / VOID |
| actual_payout |  |
| settlement_status | PROCESSED / ERROR / PENDING |
| claimable 变化 |  |
| 验收结论 | PASS / FAIL |
| 附件 | 下注截图、结算截图、SQL 结果 |

## 12. 常见异常和判断方式

### 12.1 注单下注成功，但一直在未结列表

先确认比赛是否真的进入终局。只有 `FT / AET / FT_PEN` 或退款态才会推进资金。

后端执行：

```sql
SELECT
  b.id,
  b.status,
  o.fixture_id,
  fr.state_id,
  fr.state_code,
  fr.settlement_status,
  fr.remark,
  fr.updated_at
FROM user_bet_holding AS b
LEFT JOIN oddfi_odds AS o ON o.odd_id = b.odd_id
LEFT JOIN oddfi_fixture_results AS fr ON fr.fixture_id = o.fixture_id
WHERE b.id = <BET_ID>;
```

判断：

- `fr.state_id` 仍是 live/scheduled/hold 状态：不是结算失败，继续等 spider 更新。
- `fr.state_id IN (5,7,8,12,14,15,17,20)` 但超过 10 分钟未结算：看 worker 是否运行、是否有日志错误。
- `o.fixture_id` 或 `fr.fixture_id` 为空：下注赔率和赛果快照断链，需要后端修数据或查下注服务。

### 12.2 `settlement_status = ERROR`

后端执行：

```sql
SELECT fixture_id, state_id, state_code, settlement_status, remark, updated_at
FROM oddfi_fixture_results
WHERE settlement_status = 'ERROR'
ORDER BY updated_at DESC
LIMIT 50;
```

常见原因：

- `raw_score_data` 不是合法 JSON。
- 目标比分缺失，例如 `FT` 缺 `CURRENT`，`AET / FT_PEN` 缺 `2ND_HALF`。
- 用户没有对应 `user_balance` 行。
- `bet_lock_balance < stake`。
- 同一用户有多条可扣余额行，当前注单表没有币种，worker 拒绝猜测。

结论：

- 页面应标记本次验收失败。
- 附上 `fixture_id`、`bet_id`、`remark`、页面截图给后端处理。

### 12.3 数据库已结算，但页面仍显示未结

如果 SQL 显示：

- `b.status IN ('WON','LOST','PUSH','VOID')`
- `fr.settlement_status = 'PROCESSED'`

但页面仍显示未结，优先按前端或 `web-api` 展示链路排查：

- 页面是否缓存未刷新。
- `web-api` 是否查询了旧表或旧字段。
- 已结注单是否被展示到另一个 tab。
- 页面状态枚举是否没有兼容 `PUSH / VOID`。
- 页面是否只看 `payout` 而不是 `actual_payout`。

### 12.4 页面显示已结算，但可领取金额没变

先确认结算状态：

- `LOST` 不增加 `claimable_balance`，这是正常结果。
- `WON / PUSH / VOID` 应增加 `claimable_balance`。

后端执行：

```sql
SELECT
  b.id,
  b.user_id,
  b.stake,
  b.odds,
  b.status,
  b.actual_payout,
  ub.bet_lock_balance,
  ub.claimable_balance,
  ub.update_time
FROM user_bet_holding AS b
LEFT JOIN user_balance AS ub ON ub.user_id = b.user_id
WHERE b.id = <BET_ID>;
```

判断：

- `WON / PUSH / VOID` 且 `actual_payout > 0`，但 `claimable_balance` 没有增加：看 worker 日志和是否有资金服务并发覆盖。
- 数据库 `claimable_balance` 已增加但页面没变：看 `web-api` 和页面余额展示字段。

### 12.5 赔率、盘口或投注项和数据库不一致

检查下注表快照：

- `user_bet_holding.odds` 必须是下注时赔率，不应随赛后赔率变化。
- `market` 应能归一到 `1x2 / handicap / overunder`。
- `label` 应符合玩法需要：`1 / X / 2 / over / under`。
- `handicap_line` 应等于让球线或大小球线。

如果页面展示和下注表不同，优先查下注接口写入逻辑，而不是结算 worker。

## 13. 验收通过标准

单场单笔下注验收通过需要同时满足：

- 正式页面能成功下单。
- 注单能在未结列表中看到。
- 下注后资金锁定展示合理。
- 赛事终局后 1 到 5 分钟内自动结算；网络或采集延迟场景最多观察 10 分钟。
- 页面状态和数据库 `user_bet_holding.status` 一致。
- 页面派彩和数据库 `actual_payout` 一致。
- `oddfi_fixture_results.settlement_status = 'PROCESSED'`。
- `WON / PUSH / VOID` 的可领取金额增加正确，`LOST` 不增加可领取金额。
- 没有新增持续存在的 `settlement_status = 'ERROR'`。

整体验收建议至少跑 3 笔：

1. `1X2 / Fulltime Result` 一笔，作为必测主链路。
2. `Over Under / 大小球` 一笔，验证总进球玩法字段。
3. `Asian Handicap / 让球` 一笔，验证盘口线字段；如果刚好出现整数盘打平，应重点核对 `PUSH = stake * 0.9`。

退款态 `VOID` 依赖真实赛事取消、腰斩或数据源删除，不强制要求每天线上验收都覆盖；如当天正好遇到取消赛事，应单独记录为退款态验收样本。

## 14. 提交问题时必须带的信息

每个问题单至少包含：

- 测试环境和正式页面 URL。
- 测试账号标识和 `user_id`。
- 赛事名称、开赛时间、`fixture_id`。
- `bet_id`、`odd_id`、下注时间。
- 下注截图、未结注单截图、完赛后注单截图。
- 页面显示的状态、比分、stake、odds、payout、可领取金额。
- SQL 核对结果或后端同学给出的 `settlement_status / remark`。
- 期望结果和实际结果。

没有 `bet_id` 或 `fixture_id` 的问题很难定位，提交前优先补齐这两个字段。
