# 2026-06-07 BSC Testnet Parlay Upgrade Line Matrix Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- scope: `line`
- scenarios: `19`
- bets: `41`
- postStartBets: `28`
- checks: `197 passed / 0 failed`
- suiteStartedAtBlock: `111884536`
- suiteFinishedAtBlock: `111888610`

## Contracts
- ODDToken: `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0`
- LiquidityPool: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
- BettingPool: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`

## Actors
- `admin`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- `bettor0`: `0xDf452066FB45bde0702A0d2B469B254623f76B97`
- `bettor1`: `0xE34886EBFae64cFdf1DB3B990352a68FE3Db0Dbf`
- `bettor2`: `0xE60D3Fb13A9Cb25a21cB62C1441cc29B57655B9C`
- `lpUser`: `0xF5E0Aace148b1bD8ab803e3f81dB9cDBcAA92D75`

## Checks
- [PASS] `SEED_BNB_bettor0_status`: status=1, tx=616352aad85bec2ebf299b1faf30ea52dadfe7676a94b348a62c9601b828ed6b
- [PASS] `SEED_BNB_bettor1_status`: status=1, tx=4f3c092b5807317a1fc441e9f96aa89f38e94593458091940aba2b695074e3bf
- [PASS] `SEED_ODD_bettor1_status`: status=1, tx=09d0b72bd4ccfe9b88da4da1124c974e53cefb3d7a98c5c810a7bb82b2b71710
- [PASS] `OPEN_1x2-home-win_status`: status=1, tx=8e8389fce25ddacc6e46add1fb0631fe87838478d8d1bd066abc65070763d5d0
- [PASS] `DEPOSIT_MATCH_LP_FOR_FIRST_MATRIX_MATCH_status`: status=1, tx=bd12e4d979a420fedbc6fe5fc3070552fdfaeb5fb4fdee4d50601606e9d37f95
- [PASS] `PLACE_1x2-home-win_outcome0_status`: status=1, tx=219ab781e8cccb49d3f048c925ab5b52325fe996baf277f6f0f3d39d0aa264fd
- [PASS] `PLACE_1x2-home-win_outcome1_status`: status=1, tx=5a56a4d5643f8763993beda70408306cd3b4925eede5774439605412ecfc69b0
- [PASS] `PLACE_1x2-home-win_outcome2_status`: status=1, tx=be3c7eadc0cdd62df01c1f6b077d21df34e9454bb202105028b49f090c384d9b
- [PASS] `OPEN_1x2-draw_status`: status=1, tx=a229224ae74bbff7b6d71c68616ddc7793e8283793c9bb7f1bbb40912d24d3a9
- [PASS] `PLACE_1x2-draw_outcome0_status`: status=1, tx=7fb6710e9741bb06909ba64765f00d8ef66f0b1961af302dd3fe3e2459ec5f0b
- [PASS] `PLACE_1x2-draw_outcome1_status`: status=1, tx=0410871d03ff09923c72063fb9c17c1b844edc43b7fb96b15b58ab00d1f53c2f
- [PASS] `PLACE_1x2-draw_outcome2_status`: status=1, tx=2d6a8cb7f5d4d3995441101036daff0ecb0515398589628bc8c7f1f0bbdfec3d
- [PASS] `OPEN_1x2-away-win_status`: status=1, tx=e090984623366629e737bc7d2f21c83291616d66a5e7ff32fe95de7f1770bb84
- [PASS] `PLACE_1x2-away-win_outcome0_status`: status=1, tx=fa6fead10e25fa3068689b21d4b1981306bb6b7088aab5321fdf9f31c1bbfb90
- [PASS] `PLACE_1x2-away-win_outcome1_status`: status=1, tx=baecbbb8c5741425d134b946fdb30c03000f16b5356f57f57a317bcfd5b7d3ba
- [PASS] `PLACE_1x2-away-win_outcome2_status`: status=1, tx=070370106d27cec151d8ce429e78c05419297d995d450a416748b3ae917e4f55
- [PASS] `OPEN_ou-1.5-over_status`: status=1, tx=608de3c55792e208f8740b2e790ea23cdd6b00f26a313b6c102514ffc8597bdf
- [PASS] `PLACE_ou-1.5-over_outcome0_status`: status=1, tx=78ca7f9c92e59c7a775f75097c898e18ee69472d96cc81b20215518b8686aa72
- [PASS] `PLACE_ou-1.5-over_outcome1_status`: status=1, tx=1616bdc7e0f0f1aff76c94666c48169e052cb68f70d9a61ecd0904412355c303
- [PASS] `OPEN_ou-1.5-under_status`: status=1, tx=c49915bbf2a183819dd3e3bae76aa490ce77319bbd7d8aab7be2cfc2a4933e45
- [PASS] `PLACE_ou-1.5-under_outcome0_status`: status=1, tx=1adf457b4c42e0ded8ca20d7d479b963ec2a7777a7155582c3f68976102b29d5
- [PASS] `PLACE_ou-1.5-under_outcome1_status`: status=1, tx=1c2c256e4622cf0d2b2182d9df05f3be8fd687b29174ff813f8576f2bc3d2357
- [PASS] `OPEN_ou-2.5-over_status`: status=1, tx=3b21ba27b0250d2001b45f8d20d58c2a7f7ba5ec7494d37d5a5120aff6e7cadd
- [PASS] `PLACE_ou-2.5-over_outcome0_status`: status=1, tx=11e6a0ae18b562f347cefd470b10952d778e909f828da6f3b74e059baf1823fd
- [PASS] `PLACE_ou-2.5-over_outcome1_status`: status=1, tx=41bc4547e8e606f7540b6fb63872c6c45c401fb5b5e54a82972454e3fb72a8bf
- [PASS] `OPEN_ou-2.5-under_status`: status=1, tx=a60bb4ec48c9e1c0cd79792c2cd89f10728b5907565b8d05f1f6b70b83406028
- [PASS] `PLACE_ou-2.5-under_outcome0_status`: status=1, tx=e99292a928f8f605259f33f1d32c3708379feeb0d4dad12bd5481fded73697f2
- [PASS] `PLACE_ou-2.5-under_outcome1_status`: status=1, tx=9e4b06d3a58fe5e5af805ab8adc7203ef5f4eb1c95eed6577f251d4fe50dfed3
- [PASS] `OPEN_ou-3.5-over_status`: status=1, tx=1897912d02903912010c6598d7c19484e000ee8eae8cff7c90cfb445ed73ffa6
- [PASS] `PLACE_ou-3.5-over_outcome0_status`: status=1, tx=afa405f145714d96acd7744f0ef1db727c8aac30bc4dfe94678d33561b2efa47
- [PASS] `PLACE_ou-3.5-over_outcome1_status`: status=1, tx=60f8ae982a7bb3548ff9f2af0d88ac5bb6670b52490eb41a0c37de716d79a403
- [PASS] `OPEN_ou-3.5-under_status`: status=1, tx=09e9871fae8c51456fd57e99a85fc95c60a151892bc26a13511b316dd0be65f9
- [PASS] `PLACE_ou-3.5-under_outcome0_status`: status=1, tx=c17532081c0d7c2bc733a0c3bf24a36da9225307ecf03ad1afda7a22c127e9cb
- [PASS] `PLACE_ou-3.5-under_outcome1_status`: status=1, tx=35efee39311e8511d038ddd4f66bccf572fa0169d5f267ca92e7932476981827
- [PASS] `OPEN_ah--0.5-full-win_status`: status=1, tx=af3a914bd829e2ee6eeaad4a5d93a433179e87c0cef4936784956aab3d4a884b
- [PASS] `PLACE_ah--0.5-full-win_outcome0_status`: status=1, tx=730e12e065df7e1633654748a0d87c58290450edb5ba30966865ed68115f77ed
- [PASS] `PLACE_ah--0.5-full-win_outcome1_status`: status=1, tx=c0d622856cda97b428aeb27888729e16f40315a40aedaa81a76355c09f15a7a3
- [PASS] `OPEN_ah--1-full-push_status`: status=1, tx=953a0d7056e29b4e076a78215f207528da6e3bcf25b6f124d7edddfed482b567
- [PASS] `PLACE_ah--1-full-push_outcome0_status`: status=1, tx=ff8c6fcbe21d1b0c6f2cde228cab92fd95d75695fed8e659b45a37598e3a49e7
- [PASS] `PLACE_ah--1-full-push_outcome1_status`: status=1, tx=60e59993f8bbc91091cc3dff6ed17adaf9d808822201eb06227bbbc919b94cee
- [PASS] `OPEN_ah--1.5-full-loss_status`: status=1, tx=a0c2835fafc2394c4cc955dfa929e92ab319f73bd85e21b74cace2947db796cd
- [PASS] `PLACE_ah--1.5-full-loss_outcome0_status`: status=1, tx=72eb22bef227341b64a1484feb0b78329b293bb2df9fb15c4a12e8402d605cb7
- [PASS] `PLACE_ah--1.5-full-loss_outcome1_status`: status=1, tx=dfb60f1f3499596473f426839ec43ebcc1adbac1e0a4cde4a5ce14ca35a26147
- [PASS] `OPEN_ah--0.25-half-loss_status`: status=1, tx=0fdd9fd1d1bf18eb280438108373e97185af4c073f735eeb27313b66973a7174
- [PASS] `PLACE_ah--0.25-half-loss_outcome0_status`: status=1, tx=2213e1bef7e32c62f0bd8392e3ecc54b2c49f015ea6c1880fc0800406f5628f5
- [PASS] `PLACE_ah--0.25-half-loss_outcome1_status`: status=1, tx=2d1fa59adda72e19125bc09dbc6570497ad37e11d65502e3410c26b2b1844b0b
- [PASS] `OPEN_ah--0.75-half-win_status`: status=1, tx=ea37b54b33cb69e68dbd95e61a10665eff33f6d71b6d565896b1e4d433052d61
- [PASS] `PLACE_ah--0.75-half-win_outcome0_status`: status=1, tx=73e537ed434669d5ae88c4e5f33094efc6f70e6eda50e7a45ed280229ffaa525
- [PASS] `PLACE_ah--0.75-half-win_outcome1_status`: status=1, tx=65ab6ae8a31edc8069a5b0103c97c33c734dc69d935546e890102e4bce7a8b3b
- [PASS] `OPEN_ah--1.25-half-loss_status`: status=1, tx=9e581b05643c8caa819a7dd35f7448ac307154361d8d951e5e0bb8ee8169f744
- [PASS] `PLACE_ah--1.25-half-loss_outcome0_status`: status=1, tx=bda2a5f00c2ebfa2c26aa1c1b5e959a0b05afdc66e2d08074c086aebe21e6fc0
- [PASS] `PLACE_ah--1.25-half-loss_outcome1_status`: status=1, tx=b965674b7f4c9cc8ed24aa547cb6c337c81737669c9d1d6d963c643d206e361a
- [PASS] `OPEN_ah-+0-full-push_status`: status=1, tx=464874e0c49a58b75ef7d2593b5351d2dc5b962ce8d572e7e78296cf8cd49b1d
- [PASS] `PLACE_ah-+0-full-push_outcome0_status`: status=1, tx=3eccb5e5bfd74dbe027d8593a8ae75d9fe748ccb7a972b32d9f63deb6ebb1ddf
- [PASS] `PLACE_ah-+0-full-push_outcome1_status`: status=1, tx=04f00493acafe80e001d994bd24ce883f9ae52902290d1e4e362a6812c7e270b
- [PASS] `OPEN_ah-+0.25-half-win_status`: status=1, tx=62250052d6ae8f3a64f9d5287798f1ff4d0fdd78f6697023d465cea102d3fab2
- [PASS] `PLACE_ah-+0.25-half-win_outcome0_status`: status=1, tx=5a863a0bebd1e5f04d0beffaba35ac3e5544024d688f1db24a7eac7f160e9065
- [PASS] `PLACE_ah-+0.25-half-win_outcome1_status`: status=1, tx=027045c93d364d9ef899f272514ec3205243b46d48939971760c63c7c3c23096
- [PASS] `OPEN_ah-+0.5-full-win_status`: status=1, tx=b6655e0496ed7e6be8aef5ed6cb5c8134f88d914c47c5afc89c656c13afe00cc
- [PASS] `PLACE_ah-+0.5-full-win_outcome0_status`: status=1, tx=ed3f3131e9003d80d45aa4f5a717eebce34cda4cf04f3543c0ca7804342d1fcd
- [PASS] `PLACE_ah-+0.5-full-win_outcome1_status`: status=1, tx=bc0ed93c37cbf41fff6ebb1298e28b81d3b86c8081039445336e4589a9640e11
- [PASS] `OPEN_ah-+0.75-half-loss_status`: status=1, tx=59ab4668bb9c3e5b2c0adb98bc992218804190ad30cb579327490e3a4853008d
- [PASS] `PLACE_ah-+0.75-half-loss_outcome0_status`: status=1, tx=c8571258a7e2a1e30d529c467d1a87e5a357b2e9853055173cc2fedcd8f60141
- [PASS] `PLACE_ah-+0.75-half-loss_outcome1_status`: status=1, tx=821dce4de869e12b4d9dca9b8ed8b19321675e0791946d3609332893e0392103
- [PASS] `post_start_betting_covered`: 28 bets mined at/after matchStartTime; examples=['ou-2.5-over/outcome0@1780791333', 'ou-2.5-over/outcome1@1780791343', 'ou-2.5-under/outcome0@1780791356', 'ou-2.5-under/outcome1@1780791362', 'ou-3.5-over/outcome0@1780791380']
- [PASS] `SETTLE_1x2-home-win_status`: status=1, tx=871cc9b39e2967a01ecdc36fdc777998ffca1e37be9bc7c208f38175eba6c157
- [PASS] `FINALIZE_1x2-home-win_status`: status=1, tx=3e570e875176a2c5ad7217307e9b23b910af0ebd59e75561c46f33230d1c5680
- [PASS] `1x2-home-win_market_settled`: status=Settled
- [PASS] `SETTLE_1x2-draw_status`: status=1, tx=c46fafe68205f499c0fc29307074cfe1c0fe988ac0015b8a74abf3ecab6f7689
- [PASS] `FINALIZE_1x2-draw_status`: status=1, tx=1a6bd704d17789185ff1dc4e627212bfb7554d0273bacdefdcc72a506cf28299
- [PASS] `1x2-draw_market_settled`: status=Settled
- [PASS] `SETTLE_1x2-away-win_status`: status=1, tx=3b9b1dd8f95d28d38247d5cf979b85883bf4ebdf6135767f331624a7a5664ec6
- [PASS] `FINALIZE_1x2-away-win_status`: status=1, tx=d7126846b5d83d8a5ff33dd9c8ca294ba96357be804376a17c0bc8e091fbc274
- [PASS] `1x2-away-win_market_settled`: status=Settled
- [PASS] `SETTLE_ou-1.5-over_status`: status=1, tx=68f61aaac3ca98d38afbc519519d4eaac29c354213cf55cae02d7f433500a406
- [PASS] `FINALIZE_ou-1.5-over_status`: status=1, tx=3a3e9f11cbc9eb12885422a97003b5e8a28338cf51869cf351b7fdb9c05c49b8
- [PASS] `ou-1.5-over_market_settled`: status=Settled
- [PASS] `SETTLE_ou-1.5-under_status`: status=1, tx=b5f8f41c380e9a650bf3062a962a114f814eab6e0d6071aa9d82bb2dec4c9f65
- [PASS] `FINALIZE_ou-1.5-under_status`: status=1, tx=92189c27672598a1b3d919c568b5444f55748a00428d7267a314addd7c02a77b
- [PASS] `ou-1.5-under_market_settled`: status=Settled
- [PASS] `SETTLE_ou-2.5-over_status`: status=1, tx=b32b63ffdf6c81fb970c6e7b53df15ed2e81b470d04b1bb1bdbae7d3d0e8b915
- [PASS] `FINALIZE_ou-2.5-over_status`: status=1, tx=597cc16a62f3d593a600f924cd83759068c146740d7e698d40f17f42b6af2438
- [PASS] `ou-2.5-over_market_settled`: status=Settled
- [PASS] `SETTLE_ou-2.5-under_status`: status=1, tx=0da68e72bdcb721a68acaf1f938a54260bf0fbb5cb629f804d0673da95268df0
- [PASS] `FINALIZE_ou-2.5-under_status`: status=1, tx=574a510e97dfe2a6d6e0f7a93e398ebd5ea8d86bcbb30a0238c5b5acf851a5c2
- [PASS] `ou-2.5-under_market_settled`: status=Settled
- [PASS] `SETTLE_ou-3.5-over_status`: status=1, tx=dec4616fa25f76fda3910c1ba94b16a1171ea2ad4333961de8cfa2b03dd7ea34
- [PASS] `FINALIZE_ou-3.5-over_status`: status=1, tx=9baaa300e94c8a5343b42c50c0e14a4afaa887d02ff4b215bf41c28d93f78a13
- [PASS] `ou-3.5-over_market_settled`: status=Settled
- [PASS] `SETTLE_ou-3.5-under_status`: status=1, tx=97f7105bcc4c5eb2839742d6da73488e04fd5228ff141185125966cf69bedab3
- [PASS] `FINALIZE_ou-3.5-under_status`: status=1, tx=2d7347a290a9c3d279d44d66d731caa31f7160d8acbf89c02ef8398915a575a8
- [PASS] `ou-3.5-under_market_settled`: status=Settled
- [PASS] `SETTLE_ah--0.5-full-win_status`: status=1, tx=b28f5ba75468ea7e068b0d0d110123bfa6a073656b3cb8f65293260d679a8aac
- [PASS] `FINALIZE_ah--0.5-full-win_status`: status=1, tx=91fdca5889678ef29b941572319f974ce25c8ac4bf954bb081385718db8360ce
- [PASS] `ah--0.5-full-win_market_settled`: status=Settled
- [PASS] `SETTLE_ah--1-full-push_status`: status=1, tx=160426d625e95fd92ca1bc3ce76909aa7a2010667a49017b1cb61074774af2fd
- [PASS] `FINALIZE_ah--1-full-push_status`: status=1, tx=34c1cd42c6a4f507c1493e685288d5bd23a8f40d423bbc8b2832f59975e068d3
- [PASS] `ah--1-full-push_market_settled`: status=Settled
- [PASS] `SETTLE_ah--1.5-full-loss_status`: status=1, tx=b28d1f6faabd746fdbe47b4adb9860bae0dcc6c5a3d22a49e577b98e52378fa4
- [PASS] `FINALIZE_ah--1.5-full-loss_status`: status=1, tx=4b333b052c0f004242e3a26451437ff9e06206b2cc81db8be72f1f6f1e555a6d
- [PASS] `ah--1.5-full-loss_market_settled`: status=Settled
- [PASS] `SETTLE_ah--0.25-half-loss_status`: status=1, tx=5d3332424c68d3b7694881a5101249be401bcf45d6fe954d92bf110e48fa2966
- [PASS] `FINALIZE_ah--0.25-half-loss_status`: status=1, tx=e2d50c68c8f2bd41f99b9cd78687d9c14b5189bf3f8d5dae90a903f5254b2a59
- [PASS] `ah--0.25-half-loss_market_settled`: status=Settled
- [PASS] `SETTLE_ah--0.75-half-win_status`: status=1, tx=f75cac9f2c3d6983ce43f1949cfb28b37df466d2db906610998db15edd286c16
- [PASS] `FINALIZE_ah--0.75-half-win_status`: status=1, tx=875b6f4aeb873c3308234b3109dca21f766e9f52070867f92ce0f6fc9a930db4
- [PASS] `ah--0.75-half-win_market_settled`: status=Settled
- [PASS] `SETTLE_ah--1.25-half-loss_status`: status=1, tx=18a72e1ac702e450ffb95eb4ed6e00465770df876dad7679721b7ca9b6053f1e
- [PASS] `FINALIZE_ah--1.25-half-loss_status`: status=1, tx=3adf094b63c46c5b912611fc9b77ce5bad8bb235757f0aaa4d2483c61eecf488
- [PASS] `ah--1.25-half-loss_market_settled`: status=Settled
- [PASS] `SETTLE_ah-+0-full-push_status`: status=1, tx=abb494c13654e8d0b941567debc46f415f24234f740d82a223ccaf7e4e411962
- [PASS] `FINALIZE_ah-+0-full-push_status`: status=1, tx=dd95dd6e5c349adc096a8251aeaca70a68e9b3f0b3155e1aa59d35344958fc64
- [PASS] `ah-+0-full-push_market_settled`: status=Settled
- [PASS] `SETTLE_ah-+0.25-half-win_status`: status=1, tx=62524396e9aa54c1c4d26a5fd7dcef63b60bb2b5190cbc804ad2cb431dd4c43f
- [PASS] `FINALIZE_ah-+0.25-half-win_status`: status=1, tx=f35f11ea85ba5b45a38673131dba60bd2e7a9574056b4dc66fef1dbe789c1577
- [PASS] `ah-+0.25-half-win_market_settled`: status=Settled
- [PASS] `SETTLE_ah-+0.5-full-win_status`: status=1, tx=6e93b2c62672a3eb67b38b81d40dcf9d405463001ffcbaf403168fad913c897f
- [PASS] `FINALIZE_ah-+0.5-full-win_status`: status=1, tx=567020fd3dbbaff6581d3d176021e884de0ba2b9153dc0517bce29430887f528
- [PASS] `ah-+0.5-full-win_market_settled`: status=Settled
- [PASS] `SETTLE_ah-+0.75-half-loss_status`: status=1, tx=5d8075856f38acad80eb081fd1dfb90936c758db1a33e9d5e5909a7ff5348666
- [PASS] `FINALIZE_ah-+0.75-half-loss_status`: status=1, tx=ddf322a5b133d5070d24e63bd9b9a2677f09f6e034a36a0005f6443be77a7d74
- [PASS] `ah-+0.75-half-loss_market_settled`: status=Settled
- [PASS] `1x2-home-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_1x2-home-win_outcome0_status`: status=1, tx=6d00df0ee6b819f1b7bcd492eac132025f36bf4b46b4d8d9cddbd570671627a7
- [PASS] `1x2-home-win_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `1x2-home-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-home-win_outcome2_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-draw_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-draw_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_1x2-draw_outcome1_status`: status=1, tx=1412487f3dd441c165ec0694a36c760a45b74b8b46b80b69adcfa2f0024ed612
- [PASS] `1x2-draw_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `1x2-draw_outcome2_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome2_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_1x2-away-win_outcome2_status`: status=1, tx=409eaf9d801dcd5ec7578a80d1123202ad19a1de827d9e2e8b4910523102e064
- [PASS] `1x2-away-win_outcome2_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-1.5-over_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-1.5-over_outcome0_status`: status=1, tx=6a80f858965c2872ff357d15ae7819e8e379f93afddefb4fa18e7edce23f58d2
- [PASS] `ou-1.5-over_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-1.5-over_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-1.5-under_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-1.5-under_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-1.5-under_outcome1_status`: status=1, tx=630cbf5654b9b0369c7b90cb0d527209c447a98263057e44bf62f489d9a01ea7
- [PASS] `ou-1.5-under_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-2.5-over_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-2.5-over_outcome0_status`: status=1, tx=0d2b0817baad46d6c0677afe20cccecb05b259ebbafeb6c4fd74146d666ef550
- [PASS] `ou-2.5-over_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-2.5-over_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-2.5-under_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-2.5-under_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-2.5-under_outcome1_status`: status=1, tx=7dae8fef292f73af5a1a1230378ee37e04f18a87b1e522d51fc4322b20833aec
- [PASS] `ou-2.5-under_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-3.5-over_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-3.5-over_outcome0_status`: status=1, tx=1c532d60a58f0dd56def95c4392508662ff9bde0036719c93a82696451ba6ac5
- [PASS] `ou-3.5-over_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-3.5-over_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-3.5-under_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-3.5-under_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-3.5-under_outcome1_status`: status=1, tx=1ac1ad7da9824c79f50b98d6ae5ca6a8b27551d9faf5a3a0c2f32fe4604c9768
- [PASS] `ou-3.5-under_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ah--0.5-full-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ah--0.5-full-win_outcome0_status`: status=1, tx=805441ad4c4ab25efe78279b6b12af2b00e844bdb22e2cdb0281c56bf0b2eb7a
- [PASS] `ah--0.5-full-win_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ah--0.5-full-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ah--1-full-push_outcome0_pre_claim`: expected state/refund/claimable=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah--1-full-push_outcome1_pre_claim`: expected state/refund/claimable=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah--1.5-full-loss_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ah--1.5-full-loss_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ah--1.5-full-loss_outcome1_status`: status=1, tx=4dae754a9b8e4b4d7b90307af18896a4a2c82859c4e62bec48595f127d3dd0e2
- [PASS] `ah--1.5-full-loss_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ah--0.25-half-loss_outcome0_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--0.25-half-loss_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah--0.25-half-loss_outcome1_status`: status=1, tx=d6ff134f45ded7ae927ab204b3dfcd7e082c9e39b577db17e884d734714e7af5
- [PASS] `ah--0.25-half-loss_outcome1_claim_net`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `ah--0.75-half-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah--0.75-half-win_outcome0_status`: status=1, tx=01a7c6b26728faa76f4469f4a8b5bc3fa0353f62995a4c0238745a40a40c0d0a
- [PASS] `ah--0.75-half-win_outcome0_claim_net`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `ah--0.75-half-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--1.25-half-loss_outcome0_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--1.25-half-loss_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah--1.25-half-loss_outcome1_status`: status=1, tx=dade1a55bde945a228369607a68832494b9bbf349044898a1602963fc7afae51
- [PASS] `ah--1.25-half-loss_outcome1_claim_net`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `ah-+0-full-push_outcome0_pre_claim`: expected state/refund/claimable=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah-+0-full-push_outcome1_pre_claim`: expected state/refund/claimable=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah-+0.25-half-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah-+0.25-half-win_outcome0_status`: status=1, tx=c3e809d7dd47c9596b2f2b8306721886c5337fa779c1046a0c7d769cc931ecd1
- [PASS] `ah-+0.25-half-win_outcome0_claim_net`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `ah-+0.25-half-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah-+0.5-full-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ah-+0.5-full-win_outcome0_status`: status=1, tx=39bafd84279837bba0560acdd542f0c1240ce40a6d829224b4f1bc7595a20ea2
- [PASS] `ah-+0.5-full-win_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ah-+0.5-full-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ah-+0.75-half-loss_outcome0_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah-+0.75-half-loss_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah-+0.75-half-loss_outcome1_status`: status=1, tx=a465754afad62796ff2c5703236fcadccba8a3ab8ed2d6a1bb7ee31153dede4f
- [PASS] `ah-+0.75-half-loss_outcome1_claim_net`: expected=95000000000000000000, got=95000000000000000000

## Issues
- No line-matrix functional issues found in this run.

## Scenario Matrix
| scenario | market | score | outcome | expected result | final state | refunded ODD | claimable ODD | net claim ODD | betId | claim tx |
|---|---|---:|---:|---|---|---:|---:|---:|---|---|
| `1x2-home-win` | `1X2` | `1-0` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000208` | `6d00df0ee6b819f1b7bcd492eac132025f36bf4b46b4d8d9cddbd570671627a7` |
| `1x2-home-win` | `1X2` | `1-0` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000209` | `-` |
| `1x2-home-win` | `1X2` | `1-0` | `2` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000020a` | `-` |
| `1x2-draw` | `1X2` | `1-1` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000020b` | `-` |
| `1x2-draw` | `1X2` | `1-1` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000020c` | `1412487f3dd441c165ec0694a36c760a45b74b8b46b80b69adcfa2f0024ed612` |
| `1x2-draw` | `1X2` | `1-1` | `2` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000020d` | `-` |
| `1x2-away-win` | `1X2` | `0-1` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000020e` | `-` |
| `1x2-away-win` | `1X2` | `0-1` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000020f` | `-` |
| `1x2-away-win` | `1X2` | `0-1` | `2` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000210` | `409eaf9d801dcd5ec7578a80d1123202ad19a1de827d9e2e8b4910523102e064` |
| `ou-1.5-over` | `OU 1.5` | `2-0` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000211` | `6a80f858965c2872ff357d15ae7819e8e379f93afddefb4fa18e7edce23f58d2` |
| `ou-1.5-over` | `OU 1.5` | `2-0` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000212` | `-` |
| `ou-1.5-under` | `OU 1.5` | `1-0` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000213` | `-` |
| `ou-1.5-under` | `OU 1.5` | `1-0` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000214` | `630cbf5654b9b0369c7b90cb0d527209c447a98263057e44bf62f489d9a01ea7` |
| `ou-2.5-over` | `OU 2.5` | `2-1` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000215` | `0d2b0817baad46d6c0677afe20cccecb05b259ebbafeb6c4fd74146d666ef550` |
| `ou-2.5-over` | `OU 2.5` | `2-1` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000216` | `-` |
| `ou-2.5-under` | `OU 2.5` | `1-1` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000217` | `-` |
| `ou-2.5-under` | `OU 2.5` | `1-1` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000218` | `7dae8fef292f73af5a1a1230378ee37e04f18a87b1e522d51fc4322b20833aec` |
| `ou-3.5-over` | `OU 3.5` | `3-1` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000219` | `1c532d60a58f0dd56def95c4392508662ff9bde0036719c93a82696451ba6ac5` |
| `ou-3.5-over` | `OU 3.5` | `3-1` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000021a` | `-` |
| `ou-3.5-under` | `OU 3.5` | `1-1` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000021b` | `-` |
| `ou-3.5-under` | `OU 3.5` | `1-1` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000021c` | `1ac1ad7da9824c79f50b98d6ae5ca6a8b27551d9faf5a3a0c2f32fe4604c9768` |
| `ah--0.5-full-win` | `AH -0.5` | `1-0` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000021d` | `805441ad4c4ab25efe78279b6b12af2b00e844bdb22e2cdb0281c56bf0b2eb7a` |
| `ah--0.5-full-win` | `AH -0.5` | `1-0` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000021e` | `-` |
| `ah--1-full-push` | `AH -1` | `1-0` | `0` | `FullPush` | `Refunded` | `100` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000021f` | `-` |
| `ah--1-full-push` | `AH -1` | `1-0` | `1` | `FullPush` | `Refunded` | `100` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000220` | `-` |
| `ah--1.5-full-loss` | `AH -1.5` | `1-0` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000221` | `-` |
| `ah--1.5-full-loss` | `AH -1.5` | `1-0` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000222` | `4dae754a9b8e4b4d7b90307af18896a4a2c82859c4e62bec48595f127d3dd0e2` |
| `ah--0.25-half-loss` | `AH -0.25` | `0-0` | `0` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000223` | `-` |
| `ah--0.25-half-loss` | `AH -0.25` | `0-0` | `1` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `0000000000000000000000000000000000000000000000000000000000000224` | `d6ff134f45ded7ae927ab204b3dfcd7e082c9e39b577db17e884d734714e7af5` |
| `ah--0.75-half-win` | `AH -0.75` | `1-0` | `0` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `0000000000000000000000000000000000000000000000000000000000000225` | `01a7c6b26728faa76f4469f4a8b5bc3fa0353f62995a4c0238745a40a40c0d0a` |
| `ah--0.75-half-win` | `AH -0.75` | `1-0` | `1` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000226` | `-` |
| `ah--1.25-half-loss` | `AH -1.25` | `1-0` | `0` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000227` | `-` |
| `ah--1.25-half-loss` | `AH -1.25` | `1-0` | `1` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `0000000000000000000000000000000000000000000000000000000000000228` | `dade1a55bde945a228369607a68832494b9bbf349044898a1602963fc7afae51` |
| `ah-+0-full-push` | `AH +0` | `0-0` | `0` | `FullPush` | `Refunded` | `100` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000229` | `-` |
| `ah-+0-full-push` | `AH +0` | `0-0` | `1` | `FullPush` | `Refunded` | `100` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000022a` | `-` |
| `ah-+0.25-half-win` | `AH +0.25` | `0-0` | `0` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `000000000000000000000000000000000000000000000000000000000000022b` | `c3e809d7dd47c9596b2f2b8306721886c5337fa779c1046a0c7d769cc931ecd1` |
| `ah-+0.25-half-win` | `AH +0.25` | `0-0` | `1` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000022c` | `-` |
| `ah-+0.5-full-win` | `AH +0.5` | `0-0` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000022d` | `39bafd84279837bba0560acdd542f0c1240ce40a6d829224b4f1bc7595a20ea2` |
| `ah-+0.5-full-win` | `AH +0.5` | `0-0` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000022e` | `-` |
| `ah-+0.75-half-loss` | `AH +0.75` | `0-1` | `0` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000022f` | `-` |
| `ah-+0.75-half-loss` | `AH +0.75` | `0-1` | `1` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `0000000000000000000000000000000000000000000000000000000000000230` | `a465754afad62796ff2c5703236fcadccba8a3ab8ed2d6a1bb7ee31153dede4f` |

## Transactions
| # | label | actor | tx | status | gas |
|---:|---|---|---|---:|---:|
| 1 | `SEED_BNB_bettor0` | `admin` | `616352aad85bec2ebf299b1faf30ea52dadfe7676a94b348a62c9601b828ed6b` | `1` | `21000` |
| 2 | `SEED_BNB_bettor1` | `admin` | `4f3c092b5807317a1fc441e9f96aa89f38e94593458091940aba2b695074e3bf` | `1` | `21000` |
| 3 | `SEED_ODD_bettor1` | `admin` | `09d0b72bd4ccfe9b88da4da1124c974e53cefb3d7a98c5c810a7bb82b2b71710` | `1` | `41472` |
| 4 | `OPEN_1x2-home-win` | `admin` | `8e8389fce25ddacc6e46add1fb0631fe87838478d8d1bd066abc65070763d5d0` | `1` | `520234` |
| 5 | `DEPOSIT_MATCH_LP_FOR_FIRST_MATRIX_MATCH` | `lpUser` | `bd12e4d979a420fedbc6fe5fc3070552fdfaeb5fb4fdee4d50601606e9d37f95` | `1` | `263736` |
| 6 | `PLACE_1x2-home-win_outcome0` | `bettor0` | `219ab781e8cccb49d3f048c925ab5b52325fe996baf277f6f0f3d39d0aa264fd` | `1` | `491722` |
| 7 | `PLACE_1x2-home-win_outcome1` | `bettor1` | `5a56a4d5643f8763993beda70408306cd3b4925eede5774439605412ecfc69b0` | `1` | `487744` |
| 8 | `PLACE_1x2-home-win_outcome2` | `bettor2` | `be3c7eadc0cdd62df01c1f6b077d21df34e9454bb202105028b49f090c384d9b` | `1` | `490981` |
| 9 | `OPEN_1x2-draw` | `admin` | `a229224ae74bbff7b6d71c68616ddc7793e8283793c9bb7f1bbb40912d24d3a9` | `1` | `520234` |
| 10 | `PLACE_1x2-draw_outcome0` | `bettor0` | `7fb6710e9741bb06909ba64765f00d8ef66f0b1961af302dd3fe3e2459ec5f0b` | `1` | `491734` |
| 11 | `PLACE_1x2-draw_outcome1` | `bettor1` | `0410871d03ff09923c72063fb9c17c1b844edc43b7fb96b15b58ab00d1f53c2f` | `1` | `487756` |
| 12 | `PLACE_1x2-draw_outcome2` | `bettor2` | `2d6a8cb7f5d4d3995441101036daff0ecb0515398589628bc8c7f1f0bbdfec3d` | `1` | `487756` |
| 13 | `OPEN_1x2-away-win` | `admin` | `e090984623366629e737bc7d2f21c83291616d66a5e7ff32fe95de7f1770bb84` | `1` | `520234` |
| 14 | `PLACE_1x2-away-win_outcome0` | `bettor0` | `fa6fead10e25fa3068689b21d4b1981306bb6b7088aab5321fdf9f31c1bbfb90` | `1` | `491734` |
| 15 | `PLACE_1x2-away-win_outcome1` | `bettor1` | `baecbbb8c5741425d134b946fdb30c03000f16b5356f57f57a317bcfd5b7d3ba` | `1` | `487756` |
| 16 | `PLACE_1x2-away-win_outcome2` | `bettor2` | `070370106d27cec151d8ce429e78c05419297d995d450a416748b3ae917e4f55` | `1` | `487756` |
| 17 | `OPEN_ou-1.5-over` | `admin` | `608de3c55792e208f8740b2e790ea23cdd6b00f26a313b6c102514ffc8597bdf` | `1` | `470839` |
| 18 | `PLACE_ou-1.5-over_outcome0` | `bettor0` | `78ca7f9c92e59c7a775f75097c898e18ee69472d96cc81b20215518b8686aa72` | `1` | `476539` |
| 19 | `PLACE_ou-1.5-over_outcome1` | `bettor1` | `1616bdc7e0f0f1aff76c94666c48169e052cb68f70d9a61ecd0904412355c303` | `1` | `474627` |
| 20 | `OPEN_ou-1.5-under` | `admin` | `c49915bbf2a183819dd3e3bae76aa490ce77319bbd7d8aab7be2cfc2a4933e45` | `1` | `470839` |
| 21 | `PLACE_ou-1.5-under_outcome0` | `bettor0` | `1adf457b4c42e0ded8ca20d7d479b963ec2a7777a7155582c3f68976102b29d5` | `1` | `476539` |
| 22 | `PLACE_ou-1.5-under_outcome1` | `bettor1` | `1c2c256e4622cf0d2b2182d9df05f3be8fd687b29174ff813f8576f2bc3d2357` | `1` | `474627` |
| 23 | `OPEN_ou-2.5-over` | `admin` | `3b21ba27b0250d2001b45f8d20d58c2a7f7ba5ec7494d37d5a5120aff6e7cadd` | `1` | `470851` |
| 24 | `PLACE_ou-2.5-over_outcome0` | `bettor0` | `11e6a0ae18b562f347cefd470b10952d778e909f828da6f3b74e059baf1823fd` | `1` | `476539` |
| 25 | `PLACE_ou-2.5-over_outcome1` | `bettor1` | `41bc4547e8e606f7540b6fb63872c6c45c401fb5b5e54a82972454e3fb72a8bf` | `1` | `474627` |
| 26 | `OPEN_ou-2.5-under` | `admin` | `a60bb4ec48c9e1c0cd79792c2cd89f10728b5907565b8d05f1f6b70b83406028` | `1` | `470827` |
| 27 | `PLACE_ou-2.5-under_outcome0` | `bettor0` | `e99292a928f8f605259f33f1d32c3708379feeb0d4dad12bd5481fded73697f2` | `1` | `476539` |
| 28 | `PLACE_ou-2.5-under_outcome1` | `bettor1` | `9e4b06d3a58fe5e5af805ab8adc7203ef5f4eb1c95eed6577f251d4fe50dfed3` | `1` | `474627` |
| 29 | `OPEN_ou-3.5-over` | `admin` | `1897912d02903912010c6598d7c19484e000ee8eae8cff7c90cfb445ed73ffa6` | `1` | `470851` |
| 30 | `PLACE_ou-3.5-over_outcome0` | `bettor0` | `afa405f145714d96acd7744f0ef1db727c8aac30bc4dfe94678d33561b2efa47` | `1` | `476539` |
| 31 | `PLACE_ou-3.5-over_outcome1` | `bettor1` | `60f8ae982a7bb3548ff9f2af0d88ac5bb6670b52490eb41a0c37de716d79a403` | `1` | `474627` |
| 32 | `OPEN_ou-3.5-under` | `admin` | `09e9871fae8c51456fd57e99a85fc95c60a151892bc26a13511b316dd0be65f9` | `1` | `470839` |
| 33 | `PLACE_ou-3.5-under_outcome0` | `bettor0` | `c17532081c0d7c2bc733a0c3bf24a36da9225307ecf03ad1afda7a22c127e9cb` | `1` | `476539` |
| 34 | `PLACE_ou-3.5-under_outcome1` | `bettor1` | `35efee39311e8511d038ddd4f66bccf572fa0169d5f267ca92e7932476981827` | `1` | `474627` |
| 35 | `OPEN_ah--0.5-full-win` | `admin` | `af3a914bd829e2ee6eeaad4a5d93a433179e87c0cef4936784956aab3d4a884b` | `1` | `470775` |
| 36 | `PLACE_ah--0.5-full-win_outcome0` | `bettor0` | `730e12e065df7e1633654748a0d87c58290450edb5ba30966865ed68115f77ed` | `1` | `476539` |
| 37 | `PLACE_ah--0.5-full-win_outcome1` | `bettor1` | `c0d622856cda97b428aeb27888729e16f40315a40aedaa81a76355c09f15a7a3` | `1` | `474627` |
| 38 | `OPEN_ah--1-full-push` | `admin` | `953a0d7056e29b4e076a78215f207528da6e3bcf25b6f124d7edddfed482b567` | `1` | `470787` |
| 39 | `PLACE_ah--1-full-push_outcome0` | `bettor0` | `ff8c6fcbe21d1b0c6f2cde228cab92fd95d75695fed8e659b45a37598e3a49e7` | `1` | `476539` |
| 40 | `PLACE_ah--1-full-push_outcome1` | `bettor1` | `60e59993f8bbc91091cc3dff6ed17adaf9d808822201eb06227bbbc919b94cee` | `1` | `474627` |
| 41 | `OPEN_ah--1.5-full-loss` | `admin` | `a0c2835fafc2394c4cc955dfa929e92ab319f73bd85e21b74cace2947db796cd` | `1` | `470787` |
| 42 | `PLACE_ah--1.5-full-loss_outcome0` | `bettor0` | `72eb22bef227341b64a1484feb0b78329b293bb2df9fb15c4a12e8402d605cb7` | `1` | `476539` |
| 43 | `PLACE_ah--1.5-full-loss_outcome1` | `bettor1` | `dfb60f1f3499596473f426839ec43ebcc1adbac1e0a4cde4a5ce14ca35a26147` | `1` | `474627` |
| 44 | `OPEN_ah--0.25-half-loss` | `admin` | `0fdd9fd1d1bf18eb280438108373e97185af4c073f735eeb27313b66973a7174` | `1` | `470787` |
| 45 | `PLACE_ah--0.25-half-loss_outcome0` | `bettor0` | `2213e1bef7e32c62f0bd8392e3ecc54b2c49f015ea6c1880fc0800406f5628f5` | `1` | `476539` |
| 46 | `PLACE_ah--0.25-half-loss_outcome1` | `bettor1` | `2d1fa59adda72e19125bc09dbc6570497ad37e11d65502e3410c26b2b1844b0b` | `1` | `474627` |
| 47 | `OPEN_ah--0.75-half-win` | `admin` | `ea37b54b33cb69e68dbd95e61a10665eff33f6d71b6d565896b1e4d433052d61` | `1` | `470787` |
| 48 | `PLACE_ah--0.75-half-win_outcome0` | `bettor0` | `73e537ed434669d5ae88c4e5f33094efc6f70e6eda50e7a45ed280229ffaa525` | `1` | `476527` |
| 49 | `PLACE_ah--0.75-half-win_outcome1` | `bettor1` | `65ab6ae8a31edc8069a5b0103c97c33c734dc69d935546e890102e4bce7a8b3b` | `1` | `474603` |
| 50 | `OPEN_ah--1.25-half-loss` | `admin` | `9e581b05643c8caa819a7dd35f7448ac307154361d8d951e5e0bb8ee8169f744` | `1` | `470787` |
| 51 | `PLACE_ah--1.25-half-loss_outcome0` | `bettor0` | `bda2a5f00c2ebfa2c26aa1c1b5e959a0b05afdc66e2d08074c086aebe21e6fc0` | `1` | `476539` |
| 52 | `PLACE_ah--1.25-half-loss_outcome1` | `bettor1` | `b965674b7f4c9cc8ed24aa547cb6c337c81737669c9d1d6d963c643d206e361a` | `1` | `474627` |
| 53 | `OPEN_ah-+0-full-push` | `admin` | `464874e0c49a58b75ef7d2593b5351d2dc5b962ce8d572e7e78296cf8cd49b1d` | `1` | `470787` |
| 54 | `PLACE_ah-+0-full-push_outcome0` | `bettor0` | `3eccb5e5bfd74dbe027d8593a8ae75d9fe748ccb7a972b32d9f63deb6ebb1ddf` | `1` | `476539` |
| 55 | `PLACE_ah-+0-full-push_outcome1` | `bettor1` | `04f00493acafe80e001d994bd24ce883f9ae52902290d1e4e362a6812c7e270b` | `1` | `474627` |
| 56 | `OPEN_ah-+0.25-half-win` | `admin` | `62250052d6ae8f3a64f9d5287798f1ff4d0fdd78f6697023d465cea102d3fab2` | `1` | `470787` |
| 57 | `PLACE_ah-+0.25-half-win_outcome0` | `bettor0` | `5a863a0bebd1e5f04d0beffaba35ac3e5544024d688f1db24a7eac7f160e9065` | `1` | `476539` |
| 58 | `PLACE_ah-+0.25-half-win_outcome1` | `bettor1` | `027045c93d364d9ef899f272514ec3205243b46d48939971760c63c7c3c23096` | `1` | `474627` |
| 59 | `OPEN_ah-+0.5-full-win` | `admin` | `b6655e0496ed7e6be8aef5ed6cb5c8134f88d914c47c5afc89c656c13afe00cc` | `1` | `470787` |
| 60 | `PLACE_ah-+0.5-full-win_outcome0` | `bettor0` | `ed3f3131e9003d80d45aa4f5a717eebce34cda4cf04f3543c0ca7804342d1fcd` | `1` | `476539` |
| 61 | `PLACE_ah-+0.5-full-win_outcome1` | `bettor1` | `bc0ed93c37cbf41fff6ebb1298e28b81d3b86c8081039445336e4589a9640e11` | `1` | `474627` |
| 62 | `OPEN_ah-+0.75-half-loss` | `admin` | `59ab4668bb9c3e5b2c0adb98bc992218804190ad30cb579327490e3a4853008d` | `1` | `470787` |
| 63 | `PLACE_ah-+0.75-half-loss_outcome0` | `bettor0` | `c8571258a7e2a1e30d529c467d1a87e5a357b2e9853055173cc2fedcd8f60141` | `1` | `476539` |
| 64 | `PLACE_ah-+0.75-half-loss_outcome1` | `bettor1` | `821dce4de869e12b4d9dca9b8ed8b19321675e0791946d3609332893e0392103` | `1` | `474627` |
| 65 | `SETTLE_1x2-home-win` | `admin` | `871cc9b39e2967a01ecdc36fdc777998ffca1e37be9bc7c208f38175eba6c157` | `1` | `338571` |
| 66 | `FINALIZE_1x2-home-win` | `admin` | `3e570e875176a2c5ad7217307e9b23b910af0ebd59e75561c46f33230d1c5680` | `1` | `196209` |
| 67 | `SETTLE_1x2-draw` | `admin` | `c46fafe68205f499c0fc29307074cfe1c0fe988ac0015b8a74abf3ecab6f7689` | `1` | `338730` |
| 68 | `FINALIZE_1x2-draw` | `admin` | `1a6bd704d17789185ff1dc4e627212bfb7554d0273bacdefdcc72a506cf28299` | `1` | `173504` |
| 69 | `SETTLE_1x2-away-win` | `admin` | `3b9b1dd8f95d28d38247d5cf979b85883bf4ebdf6135767f331624a7a5664ec6` | `1` | `338721` |
| 70 | `FINALIZE_1x2-away-win` | `admin` | `d7126846b5d83d8a5ff33dd9c8ca294ba96357be804376a17c0bc8e091fbc274` | `1` | `173504` |
| 71 | `SETTLE_ou-1.5-over` | `admin` | `68f61aaac3ca98d38afbc519519d4eaac29c354213cf55cae02d7f433500a406` | `1` | `303836` |
| 72 | `FINALIZE_ou-1.5-over` | `admin` | `3a3e9f11cbc9eb12885422a97003b5e8a28338cf51869cf351b7fdb9c05c49b8` | `1` | `271288` |
| 73 | `SETTLE_ou-1.5-under` | `admin` | `b5f8f41c380e9a650bf3062a962a114f814eab6e0d6071aa9d82bb2dec4c9f65` | `1` | `303862` |
| 74 | `FINALIZE_ou-1.5-under` | `admin` | `92189c27672598a1b3d919c568b5444f55748a00428d7267a314addd7c02a77b` | `1` | `271288` |
| 75 | `SETTLE_ou-2.5-over` | `admin` | `b32b63ffdf6c81fb970c6e7b53df15ed2e81b470d04b1bb1bdbae7d3d0e8b915` | `1` | `303892` |
| 76 | `FINALIZE_ou-2.5-over` | `admin` | `597cc16a62f3d593a600f924cd83759068c146740d7e698d40f17f42b6af2438` | `1` | `271288` |
| 77 | `SETTLE_ou-2.5-under` | `admin` | `0da68e72bdcb721a68acaf1f938a54260bf0fbb5cb629f804d0673da95268df0` | `1` | `303918` |
| 78 | `FINALIZE_ou-2.5-under` | `admin` | `574a510e97dfe2a6d6e0f7a93e398ebd5ea8d86bcbb30a0238c5b5acf851a5c2` | `1` | `271288` |
| 79 | `SETTLE_ou-3.5-over` | `admin` | `dec4616fa25f76fda3910c1ba94b16a1171ea2ad4333961de8cfa2b03dd7ea34` | `1` | `303926` |
| 80 | `FINALIZE_ou-3.5-over` | `admin` | `9baaa300e94c8a5343b42c50c0e14a4afaa887d02ff4b215bf41c28d93f78a13` | `1` | `271288` |
| 81 | `SETTLE_ou-3.5-under` | `admin` | `97f7105bcc4c5eb2839742d6da73488e04fd5228ff141185125966cf69bedab3` | `1` | `303952` |
| 82 | `FINALIZE_ou-3.5-under` | `admin` | `2d7347a290a9c3d279d44d66d731caa31f7160d8acbf89c02ef8398915a575a8` | `1` | `271288` |
| 83 | `SETTLE_ah--0.5-full-win` | `admin` | `b28f5ba75468ea7e068b0d0d110123bfa6a073656b3cb8f65293260d679a8aac` | `1` | `304007` |
| 84 | `FINALIZE_ah--0.5-full-win` | `admin` | `91fdca5889678ef29b941572319f974ce25c8ac4bf954bb081385718db8360ce` | `1` | `271288` |
| 85 | `SETTLE_ah--1-full-push` | `admin` | `160426d625e95fd92ca1bc3ce76909aa7a2010667a49017b1cb61074774af2fd` | `1` | `281483` |
| 86 | `FINALIZE_ah--1-full-push` | `admin` | `34c1cd42c6a4f507c1493e685288d5bd23a8f40d423bbc8b2832f59975e068d3` | `1` | `109098` |
| 87 | `SETTLE_ah--1.5-full-loss` | `admin` | `b28d1f6faabd746fdbe47b4adb9860bae0dcc6c5a3d22a49e577b98e52378fa4` | `1` | `304169` |
| 88 | `FINALIZE_ah--1.5-full-loss` | `admin` | `4b333b052c0f004242e3a26451437ff9e06206b2cc81db8be72f1f6f1e555a6d` | `1` | `271288` |
| 89 | `SETTLE_ah--0.25-half-loss` | `admin` | `5d3332424c68d3b7694881a5101249be401bcf45d6fe954d92bf110e48fa2966` | `1` | `410691` |
| 90 | `FINALIZE_ah--0.25-half-loss` | `admin` | `e2d50c68c8f2bd41f99b9cd78687d9c14b5189bf3f8d5dae90a903f5254b2a59` | `1` | `271288` |
| 91 | `SETTLE_ah--0.75-half-win` | `admin` | `f75cac9f2c3d6983ce43f1949cfb28b37df466d2db906610998db15edd286c16` | `1` | `410672` |
| 92 | `FINALIZE_ah--0.75-half-win` | `admin` | `875b6f4aeb873c3308234b3109dca21f766e9f52070867f92ce0f6fc9a930db4` | `1` | `271276` |
| 93 | `SETTLE_ah--1.25-half-loss` | `admin` | `18a72e1ac702e450ffb95eb4ed6e00465770df876dad7679721b7ca9b6053f1e` | `1` | `410797` |
| 94 | `FINALIZE_ah--1.25-half-loss` | `admin` | `3adf094b63c46c5b912611fc9b77ce5bad8bb235757f0aaa4d2483c61eecf488` | `1` | `271288` |
| 95 | `SETTLE_ah-+0-full-push` | `admin` | `abb494c13654e8d0b941567debc46f415f24234f740d82a223ccaf7e4e411962` | `1` | `281685` |
| 96 | `FINALIZE_ah-+0-full-push` | `admin` | `dd95dd6e5c349adc096a8251aeaca70a68e9b3f0b3155e1aa59d35344958fc64` | `1` | `109098` |
| 97 | `SETTLE_ah-+0.25-half-win` | `admin` | `62524396e9aa54c1c4d26a5fd7dcef63b60bb2b5190cbc804ad2cb431dd4c43f` | `1` | `410798` |
| 98 | `FINALIZE_ah-+0.25-half-win` | `admin` | `f35f11ea85ba5b45a38673131dba60bd2e7a9574056b4dc66fef1dbe789c1577` | `1` | `271288` |
| 99 | `SETTLE_ah-+0.5-full-win` | `admin` | `6e93b2c62672a3eb67b38b81d40dcf9d405463001ffcbaf403168fad913c897f` | `1` | `304345` |
| 100 | `FINALIZE_ah-+0.5-full-win` | `admin` | `567020fd3dbbaff6581d3d176021e884de0ba2b9153dc0517bce29430887f528` | `1` | `271288` |
| 101 | `SETTLE_ah-+0.75-half-loss` | `admin` | `5d8075856f38acad80eb081fd1dfb90936c758db1a33e9d5e5909a7ff5348666` | `1` | `410965` |
| 102 | `FINALIZE_ah-+0.75-half-loss` | `admin` | `ddf322a5b133d5070d24e63bd9b9a2677f09f6e034a36a0005f6443be77a7d74` | `1` | `271288` |
| 103 | `CLAIM_1x2-home-win_outcome0` | `bettor0` | `6d00df0ee6b819f1b7bcd492eac132025f36bf4b46b4d8d9cddbd570671627a7` | `1` | `156768` |
| 104 | `CLAIM_1x2-draw_outcome1` | `bettor1` | `1412487f3dd441c165ec0694a36c760a45b74b8b46b80b69adcfa2f0024ed612` | `1` | `156768` |
| 105 | `CLAIM_1x2-away-win_outcome2` | `bettor2` | `409eaf9d801dcd5ec7578a80d1123202ad19a1de827d9e2e8b4910523102e064` | `1` | `156768` |
| 106 | `CLAIM_ou-1.5-over_outcome0` | `bettor0` | `6a80f858965c2872ff357d15ae7819e8e379f93afddefb4fa18e7edce23f58d2` | `1` | `156768` |
| 107 | `CLAIM_ou-1.5-under_outcome1` | `bettor1` | `630cbf5654b9b0369c7b90cb0d527209c447a98263057e44bf62f489d9a01ea7` | `1` | `156768` |
| 108 | `CLAIM_ou-2.5-over_outcome0` | `bettor0` | `0d2b0817baad46d6c0677afe20cccecb05b259ebbafeb6c4fd74146d666ef550` | `1` | `156768` |
| 109 | `CLAIM_ou-2.5-under_outcome1` | `bettor1` | `7dae8fef292f73af5a1a1230378ee37e04f18a87b1e522d51fc4322b20833aec` | `1` | `156768` |
| 110 | `CLAIM_ou-3.5-over_outcome0` | `bettor0` | `1c532d60a58f0dd56def95c4392508662ff9bde0036719c93a82696451ba6ac5` | `1` | `156768` |
| 111 | `CLAIM_ou-3.5-under_outcome1` | `bettor1` | `1ac1ad7da9824c79f50b98d6ae5ca6a8b27551d9faf5a3a0c2f32fe4604c9768` | `1` | `156768` |
| 112 | `CLAIM_ah--0.5-full-win_outcome0` | `bettor0` | `805441ad4c4ab25efe78279b6b12af2b00e844bdb22e2cdb0281c56bf0b2eb7a` | `1` | `156768` |
| 113 | `CLAIM_ah--1.5-full-loss_outcome1` | `bettor1` | `4dae754a9b8e4b4d7b90307af18896a4a2c82859c4e62bec48595f127d3dd0e2` | `1` | `156768` |
| 114 | `CLAIM_ah--0.25-half-loss_outcome1` | `bettor1` | `d6ff134f45ded7ae927ab204b3dfcd7e082c9e39b577db17e884d734714e7af5` | `1` | `156768` |
| 115 | `CLAIM_ah--0.75-half-win_outcome0` | `bettor0` | `01a7c6b26728faa76f4469f4a8b5bc3fa0353f62995a4c0238745a40a40c0d0a` | `1` | `156768` |
| 116 | `CLAIM_ah--1.25-half-loss_outcome1` | `bettor1` | `dade1a55bde945a228369607a68832494b9bbf349044898a1602963fc7afae51` | `1` | `156768` |
| 117 | `CLAIM_ah-+0.25-half-win_outcome0` | `bettor0` | `c3e809d7dd47c9596b2f2b8306721886c5337fa779c1046a0c7d769cc931ecd1` | `1` | `156768` |
| 118 | `CLAIM_ah-+0.5-full-win_outcome0` | `bettor0` | `39bafd84279837bba0560acdd542f0c1240ce40a6d829224b4f1bc7595a20ea2` | `1` | `156768` |
| 119 | `CLAIM_ah-+0.75-half-loss_outcome1` | `bettor1` | `a465754afad62796ff2c5703236fcadccba8a3ab8ed2d6a1bb7ee31153dede4f` | `1` | `156768` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,406,251` | `98,398,350` | `9.6617532785555412` | `9.4785102765555412` |
| `bettor0` | `0xDf452066FB45bde0702A0d2B469B254623f76B97` | `5,159` | `5,020` | `0.037293835` | `0.106939889` |
| `bettor1` | `0xE34886EBFae64cFdf1DB3B990352a68FE3Db0Dbf` | `4,975` | `12,741` | `0.037954324` | `0.107642916` |
| `bettor2` | `0xE60D3Fb13A9Cb25a21cB62C1441cc29B57655B9C` | `7,055` | `6,942` | `0.072054053` | `0.070430792` |
| `lpUser` | `0xF5E0Aace148b1bD8ab803e3f81dB9cDBcAA92D75` | `7,000` | `2,000` | `0.078630638` | `0.078366902` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `130,400` | `135,656` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `68,246` | `68,319` | `0` | `0` |
