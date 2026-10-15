# OddFi BettingPool 合约交互技能

BNB Testnet 上 USDT 体育竞猜合约的完整操作指南。TypeScript + viem 实现。

## 快速开始

```bash
# 1. 导出私钥
export PRIVATE_KEY=0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796

# 2. 安装依赖（首次使用）
cd skills && npm install

# 3. 运行脚本
npx tsx script/query.ts pool
```

## 合约地址

| 合约 | 地址 |
|------|------|
| BettingPool (Proxy) | `0xCcAD84d0772262AeDe15B1B702d1Bd69D02f177D` |
| MockUSDT | `0xd8f86e84b4475d7bd398788e594124429e7700cf` |
| BettingPool (Impl) | `0xb2809eaa08cd5d0344339fc2297702bdc9936297` |

- **链**: BNB Testnet (ChainID 97)
- **RPC**: `https://bsc-testnet-dataseed.bnbchain.org` (fallback: `bsc-testnet.bnbchain.org`, `bsc-prebsc-dataseed.bnbchain.org`)
- **Explorer**: https://testnet.bscscan.com

## 脚本清单

### 查询

```bash
# 查询用户余额
npx tsx script/query.ts balance <地址>

# 查询注单详情
npx tsx script/query.ts bet <betId>

# 查询串关详情
npx tsx script/query.ts parlay <parlayId>

# 查询对赌池状态
npx tsx script/query.ts pool

# 查询平台收益
npx tsx script/query.ts platform
```

### 充值 & 提现

```bash
# 充值: mint USDT → 转入合约 → 入账
npx tsx script/deposit.ts <用户地址> <金额USDT>
# 示例: npx tsx script/deposit.ts 0x7501bCBFAAa99e6390577277D051A32ec2e64064 1000

# 提现: ≤5000 直接到账, >5000 进入24h审核
npx tsx script/withdraw.ts <金额USDT>
```

### 盘口管理

```bash
# marketType: 0=X12(胜负平), 1=AH(让分), 2=OU(总分)
# line: 0/1/2

# 开盘
npx tsx script/market.ts open <matchId> <marketType> <line>

# 封盘
npx tsx script/market.ts close <matchId> <marketType> <line>

# 查询状态
npx tsx script/market.ts status <matchId> <marketType> <line>
```

### 下注

```bash
# 赔率×1000, 如 1.818 → 1818
npx tsx script/bet.ts <betId> <用户地址> <金额USDT> <matchId> <marketType> <outcome> <line> <赔率>
```

### 结算 & 取消

```bash
# 结算盘口
npx tsx script/settle.ts <matchId> <marketType> <line> <winningOutcome> <betId1> [betId2...]

# 取消赛事
npx tsx script/cancel.ts <matchId> <marketType> <line> <betId1> [betId2...]
```

### LP 流动性

```bash
# 添加流动性（自动 mint + approve + addLiquidity，最低 $1000）
npx tsx script/lp.ts add <金额USDT>

# 移除流动性
npx tsx script/lp.ts remove <shares>

# 查询仓位
npx tsx script/lp.ts info [地址]
```

## 完整流程示例

```bash
export PRIVATE_KEY=0x...
MATCH="0x$(echo -n 'match-001' | xxd -p -l 32 | tr -d '\n' | head -c 64)"
USER="0x7501bCBFAAa99e6390577277D051A32ec2e64064"
BET="0x$(echo -n 'bet-001' | xxd -p -l 32 | tr -d '\n' | head -c 64)"

# 1. LP 注入流动性
npx tsx script/lp.ts add 10000

# 2. 用户充值
npx tsx script/deposit.ts $USER 500

# 3. 开盘（胜负平）
npx tsx script/market.ts open $MATCH 0 0

# 4. 下注（100 USDT, 赔率 1.818, 主胜=outcome 0）
npx tsx script/bet.ts $BET $USER 100 $MATCH 0 0 0 1818

# 5. 封盘
npx tsx script/market.ts close $MATCH 0 0

# 6. 结算（主胜=outcome 0）
npx tsx script/settle.ts $MATCH 0 0 0 $BET

# 7. 查询
npx tsx script/query.ts balance $USER
npx tsx script/query.ts pool
```

## 文件结构

```
skills/
├── SKILL.md                   # 本文档
├── package.json               # npm 依赖（viem, tsx）
├── tsconfig.json
├── assets/
│   ├── BettingPool.abi.json   # BettingPool 合约 ABI
│   └── MockUSDT.abi.json      # MockUSDT ABI
├── refrences/
│   └── contracts.json         # 合约地址与配置
└── script/
    ├── config.ts              # 公共配置（客户端、ABI、工具函数）
    ├── deposit.ts             # 充值
    ├── withdraw.ts            # 提现
    ├── market.ts              # 盘口管理
    ├── bet.ts                 # 下注
    ├── settle.ts              # 结算
    ├── cancel.ts              # 赛事取消
    ├── lp.ts                  # LP 流动性
    └── query.ts               # 查询工具
```

## 角色权限

| 操作 | 权限 | 说明 |
|------|------|------|
| creditDeposit, lockBet, closeMarket, updateSignal | onlyAdmin | Jason 后端单签 |
| settle, cancelMatch, reopenMarket, setAdmin | onlyMultisig | Gnosis Safe 多签 |
| withdraw, addLiquidity, removeLiquidity | 任意用户 | 用户自行调用 |
| pause / unpause | onlyMultisig | 紧急暂停 |

> 测试网 admin 和 multisig 均为 deployer 地址，方便测试。
