# 前端适配任务方案 — OddFi 主网(BSC 56)切换

> 交付对象:前端 agent(本仓 `/Users/hang/work/oddfi-frontend`,当前分支 main)
> 来源:后端 2026-06-14 已完成 prod 首轮部署(后端分支 `prod`),链配置已切主网、真实合约地址已落地。
> 基线核实:本清单所有 file:line 已于 2026-06-15 对前端 main 实测核对。

## 0. 必读前提(架构约束)

- 后端**不通过任何 API 下发**合约地址/chainId/ABI。前后端各存独立副本,**必须逐字节 lockstep 对齐**;历史上地址漂移导致过开池停摆(BUG-003)。
- relay approve 流(DD-127):前端只传 `target` 名称(`liquidity`/`betting`/`staking`),后端从自己 config 解析 spender。前端无需 spender 地址,但地址表必须正确(影响读合约 + 显示)。
- 网络模式单一真值:`/Users/hang/work/oddfi-frontend/lib/network-mode.ts:17`,`NEXT_PUBLIC_NETWORK_MODE === "testnet" ? testnet : mainnet`,默认 build 走 **mainnet**。

## 🔴 0.1 阻塞门控(放量前必读,不要跳)

后端主网链开关**当前仍关着**:`config_prod.yaml` 里 `chain.enabled=false / dry_run=true`。

- 本任务的 §1~§5(填地址/对账/ABI/build 自检)**现在就可以做并提交**。
- §6「生产 Vercel 翻 `NEXT_PUBLIC_NETWORK_MODE=mainnet` 放量」**必须等后端通知链 `enabled=true` 后再做**。否则前端连主网而后端 relay 不签名,会全链路报错。

## 1. 填主网合约地址(首要,当前全 ZERO)

文件:`/Users/hang/work/oddfi-frontend/lib/contracts.ts`,`CONTRACTS[bsc.id]` 块(行 36–47)。
当前 7 个槽位全 = `ZERO`,`requireContract`(读合约前兜底)遇 ZERO 即 hard-fail。按下表填(均为后端 `config_prod.yaml` 实测值,保持 checksum 大小写):

| contracts.ts 字段                       | 行       | 主网地址                                        |
| --------------------------------------- | -------- | ----------------------------------------------- |
| `oddToken`                              | 39       | `0x3e130563e069c414F0a18863966c211aA5D518F9`    |
| `stakingPool`                           | 40       | `0x837BEB9C2Cd6B45af68CD62009d874569584DDcA`    |
| `pools`(= LiquidityPool proxy)          | 43       | `0x55419B1529b89FE3C72BdC3062515f431a63F06A`    |
| `bettingPool`                           | 44       | `0x875D0CA32A74663E42a20d0C2b7E252b5A3121cA`    |
| `depositVault` / `lending` / `referral` | 38/41/42 | **保持 ZERO**,除非合约团队确认主网有部署(见 §7) |
| `usdc` / `usdt`                         | —        | 不动(已是主网值)                                |

> `multicall`:前端此表无此字段,无需处理(后端用 canonical `0xcA11bde05977b3631167028862bE2a173976CA11`)。

## 2. ODD token 对账(关键不一致)

文件:`/Users/hang/work/oddfi-frontend/lib/token-registry.ts:96-98`。
当前 BSC 主网 ODD 条目 `symbol:"TODD"`,`address:"0xa3049f4C5b196EbDE022eBedA6673683E5eC49b7"`。

- 该地址与 §1 后端 `oddToken` `0x3e130563…` **不一致** → 余额/swap/PLATFORM_TOKEN 会读错 token。
- **动作**:把 address 改为 `0x3e130563e069c414F0a18863966c211aA5D518F9`,与 contracts.ts 的 `oddToken` 对齐;并复核 `symbol`(主网应为 `ODD` 而非 `TODD`,确认后端/合约口径)。

## 3. ABI 重同步(条件性)

手维护 ABI 子集:`/Users/hang/work/oddfi-frontend/lib/abi/{liquidityPool,oddToken,stakingPool}.ts`(前端无 BettingPool ABI,下注走后端 relay)。

- **若**合约团队确认主网合约与测试网实现**字节一致**(仅重部署 proxy)→ 无需改。
- **若** method/签名有变(尤其 StakingPool `positions` tuple、LiquidityPool getters)→ 逐方法重核。完整 ABI 在合约仓 `/Users/hang/work/oddfi-ODD`。
- 本项依赖 §7 合约团队回复,**不确定就先不动,标记 pending**,不要凭空改。

## 4. 生产 Vercel env(改值,先备好不放量)

- `NEXT_PUBLIC_ENABLE_MSW=false`(关 mock)
- `BACKEND_URL` → `https://api.oddfi.io`
- `MARKET_API_URL` → `https://market-api.oddfi.io`
- `NEXT_PUBLIC_WS_*` → 从 `dev-*.oddfi.io` / `ws-dev.oddfi.io` 切到 prod 域(向后端确认 prod WS 子域)
- `NEXT_PUBLIC_BSC_RPC_URL`:确认主网 Alchemy key 配额够生产负载。后端用同一个 key(`bnb-mainnet.g.alchemy.com/v2/H35X…`)→ **共享 key,放量前与后端确认是否需各自独立 key 避免限流互相打架**。
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`:各 env 文件不一致 → 确认生产用哪个。
- 对照文件:`/Users/hang/work/oddfi-frontend/.env.vercel.testnet`(当前 testnet pin 值,仅作对照,别直接改它当 prod)。

## 5. 本地自检(现在做)

- mainnet 模式 `pnpm build` 通过,无 `requireContract` 抛错。
- 测试网 badge/banner 全部消失(均 keyed off `IS_TESTNET`,主网自动隐藏,无需逐个改:`components/layout/TopNav.tsx`、`components/bet-slip/BetCard.tsx` 等)。
- 钱包连接提示为 "BSC Mainnet",链切到 56(`lib/wallet-chain.ts` 自动读;`lib/wagmi.config.ts` 已处理 testnet→mainnet 缓存清理)。

## 6. ⏸ 放量(等后端开链信号)

后端确认 `chain.enabled=true / dry_run=false` 上线后:生产 Vercel 把 `NEXT_PUBLIC_NETWORK_MODE` 设为 `mainnet`(或移除,默认即 mainnet),重新部署。**在此之前不要翻。**

## 7. 给合约团队/后端的开放问题(前端先问清再动 ABI 和 ZERO 项)

1. 主网是否存在 DepositVault / Lending / Referral?(决定 contracts.ts 这三项填址还是保持 ZERO)
2. 主网合约是否与测试网实现字节一致?(决定 §3 ABI 是否重同步)
3. `0xa3049f4C…`(旧 token-registry TODD@56)是历史占位还是真有用途?新 ODD 确认为 `0x3e130563…`?
4. 主网 staking plan 锁仓时长 / planId 映射 / `SECONDS_PER_DAY`(影响质押 UI 显示;后端 config 标注「主网上线前必须核对」)。
5. prod WS 子域 + 是否需前端独立 Alchemy key。

## 验收 checklist

- [ ] contracts.ts `[bsc.id]` 4 个地址填入,与后端 config_prod.yaml 逐字节一致(交叉核对)
- [ ] token-registry ODD@56 地址改齐 `0x3e130563…`,symbol 口径确认
- [ ] ABI 三文件:确认一致(无需改)或按签名变更重核 — 二选一并记录依据
- [ ] mainnet `pnpm build` 绿、无 requireContract 抛错、测试网 badge 消失
- [ ] §7 开放问题已向合约团队/后端确认并回填
- [ ] (放量阶段)等后端开链信号后翻 NETWORK_MODE

---

## 附:后端实测地址来源(单一真值)

后端 `prod` 分支 `web-api/config_prod.yaml` + `oddfi-web-spider/config/config_prod.yaml`(两文件逐字节一致):

```
chain_id: 56
rpc_url: https://bnb-mainnet.g.alchemy.com/v2/H35XdJCol-9YDMElNIXe3
enabled: false        # ← 链开关仍关,放量门控
dry_run: true         # ← 同上
odd_token_address:       0x3e130563e069c414F0a18863966c211aA5D518F9
staking_pool_address:    0x837BEB9C2Cd6B45af68CD62009d874569584DDcA
liquidity_pool_address:  0x55419B1529b89FE3C72BdC3062515f431a63F06A
betting_pool_address:    0x875D0CA32A74663E42a20d0C2b7E252b5A3121cA
sponsor_impl_address:    0x5f50756672250a59ec84fc58868488d5a784259d   # web-api only,前端无需
multicall_address:       0xcA11bde05977b3631167028862bE2a173976CA11   # canonical,不变
```
