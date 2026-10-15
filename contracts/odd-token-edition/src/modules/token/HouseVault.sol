// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ODDToken} from "./ODDToken.sol";
import {IBettingReserveSinkV1} from "./interfaces/IBettingReserveSinkV1.sol";
import {Roles} from "../../shared/access/Roles.sol";
import {InvalidAddress, ZeroAmount} from "../../shared/errors/CommonErrors.sol";

error InvalidHouseVaultTarget(address target);
error ReentrancyGuardReentrantCall();

contract HouseVault is AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    uint256 internal constant _NOT_ENTERED = 1;
    uint256 internal constant _ENTERED = 2;

    ODDToken public oddToken;
    uint256 private _reentrancyStatus;
    uint256[48] private __gap;

    event HouseVaultInitialized(address indexed admin, address indexed oddToken);
    event HouseVaultTransfer(address indexed operator, address indexed to, uint256 amount);
    event BettingPlatformReserveFunded(address indexed operator, address indexed bettingPool, uint256 amount);

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address oddTokenAddress) external initializer {
        if (admin == address(0) || oddTokenAddress == address(0) || oddTokenAddress.code.length == 0) {
            revert InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        _grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.UPGRADER_ROLE, admin);
        _grantRole(Roles.PAUSER_ROLE, admin);
        _grantRole(Roles.HOUSEVAULT_MANAGER_ROLE, admin);

        oddToken = ODDToken(oddTokenAddress);
        _reentrancyStatus = _NOT_ENTERED;

        emit HouseVaultInitialized(admin, oddTokenAddress);
    }

    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    function transferOdd(address to, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(Roles.HOUSEVAULT_MANAGER_ROLE)
    {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (oddToken.isDexRestrictedTarget(to) || (!oddToken.isWhitelist(to) && !oddToken.isTreasurySink(to))) {
            revert InvalidHouseVaultTarget(to);
        }

        IERC20(address(oddToken)).safeTransfer(to, amount);
        emit HouseVaultTransfer(msg.sender, to, amount);
    }

    function fundBettingPlatformReserve(address bettingPool, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(Roles.HOUSEVAULT_MANAGER_ROLE)
    {
        if (bettingPool == address(0) || bettingPool.code.length == 0) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (oddToken.isDexRestrictedTarget(bettingPool) || !oddToken.isWhitelist(bettingPool)) {
            revert InvalidHouseVaultTarget(bettingPool);
        }

        IERC20 token = IERC20(address(oddToken));
        token.forceApprove(bettingPool, 0);
        token.forceApprove(bettingPool, amount);
        IBettingReserveSinkV1(bettingPool).addPlatformReserve(amount);
        token.forceApprove(bettingPool, 0);

        emit BettingPlatformReserveFunded(msg.sender, bettingPool, amount);
    }

    function _authorizeUpgrade(address) internal view override onlyRole(Roles.UPGRADER_ROLE) {}

    function _nonReentrantBefore() internal {
        if (_reentrancyStatus == _ENTERED) revert ReentrancyGuardReentrantCall();
        _reentrancyStatus = _ENTERED;
    }

    function _nonReentrantAfter() internal {
        _reentrancyStatus = _NOT_ENTERED;
    }
}
