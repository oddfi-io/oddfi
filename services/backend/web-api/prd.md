# History 表格 Status 列 — 后端字段需求


##  一句话需求

History 流水表的 Status 列要展示进行中 / 审核中 / 成功 / Failed等状态 + 失败时的 hover 失败原因 + 失败/审核中态的三点操作菜单（申诉 / 取消提现），当前后端 LedgerRecord 顶层没有状态字段，前端拉不到。

## 上下文

- 设计稿状态分级（飞书状态流转总表）：
  - Bet / Void / Push / Cancel：成功（金额颜色已表达）/ Failed（红 + ?icon），其中 Cancel 失败有「申诉」按钮
  - Claimed：进行中（蓝 progress…）/ 审核中（灰）/ 成功 / Failed（红，「申诉」）
  - Deposited：进行中 / 成功 / Failed
  - Withdrew：进行中 / 成功 / Failed（「申诉」+「取消提现」二级菜单）
  - Stake / UnStake / Add LP / Revoke LP：进行中 / 成功 / Failed

- Figma 1689:82592 Status 列实测含的具体文案：
  - In Progress（蓝）
  - Completed（绿）
  - 审核中…（灰）
  - Failed + ? icon（红）+ 三点菜单
  - 申诉中（灰）+ 三点菜单（取消提现）
  - 已取消（灰）

- 现有数据：
  - event_info.status 只覆盖 bet 类的 PENDING / WON / LOST / PUSH / VOID / CLAIMED / CANCELLED（终态语义），无 progress / 审核中 / Failed 三态。
  - WithdrawRecord.status（独立 /api/account/withdraw 接口）已有 1=PENDING_REVIEW / 2=PROCESSING / 3=COMPLETED / 4=REJECTED / 5=FAILED / 6=CANCELED 枚举，但 history 接口没透传。

- 前端目前 TransactionRecord.status 全部 hardcode "completed"（adapter 没活字段可用）。
  
## 需要后端更新的接口

GET /api/account/portfolio/history

每条 asset_ledgers 记录 (LedgerRecord) 顶层补：
 
字段	类型	含义	取值
status	int	流水状态（统一枚举，跨 business_type 复用）	1=进行中（PROCESSING）<br>2=审核中（REVIEWING）<br>3=成功（COMPLETED）<br>4=失败（FAILED）<br>5=申诉中（APPEALING，仅 withdraw）<br>6=已取消（CANCELED，仅 withdraw）
error_msg	string (可选)	失败原因；失败时（status=4）必填，前端用于 ? icon hover/click pop 显示	例："Insufficient gas" / "Risk control rejected"


字段语义按 business_type 落地

- single / parlay / banner_single（Bet 类）→ status=3 默认成功；status=4 表示下注链上失败（罕见）
- cancel_bet → status=3 成功 / status=4 失败（链上异常）
- claim_prize → status=1 进行中 / status=2 审核中 / status=3 成功 / status=4 失败
- deposit → status=1 进行中 / status=3 成功 / status=4 失败
- withdraw / cancel_withdraw → 完整 6 状态（沿用 WithdrawRecord.status 语义；建议直接复用同一枚举值）
- stake / unstake / add_lp / remove_lp → status=1 进行中 / status=3 成功 / status=4 失败
  
建议：枚举与 WithdrawRecord.status 对齐（避免两套），未用到的状态对其他 business_type 不出现即可。
