// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/BettingPool.sol";
import "../test/helpers/MockUSDT.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDT
        MockUSDT usdt = new MockUSDT();
        console.log("MockUSDT deployed:", address(usdt));

        // 2. Deploy BettingPool implementation
        BettingPool impl = new BettingPool();
        console.log("BettingPool impl deployed:", address(impl));

        // 3. Deploy proxy with initialization
        // Testnet: deployer acts as both admin and multisig
        bytes memory initData = abi.encodeCall(
            BettingPool.initialize,
            (address(usdt), deployer, deployer)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        console.log("BettingPool proxy deployed:", address(proxy));

        // 4. Verify initialization
        BettingPool pool = BettingPool(address(proxy));
        console.log("Admin:", pool.admin());
        console.log("Multisig:", pool.multisig());
        console.log("USDT:", address(pool.usdt()));

        vm.stopBroadcast();
    }
}
