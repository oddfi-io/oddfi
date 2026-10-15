// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IODDTokenBusiness {
    struct FixedSources {
        address tierSale;
        address houseVault;
        address dexLaunchController;
        address ecosystemRewards;
        address opsTreasury;
    }

    struct SourceAccount {
        uint256 salePrincipalRemaining;
        uint256 rewardPrincipalRemaining;
        uint256 businessLockedRemaining;
    }

    struct SourceBreakdown {
        uint256 saleLocked;
        uint256 rewardLocked;
        uint256 businessLocked;
        uint256 transferable;
    }

    struct BusinessSnapshot {
        address user;
        address businessContract;
        uint16 businessType;
        bytes32 rawId;
        uint64 createdAt;
        uint64 finalizedAt;
        uint256 businessIn;
        uint256 totalBusinessOut;
        uint256 principalReturned;
        uint256 profitRecognized;
        uint256 lossRecognized;
        bool finalized;
        SourceBreakdown sourceIn;
    }

    function distributeSalePurchase(address user, uint256 amount) external;
    function reclaimSalePurchase(address user, uint256 amount) external;
    function distributeRewardClaim(address user, uint256 amount) external;

    function consumeBusinessInflow(address user, uint16 businessType, bytes32 rawId, uint256 amount)
        external
        returns (bytes32 businessId);

    function registerBusinessOutcomeDelta(address user, bytes32 businessId, uint256 businessOutDelta, bool finalized)
        external;

    function registerBusinessProfitAndTransfer(address user, uint16 businessType, bytes32 rawId, uint256 amount)
        external
        returns (bytes32 businessId);

    function registerBusinessProfitForDexSwap(
        address user,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount,
        address routerOrSpender,
        address expectedPoolOrTarget
    ) external returns (bytes32 businessId);

    function markDexPoolLaunched(uint64 launchTime) external;

    function fixedSources() external view returns (FixedSources memory);
}
