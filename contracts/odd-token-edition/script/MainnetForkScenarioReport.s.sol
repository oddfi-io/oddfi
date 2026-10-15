// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";

import {
    IPancakeV2RouterLike,
    IPancakeV3FactoryLike,
    IPancakeV3PoolLike,
    IPancakeV3PositionManagerLike
} from "../test/helpers/PancakeV3Interfaces.sol";

contract ForkScenarioSource {
    function sweep(IERC20 token, address to, uint256 amount) external {
        require(token.transfer(to, amount), "SWEEP_TRANSFER_FAILED");
    }
}

contract MainnetForkScenarioReport is Script {
    using MessageHashUtils for bytes32;

    address internal constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;
    address internal constant BSC_WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address internal constant PANCAKE_V2_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant PANCAKE_V3_FACTORY = 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865;
    address internal constant PANCAKE_V3_ROUTER = 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4;
    address internal constant PANCAKE_V3_POSITION_MANAGER = 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364;
    uint24 internal constant DEFAULT_USDT_FEE = 2500;
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;

    uint256 internal constant ADMIN_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 internal constant USER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 internal constant REFERRER_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 internal constant LP_PK = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;
    uint256 internal constant USER2_PK = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;
    uint256 internal constant SIGNER_PK = 0xA12345;

    struct System {
        ODDToken odd;
        StakingPool staking;
        LiquidityPool liquidity;
        BettingPool betting;
        BettingSettlementModule settlement;
        address admin;
        address user;
        address referrer;
        address lpUser;
        address user2;
        address treasury;
        address signer;
    }

    function deploySystem()
        external
        returns (address odd, address staking, address liquidity, address betting, address settlement)
    {
        System memory sys = _deploySystem();
        odd = address(sys.odd);
        staking = address(sys.staking);
        liquidity = address(sys.liquidity);
        betting = address(sys.betting);
        settlement = address(sys.settlement);
        console2.log("ODD", odd);
        console2.log("STAKING", staking);
        console2.log("LIQUIDITY", liquidity);
        console2.log("BETTING", betting);
        console2.log("SETTLEMENT", settlement);
        console2.log("ADMIN", sys.admin);
        console2.log("USER", sys.user);
        console2.log("REFERRER", sys.referrer);
        console2.log("LP_USER", sys.lpUser);
        console2.log("USER2", sys.user2);
        console2.log("TREASURY", sys.treasury);
        console2.log("SIGNER", sys.signer);
    }

    function runNormalSettlementScenario() external {
        System memory sys = _deploySystem();

        vm.startPrank(vm.addr(LP_PK));
        sys.liquidity.depositGlobal(5_000 ether, 1);
        vm.stopPrank();

        vm.startPrank(vm.addr(REFERRER_PK));
        sys.staking.stake(1_000 ether, 1);
        vm.stopPrank();

        bytes32 marketId = _openTwoWayMarket(sys, keccak256("scenario-normal"), 1, 0);
        (QuoteGuardInput memory guard,, uint256 lockedOdds) = _guard(sys.betting, marketId, 0, 100 ether);

        uint256 userOddBefore = sys.odd.balanceOf(sys.user);
        vm.startPrank(vm.addr(USER_PK));
        (bytes32 betId, uint256 acceptedAmount,) = sys.betting.placeBet(marketId, 0, 100 ether, guard, sys.referrer);
        vm.stopPrank();

        vm.warp(block.timestamp + 4 hours + 1);
        vm.startPrank(vm.addr(ADMIN_PK));
        _settleByScore(sys.betting, marketId, 1, 0);
        vm.stopPrank();

        uint256 userOddBeforeClaim = sys.odd.balanceOf(sys.user);
        uint256 referrerRewardBefore = sys.betting.referrerRewardsOdd(sys.referrer);
        uint256 taxBufferBefore = sys.betting.taxBuffer();
        uint256 treasuryBefore = sys.odd.balanceOf(sys.treasury);
        vm.startPrank(vm.addr(USER_PK));
        sys.betting.claimPayout(betId);
        vm.stopPrank();

        uint256 gross = acceptedAmount * lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        uint256 tax = gross * sys.betting.payoutTaxBps() / PrecisionConstants.BPS_SCALE;

        console2.log("SCENARIO", "normal_settlement");
        console2.log("MARKET_ID");
        console2.logBytes32(marketId);
        console2.log("BET_ID");
        console2.logBytes32(betId);
        console2.log("USER_ODD_BEFORE_BET");
        console2.logUint(userOddBefore);
        console2.log("ACCEPTED_AMOUNT");
        console2.logUint(acceptedAmount);
        console2.log("LOCKED_ODDS");
        console2.logUint(lockedOdds);
        console2.log("GROSS_PAYOUT");
        console2.logUint(gross);
        console2.log("PAYOUT_TAX");
        console2.logUint(tax);
        console2.log("USER_ODD_BEFORE_CLAIM");
        console2.logUint(userOddBeforeClaim);
        console2.log("USER_ODD_AFTER_CLAIM");
        console2.logUint(sys.odd.balanceOf(sys.user));
        console2.log("TREASURY_BEFORE");
        console2.logUint(treasuryBefore);
        console2.log("TREASURY_AFTER");
        console2.logUint(sys.odd.balanceOf(sys.treasury));
        console2.log("REFERRER_REWARD_BEFORE");
        console2.logUint(referrerRewardBefore);
        console2.log("REFERRER_REWARD_AFTER");
        console2.logUint(sys.betting.referrerRewardsOdd(sys.referrer));
        console2.log("TAX_BUFFER_BEFORE");
        console2.logUint(taxBufferBefore);
        console2.log("TAX_BUFFER_AFTER");
        console2.logUint(sys.betting.taxBuffer());
    }

    function runPushRefundScenario() external {
        System memory sys = _deploySystem();
        bytes32 marketId = _openTwoWayMarket(sys, keccak256("scenario-push"), 1, 1);

        (QuoteGuardInput memory guard0,,) = _guard(sys.betting, marketId, 0, 100 ether);
        vm.startPrank(vm.addr(USER_PK));
        (bytes32 betId0, uint256 accepted0,) = sys.betting.placeBet(marketId, 0, 100 ether, guard0);
        vm.stopPrank();

        (QuoteGuardInput memory guard1,,) = _guard(sys.betting, marketId, 1, 120 ether);
        vm.startPrank(vm.addr(USER2_PK));
        (bytes32 betId1, uint256 accepted1,) = sys.betting.placeBet(marketId, 1, 120 ether, guard1);
        vm.stopPrank();

        bytes32[] memory betIds = new bytes32[](2);
        betIds[0] = betId0;
        betIds[1] = betId1;
        uint256 before0 = sys.odd.balanceOf(sys.user);
        uint256 before1 = sys.odd.balanceOf(sys.user2);

        vm.warp(block.timestamp + 4 hours + 1);
        vm.startPrank(vm.addr(ADMIN_PK));
        sys.betting.settleMarketBetsByScore(marketId, 1, 0, betIds);
        sys.betting.finalizeMarketSettlement(marketId, 0);
        vm.stopPrank();

        console2.log("SCENARIO", "push_refund");
        console2.log("MARKET_ID");
        console2.logBytes32(marketId);
        console2.log("BET0");
        console2.logBytes32(betId0);
        console2.log("BET1");
        console2.logBytes32(betId1);
        console2.log("ACCEPTED0");
        console2.logUint(accepted0);
        console2.log("ACCEPTED1");
        console2.logUint(accepted1);
        console2.log("USER0_BEFORE");
        console2.logUint(before0);
        console2.log("USER0_AFTER");
        console2.logUint(sys.odd.balanceOf(sys.user));
        console2.log("USER1_BEFORE");
        console2.logUint(before1);
        console2.log("USER1_AFTER");
        console2.logUint(sys.odd.balanceOf(sys.user2));
    }

    function runReferralUsdtScenario() external {
        System memory sys = _deploySystem();
        _ensureOddUsdtPool(sys, 50_000 ether, 5_000 ether);

        bytes32 marketId = _openTwoWayMarket(sys, keccak256("scenario-referral-usdt"), 1, 0);
        (QuoteGuardInput memory guard,,) = _guard(sys.betting, marketId, 0, 100 ether);
        vm.startPrank(vm.addr(USER_PK));
        sys.betting.placeBet(marketId, 0, 100 ether, guard, sys.referrer);
        vm.stopPrank();

        uint256 oddBefore = sys.odd.balanceOf(sys.referrer);
        vm.startPrank(vm.addr(REFERRER_PK));
        sys.betting.claimReferralRewards(0.5 ether);
        vm.stopPrank();

        uint256 available = sys.betting.referrerRewardsOdd(sys.referrer);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _referralSignature(
            sys.betting, sys.referrer, available, 1, deadline, sys.betting.referralClaimNonces(sys.referrer)
        );
        uint256 usdtBefore = IERC20(BSC_USDT).balanceOf(sys.referrer);
        uint256 oddRewardBefore = sys.betting.referrerRewardsOdd(sys.referrer);

        vm.startPrank(vm.addr(REFERRER_PK));
        uint256 amountOut = sys.betting.claimUSDTReferralRewards(1, deadline, signature, 0);
        vm.stopPrank();

        console2.log("SCENARIO", "referral_usdt");
        console2.log("MARKET_ID");
        console2.logBytes32(marketId);
        console2.log("REFERRER_ODD_WALLET_BEFORE");
        console2.logUint(oddBefore);
        console2.log("REFERRER_ODD_WALLET_AFTER");
        console2.logUint(sys.odd.balanceOf(sys.referrer));
        console2.log("REFERRER_REWARD_ODD_BEFORE_USDT");
        console2.logUint(oddRewardBefore);
        console2.log("REFERRER_REWARD_ODD_AFTER_USDT");
        console2.logUint(sys.betting.referrerRewardsOdd(sys.referrer));
        console2.log("REFERRER_USDT_BEFORE");
        console2.logUint(usdtBefore);
        console2.log("REFERRER_USDT_AFTER");
        console2.logUint(IERC20(BSC_USDT).balanceOf(sys.referrer));
        console2.log("USDT_OUT");
        console2.logUint(amountOut);
    }

    function runWaterfallScenario() external {
        System memory sys = _deploySystem();

        vm.startPrank(vm.addr(LP_PK));
        sys.liquidity.depositGlobal(1_000 ether, 1);
        vm.stopPrank();

        vm.startPrank(vm.addr(ADMIN_PK));
        sys.betting.setRiskConfig(500 ether, 1_000 ether, 2_000 ether);
        vm.stopPrank();

        bytes32 marketId = _openTwoWayMarket(sys, keccak256("scenario-waterfall"), 1, 0);
        (QuoteGuardInput memory guard,,) = _guard(sys.betting, marketId, 0, 1_000 ether);
        vm.startPrank(vm.addr(USER_PK));
        sys.betting.placeBet(marketId, 0, 1_000 ether, guard);
        vm.stopPrank();

        uint256 reserveBefore = sys.betting.platformReserve();
        uint256 lpLossOffsetRemainingBefore = sys.betting.lpLossOffsetRemaining();
        vm.warp(block.timestamp + 4 hours + 1);
        vm.startPrank(vm.addr(ADMIN_PK));
        _settleByScore(sys.betting, marketId, 1, 0);
        vm.stopPrank();

        console2.log("SCENARIO", "waterfall");
        console2.log("MARKET_ID");
        console2.logBytes32(marketId);
        console2.log("RESERVE_BEFORE");
        console2.logUint(reserveBefore);
        console2.log("RESERVE_AFTER");
        console2.logUint(sys.betting.platformReserve());
        console2.log("LP_LOSS_OFFSET_BEFORE");
        console2.logUint(lpLossOffsetRemainingBefore);
        console2.log("LP_LOSS_OFFSET_AFTER");
        console2.logUint(sys.betting.lpLossOffsetRemaining());
        console2.log("TAX_BUFFER_AFTER");
        console2.logUint(sys.betting.taxBuffer());
    }

    function _deploySystem() internal returns (System memory sys) {
        sys.admin = vm.addr(ADMIN_PK);
        sys.user = vm.addr(USER_PK);
        sys.referrer = vm.addr(REFERRER_PK);
        sys.lpUser = vm.addr(LP_PK);
        sys.user2 = vm.addr(USER2_PK);
        sys.treasury = makeAddr("treasury");
        sys.signer = vm.addr(SIGNER_PK);

        vm.deal(sys.admin, 100 ether);
        vm.deal(sys.user, 20 ether);
        vm.deal(sys.referrer, 20 ether);
        vm.deal(sys.lpUser, 20 ether);
        vm.deal(sys.user2, 20 ether);
        vm.deal(sys.treasury, 1 ether);

        vm.startPrank(vm.addr(ADMIN_PK));
        sys.odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (sys.admin, sys.admin))));
        sys.staking = StakingPool(
            _proxy(
                address(new StakingPool()),
                abi.encodeCall(StakingPool.initialize, (sys.admin, address(sys.odd), sys.treasury))
            )
        );
        sys.liquidity = LiquidityPool(
            _proxy(
                address(new LiquidityPool()),
                abi.encodeCall(LiquidityPool.initialize, (sys.admin, address(sys.odd), sys.admin))
            )
        );
        sys.settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        sys.betting = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(
                    BettingPool.initialize, (sys.admin, address(sys.odd), address(sys.staking), address(sys.liquidity))
                )
            )
        );
        sys.betting.setSettlementModule(address(sys.settlement));
        sys.betting.setBetModule(address(betModule));
        sys.betting.setMarketModule(address(new BettingMarketModule()));
        sys.betting.setReferralModule(address(new BettingReferralModule()));
        sys.staking.initializeV2(address(sys.betting));
        sys.liquidity.setBettingPool(address(sys.betting));
        _bootstrapToken(sys);
        sys.betting.initializeV2(sys.treasury);
        sys.betting.setReferralClaimConfig(sys.signer, DEFAULT_USDT_FEE);
        require(sys.odd.transfer(sys.user, 2_000_000 ether), "USER_TRANSFER_FAILED");
        require(sys.odd.transfer(sys.user2, 2_000_000 ether), "USER2_TRANSFER_FAILED");
        require(sys.odd.transfer(sys.referrer, 1_000_000 ether), "REFERRER_TRANSFER_FAILED");
        require(sys.odd.transfer(sys.lpUser, 3_000_000 ether), "LP_TRANSFER_FAILED");
        sys.odd.approve(address(sys.betting), type(uint256).max);
        sys.betting.addPlatformReserve(15_000_000 ether);
        vm.stopPrank();

        _approveOdd(USER_PK, sys);
        _approveOdd(USER2_PK, sys);
        _approveOdd(REFERRER_PK, sys);
        _approveOdd(LP_PK, sys);
    }

    function _bootstrapToken(System memory sys) internal {
        ForkScenarioSource tierSale = new ForkScenarioSource();
        ForkScenarioSource houseVault = new ForkScenarioSource();
        ForkScenarioSource dexLaunchController = new ForkScenarioSource();
        ForkScenarioSource ecosystemRewards = new ForkScenarioSource();

        sys.odd.setTreasurySink(sys.admin, true);
        sys.odd.setTreasurySink(sys.treasury, true);
        sys.odd
            .setFixedSourceContracts(
                IODDTokenBusiness.FixedSources({
                    tierSale: address(tierSale),
                    houseVault: address(houseVault),
                    dexLaunchController: address(dexLaunchController),
                    ecosystemRewards: address(ecosystemRewards),
                    opsTreasury: sys.admin
                })
            );
        sys.odd.setWhitelist(address(sys.staking), true);
        sys.odd.setWhitelist(address(sys.liquidity), true);
        sys.odd.setWhitelist(address(sys.betting), true);
        sys.odd.allocateInitialSupply();

        _sweepSource(tierSale, sys.odd, sys.admin);
        _sweepSource(houseVault, sys.odd, sys.admin);
        _sweepSource(dexLaunchController, sys.odd, sys.admin);
        _sweepSource(ecosystemRewards, sys.odd, sys.admin);
    }

    function _sweepSource(ForkScenarioSource source, ODDToken token, address to) internal {
        uint256 balance = token.balanceOf(address(source));
        if (balance > 0) {
            source.sweep(IERC20(address(token)), to, balance);
        }
    }

    function _approveOdd(uint256 pk, System memory sys) internal {
        vm.startPrank(vm.addr(pk));
        sys.odd.approve(address(sys.betting), type(uint256).max);
        sys.odd.approve(address(sys.staking), type(uint256).max);
        sys.odd.approve(address(sys.liquidity), type(uint256).max);
        vm.stopPrank();
    }

    function _settleByScore(BettingPool pool, bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory betIds = pool.getMarketBetIds(marketId, 0, 50);
        if (betIds.length > 0) {
            pool.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        }
        pool.finalizeMarketSettlement(marketId, 0);
    }

    function _openTwoWayMarket(System memory sys, bytes32 matchId, uint8 marketType, uint8 line)
        internal
        returns (bytes32 marketId)
    {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;
        vm.startPrank(vm.addr(ADMIN_PK));
        marketId = sys.betting
            .openMarket(
                matchId,
                marketType,
                line,
                uint64(block.timestamp + 2 hours),
                uint64(block.timestamp + 4 hours),
                baseOdds,
                uint64(block.timestamp)
            );
        vm.stopPrank();
    }

    function _guard(BettingPool betting, bytes32 marketId, uint8 outcome, uint256 requestedAmount)
        internal
        view
        returns (QuoteGuardInput memory guard, uint256 acceptedAmount, uint256 lockedOdds)
    {
        (, acceptedAmount, lockedOdds,,) = betting.previewSignal(marketId, outcome, requestedAmount);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });
    }

    function _referralSignature(
        BettingPool betting,
        address claimant,
        uint256 oddAmount,
        uint256 rewardMinUsdtOutAmount,
        uint256 signatureDeadline,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
                abi.encode(
                    address(betting),
                    block.chainid,
                    claimant,
                    oddAmount,
                    rewardMinUsdtOutAmount,
                    signatureDeadline,
                    nonce
                )
            ).toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _quoteUsdt(address recipient, uint256 bnbAmount) internal returns (uint256 amountOut) {
        vm.startPrank(vm.addr(ADMIN_PK));
        address[] memory path = new address[](2);
        path[0] = BSC_WBNB;
        path[1] = BSC_USDT;
        uint256[] memory amounts = IPancakeV2RouterLike(PANCAKE_V2_ROUTER).swapExactETHForTokens{value: bnbAmount}(
            0, path, recipient, block.timestamp
        );
        amountOut = amounts[amounts.length - 1];
        vm.stopPrank();
    }

    function _ensureOddUsdtPool(System memory sys, uint256 oddAmount, uint256 usdtAmount) internal {
        _quoteUsdt(sys.admin, 10 ether);

        address token0 = address(sys.odd) < BSC_USDT ? address(sys.odd) : BSC_USDT;
        address token1 = address(sys.odd) < BSC_USDT ? BSC_USDT : address(sys.odd);

        address pool = IPancakeV3FactoryLike(PANCAKE_V3_FACTORY).getPool(token0, token1, DEFAULT_USDT_FEE);
        if (pool == address(0)) {
            vm.startPrank(vm.addr(ADMIN_PK));
            pool = IPancakeV3FactoryLike(PANCAKE_V3_FACTORY).createPool(token0, token1, DEFAULT_USDT_FEE);
            uint256 token0Unit = 10 ** IERC20Metadata(token0).decimals();
            uint256 token1Unit = 10 ** IERC20Metadata(token1).decimals();
            uint160 sqrtPriceX96 = token0 == address(sys.odd)
                ? _encodeSqrtPriceX96(token1Unit / 10, token0Unit)
                : _encodeSqrtPriceX96(token1Unit, token0Unit / 10);
            IPancakeV3PoolLike(pool).initialize(sqrtPriceX96);
            vm.stopPrank();
        }

        vm.startPrank(vm.addr(ADMIN_PK));
        IERC20(address(sys.odd)).approve(PANCAKE_V3_POSITION_MANAGER, type(uint256).max);
        IERC20(BSC_USDT).approve(PANCAKE_V3_POSITION_MANAGER, type(uint256).max);
        sys.odd.setDexRestrictedTarget(PANCAKE_V3_ROUTER, true);
        sys.odd.setDexRestrictedTarget(pool, true);
        sys.betting.setReferralSwapConfig(PANCAKE_V3_ROUTER, BSC_USDT, pool);
        int24 spacing = IPancakeV3FactoryLike(PANCAKE_V3_FACTORY).feeAmountTickSpacing(DEFAULT_USDT_FEE);
        int24 tickLower = _ceilTick(MIN_TICK, spacing);
        int24 tickUpper = _floorTick(MAX_TICK, spacing);
        uint256 amount0Desired = token0 == address(sys.odd) ? oddAmount : usdtAmount;
        uint256 amount1Desired = token0 == address(sys.odd) ? usdtAmount : oddAmount;
        IPancakeV3PositionManagerLike(PANCAKE_V3_POSITION_MANAGER)
            .mint(
                IPancakeV3PositionManagerLike.MintParams({
                    token0: token0,
                    token1: token1,
                    fee: DEFAULT_USDT_FEE,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: sys.admin,
                    deadline: block.timestamp
                })
            );
        vm.stopPrank();
    }

    function _encodeSqrtPriceX96(uint256 amount1, uint256 amount0) internal pure returns (uint160) {
        uint256 ratioX192 = (amount1 << 192) / amount0;
        return uint160(_sqrt(ratioX192));
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        uint256 xx = x;
        z = 1;
        if (xx >= 0x100000000000000000000000000000000) {
            xx >>= 128;
            z <<= 64;
        }
        if (xx >= 0x10000000000000000) {
            xx >>= 64;
            z <<= 32;
        }
        if (xx >= 0x100000000) {
            xx >>= 32;
            z <<= 16;
        }
        if (xx >= 0x10000) {
            xx >>= 16;
            z <<= 8;
        }
        if (xx >= 0x100) {
            xx >>= 8;
            z <<= 4;
        }
        if (xx >= 0x10) {
            xx >>= 4;
            z <<= 2;
        }
        if (xx >= 0x8) {
            z <<= 1;
        }
        for (uint256 i = 0; i < 7; i++) {
            z = (z + x / z) >> 1;
        }
        uint256 y = x / z;
        if (z > y) z = y;
    }

    function _floorTick(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 compressed = tick / spacing;
        if (tick < 0 && tick % spacing != 0) compressed--;
        return compressed * spacing;
    }

    function _ceilTick(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 compressed = tick / spacing;
        if (tick % spacing != 0) compressed++;
        return compressed * spacing;
    }
}
