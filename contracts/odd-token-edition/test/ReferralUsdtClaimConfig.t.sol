// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {IPancakeV3SwapRouterLike} from "../src/modules/betting/interfaces/IPancakeV3SwapRouterLike.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract MockUsdt is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

contract NoTransferRouter {
    function exactInputSingle(IPancakeV3SwapRouterLike.ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        ERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        return params.amountOutMinimum == 0 ? 1 : params.amountOutMinimum;
    }
}

contract ReferralUsdtClaimConfigTest is OddMvpTestBootstrap {
    using MessageHashUtils for bytes32;

    uint256 internal constant SIGNER_PK = 0xA12345;
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal user = address(0xCAFE);
    address internal referrer = address(0xF00D);

    ODDToken internal odd;
    StakingPool internal staking;
    LiquidityPool internal liquidity;
    BettingPool internal betting;
    MockUsdt internal usdt;
    NoTransferRouter internal router;

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function setUp() public {
        odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin))));
        staking = StakingPool(
            _proxy(address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(odd), treasury)))
        );
        liquidity = LiquidityPool(
            _proxy(address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(odd), admin)))
        );
        betting = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(BettingPool.initialize, (admin, address(odd), address(staking), address(liquidity)))
            )
        );
        BettingSettlementModule settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        usdt = new MockUsdt();
        router = new NoTransferRouter();

        _bootstrapOddMvpToken(odd, admin, treasury, address(staking), address(liquidity), address(betting));

        vm.startPrank(admin);
        betting.setSettlementModule(address(settlement));
        betting.setBetModule(address(betModule));
        betting.setMarketModule(address(new BettingMarketModule()));
        betting.setReferralModule(address(new BettingReferralModule()));
        betting.initializeV2(treasury);
        betting.setReferralClaimConfig(vm.addr(SIGNER_PK), 2500);
        odd.setDexRestrictedTarget(address(router), true);
        betting.setReferralSwapConfig(address(router), address(usdt), address(router));
        staking.initializeV2(address(betting));
        liquidity.setBettingPool(address(betting));
        odd.transfer(user, 10_000 ether);
        odd.approve(address(betting), 100_000 ether);
        betting.addPlatformReserve(100_000 ether);
        vm.stopPrank();

        vm.prank(user);
        odd.approve(address(betting), type(uint256).max);
    }

    function testUsdtClaimRequiresActualConfiguredUsdtReceived() public {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;
        vm.prank(admin);
        bytes32 marketId = betting.openMarket(
            keccak256("configured-usdt-claim"),
            1,
            0,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            baseOdds,
            uint64(block.timestamp)
        );

        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, 0, 100 ether);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(user);
        betting.placeBet(marketId, 0, 100 ether, guard, referrer);
        uint256 available = betting.referrerRewardsOdd(referrer);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature =
            _referralSignature(referrer, available, 1, deadline, betting.referralClaimNonces(referrer));

        vm.expectRevert();
        vm.prank(referrer);
        betting.claimUSDTReferralRewards(1, deadline, signature, 1);

        assertEq(betting.referrerRewardsOdd(referrer), available);
        assertEq(usdt.balanceOf(referrer), 0);
    }

    function testTreasuryAndReferralSwapConfigRequireTokenGuards() public {
        vm.expectRevert();
        vm.prank(admin);
        betting.setPlatformTreasury(user);

        vm.expectRevert();
        vm.prank(admin);
        staking.setPlatformTreasury(user);

        vm.expectRevert();
        vm.prank(admin);
        betting.setReferralSwapConfig(address(router), address(usdt));

        vm.startPrank(admin);
        odd.setTreasurySink(user, true);
        betting.setPlatformTreasury(user);
        staking.setPlatformTreasury(user);
        betting.setReferralSwapConfig(address(router), address(usdt), address(router));
        vm.stopPrank();

        assertEq(betting.platformTreasury(), user);
        assertEq(staking.platformTreasury(), user);
        assertEq(betting.referralSwapExpectedPool(), address(router));
    }

    function _referralSignature(address claimant, uint256 oddAmount, uint256 minOut, uint256 deadline, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
                abi.encode(address(betting), block.chainid, claimant, oddAmount, minOut, deadline, nonce)
            ).toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, digest);
        return abi.encodePacked(r, s, v);
    }
}
