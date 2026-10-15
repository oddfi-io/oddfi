// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {Roles} from "../../shared/access/Roles.sol";
import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {QuoteGuardInput} from "../../shared/types/CommonTypes.sol";
import {SignalColor} from "../../shared/types/MarketEnums.sol";
import {ParlayEstimatedValue, ParlayLegInput} from "../../shared/types/ParlayTypes.sol";
import {InvalidAddress} from "../../shared/errors/CommonErrors.sol";
import {DependenciesAlreadyConfigured} from "../../shared/errors/ConfigErrors.sol";
import {SettlementCannotClose, InvalidReferralClaim, InvalidTaxConfig} from "../../shared/errors/BettingErrors.sol";
import {IBettingMarketModule} from "./interfaces/IBettingMarketModule.sol";
import {IBettingParlayModule} from "./interfaces/IBettingParlayModule.sol";
import {IBettingSettlementModule} from "./interfaces/IBettingSettlementModule.sol";
import {BettingPoolStorage} from "./BettingPoolStorage.sol";
import {IODDTokenBusiness} from "../token/interfaces/IODDTokenBusiness.sol";
import {IODDTokenTreasuryView} from "../token/interfaces/IODDTokenTreasuryView.sol";

contract BettingPool is BettingPoolStorage, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address oddTokenAddress,
        address stakingPoolAddress,
        address liquidityPoolAddress
    ) external initializer {
        if (
            admin == address(0) || oddTokenAddress == address(0) || stakingPoolAddress == address(0)
                || liquidityPoolAddress == address(0)
        ) {
            revert InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        _grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.UPGRADER_ROLE, admin);
        _grantRole(Roles.PAUSER_ROLE, admin);
        _grantRole(Roles.OPERATOR_ROLE, admin);
        _grantRole(Roles.SETTLER_ROLE, admin);
        _grantRole(Roles.KEEPER_ROLE, admin);

        oddToken = IERC20(oddTokenAddress);
        stakingPool = stakingPoolAddress;
        liquidityPool = liquidityPoolAddress;
        platformTreasury = admin;
        nextBetNonce = 1;
        nextParlayNonce = 1;
        _reentrancyStatus = 1;
        betTaxBps = BettingConstants.BET_TAX_BPS_DEFAULT;
        payoutTaxBps = BettingConstants.PAYOUT_TAX_BPS_DEFAULT;
        taxAllocStakingBps = BettingConstants.PAYOUT_ALLOC_STAKING_DEFAULT;
        taxAllocTaxBufferBps = BettingConstants.PAYOUT_ALLOC_TAXBUFFER_DEFAULT;
        taxAllocReferrerBps = BettingConstants.PAYOUT_ALLOC_REFERRER_DEFAULT;
        lpMarginShareBps = 8000;
        wclYellowThreshold = BettingConstants.WCL_YELLOW_THRESHOLD;
        wclOrangeThreshold = BettingConstants.WCL_ORANGE_THRESHOLD;
        wclRedThreshold = BettingConstants.WCL_RED_THRESHOLD;
        referralSwapPoolFee = 2500;
    }

    function setBettingDependencies(address stakingPoolAddress, address liquidityPoolAddress, address oddTokenAddress)
        external
        onlyRole(Roles.DEFAULT_ADMIN_ROLE)
    {
        if (stakingPoolAddress == address(0) || liquidityPoolAddress == address(0) || oddTokenAddress == address(0)) {
            revert InvalidAddress();
        }
        // Dependency addresses are cross-contract ledger anchors, not UUPS implementation slots.
        // They may only be filled once by a bootstrap or migration flow when all three are unset.
        if (stakingPool != address(0) || liquidityPool != address(0) || address(oddToken) != address(0)) {
            revert DependenciesAlreadyConfigured();
        }
        stakingPool = stakingPoolAddress;
        liquidityPool = liquidityPoolAddress;
        oddToken = IERC20(oddTokenAddress);
    }

    function initializeV2(address treasuryAddress) external reinitializer(2) onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        _requireTreasurySink(treasuryAddress);
        platformTreasury = treasuryAddress;
        emit PlatformTreasuryUpdated(msg.sender, treasuryAddress);
    }

    function initializeV3() external reinitializer(3) onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (nextParlayNonce == 0) {
            nextParlayNonce = 1;
        }
    }

    function setTaxConfig(
        uint16 newBetTaxBps,
        uint16 newPayoutTaxBps,
        uint16 newAllocStakingBps,
        uint16 newAllocTaxBufferBps,
        uint16 newAllocPlatformBps,
        uint16 newAllocReferrerBps
    ) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newBetTaxBps > BettingConstants.BET_TAX_BPS_MAX) revert InvalidTaxConfig();
        if (newPayoutTaxBps > BettingConstants.PAYOUT_TAX_BPS_MAX) revert InvalidTaxConfig();
        uint256 totalAlloc =
            uint256(newAllocStakingBps) + newAllocTaxBufferBps + newAllocPlatformBps + newAllocReferrerBps;
        if (totalAlloc != newPayoutTaxBps) revert InvalidTaxConfig();

        betTaxBps = newBetTaxBps;
        payoutTaxBps = newPayoutTaxBps;
        taxAllocStakingBps = newAllocStakingBps;
        taxAllocTaxBufferBps = newAllocTaxBufferBps;
        taxAllocReferrerBps = newAllocReferrerBps;
    }

    function setPlatformTreasury(address treasuryAddress) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        _requireTreasurySink(treasuryAddress);
        platformTreasury = treasuryAddress;
        emit PlatformTreasuryUpdated(msg.sender, treasuryAddress);
    }

    function setRiskConfig(uint256 yellowThreshold, uint256 orangeThreshold, uint256 redThreshold)
        external
        onlyRole(Roles.DEFAULT_ADMIN_ROLE)
    {
        if (yellowThreshold == 0 || yellowThreshold >= orangeThreshold || orangeThreshold >= redThreshold) {
            revert SettlementCannotClose(bytes32(0));
        }

        wclYellowThreshold = yellowThreshold;
        wclOrangeThreshold = orangeThreshold;
        wclRedThreshold = redThreshold;
    }

    function setMarginSplit(uint16 newLpMarginShareBps) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newLpMarginShareBps > PrecisionConstants.BPS_SCALE) revert InvalidTaxConfig();
        lpMarginShareBps = newLpMarginShareBps;
    }

    function setReferralClaimConfig(address signer, uint24 poolFee) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (signer == address(0)) {
            revert InvalidAddress();
        }
        if (poolFee == 0) revert InvalidReferralClaim();

        referralClaimSigner = signer;
        referralSwapPoolFee = poolFee;
    }

    function setReferralSwapConfig(address swapRouter, address usdtToken)
        external
        view
        onlyRole(Roles.DEFAULT_ADMIN_ROLE)
    {
        if (swapRouter == address(0) || usdtToken == address(0)) {
            revert InvalidAddress();
        }
        revert InvalidReferralClaim();
    }

    function setReferralSwapConfig(address swapRouter, address usdtToken, address expectedPool)
        external
        onlyRole(Roles.DEFAULT_ADMIN_ROLE)
    {
        if (swapRouter == address(0) || usdtToken == address(0) || expectedPool == address(0)) {
            revert InvalidAddress();
        }
        referralSwapRouter = swapRouter;
        referralUsdtToken = usdtToken;
        referralSwapExpectedPool = expectedPool;
        emit ReferralSwapConfigUpdated(swapRouter, usdtToken, expectedPool);
    }

    function _requireTreasurySink(address treasuryAddress) internal view {
        if (treasuryAddress == address(0) || !IODDTokenTreasuryView(address(oddToken)).isTreasurySink(treasuryAddress))
        {
            revert InvalidAddress();
        }
    }

    function setSettlementModule(address newSettlementModule) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newSettlementModule == address(0) || newSettlementModule.code.length == 0) {
            revert InvalidAddress();
        }
        settlementModule = newSettlementModule;
    }

    function setParlayModule(address newParlayModule) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newParlayModule == address(0) || newParlayModule.code.length == 0) {
            revert InvalidAddress();
        }
        address oldModule = parlayModule;
        parlayModule = newParlayModule;
        emit ParlayModuleUpdated(oldModule, newParlayModule);
    }

    function setBetModule(address newBetModule) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newBetModule == address(0) || newBetModule.code.length == 0) {
            revert InvalidAddress();
        }
        address oldModule = betModule;
        betModule = newBetModule;
        emit BetModuleUpdated(oldModule, newBetModule);
    }

    function setMarketModule(address newMarketModule) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newMarketModule == address(0) || newMarketModule.code.length == 0) {
            revert InvalidAddress();
        }
        address oldModule = marketModule;
        marketModule = newMarketModule;
        emit MarketModuleUpdated(oldModule, newMarketModule);
    }

    function setReferralModule(address newReferralModule) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newReferralModule == address(0) || newReferralModule.code.length == 0) {
            revert InvalidAddress();
        }
        address oldModule = referralModule;
        referralModule = newReferralModule;
        emit ReferralModuleUpdated(oldModule, newReferralModule);
    }

    function bindReferrer(address referrer) external {
        referrer;
        _delegateToReferral(msg.data);
    }

    function addPlatformReserve(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert SettlementCannotClose(bytes32(0));
        }
        if (!_isPlatformReserveFunder(msg.sender)) {
            revert InvalidAddress();
        }
        oddToken.safeTransferFrom(msg.sender, address(this), amount);

        platformReserve += amount;
        accountedBalance += amount;
        emit PlatformReserveUpdated(int256(amount), platformReserve, 0);
    }

    function _isPlatformReserveFunder(address account) internal view returns (bool) {
        if (hasRole(Roles.DEFAULT_ADMIN_ROLE, account)) return true;
        IODDTokenBusiness.FixedSources memory sources = IODDTokenBusiness(address(oddToken)).fixedSources();
        return account == sources.houseVault;
    }

    function openMarket(
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint64 matchStartTime,
        uint64 matchEndTime,
        uint256[] calldata baseOdds,
        uint64 updatedAt
    ) external onlyRole(Roles.OPERATOR_ROLE) returns (bytes32 marketId) {
        matchId;
        marketType;
        line;
        matchStartTime;
        matchEndTime;
        baseOdds;
        updatedAt;
        bytes memory ret = _delegateToMarket(msg.data);
        return abi.decode(ret, (bytes32));
    }

    function lockMarket(bytes32 marketId) external onlyRole(Roles.OPERATOR_ROLE) nonReentrant {
        marketId;
        _delegateToSettlement(msg.data);
    }

    function updateOdds(bytes32 marketId, uint256[] calldata baseOdds, uint64 updatedAt)
        external
        onlyRole(Roles.OPERATOR_ROLE)
    {
        marketId;
        baseOdds;
        updatedAt;
        _delegateToMarket(msg.data);
    }

    function previewSignal(bytes32 marketId, uint8 outcome, uint256 requestedAmount)
        external
        view
        returns (
            SignalColor signal,
            uint256 acceptedAmount,
            uint256 lockedOdds,
            bool partialFill,
            uint256 maxAcceptableAmount
        )
    {
        bytes memory ret = _staticModuleCall(
            marketModule,
            abi.encodeWithSelector(
                IBettingMarketModule.previewSignal.selector, address(this), marketId, outcome, requestedAmount
            )
        );
        (uint8 signalRaw, uint256 accepted, uint256 odds, bool partialFillResult, uint256 maxAmount) =
            abi.decode(ret, (uint8, uint256, uint256, bool, uint256));
        return (SignalColor(signalRaw), accepted, odds, partialFillResult, maxAmount);
    }

    function placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, QuoteGuardInput calldata guard)
        external
        nonReentrant
        whenNotPaused
        returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
    {
        marketId;
        outcome;
        requestedAmount;
        guard;
        bytes memory ret = _delegateToBet(msg.data);
        return abi.decode(ret, (bytes32, uint256, uint256));
    }

    function placeBet(
        bytes32 marketId,
        uint8 outcome,
        uint256 requestedAmount,
        QuoteGuardInput calldata guard,
        address referrer
    ) public nonReentrant whenNotPaused returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds) {
        marketId;
        outcome;
        requestedAmount;
        guard;
        referrer;
        bytes memory ret = _delegateToBet(msg.data);
        return abi.decode(ret, (bytes32, uint256, uint256));
    }

    function settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] calldata betIds)
        external
        onlyRole(Roles.SETTLER_ROLE)
        nonReentrant
    {
        marketId;
        homeScore;
        awayScore;
        betIds;
        _delegateToSettlement(msg.data);
    }

    function finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw)
        external
        onlyRole(Roles.SETTLER_ROLE)
        nonReentrant
    {
        marketId;
        resultKindRaw;
        _delegateToSettlement(msg.data);
    }

    function refundBets(bytes32 marketId, bytes32[] calldata betIds, uint256[] calldata refundAmounts)
        external
        onlyRole(Roles.SETTLER_ROLE)
        nonReentrant
    {
        marketId;
        betIds;
        refundAmounts;
        _delegateToSettlement(msg.data);
    }

    function cashOut(
        bytes32 betId,
        uint256 expectedQuoteVersion,
        uint64 quotedAt,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant whenNotPaused {
        betId;
        expectedQuoteVersion;
        quotedAt;
        minAmountOut;
        deadline;
        _delegateToSettlement(msg.data);
    }

    function claimPayout(bytes32 betId) external nonReentrant whenNotPaused {
        betId;
        _delegateToSettlement(msg.data);
    }

    function releasePayoutReserve(bytes32 riskId) external onlyRole(Roles.SETTLER_ROLE) nonReentrant {
        riskId;
        _delegateToSettlement(msg.data);
    }

    function placeParlay(
        ParlayLegInput[] calldata legs,
        uint256 stake,
        uint256 minComboOdds,
        uint256 deadline,
        address referrer
    ) external nonReentrant whenNotPaused returns (bytes32 parlayId) {
        legs;
        stake;
        minComboOdds;
        deadline;
        referrer;
        bytes memory ret = _delegateToParlay(msg.data);
        parlayId = abi.decode(ret, (bytes32));
    }

    function settleParlay(bytes32 parlayId) external onlyRole(Roles.SETTLER_ROLE) nonReentrant {
        parlayId;
        _delegateToParlay(msg.data);
    }

    function claimParlayPayout(bytes32 parlayId) external nonReentrant whenNotPaused {
        parlayId;
        _delegateToParlay(msg.data);
    }

    function getClaimStatus(address userAddress, bytes32 betId) external view returns (bool won, uint256 reward) {
        bytes memory ret = _staticModuleCall(
            settlementModule,
            abi.encodeWithSelector(IBettingSettlementModule.getClaimStatus.selector, address(this), userAddress, betId)
        );
        return abi.decode(ret, (bool, uint256));
    }

    function estimateBetValue(address userAddress, bytes32 betId)
        external
        view
        returns (uint256 estimatedValue, int256 floatingPnL)
    {
        bytes memory ret = _staticModuleCall(
            settlementModule,
            abi.encodeWithSelector(
                IBettingSettlementModule.estimateBetValue.selector, address(this), userAddress, betId
            )
        );
        return abi.decode(ret, (uint256, int256));
    }

    function getParlayClaimStatus(address userAddress, bytes32 parlayId)
        external
        view
        returns (bool won, uint256 reward)
    {
        bytes memory ret = _staticModuleCall(
            parlayModule,
            abi.encodeWithSelector(
                IBettingParlayModule.getParlayClaimStatus.selector, address(this), userAddress, parlayId
            )
        );
        return abi.decode(ret, (bool, uint256));
    }

    function estimateParlayValue(address userAddress, bytes32 parlayId)
        external
        view
        returns (ParlayEstimatedValue memory estimated)
    {
        bytes memory ret = _staticModuleCall(
            parlayModule,
            abi.encodeWithSelector(
                IBettingParlayModule.estimateParlayValue.selector, address(this), userAddress, parlayId
            )
        );
        return abi.decode(ret, (ParlayEstimatedValue));
    }

    function claimReferralRewards(uint256 oddAmount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 claimedAmount)
    {
        oddAmount;
        bytes memory ret = _delegateToReferral(msg.data);
        return abi.decode(ret, (uint256));
    }

    function claimUSDTReferralRewards(
        uint256 rewardMinUsdtOutAmount,
        uint256 signatureDeadline,
        bytes calldata signature,
        uint256 minUsdtOut
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        rewardMinUsdtOutAmount;
        signatureDeadline;
        signature;
        minUsdtOut;
        bytes memory ret = _delegateToReferral(msg.data);
        return abi.decode(ret, (uint256));
    }

    function getMarket(bytes32 marketId) external view returns (MarketConfig memory) {
        return markets[marketId];
    }

    function taxAllocPlatformBps() external view returns (uint16) {
        return uint16(payoutTaxBps - taxAllocStakingBps - taxAllocTaxBufferBps - taxAllocReferrerBps);
    }

    function getMarketOdds(bytes32 marketId)
        external
        view
        returns (uint256[] memory, uint256[] memory, uint64, uint256)
    {
        MarketOdds storage odds = marketOdds[marketId];
        return (odds.baseOdds, odds.quotedOdds, odds.updatedAt, odds.quoteVersion);
    }

    function getMarketExposure(bytes32 marketId)
        external
        view
        returns (uint256[] memory totalStakedByOutcome, uint256[] memory payoutByOutcome, SignalColor signalColor)
    {
        MarketExposure storage exposure = marketExposure[marketId];
        return (exposure.totalStakedByOutcome, exposure.payoutByOutcome, exposure.signalColor);
    }

    function getBet(bytes32 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    function getMatchMarketIds(bytes32 matchId) external view returns (bytes32[] memory) {
        return matchMarketIds[matchId];
    }

    function getMarketBetIds(bytes32 marketId, uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory result)
    {
        bytes32[] storage betIds = marketBetIds[marketId];
        if (offset >= betIds.length || limit == 0) {
            return new bytes32[](0);
        }
        uint256 end = offset + limit;
        if (end > betIds.length) {
            end = betIds.length;
        }
        result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            result[i - offset] = betIds[i];
        }
    }

    function getUserRiskLedger(address user) external view returns (UserRiskLedger memory) {
        return userRiskLedger[user];
    }

    function isMatchTerminal(bytes32 matchId) external view returns (bool) {
        bytes memory ret = _staticModuleCall(
            marketModule, abi.encodeWithSelector(IBettingMarketModule.isMatchTerminal.selector, address(this), matchId)
        );
        return abi.decode(ret, (bool));
    }

    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    function _delegateToSettlement(bytes memory data) internal {
        address module = settlementModule;
        if (module == address(0)) {
            revert InvalidAddress();
        }
        (bool ok, bytes memory ret) = module.delegatecall(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    function _delegateToParlay(bytes memory data) internal returns (bytes memory ret) {
        address module = parlayModule;
        if (module == address(0)) {
            revert InvalidAddress();
        }
        (bool ok, bytes memory result) = module.delegatecall(data);
        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        return result;
    }

    function _delegateToMarket(bytes memory data) internal returns (bytes memory ret) {
        address module = marketModule;
        if (module == address(0)) {
            revert InvalidAddress();
        }
        (bool ok, bytes memory result) = module.delegatecall(data);
        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        return result;
    }

    function _delegateToReferral(bytes memory data) internal returns (bytes memory ret) {
        address module = referralModule;
        if (module == address(0)) {
            revert InvalidAddress();
        }
        (bool ok, bytes memory result) = module.delegatecall(data);
        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        return result;
    }

    function _delegateToBet(bytes memory data) internal returns (bytes memory ret) {
        address module = betModule;
        if (module == address(0)) {
            revert InvalidAddress();
        }
        (bool ok, bytes memory result) = module.delegatecall(data);
        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        return result;
    }

    function _staticModuleCall(address module, bytes memory data) internal view returns (bytes memory ret) {
        if (module == address(0)) {
            revert InvalidAddress();
        }
        (bool ok, bytes memory result) = module.staticcall(data);
        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        return result;
    }

    function _authorizeUpgrade(address) internal view override onlyRole(Roles.UPGRADER_ROLE) {}

    function _nonReentrantBefore() internal {
        if (_reentrancyStatus == 2) revert SettlementCannotClose(bytes32(0));
        _reentrancyStatus = 2;
    }

    function _nonReentrantAfter() internal {
        _reentrancyStatus = 1;
    }
}
