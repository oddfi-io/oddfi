# 2026-06-03 BSC Testnet Cash Out Upgrade Line Matrix Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- scope: `line`
- scenarios: `19`
- bets: `41`
- postStartBets: `28`
- checks: `194 passed / 0 failed`
- suiteStartedAtBlock: `111160288`
- suiteFinishedAtBlock: `111169903`

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
- [PASS] `OPEN_1x2-home-win_status`: status=1, tx=ef53c205ff4d5afdde39a2c5fa8d1d893bf1d4abc6ab7da2ec31423824acb7ad
- [PASS] `DEPOSIT_MATCH_LP_FOR_FIRST_MATRIX_MATCH_status`: status=1, tx=2283e596c0194546cd2daa5577444c5c20bf3182227544c7ae45d7ef999070c2
- [PASS] `PLACE_1x2-home-win_outcome0_status`: status=1, tx=403b578b6a3634aacba51feadf101b4dabd01698461d35579a93cc68b553166e
- [PASS] `PLACE_1x2-home-win_outcome1_status`: status=1, tx=b286911e6c02a5731b0ee64ab28eb0183b89e680e98e8feadd19947a78a7e04b
- [PASS] `PLACE_1x2-home-win_outcome2_status`: status=1, tx=aa8e3eb28e79557ed8d39ccab07c44b6c5a65b1616334e8b52032f66955c97da
- [PASS] `OPEN_1x2-draw_status`: status=1, tx=d6b0b3bb0acafbe10b66e9eb12f6067049721b1d1e7a9b7d0e635af3b79cf4f8
- [PASS] `PLACE_1x2-draw_outcome0_status`: status=1, tx=0bc0e3f8e4cf232de8c340c6c79d899ab3728624e3a24b73ac522805413f32d1
- [PASS] `PLACE_1x2-draw_outcome1_status`: status=1, tx=35a292fa77a69bb0e3b0fa6f7606518715ada21b07c2cffc65f226e36e83bb7f
- [PASS] `PLACE_1x2-draw_outcome2_status`: status=1, tx=1a29a21ed980e4835e023a320d69be74e995f22eead7f7ef5b098637fcd8cb99
- [PASS] `OPEN_1x2-away-win_status`: status=1, tx=a9445d1a81b6d4cb1f48815c64d6ab12289565a7c67f75991689827b3af3ba97
- [PASS] `PLACE_1x2-away-win_outcome0_status`: status=1, tx=c3b2d90e65afbb39e1a0f6cc833bb0bd2cbd83f1579e21ebc47a79770594bd55
- [PASS] `PLACE_1x2-away-win_outcome1_status`: status=1, tx=9535d1239d87f6253f4abcfc514ecde3a2af272f009055d90789189aef3f793a
- [PASS] `PLACE_1x2-away-win_outcome2_status`: status=1, tx=3c4b6599d64ea04d972dae7f2fabc5de902d37ccc51ae940eca6eea4b1d8aaff
- [PASS] `OPEN_ou-1.5-over_status`: status=1, tx=d88b99ab611cf2973874ae07bbadb00462d5dbec59223fd8d5113ce4aa7cc3a5
- [PASS] `PLACE_ou-1.5-over_outcome0_status`: status=1, tx=cdcbb256e0f20e5371940495adf7b201bd42b3907693b5a0199603c9944036d5
- [PASS] `PLACE_ou-1.5-over_outcome1_status`: status=1, tx=ac00dcfc84828d88c310f29fa690c81530828cbeb0768d452af7f716df380bca
- [PASS] `OPEN_ou-1.5-under_status`: status=1, tx=2f94ab55ccd3d381063f636c663169b57fecd5ced7cf9a4f7ab450ebef188a57
- [PASS] `PLACE_ou-1.5-under_outcome0_status`: status=1, tx=7da1f67bda6e4043047518141d3181982164a6f3070c5fb002a5b857942c170f
- [PASS] `PLACE_ou-1.5-under_outcome1_status`: status=1, tx=f300d29fc4ee01a6dda08cae7275f138108a51cfa3d91b4f349017da8d894392
- [PASS] `OPEN_ou-2.5-over_status`: status=1, tx=23a1d6b144b89ba950b086e18eb0a8c8919287cd151e48717aa0f41d5f457a3c
- [PASS] `PLACE_ou-2.5-over_outcome0_status`: status=1, tx=ff7e536ffe079c17f87903926d13ca0a5d92972fa6c01c8a2f9f59983d9056b3
- [PASS] `PLACE_ou-2.5-over_outcome1_status`: status=1, tx=7bf3e3d48ede755a6b9ee0b6c5d150adb59d3843fc3d295eaa06180358c2863c
- [PASS] `OPEN_ou-2.5-under_status`: status=1, tx=45a2baec2f00a9f1e2708bada626b62c307072b59d2647dda22cbdf3b9ef7110
- [PASS] `PLACE_ou-2.5-under_outcome0_status`: status=1, tx=8d2148b1ff0ee0d29bcd54c85a08a54ca8f215a12b694f66976a1fe00c649f7f
- [PASS] `PLACE_ou-2.5-under_outcome1_status`: status=1, tx=3dc0fc65d279dbb27cef7b69986e8ec962717a018995c4f7f1dfad7507290cab
- [PASS] `OPEN_ou-3.5-over_status`: status=1, tx=115f72f4dd308f07831b8be0ee256dd52fc287d54f78bc61f955f563d077da20
- [PASS] `PLACE_ou-3.5-over_outcome0_status`: status=1, tx=d50e6ea718b91cd7ceb6d374ff4a41f96915b2a6f8134a9a10024ea1e3cd26b4
- [PASS] `PLACE_ou-3.5-over_outcome1_status`: status=1, tx=c145a48714094ed2f7097471c286366331fdc6797ac65668b0ad56dea0f4dc2e
- [PASS] `OPEN_ou-3.5-under_status`: status=1, tx=348ab3b4cdfbf25797d39c2aefc75036f5b81a25eb0efe7d29fbf21dd81d278d
- [PASS] `PLACE_ou-3.5-under_outcome0_status`: status=1, tx=3b78be597c21578f72d24bfeba55236009a028f930afe1a19b51d7ed840b64c0
- [PASS] `PLACE_ou-3.5-under_outcome1_status`: status=1, tx=d23efe564ff077d67cc34a2a6b94fb9ce10d7c76b65332bad38c1954c091052e
- [PASS] `OPEN_ah--0.5-full-win_status`: status=1, tx=d0f8ad5e5d600283a0912103b33b5b07f77beeeb97263c359475ea51afef3122
- [PASS] `PLACE_ah--0.5-full-win_outcome0_status`: status=1, tx=f92e548d74fb652c4c183112c79fd2316b811ad74b4806a96e54b7c9940b338b
- [PASS] `PLACE_ah--0.5-full-win_outcome1_status`: status=1, tx=5411bb3da8f0099a06cba17bbf47777f83d1f4e49a7b0ca9be98ff33e3537781
- [PASS] `OPEN_ah--1-full-push_status`: status=1, tx=a296c37eff6224f80118519a1d6cac9e74073096e321b9486f99e3f0dc31f82b
- [PASS] `PLACE_ah--1-full-push_outcome0_status`: status=1, tx=4df6fa52bb99a62d94ae2ba51b33d4d3eeef00f5d1930e78af35d2fe686cafc0
- [PASS] `PLACE_ah--1-full-push_outcome1_status`: status=1, tx=7e42e280ee381e67aed166ea04bbd5a51abf51b7edd3e9f5a3fd19e05d68b6d0
- [PASS] `OPEN_ah--1.5-full-loss_status`: status=1, tx=f770aa123a3b69625c621fef8a48a53313ef9a2f14df5f4e7e1bae4d0cd30262
- [PASS] `PLACE_ah--1.5-full-loss_outcome0_status`: status=1, tx=3c8a7e1011ec88a55e6a3286de20d78cd2654d78ca36c8503ad389f983b5ff31
- [PASS] `PLACE_ah--1.5-full-loss_outcome1_status`: status=1, tx=642079cda6e0890e8017cfd25054bd246ac893e22cc4f50d4521571e3071f638
- [PASS] `OPEN_ah--0.25-half-loss_status`: status=1, tx=4e4a7a837640cca5d8ee633d13dcba9007232d416b54533c6019a22427901c3e
- [PASS] `PLACE_ah--0.25-half-loss_outcome0_status`: status=1, tx=81151c05231d5331ffda12e8192dbd00e0983453b54570f35c162b5637b60f4b
- [PASS] `PLACE_ah--0.25-half-loss_outcome1_status`: status=1, tx=2030dd18226a939e331cce2c7a92e0ec8b01e94d57a820d6619871f2ac1b779b
- [PASS] `OPEN_ah--0.75-half-win_status`: status=1, tx=d082ccd8c262bc6474443b28438147a18fe11aaaa85989bc5bdad78f5a465edb
- [PASS] `PLACE_ah--0.75-half-win_outcome0_status`: status=1, tx=bc37ecedf5f95e48aa74192775fd0c805bba25299678e900dd87fdd75294d437
- [PASS] `PLACE_ah--0.75-half-win_outcome1_status`: status=1, tx=f6019f0846192b8d2e19becb9eea5511992fc9264c4d343a1149113f2718596f
- [PASS] `OPEN_ah--1.25-half-loss_status`: status=1, tx=6b99ea4feb5eddea96eac7008918df531a4dfd2158556373879ed804b66c7417
- [PASS] `PLACE_ah--1.25-half-loss_outcome0_status`: status=1, tx=f19260382befe4a65493efb54a28b466b403562883898cc516f4b825f394165d
- [PASS] `PLACE_ah--1.25-half-loss_outcome1_status`: status=1, tx=46a3cab940e7ace1a27fbe794142f3ef0142e10273dda980c300aafb3eea532c
- [PASS] `OPEN_ah-+0-full-push_status`: status=1, tx=c1615c43e4c78c143d208e8e6d3d339a88ebad9bf66872518cedf37766f950e3
- [PASS] `PLACE_ah-+0-full-push_outcome0_status`: status=1, tx=b00676fc804decf0791fbe05995231f4cda208fdd36a0846fa510fd5f615fbd2
- [PASS] `PLACE_ah-+0-full-push_outcome1_status`: status=1, tx=56f07a5e446f7e0b9d2be1bcee7cf04d3cbe8cb2f9f5f2148ebff22ad464fb01
- [PASS] `OPEN_ah-+0.25-half-win_status`: status=1, tx=77bf1d5b3c9143c7efcb2f503dab6cd2e07187d1e4dee407f5738e84ae3dbdf0
- [PASS] `PLACE_ah-+0.25-half-win_outcome0_status`: status=1, tx=d49d9d17b18c74dc907c377ee4608af6932ee680df897852a31f252941dc1cdb
- [PASS] `PLACE_ah-+0.25-half-win_outcome1_status`: status=1, tx=4fe114e06c7ac6b3470dfa560f54c543f6d410ca15949a7e4e661daeb426fb07
- [PASS] `OPEN_ah-+0.5-full-win_status`: status=1, tx=19e195b15e6bb79419534e87af6ec767c09d059552ed325af1099818093e1a17
- [PASS] `PLACE_ah-+0.5-full-win_outcome0_status`: status=1, tx=ec694b4b3890140609836c6f85075d3baedb0f710877639a9f2dcfbf3aa2f3a6
- [PASS] `PLACE_ah-+0.5-full-win_outcome1_status`: status=1, tx=ee7e805bb03388d960bde441d009ecc48a108f86cead9ceba58e0456ddb61df9
- [PASS] `OPEN_ah-+0.75-half-loss_status`: status=1, tx=2f7e645be3053657f882eea6836fbf32bbdfc4148562a90405620cddccf08186
- [PASS] `PLACE_ah-+0.75-half-loss_outcome0_status`: status=1, tx=3869ae5f51e41add02343b9c85ede3768a4212c4698811efbbfc4a45cee4cdd9
- [PASS] `PLACE_ah-+0.75-half-loss_outcome1_status`: status=1, tx=f0e899111adb967b7d0f0713db127b724dfb0aae886fbcaae45de557d1816158
- [PASS] `post_start_betting_covered`: 28 bets mined at/after matchStartTime; examples=['ou-2.5-over/outcome0@1780465864', 'ou-2.5-over/outcome1@1780465893', 'ou-2.5-under/outcome0@1780465958', 'ou-2.5-under/outcome1@1780465991', 'ou-3.5-over/outcome0@1780466055']
- [PASS] `SETTLE_1x2-home-win_status`: status=1, tx=e744a639d1386c57ee10cd3c762bad7de76db23bf5560f82f092c829989f4de2
- [PASS] `FINALIZE_1x2-home-win_status`: status=1, tx=b9d64b34f2605654ebab818671d01e73cd2919439a3c521b2516468c4e864aca
- [PASS] `1x2-home-win_market_settled`: status=Settled
- [PASS] `SETTLE_1x2-draw_status`: status=1, tx=7fbc0b13723ea669733ae745ab6f39640a2be21e463314fd14a609bccba2bec6
- [PASS] `FINALIZE_1x2-draw_status`: status=1, tx=8454d4f9ede828290b1055077cc590db3d6cf6664bab7232615d350604955a74
- [PASS] `1x2-draw_market_settled`: status=Settled
- [PASS] `SETTLE_1x2-away-win_status`: status=1, tx=8f7ef4d4552fc755d24c39c5c75df385d18e739f504a645e46a66569624a5579
- [PASS] `FINALIZE_1x2-away-win_status`: status=1, tx=83927fd6c564c5a42784e78d651fbda748a8ec0218850c272de2de1bc6348b1d
- [PASS] `1x2-away-win_market_settled`: status=Settled
- [PASS] `SETTLE_ou-1.5-over_status`: status=1, tx=bfbdf70b550f705a95cceea1c43442f4db8a100ff07de0740b3397b6087affbc
- [PASS] `FINALIZE_ou-1.5-over_status`: status=1, tx=9124e7c7eb4762c82027377ba1ae435cbd5dd3610732c69cc3f13bfefc7608f8
- [PASS] `ou-1.5-over_market_settled`: status=Settled
- [PASS] `SETTLE_ou-1.5-under_status`: status=1, tx=94366d4e39dba1775b73c1c27297f5288f141724933df60e495d012c7f9178ab
- [PASS] `FINALIZE_ou-1.5-under_status`: status=1, tx=b6aaaf62efed61198b78556713c178a50f9d7b55e0ab0212733fc3e786265fcc
- [PASS] `ou-1.5-under_market_settled`: status=Settled
- [PASS] `SETTLE_ou-2.5-over_status`: status=1, tx=d839de0ed500728310bea2bcf5e010b0197b56e2e5221b340d95da4c035210e9
- [PASS] `FINALIZE_ou-2.5-over_status`: status=1, tx=fc51c9e1c98425d5d7cc816c46a024c3da6977ecc6103d0b1c3d3b371145ca68
- [PASS] `ou-2.5-over_market_settled`: status=Settled
- [PASS] `SETTLE_ou-2.5-under_status`: status=1, tx=43bfc258cd9895c18174ca5fbf96f21878803acb92fc0b03531a2d6f465064a3
- [PASS] `FINALIZE_ou-2.5-under_status`: status=1, tx=1bf9d730c80aa9db2215a5b3be9dc74692837f229be05a88b0c96c061e3acb71
- [PASS] `ou-2.5-under_market_settled`: status=Settled
- [PASS] `SETTLE_ou-3.5-over_status`: status=1, tx=afe01f506b4e011cc98c4ada3a4c9ac95812f8dae80f5e6afefde068c3b1b4ad
- [PASS] `FINALIZE_ou-3.5-over_status`: status=1, tx=dd75dd5b3aa0772426361f0ab232cdf6f473b0ca4c4bfd686be01dfaabad29b0
- [PASS] `ou-3.5-over_market_settled`: status=Settled
- [PASS] `SETTLE_ou-3.5-under_status`: status=1, tx=efc197d9276d59fe0132e86bcc21eca6006755546b0b0070829480334016df2e
- [PASS] `FINALIZE_ou-3.5-under_status`: status=1, tx=84938c2d2b4b844a665d8c0f20321214e89b59f4b4af6518928da4a8707ace20
- [PASS] `ou-3.5-under_market_settled`: status=Settled
- [PASS] `SETTLE_ah--0.5-full-win_status`: status=1, tx=26492c240f22ba1a39157b921c0f32dec4bbcbae43c36d2370547d434bcd473c
- [PASS] `FINALIZE_ah--0.5-full-win_status`: status=1, tx=40ea63289fc70f104412a745a93d3f9a5cf332213c399922976c31fbf80988aa
- [PASS] `ah--0.5-full-win_market_settled`: status=Settled
- [PASS] `SETTLE_ah--1-full-push_status`: status=1, tx=9a62c07923b77657b9275b4b63bdffe65d543f1045fd342e5484c6830726195b
- [PASS] `FINALIZE_ah--1-full-push_status`: status=1, tx=dcbf24a2b8036d411f253bcd7e44a1c526f6b6680d06d341fdefea06501d260a
- [PASS] `ah--1-full-push_market_settled`: status=Settled
- [PASS] `SETTLE_ah--1.5-full-loss_status`: status=1, tx=287630c1894f9fca04f63437bfb8738536d748a91dbc70d54094984f35fc5d83
- [PASS] `FINALIZE_ah--1.5-full-loss_status`: status=1, tx=8aab3f14cb2da4faf064d37c53e79966d4b8481cc6b7cad65900bd91c22fb212
- [PASS] `ah--1.5-full-loss_market_settled`: status=Settled
- [PASS] `SETTLE_ah--0.25-half-loss_status`: status=1, tx=8e411f1793942b38227a93ddea3061d10d4284e5d2379088299a78a8291020c8
- [PASS] `FINALIZE_ah--0.25-half-loss_status`: status=1, tx=207829a954518a0bfb1e3da7f888b53c1c35d33585d2ff7529adfe994042c544
- [PASS] `ah--0.25-half-loss_market_settled`: status=Settled
- [PASS] `SETTLE_ah--0.75-half-win_status`: status=1, tx=0a0738f748b6ecc2cf74688236ed46a8bed0bd9b036eff44a7c4e62bb79d01e7
- [PASS] `FINALIZE_ah--0.75-half-win_status`: status=1, tx=b70438fd3f70f58000d98e48b542b34d44059a99e6965308e827647cd7b6353d
- [PASS] `ah--0.75-half-win_market_settled`: status=Settled
- [PASS] `SETTLE_ah--1.25-half-loss_status`: status=1, tx=20db0a19e2aa393c06a2d72064ccedae9d7ff47d283336ba2d2ea95c4719f8f0
- [PASS] `FINALIZE_ah--1.25-half-loss_status`: status=1, tx=6ed9447f417ad2c458644074301743fef810977a1561dc65e6847f93bfd13379
- [PASS] `ah--1.25-half-loss_market_settled`: status=Settled
- [PASS] `SETTLE_ah-+0-full-push_status`: status=1, tx=96e2b038b2a9acf309bbe260783b0992c5a5e982cc29379dce51584d6826a58d
- [PASS] `FINALIZE_ah-+0-full-push_status`: status=1, tx=25b0750235b06e0d003bf674aea507dc06a6c00c5c3f0af19e175d3fa9384f23
- [PASS] `ah-+0-full-push_market_settled`: status=Settled
- [PASS] `SETTLE_ah-+0.25-half-win_status`: status=1, tx=c36d8e4c65c47e2dadb5b629a6b742294c76384ad8fd271f013baa37a3fb9dc5
- [PASS] `FINALIZE_ah-+0.25-half-win_status`: status=1, tx=cd0e45032c8e1a9a2a42869f459deb36f999790939982f0f9df3dbfbb339a912
- [PASS] `ah-+0.25-half-win_market_settled`: status=Settled
- [PASS] `SETTLE_ah-+0.5-full-win_status`: status=1, tx=6d5d76596f34358dde6d3f3ad1b822952319c9de10d22852536dee62d9396fca
- [PASS] `FINALIZE_ah-+0.5-full-win_status`: status=1, tx=1335462ec6728774f65010aa9d2cc85842438ad4049aeb28f3407859f89e938b
- [PASS] `ah-+0.5-full-win_market_settled`: status=Settled
- [PASS] `SETTLE_ah-+0.75-half-loss_status`: status=1, tx=c796494f1f45df68dc609151723147efaa0d2a4d9470c0c3831c71cdd334d49b
- [PASS] `FINALIZE_ah-+0.75-half-loss_status`: status=1, tx=d44ff3e52b3a0e93b5e5b34d2e488d5a2dc11ba05a5bcb707db9a69e49f907b1
- [PASS] `ah-+0.75-half-loss_market_settled`: status=Settled
- [PASS] `1x2-home-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_1x2-home-win_outcome0_status`: status=1, tx=109915acf7e85658b09e2814cb8d575b183ff529b49c862ab6c7fd37c0d8b909
- [PASS] `1x2-home-win_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `1x2-home-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-home-win_outcome2_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-draw_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-draw_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_1x2-draw_outcome1_status`: status=1, tx=3a536ddff5542b11a98d6faf31aac0f449150e916d775e19cd72987278e52381
- [PASS] `1x2-draw_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `1x2-draw_outcome2_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `1x2-away-win_outcome2_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_1x2-away-win_outcome2_status`: status=1, tx=d9dbe2ac1756b5c61578d27ef856579e67303d2de046fae2371a2bdfa2dacbde
- [PASS] `1x2-away-win_outcome2_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-1.5-over_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-1.5-over_outcome0_status`: status=1, tx=a95ec447a9f44072fd4ac2dc2948a23ac2c8bf4583e12e8fc5620091176a0c36
- [PASS] `ou-1.5-over_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-1.5-over_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-1.5-under_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-1.5-under_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-1.5-under_outcome1_status`: status=1, tx=b662dec51e00a7ed6397b845ec1e99738306ae294f15baeb20e00bfbc627a3f6
- [PASS] `ou-1.5-under_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-2.5-over_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-2.5-over_outcome0_status`: status=1, tx=1f443dd74f3646de47af73ab90e6ac685aa1434a9414f2416a751e1c464aa394
- [PASS] `ou-2.5-over_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-2.5-over_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-2.5-under_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-2.5-under_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-2.5-under_outcome1_status`: status=1, tx=c0e8e6b18eebed51df253855cd820c1504c65635d93c13dc8f92260bba37d4c7
- [PASS] `ou-2.5-under_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-3.5-over_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-3.5-over_outcome0_status`: status=1, tx=0c693d1434003f8c15afe569cbb877f82d03249928b272d82450bcc9c75fb515
- [PASS] `ou-3.5-over_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ou-3.5-over_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-3.5-under_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ou-3.5-under_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ou-3.5-under_outcome1_status`: status=1, tx=443b5fc43de2c05b78d9f0ce6c52ea873f23ef60e13dc11db0ac5bf423daf4c2
- [PASS] `ou-3.5-under_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ah--0.5-full-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ah--0.5-full-win_outcome0_status`: status=1, tx=99eef42da885fcb1d7719b053a0b5d4e9e21c461115fa7cbbaffba4b817cb3eb
- [PASS] `ah--0.5-full-win_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ah--0.5-full-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ah--1-full-push_outcome0_pre_claim`: expected state/refund/claimable=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah--1-full-push_outcome1_pre_claim`: expected state/refund/claimable=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah--1.5-full-loss_outcome0_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ah--1.5-full-loss_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ah--1.5-full-loss_outcome1_status`: status=1, tx=9814fc92c654fa08551b32106c59c505f527a496e3ec648d60d9193f6e18838c
- [PASS] `ah--1.5-full-loss_outcome1_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ah--0.25-half-loss_outcome0_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--0.25-half-loss_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah--0.25-half-loss_outcome1_status`: status=1, tx=75313dcb4d88c016e304b6ee3e2db1aac923e21077f816251ddfef75fb85ee23
- [PASS] `ah--0.25-half-loss_outcome1_claim_net`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `ah--0.75-half-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah--0.75-half-win_outcome0_status`: status=1, tx=b02c3656fec9c8c2cb27ff5fc8500bac5ab6b376c19f21659944966cfba4d9e3
- [PASS] `ah--0.75-half-win_outcome0_claim_net`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `ah--0.75-half-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--1.25-half-loss_outcome0_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah--1.25-half-loss_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah--1.25-half-loss_outcome1_status`: status=1, tx=794c3c4296b59922963352e7763482fef58a3612e960a6fc064397b308185c26
- [PASS] `ah--1.25-half-loss_outcome1_claim_net`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `ah-+0-full-push_outcome0_pre_claim`: expected state/refund/claimable=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah-+0-full-push_outcome1_pre_claim`: expected state/refund/claimable=Refunded/100000000000000000000/0, got=Refunded/100000000000000000000/0
- [PASS] `ah-+0.25-half-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah-+0.25-half-win_outcome0_status`: status=1, tx=481491b4aaac7f9dcb343d9a0706418a1bb7b4f20773128c66f2fa8dde25d0cf
- [PASS] `ah-+0.25-half-win_outcome0_claim_net`: expected=95000000000000000000, got=95000000000000000000
- [PASS] `ah-+0.25-half-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah-+0.5-full-win_outcome0_pre_claim`: expected state/refund/claimable=WonUnclaimed/0/200000000000000000000, got=WonUnclaimed/0/200000000000000000000
- [PASS] `CLAIM_ah-+0.5-full-win_outcome0_status`: status=1, tx=731da5dba9f769ce4e2c3e8440b42100827ab9fab20a2889864d43ed1c07aa00
- [PASS] `ah-+0.5-full-win_outcome0_claim_net`: expected=190000000000000000000, got=190000000000000000000
- [PASS] `ah-+0.5-full-win_outcome1_pre_claim`: expected state/refund/claimable=Lost/0/0, got=Lost/0/0
- [PASS] `ah-+0.75-half-loss_outcome0_pre_claim`: expected state/refund/claimable=Lost/50000000000000000000/0, got=Lost/50000000000000000000/0
- [PASS] `ah-+0.75-half-loss_outcome1_pre_claim`: expected state/refund/claimable=WonUnclaimed/50000000000000000000/100000000000000000000, got=WonUnclaimed/50000000000000000000/100000000000000000000
- [PASS] `CLAIM_ah-+0.75-half-loss_outcome1_status`: status=1, tx=ebbb20f52deeee73b8e8421de7400be11ab355d94c1cc2816ab6346c8a3fdb3f
- [PASS] `ah-+0.75-half-loss_outcome1_claim_net`: expected=95000000000000000000, got=95000000000000000000

## Issues
- No line-matrix functional issues found in this run.

## Scenario Matrix
| scenario | market | score | outcome | expected result | final state | refunded ODD | claimable ODD | net claim ODD | betId | claim tx |
|---|---|---:|---:|---|---|---:|---:|---:|---|---|
| `1x2-home-win` | `1X2` | `1-0` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000016a` | `109915acf7e85658b09e2814cb8d575b183ff529b49c862ab6c7fd37c0d8b909` |
| `1x2-home-win` | `1X2` | `1-0` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000016b` | `-` |
| `1x2-home-win` | `1X2` | `1-0` | `2` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000016c` | `-` |
| `1x2-draw` | `1X2` | `1-1` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000016d` | `-` |
| `1x2-draw` | `1X2` | `1-1` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000016e` | `3a536ddff5542b11a98d6faf31aac0f449150e916d775e19cd72987278e52381` |
| `1x2-draw` | `1X2` | `1-1` | `2` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000016f` | `-` |
| `1x2-away-win` | `1X2` | `0-1` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000170` | `-` |
| `1x2-away-win` | `1X2` | `0-1` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000171` | `-` |
| `1x2-away-win` | `1X2` | `0-1` | `2` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000172` | `d9dbe2ac1756b5c61578d27ef856579e67303d2de046fae2371a2bdfa2dacbde` |
| `ou-1.5-over` | `OU 1.5` | `2-0` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000173` | `a95ec447a9f44072fd4ac2dc2948a23ac2c8bf4583e12e8fc5620091176a0c36` |
| `ou-1.5-over` | `OU 1.5` | `2-0` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000174` | `-` |
| `ou-1.5-under` | `OU 1.5` | `1-0` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000175` | `-` |
| `ou-1.5-under` | `OU 1.5` | `1-0` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000176` | `b662dec51e00a7ed6397b845ec1e99738306ae294f15baeb20e00bfbc627a3f6` |
| `ou-2.5-over` | `OU 2.5` | `2-1` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000177` | `1f443dd74f3646de47af73ab90e6ac685aa1434a9414f2416a751e1c464aa394` |
| `ou-2.5-over` | `OU 2.5` | `2-1` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000178` | `-` |
| `ou-2.5-under` | `OU 2.5` | `1-1` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000179` | `-` |
| `ou-2.5-under` | `OU 2.5` | `1-1` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000017a` | `c0e8e6b18eebed51df253855cd820c1504c65635d93c13dc8f92260bba37d4c7` |
| `ou-3.5-over` | `OU 3.5` | `3-1` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000017b` | `0c693d1434003f8c15afe569cbb877f82d03249928b272d82450bcc9c75fb515` |
| `ou-3.5-over` | `OU 3.5` | `3-1` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000017c` | `-` |
| `ou-3.5-under` | `OU 3.5` | `1-1` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000017d` | `-` |
| `ou-3.5-under` | `OU 3.5` | `1-1` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000017e` | `443b5fc43de2c05b78d9f0ce6c52ea873f23ef60e13dc11db0ac5bf423daf4c2` |
| `ah--0.5-full-win` | `AH -0.5` | `1-0` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000017f` | `99eef42da885fcb1d7719b053a0b5d4e9e21c461115fa7cbbaffba4b817cb3eb` |
| `ah--0.5-full-win` | `AH -0.5` | `1-0` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000180` | `-` |
| `ah--1-full-push` | `AH -1` | `1-0` | `0` | `FullPush` | `Refunded` | `100` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000181` | `-` |
| `ah--1-full-push` | `AH -1` | `1-0` | `1` | `FullPush` | `Refunded` | `100` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000182` | `-` |
| `ah--1.5-full-loss` | `AH -1.5` | `1-0` | `0` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000183` | `-` |
| `ah--1.5-full-loss` | `AH -1.5` | `1-0` | `1` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `0000000000000000000000000000000000000000000000000000000000000184` | `9814fc92c654fa08551b32106c59c505f527a496e3ec648d60d9193f6e18838c` |
| `ah--0.25-half-loss` | `AH -0.25` | `0-0` | `0` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000185` | `-` |
| `ah--0.25-half-loss` | `AH -0.25` | `0-0` | `1` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `0000000000000000000000000000000000000000000000000000000000000186` | `75313dcb4d88c016e304b6ee3e2db1aac923e21077f816251ddfef75fb85ee23` |
| `ah--0.75-half-win` | `AH -0.75` | `1-0` | `0` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `0000000000000000000000000000000000000000000000000000000000000187` | `b02c3656fec9c8c2cb27ff5fc8500bac5ab6b376c19f21659944966cfba4d9e3` |
| `ah--0.75-half-win` | `AH -0.75` | `1-0` | `1` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000188` | `-` |
| `ah--1.25-half-loss` | `AH -1.25` | `1-0` | `0` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000189` | `-` |
| `ah--1.25-half-loss` | `AH -1.25` | `1-0` | `1` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `000000000000000000000000000000000000000000000000000000000000018a` | `794c3c4296b59922963352e7763482fef58a3612e960a6fc064397b308185c26` |
| `ah-+0-full-push` | `AH +0` | `0-0` | `0` | `FullPush` | `Refunded` | `100` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000018b` | `-` |
| `ah-+0-full-push` | `AH +0` | `0-0` | `1` | `FullPush` | `Refunded` | `100` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000018c` | `-` |
| `ah-+0.25-half-win` | `AH +0.25` | `0-0` | `0` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `000000000000000000000000000000000000000000000000000000000000018d` | `481491b4aaac7f9dcb343d9a0706418a1bb7b4f20773128c66f2fa8dde25d0cf` |
| `ah-+0.25-half-win` | `AH +0.25` | `0-0` | `1` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `000000000000000000000000000000000000000000000000000000000000018e` | `-` |
| `ah-+0.5-full-win` | `AH +0.5` | `0-0` | `0` | `FullWin` | `WonClaimed` | `0` | `200` | `190` | `000000000000000000000000000000000000000000000000000000000000018f` | `731da5dba9f769ce4e2c3e8440b42100827ab9fab20a2889864d43ed1c07aa00` |
| `ah-+0.5-full-win` | `AH +0.5` | `0-0` | `1` | `FullLoss` | `Lost` | `0` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000190` | `-` |
| `ah-+0.75-half-loss` | `AH +0.75` | `0-1` | `0` | `HalfLoss` | `Lost` | `50` | `0` | `0` | `0000000000000000000000000000000000000000000000000000000000000191` | `-` |
| `ah-+0.75-half-loss` | `AH +0.75` | `0-1` | `1` | `HalfWin` | `WonClaimed` | `50` | `100` | `95` | `0000000000000000000000000000000000000000000000000000000000000192` | `ebbb20f52deeee73b8e8421de7400be11ab355d94c1cc2816ab6346c8a3fdb3f` |

## Transactions
| # | label | actor | tx | status | gas |
|---:|---|---|---|---:|---:|
| 1 | `OPEN_1x2-home-win` | `admin` | `ef53c205ff4d5afdde39a2c5fa8d1d893bf1d4abc6ab7da2ec31423824acb7ad` | `1` | `520175` |
| 2 | `DEPOSIT_MATCH_LP_FOR_FIRST_MATRIX_MATCH` | `lpUser` | `2283e596c0194546cd2daa5577444c5c20bf3182227544c7ae45d7ef999070c2` | `1` | `263570` |
| 3 | `PLACE_1x2-home-win_outcome0` | `bettor0` | `403b578b6a3634aacba51feadf101b4dabd01698461d35579a93cc68b553166e` | `1` | `511937` |
| 4 | `PLACE_1x2-home-win_outcome1` | `bettor1` | `b286911e6c02a5731b0ee64ab28eb0183b89e680e98e8feadd19947a78a7e04b` | `1` | `507959` |
| 5 | `PLACE_1x2-home-win_outcome2` | `bettor2` | `aa8e3eb28e79557ed8d39ccab07c44b6c5a65b1616334e8b52032f66955c97da` | `1` | `507959` |
| 6 | `OPEN_1x2-draw` | `admin` | `d6b0b3bb0acafbe10b66e9eb12f6067049721b1d1e7a9b7d0e635af3b79cf4f8` | `1` | `520187` |
| 7 | `PLACE_1x2-draw_outcome0` | `bettor0` | `0bc0e3f8e4cf232de8c340c6c79d899ab3728624e3a24b73ac522805413f32d1` | `1` | `491600` |
| 8 | `PLACE_1x2-draw_outcome1` | `bettor1` | `35a292fa77a69bb0e3b0fa6f7606518715ada21b07c2cffc65f226e36e83bb7f` | `1` | `487622` |
| 9 | `PLACE_1x2-draw_outcome2` | `bettor2` | `1a29a21ed980e4835e023a320d69be74e995f22eead7f7ef5b098637fcd8cb99` | `1` | `487622` |
| 10 | `OPEN_1x2-away-win` | `admin` | `a9445d1a81b6d4cb1f48815c64d6ab12289565a7c67f75991689827b3af3ba97` | `1` | `520187` |
| 11 | `PLACE_1x2-away-win_outcome0` | `bettor0` | `c3b2d90e65afbb39e1a0f6cc833bb0bd2cbd83f1579e21ebc47a79770594bd55` | `1` | `491588` |
| 12 | `PLACE_1x2-away-win_outcome1` | `bettor1` | `9535d1239d87f6253f4abcfc514ecde3a2af272f009055d90789189aef3f793a` | `1` | `487610` |
| 13 | `PLACE_1x2-away-win_outcome2` | `bettor2` | `3c4b6599d64ea04d972dae7f2fabc5de902d37ccc51ae940eca6eea4b1d8aaff` | `1` | `487610` |
| 14 | `OPEN_ou-1.5-over` | `admin` | `d88b99ab611cf2973874ae07bbadb00462d5dbec59223fd8d5113ce4aa7cc3a5` | `1` | `470792` |
| 15 | `PLACE_ou-1.5-over_outcome0` | `bettor0` | `cdcbb256e0f20e5371940495adf7b201bd42b3907693b5a0199603c9944036d5` | `1` | `476405` |
| 16 | `PLACE_ou-1.5-over_outcome1` | `bettor1` | `ac00dcfc84828d88c310f29fa690c81530828cbeb0768d452af7f716df380bca` | `1` | `474493` |
| 17 | `OPEN_ou-1.5-under` | `admin` | `2f94ab55ccd3d381063f636c663169b57fecd5ced7cf9a4f7ab450ebef188a57` | `1` | `470792` |
| 18 | `PLACE_ou-1.5-under_outcome0` | `bettor0` | `7da1f67bda6e4043047518141d3181982164a6f3070c5fb002a5b857942c170f` | `1` | `476405` |
| 19 | `PLACE_ou-1.5-under_outcome1` | `bettor1` | `f300d29fc4ee01a6dda08cae7275f138108a51cfa3d91b4f349017da8d894392` | `1` | `474493` |
| 20 | `OPEN_ou-2.5-over` | `admin` | `23a1d6b144b89ba950b086e18eb0a8c8919287cd151e48717aa0f41d5f457a3c` | `1` | `470804` |
| 21 | `PLACE_ou-2.5-over_outcome0` | `bettor0` | `ff7e536ffe079c17f87903926d13ca0a5d92972fa6c01c8a2f9f59983d9056b3` | `1` | `476405` |
| 22 | `PLACE_ou-2.5-over_outcome1` | `bettor1` | `7bf3e3d48ede755a6b9ee0b6c5d150adb59d3843fc3d295eaa06180358c2863c` | `1` | `474493` |
| 23 | `OPEN_ou-2.5-under` | `admin` | `45a2baec2f00a9f1e2708bada626b62c307072b59d2647dda22cbdf3b9ef7110` | `1` | `470804` |
| 24 | `PLACE_ou-2.5-under_outcome0` | `bettor0` | `8d2148b1ff0ee0d29bcd54c85a08a54ca8f215a12b694f66976a1fe00c649f7f` | `1` | `476405` |
| 25 | `PLACE_ou-2.5-under_outcome1` | `bettor1` | `3dc0fc65d279dbb27cef7b69986e8ec962717a018995c4f7f1dfad7507290cab` | `1` | `474493` |
| 26 | `OPEN_ou-3.5-over` | `admin` | `115f72f4dd308f07831b8be0ee256dd52fc287d54f78bc61f955f563d077da20` | `1` | `470792` |
| 27 | `PLACE_ou-3.5-over_outcome0` | `bettor0` | `d50e6ea718b91cd7ceb6d374ff4a41f96915b2a6f8134a9a10024ea1e3cd26b4` | `1` | `476405` |
| 28 | `PLACE_ou-3.5-over_outcome1` | `bettor1` | `c145a48714094ed2f7097471c286366331fdc6797ac65668b0ad56dea0f4dc2e` | `1` | `474493` |
| 29 | `OPEN_ou-3.5-under` | `admin` | `348ab3b4cdfbf25797d39c2aefc75036f5b81a25eb0efe7d29fbf21dd81d278d` | `1` | `470804` |
| 30 | `PLACE_ou-3.5-under_outcome0` | `bettor0` | `3b78be597c21578f72d24bfeba55236009a028f930afe1a19b51d7ed840b64c0` | `1` | `476405` |
| 31 | `PLACE_ou-3.5-under_outcome1` | `bettor1` | `d23efe564ff077d67cc34a2a6b94fb9ce10d7c76b65332bad38c1954c091052e` | `1` | `474493` |
| 32 | `OPEN_ah--0.5-full-win` | `admin` | `d0f8ad5e5d600283a0912103b33b5b07f77beeeb97263c359475ea51afef3122` | `1` | `470728` |
| 33 | `PLACE_ah--0.5-full-win_outcome0` | `bettor0` | `f92e548d74fb652c4c183112c79fd2316b811ad74b4806a96e54b7c9940b338b` | `1` | `476405` |
| 34 | `PLACE_ah--0.5-full-win_outcome1` | `bettor1` | `5411bb3da8f0099a06cba17bbf47777f83d1f4e49a7b0ca9be98ff33e3537781` | `1` | `474493` |
| 35 | `OPEN_ah--1-full-push` | `admin` | `a296c37eff6224f80118519a1d6cac9e74073096e321b9486f99e3f0dc31f82b` | `1` | `470740` |
| 36 | `PLACE_ah--1-full-push_outcome0` | `bettor0` | `4df6fa52bb99a62d94ae2ba51b33d4d3eeef00f5d1930e78af35d2fe686cafc0` | `1` | `476405` |
| 37 | `PLACE_ah--1-full-push_outcome1` | `bettor1` | `7e42e280ee381e67aed166ea04bbd5a51abf51b7edd3e9f5a3fd19e05d68b6d0` | `1` | `474493` |
| 38 | `OPEN_ah--1.5-full-loss` | `admin` | `f770aa123a3b69625c621fef8a48a53313ef9a2f14df5f4e7e1bae4d0cd30262` | `1` | `470740` |
| 39 | `PLACE_ah--1.5-full-loss_outcome0` | `bettor0` | `3c8a7e1011ec88a55e6a3286de20d78cd2654d78ca36c8503ad389f983b5ff31` | `1` | `479642` |
| 40 | `PLACE_ah--1.5-full-loss_outcome1` | `bettor1` | `642079cda6e0890e8017cfd25054bd246ac893e22cc4f50d4521571e3071f638` | `1` | `477730` |
| 41 | `OPEN_ah--0.25-half-loss` | `admin` | `4e4a7a837640cca5d8ee633d13dcba9007232d416b54533c6019a22427901c3e` | `1` | `470740` |
| 42 | `PLACE_ah--0.25-half-loss_outcome0` | `bettor0` | `81151c05231d5331ffda12e8192dbd00e0983453b54570f35c162b5637b60f4b` | `1` | `476405` |
| 43 | `PLACE_ah--0.25-half-loss_outcome1` | `bettor1` | `2030dd18226a939e331cce2c7a92e0ec8b01e94d57a820d6619871f2ac1b779b` | `1` | `474493` |
| 44 | `OPEN_ah--0.75-half-win` | `admin` | `d082ccd8c262bc6474443b28438147a18fe11aaaa85989bc5bdad78f5a465edb` | `1` | `470740` |
| 45 | `PLACE_ah--0.75-half-win_outcome0` | `bettor0` | `bc37ecedf5f95e48aa74192775fd0c805bba25299678e900dd87fdd75294d437` | `1` | `476405` |
| 46 | `PLACE_ah--0.75-half-win_outcome1` | `bettor1` | `f6019f0846192b8d2e19becb9eea5511992fc9264c4d343a1149113f2718596f` | `1` | `474493` |
| 47 | `OPEN_ah--1.25-half-loss` | `admin` | `6b99ea4feb5eddea96eac7008918df531a4dfd2158556373879ed804b66c7417` | `1` | `470740` |
| 48 | `PLACE_ah--1.25-half-loss_outcome0` | `bettor0` | `f19260382befe4a65493efb54a28b466b403562883898cc516f4b825f394165d` | `1` | `476405` |
| 49 | `PLACE_ah--1.25-half-loss_outcome1` | `bettor1` | `46a3cab940e7ace1a27fbe794142f3ef0142e10273dda980c300aafb3eea532c` | `1` | `474493` |
| 50 | `OPEN_ah-+0-full-push` | `admin` | `c1615c43e4c78c143d208e8e6d3d339a88ebad9bf66872518cedf37766f950e3` | `1` | `470740` |
| 51 | `PLACE_ah-+0-full-push_outcome0` | `bettor0` | `b00676fc804decf0791fbe05995231f4cda208fdd36a0846fa510fd5f615fbd2` | `1` | `476405` |
| 52 | `PLACE_ah-+0-full-push_outcome1` | `bettor1` | `56f07a5e446f7e0b9d2be1bcee7cf04d3cbe8cb2f9f5f2148ebff22ad464fb01` | `1` | `474493` |
| 53 | `OPEN_ah-+0.25-half-win` | `admin` | `77bf1d5b3c9143c7efcb2f503dab6cd2e07187d1e4dee407f5738e84ae3dbdf0` | `1` | `470740` |
| 54 | `PLACE_ah-+0.25-half-win_outcome0` | `bettor0` | `d49d9d17b18c74dc907c377ee4608af6932ee680df897852a31f252941dc1cdb` | `1` | `476405` |
| 55 | `PLACE_ah-+0.25-half-win_outcome1` | `bettor1` | `4fe114e06c7ac6b3470dfa560f54c543f6d410ca15949a7e4e661daeb426fb07` | `1` | `474493` |
| 56 | `OPEN_ah-+0.5-full-win` | `admin` | `19e195b15e6bb79419534e87af6ec767c09d059552ed325af1099818093e1a17` | `1` | `470740` |
| 57 | `PLACE_ah-+0.5-full-win_outcome0` | `bettor0` | `ec694b4b3890140609836c6f85075d3baedb0f710877639a9f2dcfbf3aa2f3a6` | `1` | `476405` |
| 58 | `PLACE_ah-+0.5-full-win_outcome1` | `bettor1` | `ee7e805bb03388d960bde441d009ecc48a108f86cead9ceba58e0456ddb61df9` | `1` | `474493` |
| 59 | `OPEN_ah-+0.75-half-loss` | `admin` | `2f7e645be3053657f882eea6836fbf32bbdfc4148562a90405620cddccf08186` | `1` | `470740` |
| 60 | `PLACE_ah-+0.75-half-loss_outcome0` | `bettor0` | `3869ae5f51e41add02343b9c85ede3768a4212c4698811efbbfc4a45cee4cdd9` | `1` | `476405` |
| 61 | `PLACE_ah-+0.75-half-loss_outcome1` | `bettor1` | `f0e899111adb967b7d0f0713db127b724dfb0aae886fbcaae45de557d1816158` | `1` | `474493` |
| 62 | `SETTLE_1x2-home-win` | `admin` | `e744a639d1386c57ee10cd3c762bad7de76db23bf5560f82f092c829989f4de2` | `1` | `338059` |
| 63 | `FINALIZE_1x2-home-win` | `admin` | `b9d64b34f2605654ebab818671d01e73cd2919439a3c521b2516468c4e864aca` | `1` | `165361` |
| 64 | `SETTLE_1x2-draw` | `admin` | `7fbc0b13723ea669733ae745ab6f39640a2be21e463314fd14a609bccba2bec6` | `1` | `338206` |
| 65 | `FINALIZE_1x2-draw` | `admin` | `8454d4f9ede828290b1055077cc590db3d6cf6664bab7232615d350604955a74` | `1` | `142673` |
| 66 | `SETTLE_1x2-away-win` | `admin` | `8f7ef4d4552fc755d24c39c5c75df385d18e739f504a645e46a66569624a5579` | `1` | `333385` |
| 67 | `FINALIZE_1x2-away-win` | `admin` | `83927fd6c564c5a42784e78d651fbda748a8ec0218850c272de2de1bc6348b1d` | `1` | `142661` |
| 68 | `SETTLE_ou-1.5-over` | `admin` | `bfbdf70b550f705a95cceea1c43442f4db8a100ff07de0740b3397b6087affbc` | `1` | `303455` |
| 69 | `FINALIZE_ou-1.5-over` | `admin` | `9124e7c7eb4762c82027377ba1ae435cbd5dd3610732c69cc3f13bfefc7608f8` | `1` | `238671` |
| 70 | `SETTLE_ou-1.5-under` | `admin` | `94366d4e39dba1775b73c1c27297f5288f141724933df60e495d012c7f9178ab` | `1` | `303481` |
| 71 | `FINALIZE_ou-1.5-under` | `admin` | `b6aaaf62efed61198b78556713c178a50f9d7b55e0ab0212733fc3e786265fcc` | `1` | `238671` |
| 72 | `SETTLE_ou-2.5-over` | `admin` | `d839de0ed500728310bea2bcf5e010b0197b56e2e5221b340d95da4c035210e9` | `1` | `303511` |
| 73 | `FINALIZE_ou-2.5-over` | `admin` | `fc51c9e1c98425d5d7cc816c46a024c3da6977ecc6103d0b1c3d3b371145ca68` | `1` | `238671` |
| 74 | `SETTLE_ou-2.5-under` | `admin` | `43bfc258cd9895c18174ca5fbf96f21878803acb92fc0b03531a2d6f465064a3` | `1` | `303537` |
| 75 | `FINALIZE_ou-2.5-under` | `admin` | `1bf9d730c80aa9db2215a5b3be9dc74692837f229be05a88b0c96c061e3acb71` | `1` | `238671` |
| 76 | `SETTLE_ou-3.5-over` | `admin` | `afe01f506b4e011cc98c4ada3a4c9ac95812f8dae80f5e6afefde068c3b1b4ad` | `1` | `303545` |
| 77 | `FINALIZE_ou-3.5-over` | `admin` | `dd75dd5b3aa0772426361f0ab232cdf6f473b0ca4c4bfd686be01dfaabad29b0` | `1` | `238671` |
| 78 | `SETTLE_ou-3.5-under` | `admin` | `efc197d9276d59fe0132e86bcc21eca6006755546b0b0070829480334016df2e` | `1` | `303571` |
| 79 | `FINALIZE_ou-3.5-under` | `admin` | `84938c2d2b4b844a665d8c0f20321214e89b59f4b4af6518928da4a8707ace20` | `1` | `238671` |
| 80 | `SETTLE_ah--0.5-full-win` | `admin` | `26492c240f22ba1a39157b921c0f32dec4bbcbae43c36d2370547d434bcd473c` | `1` | `303626` |
| 81 | `FINALIZE_ah--0.5-full-win` | `admin` | `40ea63289fc70f104412a745a93d3f9a5cf332213c399922976c31fbf80988aa` | `1` | `238671` |
| 82 | `SETTLE_ah--1-full-push` | `admin` | `9a62c07923b77657b9275b4b63bdffe65d543f1045fd342e5484c6830726195b` | `1` | `281102` |
| 83 | `FINALIZE_ah--1-full-push` | `admin` | `dcbf24a2b8036d411f253bcd7e44a1c526f6b6680d06d341fdefea06501d260a` | `1` | `83414` |
| 84 | `SETTLE_ah--1.5-full-loss` | `admin` | `287630c1894f9fca04f63437bfb8738536d748a91dbc70d54094984f35fc5d83` | `1` | `303788` |
| 85 | `FINALIZE_ah--1.5-full-loss` | `admin` | `8aab3f14cb2da4faf064d37c53e79966d4b8481cc6b7cad65900bd91c22fb212` | `1` | `238671` |
| 86 | `SETTLE_ah--0.25-half-loss` | `admin` | `8e411f1793942b38227a93ddea3061d10d4284e5d2379088299a78a8291020c8` | `1` | `410310` |
| 87 | `FINALIZE_ah--0.25-half-loss` | `admin` | `207829a954518a0bfb1e3da7f888b53c1c35d33585d2ff7529adfe994042c544` | `1` | `238671` |
| 88 | `SETTLE_ah--0.75-half-win` | `admin` | `0a0738f748b6ecc2cf74688236ed46a8bed0bd9b036eff44a7c4e62bb79d01e7` | `1` | `410303` |
| 89 | `FINALIZE_ah--0.75-half-win` | `admin` | `b70438fd3f70f58000d98e48b542b34d44059a99e6965308e827647cd7b6353d` | `1` | `238671` |
| 90 | `SETTLE_ah--1.25-half-loss` | `admin` | `20db0a19e2aa393c06a2d72064ccedae9d7ff47d283336ba2d2ea95c4719f8f0` | `1` | `410416` |
| 91 | `FINALIZE_ah--1.25-half-loss` | `admin` | `6ed9447f417ad2c458644074301743fef810977a1561dc65e6847f93bfd13379` | `1` | `238671` |
| 92 | `SETTLE_ah-+0-full-push` | `admin` | `96e2b038b2a9acf309bbe260783b0992c5a5e982cc29379dce51584d6826a58d` | `1` | `281304` |
| 93 | `FINALIZE_ah-+0-full-push` | `admin` | `25b0750235b06e0d003bf674aea507dc06a6c00c5c3f0af19e175d3fa9384f23` | `1` | `83414` |
| 94 | `SETTLE_ah-+0.25-half-win` | `admin` | `c36d8e4c65c47e2dadb5b629a6b742294c76384ad8fd271f013baa37a3fb9dc5` | `1` | `410417` |
| 95 | `FINALIZE_ah-+0.25-half-win` | `admin` | `cd0e45032c8e1a9a2a42869f459deb36f999790939982f0f9df3dbfbb339a912` | `1` | `238671` |
| 96 | `SETTLE_ah-+0.5-full-win` | `admin` | `6d5d76596f34358dde6d3f3ad1b822952319c9de10d22852536dee62d9396fca` | `1` | `303964` |
| 97 | `FINALIZE_ah-+0.5-full-win` | `admin` | `1335462ec6728774f65010aa9d2cc85842438ad4049aeb28f3407859f89e938b` | `1` | `238671` |
| 98 | `SETTLE_ah-+0.75-half-loss` | `admin` | `c796494f1f45df68dc609151723147efaa0d2a4d9470c0c3831c71cdd334d49b` | `1` | `400984` |
| 99 | `FINALIZE_ah-+0.75-half-loss` | `admin` | `d44ff3e52b3a0e93b5e5b34d2e488d5a2dc11ba05a5bcb707db9a69e49f907b1` | `1` | `238671` |
| 100 | `CLAIM_1x2-home-win_outcome0` | `bettor0` | `109915acf7e85658b09e2814cb8d575b183ff529b49c862ab6c7fd37c0d8b909` | `1` | `156372` |
| 101 | `CLAIM_1x2-draw_outcome1` | `bettor1` | `3a536ddff5542b11a98d6faf31aac0f449150e916d775e19cd72987278e52381` | `1` | `156372` |
| 102 | `CLAIM_1x2-away-win_outcome2` | `bettor2` | `d9dbe2ac1756b5c61578d27ef856579e67303d2de046fae2371a2bdfa2dacbde` | `1` | `156372` |
| 103 | `CLAIM_ou-1.5-over_outcome0` | `bettor0` | `a95ec447a9f44072fd4ac2dc2948a23ac2c8bf4583e12e8fc5620091176a0c36` | `1` | `156372` |
| 104 | `CLAIM_ou-1.5-under_outcome1` | `bettor1` | `b662dec51e00a7ed6397b845ec1e99738306ae294f15baeb20e00bfbc627a3f6` | `1` | `156372` |
| 105 | `CLAIM_ou-2.5-over_outcome0` | `bettor0` | `1f443dd74f3646de47af73ab90e6ac685aa1434a9414f2416a751e1c464aa394` | `1` | `156372` |
| 106 | `CLAIM_ou-2.5-under_outcome1` | `bettor1` | `c0e8e6b18eebed51df253855cd820c1504c65635d93c13dc8f92260bba37d4c7` | `1` | `156372` |
| 107 | `CLAIM_ou-3.5-over_outcome0` | `bettor0` | `0c693d1434003f8c15afe569cbb877f82d03249928b272d82450bcc9c75fb515` | `1` | `156372` |
| 108 | `CLAIM_ou-3.5-under_outcome1` | `bettor1` | `443b5fc43de2c05b78d9f0ce6c52ea873f23ef60e13dc11db0ac5bf423daf4c2` | `1` | `156372` |
| 109 | `CLAIM_ah--0.5-full-win_outcome0` | `bettor0` | `99eef42da885fcb1d7719b053a0b5d4e9e21c461115fa7cbbaffba4b817cb3eb` | `1` | `156372` |
| 110 | `CLAIM_ah--1.5-full-loss_outcome1` | `bettor1` | `9814fc92c654fa08551b32106c59c505f527a496e3ec648d60d9193f6e18838c` | `1` | `156372` |
| 111 | `CLAIM_ah--0.25-half-loss_outcome1` | `bettor1` | `75313dcb4d88c016e304b6ee3e2db1aac923e21077f816251ddfef75fb85ee23` | `1` | `156372` |
| 112 | `CLAIM_ah--0.75-half-win_outcome0` | `bettor0` | `b02c3656fec9c8c2cb27ff5fc8500bac5ab6b376c19f21659944966cfba4d9e3` | `1` | `156372` |
| 113 | `CLAIM_ah--1.25-half-loss_outcome1` | `bettor1` | `794c3c4296b59922963352e7763482fef58a3612e960a6fc064397b308185c26` | `1` | `156372` |
| 114 | `CLAIM_ah-+0.25-half-win_outcome0` | `bettor0` | `481491b4aaac7f9dcb343d9a0706418a1bb7b4f20773128c66f2fa8dde25d0cf` | `1` | `156372` |
| 115 | `CLAIM_ah-+0.5-full-win_outcome0` | `bettor0` | `731da5dba9f769ce4e2c3e8440b42100827ab9fab20a2889864d43ed1c07aa00` | `1` | `156372` |
| 116 | `CLAIM_ah-+0.75-half-loss_outcome1` | `bettor1` | `ebbb20f52deeee73b8e8421de7400be11ab355d94c1cc2816ab6346c8a3fdb3f` | `1` | `156372` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,461,020` | `98,461,119` | `10.0501633581555412` | `10.0307254681555412` |
| `bettor0` | `0xDf452066FB45bde0702A0d2B469B254623f76B97` | `7,861` | `7,722` | `0.069585866` | `0.059214048` |
| `bettor1` | `0xE34886EBFae64cFdf1DB3B990352a68FE3Db0Dbf` | `7,766` | `7,532` | `0.069628392` | `0.0592991` |
| `bettor2` | `0xE60D3Fb13A9Cb25a21cB62C1441cc29B57655B9C` | `7,887` | `7,774` | `0.078280028` | `0.076640465` |
| `lpUser` | `0xF5E0Aace148b1bD8ab803e3f81dB9cDBcAA92D75` | `11,000` | `6,000` | `0.079685262` | `0.079421692` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `93,656` | `98,912` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `52,718` | `52,791` | `0` | `0` |