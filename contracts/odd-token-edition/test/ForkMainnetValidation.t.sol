// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

contract ForkMainnetValidationTest is Test {
    function testForkIsBnBMainnet() public {
        string memory rpcUrl = vm.envOr("MAINNET_FORK_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            return;
        }
        uint256 forkId = vm.createSelectFork(rpcUrl);
        forkId;
        assertEq(block.chainid, 56);
        assertGt(block.number, 90_000_000);
    }
}
