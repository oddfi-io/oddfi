// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract LiquidityPayoutReserveHandler is Test {
    ODDToken internal immutable ODD;
    LiquidityPool internal immutable LIQUIDITY;

    uint256[] internal positionIds;
    bytes32[] internal matchIds;
    uint256 internal matchNonce;

    constructor(ODDToken oddToken, LiquidityPool liquidityPool) {
        ODD = oddToken;
        LIQUIDITY = liquidityPool;
        ODD.approve(address(LIQUIDITY), type(uint256).max);
    }

    function depositGlobal(uint256 amount, uint16 planId) external {
        if (ODD.balanceOf(address(this)) < 1_000 ether) return;

        uint256 depositAmount = bound(amount, 1_000 ether, 50_000 ether);
        uint256 available = ODD.balanceOf(address(this));
        if (depositAmount > available) depositAmount = available;

        try LIQUIDITY.depositGlobal(depositAmount, planId % 5) returns (uint256 positionId) {
            positionIds.push(positionId);
        } catch {}
    }

    function openMatch(uint256 seed) external {
        bytes32 matchId = keccak256(abi.encode(seed, matchNonce++));
        uint64 startAt = uint64(block.timestamp + 1 hours);
        uint64 endAt = uint64(block.timestamp + 2 hours);

        try LIQUIDITY.openMatchPool(matchId, startAt, endAt) {
            matchIds.push(matchId);
        } catch {}
    }

    function distributeMargin(uint256 matchIndex, uint256 amount) external {
        if (matchIds.length == 0) return;
        if (ODD.balanceOf(address(this)) == 0) return;

        bytes32 matchId = matchIds[matchIndex % matchIds.length];
        uint256 marginAmount = bound(amount, 1 ether, 1_000 ether);
        uint256 available = ODD.balanceOf(address(this));
        if (marginAmount > available) marginAmount = available;

        assertTrue(ODD.transfer(address(LIQUIDITY), marginAmount));
        try LIQUIDITY.distributeMargin(matchId, marginAmount) {} catch {}
    }

    function distributeLoss(uint256 matchIndex, uint256 amount) external {
        if (matchIds.length == 0) return;

        uint256 requestable = LIQUIDITY.getRequestableLiquidity();
        if (requestable == 0) return;

        bytes32 matchId = matchIds[matchIndex % matchIds.length];
        uint256 lossAmount = bound(amount, 1 ether, requestable);
        try LIQUIDITY.distributeLoss(matchId, lossAmount) {} catch {}
    }

    function requestPayout(uint256 matchIndex, uint256 amount) external {
        if (matchIds.length == 0) return;

        bytes32 matchId = matchIds[matchIndex % matchIds.length];
        (uint256 reservedAmount, uint256 paidOutAmount,) = LIQUIDITY.getPayoutLiquidityWindow(matchId);
        if (reservedAmount <= paidOutAmount) return;

        uint256 remainingReserved = reservedAmount - paidOutAmount;
        uint256 payoutAmount = bound(amount, 1 ether, remainingReserved);
        try LIQUIDITY.requestPayoutLiquidity(matchId, payoutAmount) {} catch {}
    }

    function requestUnbond(uint256 positionIndex) external {
        if (positionIds.length == 0) return;

        vm.warp(block.timestamp + 40 days);
        uint256 positionId = positionIds[positionIndex % positionIds.length];
        try LIQUIDITY.requestUnbond(positionId) {} catch {}
    }

    function withdraw(uint256 positionIndex) external {
        if (positionIds.length == 0) return;

        vm.warp(block.timestamp + 4 days);
        uint256 positionId = positionIds[positionIndex % positionIds.length];
        try LIQUIDITY.withdraw(positionId) {} catch {}
    }

    function isMatchTerminal(bytes32) external pure returns (bool) {
        return true;
    }
}

contract LiquidityPayoutReserveInvariantTest is OddMvpTestBootstrap {
    ODDToken internal odd;
    LiquidityPool internal liquidity;
    LiquidityPayoutReserveHandler internal handler;

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function setUp() public {
        odd = ODDToken(
            _proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (address(this), address(this))))
        );

        liquidity = LiquidityPool(
            _proxy(
                address(new LiquidityPool()),
                abi.encodeCall(LiquidityPool.initialize, (address(this), address(odd), address(this)))
            )
        );

        _bootstrapOddMvpToken(odd, address(this), address(this), address(0), address(liquidity), address(0));

        handler = new LiquidityPayoutReserveHandler(odd, liquidity);
        odd.setTreasurySink(address(handler), true);
        liquidity.setBettingPool(address(handler));
        assertTrue(odd.transfer(address(handler), 20_000_000 ether));

        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = LiquidityPayoutReserveHandler.depositGlobal.selector;
        selectors[1] = LiquidityPayoutReserveHandler.openMatch.selector;
        selectors[2] = LiquidityPayoutReserveHandler.distributeMargin.selector;
        selectors[3] = LiquidityPayoutReserveHandler.distributeLoss.selector;
        selectors[4] = LiquidityPayoutReserveHandler.requestPayout.selector;
        selectors[5] = LiquidityPayoutReserveHandler.requestUnbond.selector;
        selectors[6] = LiquidityPayoutReserveHandler.withdraw.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariant_LiquidityBalanceCoversOutstandingPayoutReserve() public view {
        assertGe(odd.balanceOf(address(liquidity)), liquidity.totalOutstandingPayoutReserved());
    }
}
