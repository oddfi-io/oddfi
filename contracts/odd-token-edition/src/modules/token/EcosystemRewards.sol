// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IODDTokenBusiness} from "./interfaces/IODDTokenBusiness.sol";
import {Roles} from "../../shared/access/Roles.sol";
import {InvalidAddress, ZeroAmount} from "../../shared/errors/CommonErrors.sol";

error InvalidClaimable(uint256 claimId);
error ClaimableNotOwner(uint256 claimId, address caller);
error ClaimableAlreadyClosed(uint256 claimId);
error RewardBudgetExceeded(uint8 category, uint256 requested, uint256 budget);
error ReentrancyGuardReentrantCall();

contract EcosystemRewards is AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    struct ClaimableReward {
        address user;
        uint8 category;
        uint256 amount;
        bool claimed;
        bool cancelled;
    }

    uint256 public constant ECOSYSTEM_REWARDS_ALLOCATION = 15_000_000 ether;
    uint256 internal constant _NOT_ENTERED = 1;
    uint256 internal constant _ENTERED = 2;

    IODDTokenBusiness public oddToken;
    uint256 public nextClaimId;
    uint256 public totalAllocated;
    uint256 public totalClaimed;
    uint256 public totalCancelled;
    uint256 public totalCategoryBudget;

    mapping(uint8 => uint256) public categoryBudget;
    mapping(uint8 => uint256) public categoryAllocated;
    mapping(uint8 => uint256) public categoryClaimed;
    mapping(address => uint256) public claimableOf;
    mapping(uint256 => ClaimableReward) public claimables;

    uint256 private _reentrancyStatus;
    uint256[39] private __gap;

    event EcosystemRewardsInitialized(address indexed admin, address indexed oddToken);
    event CategoryBudgetUpdated(address indexed operator, uint8 indexed category, uint256 oldBudget, uint256 newBudget);
    event ClaimableCreated(uint256 indexed claimId, address indexed user, uint8 indexed category, uint256 amount);
    event ClaimableCancelled(uint256 indexed claimId, address indexed user, uint8 indexed category, uint256 amount);
    event RewardClaimed(uint256 indexed claimId, address indexed user, uint8 indexed category, uint256 amount);

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
        _grantRole(Roles.REWARD_DISTRIBUTOR_ROLE, admin);

        oddToken = IODDTokenBusiness(oddTokenAddress);
        nextClaimId = 1;
        _reentrancyStatus = _NOT_ENTERED;

        emit EcosystemRewardsInitialized(admin, oddTokenAddress);
    }

    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    function setCategoryBudget(uint8 category, uint256 budget) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (budget < categoryAllocated[category]) {
            revert RewardBudgetExceeded(category, categoryAllocated[category], budget);
        }
        uint256 newTotalBudget = totalCategoryBudget - categoryBudget[category] + budget;
        if (newTotalBudget > ECOSYSTEM_REWARDS_ALLOCATION) {
            revert RewardBudgetExceeded(type(uint8).max, newTotalBudget, ECOSYSTEM_REWARDS_ALLOCATION);
        }
        emit CategoryBudgetUpdated(msg.sender, category, categoryBudget[category], budget);
        categoryBudget[category] = budget;
        totalCategoryBudget = newTotalBudget;
    }

    function createClaimable(address user, uint8 category, uint256 amount)
        external
        onlyRole(Roles.REWARD_DISTRIBUTOR_ROLE)
        returns (uint256 claimId)
    {
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 budget = categoryBudget[category];
        if (budget == 0 || categoryAllocated[category] + amount > budget) {
            revert RewardBudgetExceeded(category, categoryAllocated[category] + amount, budget);
        }
        if (totalAllocated + amount > ECOSYSTEM_REWARDS_ALLOCATION) {
            revert RewardBudgetExceeded(type(uint8).max, totalAllocated + amount, ECOSYSTEM_REWARDS_ALLOCATION);
        }

        claimId = nextClaimId++;
        categoryAllocated[category] += amount;
        totalAllocated += amount;
        claimableOf[user] += amount;
        claimables[claimId] =
            ClaimableReward({user: user, category: category, amount: amount, claimed: false, cancelled: false});

        emit ClaimableCreated(claimId, user, category, amount);
    }

    function cancelClaimable(uint256 claimId) external onlyRole(Roles.REWARD_DISTRIBUTOR_ROLE) {
        ClaimableReward storage reward = _openClaimable(claimId);
        reward.cancelled = true;
        categoryAllocated[reward.category] -= reward.amount;
        totalAllocated -= reward.amount;
        totalCancelled += reward.amount;
        claimableOf[reward.user] -= reward.amount;

        emit ClaimableCancelled(claimId, reward.user, reward.category, reward.amount);
    }

    function claim(uint256 claimId) external nonReentrant whenNotPaused {
        ClaimableReward storage reward = _openClaimable(claimId);
        if (reward.user != msg.sender) revert ClaimableNotOwner(claimId, msg.sender);

        reward.claimed = true;
        totalClaimed += reward.amount;
        categoryClaimed[reward.category] += reward.amount;
        claimableOf[msg.sender] -= reward.amount;

        oddToken.distributeRewardClaim(msg.sender, reward.amount);
        emit RewardClaimed(claimId, msg.sender, reward.category, reward.amount);
    }

    function _openClaimable(uint256 claimId) internal view returns (ClaimableReward storage reward) {
        reward = claimables[claimId];
        if (reward.user == address(0)) revert InvalidClaimable(claimId);
        if (reward.claimed || reward.cancelled) revert ClaimableAlreadyClosed(claimId);
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
