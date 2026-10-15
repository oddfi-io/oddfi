# BNB Testnet 部署账户

> **仅用于测试网部署，禁止用于主网或存放真实资产**

| 项目 | 值 |
|------|---|
| **Address** | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` |
| **Private Key** | `0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796` |
| **Chain** | BNB Smart Chain Testnet (ChainID: 97) |
| **Faucet** | https://www.bnbchain.org/en/testnet-faucet |

## 使用方式

```bash
# 部署合约
forge script script/Deploy.s.sol --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545 --private-key 0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796 --broadcast

# 查询余额
cast balance 0x7501bCBFAAa99e6390577277D051A32ec2e64064 --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545
```
