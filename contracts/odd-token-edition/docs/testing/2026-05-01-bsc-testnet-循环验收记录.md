# 2026-05-01 BSC Testnet 循环验收记录

## 结论

- 循环次数：`10`
- 每轮步骤：
  1. 扫描 `docs/` 与 `skills/` 历史残留；
  2. 检查 BscScan Testnet verified 状态；
  3. 执行 `docs/testing` 对应的 Foundry 场景测试套件。
- 结果：`10 / 10` 轮通过。

## BscScan Testnet Verify 状态

以下地址均已通过 BscScan Testnet 源码验证；每轮循环均通过 Etherscan API V2 `getsourcecode` 校验 `SourceCode` 与 `ABI` 非空。

| 合约 | 地址 |
|---|---|
| `ODDToken` implementation | `0xfaeFbF5261cedb41c418E403b0E95464d7CcCE67` |
| `StakingPool` implementation | `0xef52B61D93fE066d7d2D98EA5c7496c521DDCd84` |
| `LiquidityPool` implementation | `0xA412fA32911FFceAaa9c0589f41ABC72Cc4eb77C` |
| `BettingPool` implementation | `0x091C86040859033Af25cB0dFa9d06ca7334C64d4` |
| `BettingSettlementModule` | `0x0a52b1172181009f8314a1Aa198990d06C10EF80` |
| `ODDToken` proxy | `0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C` |
| `StakingPool` proxy | `0x65fd4A2529010693BA474d1993631e305a42E061` |
| `LiquidityPool` proxy | `0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f` |
| `BettingPool` proxy | `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F` |

## 历史残留扫描

每轮扫描范围：

- `docs/`
- `skills/`

扫描目标包括：

- 已删除的旧 BSC Testnet 报告路径；
- 旧 proxy / implementation 地址；
- 旧 ABI / 存储布局误导性说明；
- 过期的历史地址说明。

结果：10 轮均无命中。

## 场景测试

每轮执行命令：

```bash
MAINNET_FORK_RPC_URL='<BSC_MAINNET_RPC_URL>' forge test --offline
```

每轮结果一致：

```text
Ran 10 test suites: 35 tests passed, 0 failed, 0 skipped.
```

说明：

- 当前 `docs/testing/合约场景测试文档.md` 是链上场景验收清单；
- 自动化覆盖由当前 `test/ForkMainnet*.t.sol` 场景套件承接；
- BSC Testnet live 交易报告脚本 `script/bsc_testnet_scenario_report.py` 已更新到当前地址和当前报告名，但 live 模式受真实出块与锁盘时间影响，不用于 10 轮快速循环。
