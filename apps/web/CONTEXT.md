# OddFi · 项目领域术语表（CONTEXT.md）

> **状态**：v1 草案 · 待 PM / 合约 / 前端三方对齐
> **来源**：受 [mattpocock/skills · grill-with-docs](https://github.com/mattpocock/skills) 启发
> **调研**：`.progress/research/RES-015-mattpocock-skills-evaluation.md`
> **目的**：建立 Ubiquitous Language —— 让 PM、合约、前端、Agent 用同一套词汇沟通。代码命名、文档命名、对话表达都以本表为准。

---

## 怎么用

- 写代码 / 起变量名 / 起组件名前，对照本表选**首选词**，不用 _Avoid_ 列的别名
- 写 DD/ENH/PRD/Bug 复盘时，使用粗体术语引用（`**Match**`），让 Agent 跨文档保持一致
- 发现冲突或新术语，直接 PR 改本表，**先口径对齐再写代码**

---

## §1 平台与代币

**OFI Token**（PRD 名 / 项目对外名）
平台原生代币，含卖出税，ERC-20。
_Avoid_: PTK（旧名遗留 · MVP 阶段使用过）

**ODD**（合约层 symbol）
OFI Token 在 BSC 链上的合约 symbol 字段实际值，价格接口路径也是 `?symbol=odd`。
_注_: 内部讨论用 **OFI Token**；涉及合约 / 链上数据 / 价格接口路径时用 **ODD**。这两个词指**同一个代币**，只是层次不同。
_Flagged_: 历史 MVP 阶段三个名字混用（PTK / OFI / ODD），v1 决策见 §Flagged ambiguities #1。

**USDT / USDC**
稳定币，仅作为**入金资产**与**赔付结算单位**。
_Avoid_: USD（不写裸 USD，避免与法币混淆）

---

## §2 赛事

**Match**（前端展示概念）
单场体育比赛实体，Calendar / Pools / 详情页等所有 UI 展示用此词。
_Avoid_: Game, Event（_Event_ 在合约层另有含义，见 §3）

**Fixture**（后端 / SportMonks 数据层）
SportMonks API 返回的原始赛事记录，类型字段 `fixtureId` / `fixtureName`。
_注_: **Fixture 仅用于数据层**（API、SDK、types/betting.ts BetSelection）。落地到 UI / 文档 / 业务讨论时统一称 **Match**。
_Flagged_: §Flagged ambiguities #2

**League**
联赛实体，`leagueId` 来自 SportMonks（如 Premier League=8 / Serie A=384）。

**Market（玩法）**
单场 Match 上可下注的玩法类型。三大类：

- `1x2`（fulltime_result）—— 主胜 / 平 / 客胜
- `asian_handicap` —— 亚盘让球
- `asian_total` —— 亚盘大小球
  _Avoid_: Bet Type, Wager Type

**Banner Market**（首页 banner 专属玩法）
跨赛季 / 长周期玩法，独立于单场 Match：

- `champion_winner`（夺冠盘）
- `total_goals`（总进球数）
- `golden_ball` / `golden_boot` / `golden_glove`（金球 / 金靴 / 金手套）

**Selection**
用户从某 Market 中选择的具体下注项。例如 1x2 的 `home` / `draw` / `away`，亚盘的 `over 2.5`。

**Odds（赔率）**
小数赔率字符串（如 "1.53"），来自 SportMonks `odds.id`（前端用 `oddId` 字段引用）。

**前后端命名映射（DD-124）**
同一玩法在前端 `BetSelection.marketType`、后端 onchain `bet_market`、后端流水 `business_type` 三处命名不一致，对接时以此表为准：

| 概念           | 前端 `BetSelection.marketType` | 后端 onchain `bet_market` | 后端流水 `business_type` |
| -------------- | ------------------------------ | ------------------------- | ------------------------ |
| 1X2 / 全场胜负 | `"1x2"`                        | `"fulltime_result"`       | `"single"`               |
| 亚洲让球       | `"asian_handicap"`             | `"asian_handicap"`        | `"single"`               |
| 大小球         | `"asian_total"`                | `"asian_over_under"`      | `"single"`               |

_注_: 大小球前端叫 `asian_total`、后端 onchain 叫 `asian_over_under`——命名不同，是已知映射点。数据边界在 `MARKET_TYPE_CODE`（`lib/betting/submit-onchain-from-selection.ts`：`"1x2"→0 / "asian_handicap"→1 / "asian_total"→2`）。链上盘口匹配用 `OnchainMarket.line_value` 字符串等价（不是 `line` uint8 编号），见 DD-124 / BUG-014。

---

## §3 合约 / 链上动作

**Bet（投注）**
用户对某 Match 的某 Selection 下注，锁定本金 + 锁定赔率。**业务讨论 + UI 展示统一用此词**。
_Avoid_: Order, Wager, Trade（_Trade_ 在合约层另有含义，见下）

**MockOrder**
`types/betting.ts` 内 BetSlip 编辑态的临时数据结构。
_注_: 不是业务概念，只是前端实现层结构，不出现在 PRD / DD / 用户文案中。

**PortfolioBet**
`types/portfolio.ts` 内已结算 / 展示态的注单数据结构。

**Stake（质押）**
将 OFI Token 锁入 StakingPool 获取奖励。**这是项目的 Stake 唯一含义**，不要把 Bet 译成"质押"。
_Avoid_: Lock, Deposit-as-Stake

**Deposit（充值）**
把链上资产（USDT/USDC）转入 DepositVault，作为投注前置资金。
_Avoid_: Top-up, Fund

**Withdraw（提现）**
把账户余额提回链上钱包。

**Settlement（结算）**
赛事结束后，BettingSettlementModule 根据真实结果把 Bet 标记为 `won` / `lost` / `push` / `void`，并把赔付转入用户账户余额。

**Refund（退款）**
赛事 / 盘口取消时，本金原路返还，对应状态 `void`。

**Claim（领奖）**
用户主动领取已 settled 的 won 注单赔付（部分玩法走主动 claim，非自动到账）。

**Trade**（仅指 Swap 场景）
Swap 页面 USDT ⇄ ODD 的兑换动作。**Trade 在本项目仅用于 Swap，不要把 Bet 误称 Trade**。
_Avoid_: 把投注称为 Trade

---

## §3.5 奖励（Reward）—— 两类不可混用

> 项目里有两处「我的奖励 / My Rewards」UI，业务含义完全不同，命名必须区分（DD-150）。

**TaskReward（任务奖励 · Reward Hub 页）**
用户完成新手任务 / 每日社媒任务后领取的 ODD 奖励，展示在**奖励中心**（`/rewards`，Reward Hub）。
对应类型 `RewardRecord`、状态 `RewardStatus = claimable | claimed | expired`。
_注_: Reward Hub 的「我的奖励」Tab 在代码里命名为 `RewardRecordsTab`、子目录 `records/`，**不要**叫 `MyRewards`（与下方 referral 页冲突）。
_Avoid_: MyRewards（裸用，歧义）

**ReferralReward（推荐返佣 · Referral 页）**
用户邀请好友后获得的返佣奖励，展示在**推荐页**（`/referral`），对应 `components/referral/MyRewardsSection.tsx`。
_注_: 这是**已有**概念，沿用 `MyRewardsSection` 命名不动；新页禁止复用该名。
_Avoid_: 把它与 TaskReward 混为一谈

---

## §4 资金池 / 合约模块

**StakingPool**
质押池合约，OFI Token 持有者锁仓获取奖励。

**LiquidityPool**
流动性池合约，承载 USDT/ODD 兑换池。
_注_: `lib/contracts.ts` 中字段名 `pools`（复数）历史命名歧义，实际指 LiquidityPool proxy。后续考虑改名 `liquidityPool`，详见 DD-090。

**BettingPool**
投注池合约，承担庄家角色，所有 Bet 的本金注入此池，赔付从此池支出。

**BettingSettlementModule**
结算模块合约，处理 Bet 的 settlement / refund 流转。

**DepositVault**
入金保管合约，用户向此地址存入 USDT/USDC，余额计入用户账户。
_Avoid_: TreasuryVault, PaymentVault

---

## §5 用户实体

**User**（业务实体）
平台用户。一个 User 对应一个 EOA 钱包地址（登录主体）+ 一个 ProxyWallet（代理执行合约调用的子账户）。
_Avoid_: Customer, Account（_Account_ 在 API 路径 `/api/account/*` 中是后端服务名，不是业务实体）

**ProxyWallet**
为 User 在 BSC 链上分配的代理钱包地址，由后端托管私钥 / 走 EIP-4337 等方案。所有合约动作都从 ProxyWallet 发起，User 只签登录消息。
_Avoid_: Sub Wallet, Smart Account

**EOA Wallet**
User 自己的 MetaMask / OKX 等外部钱包，**只用于登录签名**，不直接调合约。

**Auth Session**
JWT 登录态，24h access token + 7d refresh token，存 `localStorage['oddfi_auth']`。

---

## §6 状态机

**BetSettlementStatus**（注单结算状态 · 单一源）
源在 `types/portfolio.ts`，归一通过 `normalizeBetStatus()`。

| 状态        | 含义                            |
| ----------- | ------------------------------- |
| `pending`   | 待开赛 / 待结算                 |
| `live`      | 比赛进行中（active 列表行）     |
| `won`       | 赢                              |
| `lost`      | 输                              |
| `push`      | 走水（盘口推迟，本金返还）      |
| `void`      | 退款（赛事/盘口取消，本金返还） |
| `cancelled` | 用户主动取消（开赛前）          |
| `claimed`   | 已领奖（won 注单领取赔付后）    |

_Avoid_: cashback, failed（DD-087 Batch 4/5 清理 deprecated）

**OddsAcceptance**（赔率接受策略）

- `any` —— 任何赔率变动都接受
- `higher_only` —— 仅接受赔率上调
- `none` —— 任何变动都拒绝，需重新确认

---

## §7 关系（Relationships）

- 一个 **Match** 由一个 **League** 持有
- 一个 **Match** 暴露多个 **Market**（1x2 / asian_handicap / asian_total）
- 一个 **Bet** 锁定一个 **Match** 上的一个 **Market** 的一个 **Selection**
- 一个 **Bet** 由一个 **User** 通过 **ProxyWallet** 提交到 **BettingPool**
- **Settlement** 后 **Bet** 状态从 `pending`/`live` 转为 `won`/`lost`/`push`/`void`
- 一个 **User** 拥有一个 **EOA Wallet** + 一个 **ProxyWallet**
- 一个 **Banner Market** 横跨多场 **Match**（如夺冠盘横跨整届世界杯）

---

## §8 Flagged Ambiguities（已知冲突 + 解决）

### #1 代币三个名字 PTK / OFI / ODD

**冲突**：MVP 阶段三个词混用 → 现在合约 symbol 是 ODD，PRD/对外名是 OFI Token，旧文档残留 PTK。

**v1 决策**：

- **业务讨论 / PRD / DD / UI 文案** → 统一 **OFI Token**
- **合约层 / 链上数据 / 价格接口路径** → 沿用 **ODD**（因为合约已部署，改名成本极高）
- **PTK** → 仅历史归档文档保留，新代码 / 文档**禁止**使用

### #2 Match vs Fixture

**冲突**：SportMonks 字段叫 `fixture`，前端 types 里用 `fixtureId`，但 UI 上展示叫"Match / 比赛"。

**v1 决策**：

- **数据层**（API client、types、SDK 字段）→ 沿用 **Fixture**（与上游一致）
- **UI / 业务讨论 / DD/ENH** → 统一 **Match**
- 边界：从 API 拿到 Fixture 后，传给 UI 组件前的 adapter 层做名字转换

### #3 Pool vs Vault

**冲突**：StakingPool / LiquidityPool / BettingPool 都叫 Pool，DepositVault 叫 Vault。

**v1 决策**：

- **Pool** = 资产的"双向流动池"（注入 + 流出，如赔付 / 兑换 / 奖励）
- **Vault** = 资产的"单向保管库"（仅入金保管，无业务运转）
- 这是合约组结构决策，不要混用

### #4 Trade vs Bet

**冲突**：早期讨论中"投注"被译为 Trade，但 Swap 页面也用 Trade。

**v1 决策**：

- **Bet** = 投注（赛事下注）
- **Trade** = Swap（代币兑换）
- 这两个词在本项目不可互换

---

## §9 示例对话（Example Dialogue）

> **PM**：用户对一场 **Match** 下了 **Bet**，赛事被取消时怎么处理？
>
> **后端**：合约会触发 **Refund**，**Bet** 状态从 `pending` 转 `void`，本金原路退回 **ProxyWallet** 的账户余额。
>
> **前端**：UI 上展示注单为"已退款"，注单卡用灰色标签 + Refund 文案。需要 Toast 提示用户吗？
>
> **PM**：需要 Toast。但只有用户在线时弹，离线下次登录时合并展示。
>
> **前端**：那是不是该走我们的 notification 系统而不是 Toast？因为用户当时可能不在 Portfolio 页。
>
> **后端**：另外 PreSale 阶段的夺冠盘是 **Banner Market**，不是普通 **Match Bet**，**Refund** 流程走 BettingSettlementModule 的另一个分支。

---

## §10 待办（v1 → v2）

- [ ] PM 对齐 §1 OFI/ODD 命名（确认 v1 决策）
- [ ] 合约方对齐 §4 资金池命名（DD-090 后续 `pools` 改名 `liquidityPool`）
- [ ] 前端对齐 §6 BetSettlementStatus 与 `normalizeBetStatus()` 实际枚举
- [ ] 补充 §赛事 中的 Asian Handicap 子玩法（让球 / 让球大小 / 单双）—— 等 PRD 二期玩法定稿
- [ ] 补充 §Lending 概念（如该模块进入正式产品）

---

## §11 关联

- **规则**：`.claude/rules/dd-enh-workflow.md`（ADR + DD/ENH 引用本表）
- **调研**：`.progress/research/RES-015-mattpocock-skills-evaluation.md`
- **ADR**：`.progress/adr/0001-http-client-ky-not-axios.md` 等
- **类型源**：`types/betting.ts`、`types/portfolio.ts`、`lib/contracts.ts`
- **状态归一**：`lib/normalize-bet-status.ts`（如不存在则在 `lib/decimal.ts` 同级）
