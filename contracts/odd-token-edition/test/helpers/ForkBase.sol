// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ODDToken} from "../../src/modules/token/ODDToken.sol";
import {StakingPool} from "../../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../../src/modules/betting/BettingSettlementModule.sol";
import {IODDTokenBusiness} from "../../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {QuoteGuardInput} from "../../src/shared/types/CommonTypes.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {
    IPancakeV2RouterLike,
    IPancakeV3FactoryLike,
    IPancakeV3PoolLike,
    IPancakeV3PositionManagerLike
} from "./PancakeV3Interfaces.sol";
import {OddMvpTestBootstrap} from "./OddMvpTestBootstrap.sol";

contract ForkMvpSource {
    function sweep(IERC20 token, address to, uint256 amount) external {
        require(token.transfer(to, amount), "SWEEP_TRANSFER_FAILED");
    }
}

abstract contract ForkBase is OddMvpTestBootstrap {
    using MessageHashUtils for bytes32;

    string internal constant RPC_ENV = "MAINNET_FORK_RPC_URL";
    address internal constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;
    address internal constant BSC_WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address internal constant PANCAKE_V2_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant PANCAKE_V3_FACTORY = 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865;
    address internal constant PANCAKE_V3_ROUTER = 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4;
    address internal constant PANCAKE_V3_POSITION_MANAGER = 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364;
    uint24 internal constant DEFAULT_USDT_FEE = 2500;
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;
    uint256 internal constant SIGNER_PK = 0xA12345;

    uint256 internal forkId;

    ODDToken internal odd;
    StakingPool internal staking;
    LiquidityPool internal liquidity;
    BettingPool internal betting;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal user = makeAddr("user");
    address internal user2 = makeAddr("user2");
    address internal referrer = makeAddr("referrer");
    address internal lpUser = makeAddr("lpUser");
    address internal outsider = makeAddr("outsider");
    address internal signer = vm.addr(SIGNER_PK);

    address internal oddUsdtPool;

    function setUp() public virtual {
        forkId = vm.createSelectFork(vm.envString(RPC_ENV));
        vm.deal(admin, 2_000 ether);
        vm.deal(user, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(referrer, 100 ether);
        vm.deal(lpUser, 100 ether);
        vm.deal(outsider, 100 ether);

        odd = ODDToken(_deployProxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin))));

        staking = StakingPool(
            _deployProxy(
                address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(odd), treasury))
            )
        );

        liquidity = LiquidityPool(
            _deployProxy(
                address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(odd), admin))
            )
        );

        BettingSettlementModule settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        betting = BettingPool(
            _deployProxy(
                address(new BettingPool()),
                abi.encodeCall(BettingPool.initialize, (admin, address(odd), address(staking), address(liquidity)))
            )
        );
        _installBettingModules(betting, settlement, betModule);
        vm.prank(admin);
        staking.initializeV2(address(betting));
        vm.prank(admin);
        liquidity.setBettingPool(address(betting));
        _bootstrapForkSystem(odd, treasury, address(staking), address(liquidity), address(betting));
        vm.prank(admin);
        betting.initializeV2(treasury);
        vm.prank(admin);
        betting.setReferralClaimConfig(signer, DEFAULT_USDT_FEE);

        vm.startPrank(admin);
        require(odd.transfer(user, 2_000_000 ether), "USER_TRANSFER_FAILED");
        require(odd.transfer(user2, 2_000_000 ether), "USER2_TRANSFER_FAILED");
        require(odd.transfer(referrer, 1_000_000 ether), "REFERRER_TRANSFER_FAILED");
        require(odd.transfer(lpUser, 3_000_000 ether), "LP_TRANSFER_FAILED");
        odd.approve(address(betting), type(uint256).max);
        betting.addPlatformReserve(15_000_000 ether);
        vm.stopPrank();

        _approveOdd(user);
        _approveOdd(user2);
        _approveOdd(referrer);
        _approveOdd(lpUser);
    }

    function _deployProxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _installBettingModules(BettingPool pool, BettingSettlementModule settlement, BettingBetModule betModule)
        internal
    {
        BettingMarketModule marketModule = new BettingMarketModule();
        BettingReferralModule referralModule = new BettingReferralModule();

        vm.prank(admin);
        pool.setSettlementModule(address(settlement));
        vm.prank(admin);
        pool.setBetModule(address(betModule));
        vm.prank(admin);
        pool.setMarketModule(address(marketModule));
        vm.prank(admin);
        pool.setReferralModule(address(referralModule));
    }

    function _bootstrapForkSystem(
        ODDToken token,
        address treasuryAddress,
        address stakingAddress,
        address liquidityAddress,
        address bettingAddress
    ) internal {
        ForkMvpSource tierSale = new ForkMvpSource();
        ForkMvpSource houseVault = new ForkMvpSource();
        ForkMvpSource dexLaunchController = new ForkMvpSource();
        ForkMvpSource ecosystemRewards = new ForkMvpSource();

        vm.startPrank(admin);
        token.setTreasurySink(admin, true);
        if (treasuryAddress != address(0) && treasuryAddress != admin) {
            token.setTreasurySink(treasuryAddress, true);
        }
        token.setFixedSourceContracts(
            IODDTokenBusiness.FixedSources({
                tierSale: address(tierSale),
                houseVault: address(houseVault),
                dexLaunchController: address(dexLaunchController),
                ecosystemRewards: address(ecosystemRewards),
                opsTreasury: admin
            })
        );
        if (stakingAddress != address(0)) token.setWhitelist(stakingAddress, true);
        if (liquidityAddress != address(0)) token.setWhitelist(liquidityAddress, true);
        if (bettingAddress != address(0)) token.setWhitelist(bettingAddress, true);
        token.allocateInitialSupply();
        vm.stopPrank();

        _sweepSource(tierSale, token);
        _sweepSource(houseVault, token);
        _sweepSource(dexLaunchController, token);
        _sweepSource(ecosystemRewards, token);
    }

    function _sweepSource(ForkMvpSource source, ODDToken token) internal {
        uint256 balance = token.balanceOf(address(source));
        if (balance > 0) {
            source.sweep(IERC20(address(token)), admin, balance);
        }
    }

    function _approveOdd(address actor) internal {
        vm.prank(actor);
        odd.approve(address(betting), type(uint256).max);
        vm.prank(actor);
        odd.approve(address(staking), type(uint256).max);
        vm.prank(actor);
        odd.approve(address(liquidity), type(uint256).max);
    }

    function _quoteUsdt(address recipient, uint256 bnbAmount) internal returns (uint256 amountOut) {
        vm.startPrank(recipient);
        address[] memory path = new address[](2);
        path[0] = BSC_WBNB;
        path[1] = BSC_USDT;
        uint256[] memory amounts = IPancakeV2RouterLike(PANCAKE_V2_ROUTER).swapExactETHForTokens{value: bnbAmount}(
            0, path, recipient, block.timestamp
        );
        amountOut = amounts[amounts.length - 1];
        vm.stopPrank();
    }

    function _ensureOddUsdtPool(uint256 oddAmount, uint256 usdtAmount) internal {
        if (oddUsdtPool != address(0)) return;
        _quoteUsdt(admin, 10 ether);

        address token0 = address(odd) < BSC_USDT ? address(odd) : BSC_USDT;
        address token1 = address(odd) < BSC_USDT ? BSC_USDT : address(odd);

        oddUsdtPool = IPancakeV3FactoryLike(PANCAKE_V3_FACTORY).getPool(token0, token1, DEFAULT_USDT_FEE);
        if (oddUsdtPool == address(0)) {
            vm.prank(admin);
            oddUsdtPool = IPancakeV3FactoryLike(PANCAKE_V3_FACTORY).createPool(token0, token1, DEFAULT_USDT_FEE);
            uint256 token0Unit = 10 ** IERC20Metadata(token0).decimals();
            uint256 token1Unit = 10 ** IERC20Metadata(token1).decimals();
            uint160 sqrtPriceX96 = token0 == address(odd)
                ? _encodeSqrtPriceX96(token1Unit / 10, token0Unit)
                : _encodeSqrtPriceX96(token1Unit, token0Unit / 10);
            vm.prank(admin);
            IPancakeV3PoolLike(oddUsdtPool).initialize(sqrtPriceX96);
        }

        vm.startPrank(admin);
        IERC20(address(odd)).approve(PANCAKE_V3_POSITION_MANAGER, type(uint256).max);
        IERC20(BSC_USDT).approve(PANCAKE_V3_POSITION_MANAGER, type(uint256).max);
        vm.stopPrank();

        int24 spacing = IPancakeV3FactoryLike(PANCAKE_V3_FACTORY).feeAmountTickSpacing(DEFAULT_USDT_FEE);
        int24 tickLower = _ceilTick(MIN_TICK, spacing);
        int24 tickUpper = _floorTick(MAX_TICK, spacing);

        uint256 amount0Desired = token0 == address(odd) ? oddAmount : usdtAmount;
        uint256 amount1Desired = token0 == address(odd) ? usdtAmount : oddAmount;

        vm.prank(admin);
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
                    recipient: admin,
                    deadline: block.timestamp
                })
            );

        vm.startPrank(admin);
        odd.setDexRestrictedTarget(PANCAKE_V3_ROUTER, true);
        odd.setDexRestrictedTarget(oddUsdtPool, true);
        betting.setReferralSwapConfig(PANCAKE_V3_ROUTER, BSC_USDT, oddUsdtPool);
        vm.stopPrank();
    }

    function _openThreeWayMarket(bytes32 matchId) internal returns (bytes32 marketId) {
        uint256[] memory baseOdds = new uint256[](3);
        baseOdds[0] = 20_000;
        baseOdds[1] = 30_000;
        baseOdds[2] = 40_000;
        vm.prank(admin);
        marketId = betting.openMarket(
            matchId,
            0,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            baseOdds,
            uint64(block.timestamp)
        );
    }

    function _openTwoWayMarket(bytes32 matchId, uint8 marketType, uint8 line) internal returns (bytes32 marketId) {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;
        vm.prank(admin);
        marketId = betting.openMarket(
            matchId,
            marketType,
            line,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            baseOdds,
            uint64(block.timestamp)
        );
    }

    function _settleMarketByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        _settleMarketByScore(betting, marketId, homeScore, awayScore);
    }

    function _settleMarketByScore(BettingPool pool, bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory betIds = pool.getMarketBetIds(marketId, 0, 50);
        if (betIds.length > 0) {
            vm.prank(admin);
            pool.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        }
        vm.prank(admin);
        pool.finalizeMarketSettlement(marketId, 0);
    }

    function _finalizeMarketStatus(BettingPool pool, bytes32 marketId, uint8 resultKindRaw) internal {
        vm.prank(admin);
        pool.finalizeMarketSettlement(marketId, resultKindRaw);
    }

    function _singleBetId(bytes32 betId) internal pure returns (bytes32[] memory betIds) {
        betIds = new bytes32[](1);
        betIds[0] = betId;
    }

    function _guard(bytes32 marketId, uint8 outcome, uint256 requestedAmount)
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

    function _encodeSqrtPriceX96(uint256 amount1, uint256 amount0) internal pure returns (uint160) {
        uint256 ratioX192 = (amount1 << 192) / amount0;
        return uint160(_sqrt(ratioX192));
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
