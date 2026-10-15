# 2026-06-05 BSC Testnet Line Matrix Recovery Report

- chainId: `97`
- scenarios: `19`
- bets: `41`
- claims executed: `17`
- checks: `77 passed / 0 failed`

## Checks
- [PASS] `1x2-home-win_market_settled`: status=Settled, marketId=571d2d0183daa05cf2c3e39e66002b08950b57f63d5c947c0bd4bc758b07986d
- [PASS] `1x2-draw_market_settled`: status=Settled, marketId=52389f3241fbf811f791072d6a1428f1c1f3c52a2265b486fe1456e9944a10f7
- [PASS] `1x2-away-win_market_settled`: status=Settled, marketId=2bcf9ac97b66e1afba39b7e63438f0fad5c4d203bd812100dc7eccfb553cfcc6
- [PASS] `ou-1.5-over_market_settled`: status=Settled, marketId=568395500ea0d0b724d4371848ee1e978b6c4d5fdff9712d115a861353934341
- [PASS] `ou-1.5-under_market_settled`: status=Settled, marketId=1b5905caf29d98d3ff41a0985e23bfc505d78c8a474328a8bde762a56f0d5747
- [PASS] `ou-2.5-over_market_settled`: status=Settled, marketId=015c4aa1345a3743261c5b7b5c3119d2e87b2563194f2153c8c08d0eacf521c8
- [PASS] `ou-2.5-under_market_settled`: status=Settled, marketId=a8c8cce7c618736f703a4b194f33fb2570b779fb803832f18bfd88f4d62bb975
- [PASS] `ou-3.5-over_market_settled`: status=Settled, marketId=812d480ff693b1ec578766161a4d3b9d5131775501df6b6f1a5a36a5c47c90bb
- [PASS] `ou-3.5-under_market_settled`: status=Settled, marketId=1227a06c7a6448e1105af9d9441f7b92349bea38fa2580d9d3cb6a3d207ee76a
- [PASS] `ah--0.5-full-win_market_settled`: status=Settled, marketId=89c23cb981f2c6bd7869552d4ad6d638a4cd7a535242bc6585fab802370359d2
- [PASS] `ah--1-full-push_market_settled`: status=Settled, marketId=233314990439ed863cf91dcf75e3ca09a4ce0182b766cae7e512903a560e280f
- [PASS] `ah--1.5-full-loss_market_settled`: status=Settled, marketId=73343c29a1abb426ee5527a317d215416d8baad99e5a45f5f9fcc2757c061134
- [PASS] `ah--0.25-half-loss_market_settled`: status=Settled, marketId=a961a2978015f58d3d12a1a439966595690a2b55d66185309c4548b05a94090c
- [PASS] `ah--0.75-half-win_market_settled`: status=Settled, marketId=57909d1aad7621c1bb584087a396eb7831fe5c62d73d70bed02a8ac147ecf912
- [PASS] `ah--1.25-half-loss_market_settled`: status=Settled, marketId=09658892143470f78d1236ae020ddad35f71c272351a1a92d740286b8e19cf37
- [PASS] `ah-+0-full-push_market_settled`: status=Settled, marketId=0044f00a64c96f3e806b08119769e4b84abbdc1de81353ee5769a3729fa695b9
- [PASS] `ah-+0.25-half-win_market_settled`: status=Settled, marketId=04bbf85289e5f7770aca5cf6c27353632b3d5ab5025f41f85fa9bf0bcd099b67
- [PASS] `ah-+0.5-full-win_market_settled`: status=Settled, marketId=4e6174ae1267bd6ba836b0a5505d55fcb4aad09a2bafe070a612ecef98c42642
- [PASS] `ah-+0.75-half-loss_market_settled`: status=Settled, marketId=c52ae2eeac38ac8a28adcdefe9b772b7efe90aa052bddaa1d935813abc0893d7
- [PASS] `1x2-home-win_outcome0_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `1x2-home-win_outcome1_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-home-win_outcome2_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-draw_outcome0_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-draw_outcome1_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `1x2-draw_outcome2_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome0_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome1_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome2_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ou-1.5-over_outcome0_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ou-1.5-over_outcome1_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ou-1.5-under_outcome0_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ou-1.5-under_outcome1_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ou-2.5-over_outcome0_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ou-2.5-over_outcome1_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ou-2.5-under_outcome0_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ou-2.5-under_outcome1_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ou-3.5-over_outcome0_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ou-3.5-over_outcome1_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ou-3.5-under_outcome0_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ou-3.5-under_outcome1_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ah--0.5-full-win_outcome0_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ah--0.5-full-win_outcome1_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ah--1-full-push_outcome0_0000000000`: expected=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah--1-full-push_outcome1_0000000000`: expected=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah--1.5-full-loss_outcome0_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ah--1.5-full-loss_outcome1_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ah--0.25-half-loss_outcome0_0000000000`: expected=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--0.25-half-loss_outcome1_0000000000`: expected=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `ah--0.75-half-win_outcome0_0000000000`: expected=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `ah--0.75-half-win_outcome1_0000000000`: expected=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--1.25-half-loss_outcome0_0000000000`: expected=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--1.25-half-loss_outcome1_0000000000`: expected=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `ah-+0-full-push_outcome0_0000000000`: expected=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah-+0-full-push_outcome1_0000000000`: expected=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah-+0.25-half-win_outcome0_0000000000`: expected=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `ah-+0.25-half-win_outcome1_0000000000`: expected=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah-+0.5-full-win_outcome0_0000000000`: expected=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `ah-+0.5-full-win_outcome1_0000000000`: expected=Lost/0/0, got=Lost/0/0
- [PASS] `ah-+0.75-half-loss_outcome0_0000000000`: expected=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah-+0.75-half-loss_outcome1_0000000000`: expected=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `claim_delta_0000000000`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `claim_delta_0000000000`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `claim_delta_0000000000`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `claim_delta_0000000000`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `claim_delta_0000000000`: expected=95000000000000000000, got=95000000000000000000

## Transactions
| label | tx | status | gas |
|---|---|---:|---:|
| `RECOVER_CLAIM_0000000000` | `9eebf497a623e1b40884ad8668b3c77d684480abdd6b87fa0002f83acdbde242` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `de58c93e9482ce5fa1c1f235686945f1ec565aa8dc9629bc0dcbc1e1f4678c1c` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `965ae53e8e655fa907a3b67350ab2cce4a805d91d082280805e898c7936b578f` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `e7d9dbbddfa6c3a02293b02aa2ef5ac99441d3c3a6fa6489c45fb118c433f407` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `8cfb1d28507624bd62d5b468acc8ff3bd56886cdb2de91bffd059c80062f3f23` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `a0f9e033920058caf331cc3aa4551b0cd6ee24710b4d491b5c4d24872a550da8` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `0e3d04cf8f0c6b7b1ef81a80ce681f9abedfd829f5989d3bc48a9baf0cca9b28` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `6a03fe93cbbe9d3760f62c6df1ab064b9ae0b9dbb45c9654a3bc5011ec9f163f` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `027c62cc95ad98dc22762a4f7157ab73e37283a3e048a60b449ff97ef09f5809` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `6515af909916a77204cb54f1425b028273d92d0c3c5645c08b163a4848c849c2` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `dd37d1169209dfee33b232fdc490c4f9104362d6f9343f504b4c2bd3f56e8d00` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `1fb4138288486b6160486162aa4d90b717f782f983b08f7f549ad2c52667bfe7` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `0c6d6e155fbf68b2f5a16f25f683def235e2068ffe2360fb5f8d823eb9f3d0b9` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `c039f49a588192a92b125da5f1e6f5b877a87f7db23ddf8331de616c197a7590` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `b59e7e735b5e06b5811ebfbb6f09cdce66e0698f8af6c69bd6079e2f0065076a` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `86cd1b4a00683e6cc88456bcc251213f9c3d85d3f48fbc43c7f904ad7764d954` | `1` | `156372` |
| `RECOVER_CLAIM_0000000000` | `84a48e80f7153e50451e031ad2d707427d4fc6e28fab56ac85d5f928a3bb3bbb` | `1` | `156372` |