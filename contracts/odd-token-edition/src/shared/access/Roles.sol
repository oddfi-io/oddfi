// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library Roles {
    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 internal constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 internal constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 internal constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    bytes32 internal constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 internal constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 internal constant WHITELIST_ADMIN_ROLE = keccak256("WHITELIST_ADMIN_ROLE");
    bytes32 internal constant HOUSEVAULT_MANAGER_ROLE = keccak256("HOUSEVAULT_MANAGER_ROLE");
    bytes32 internal constant DEX_LAUNCHER_ROLE = keccak256("DEX_LAUNCHER_ROLE");
    bytes32 internal constant SALE_ADMIN_ROLE = keccak256("SALE_ADMIN_ROLE");
    bytes32 internal constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
}
