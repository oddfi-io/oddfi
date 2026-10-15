// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IODDTokenBusiness} from "./interfaces/IODDTokenBusiness.sol";
import {Roles} from "../../shared/access/Roles.sol";
import {TokenConstants} from "../../shared/constants/TokenConstants.sol";
import {InvalidAddress, ZeroAmount} from "../../shared/errors/CommonErrors.sol";

error FixedSourcesAlreadyConfigured();
error FixedSourcesNotConfigured();
error InitialSupplyAlreadyAllocated();
error InvalidWhitelistAccount(address account);
error InvalidTransferRestricted(address from, address to, uint256 value);
error BusinessSnapshotAlreadyExists(bytes32 businessId);
error BusinessSnapshotNotFound(bytes32 businessId);
error InvalidBusinessSnapshotCaller(bytes32 businessId, address caller);
error BusinessSnapshotFinalized(bytes32 businessId);
error InvalidBusinessOutcome(bytes32 businessId);
error DexPoolLaunchAlreadyMarked(uint64 launchTime);
error InvalidDexSpend(address from, address spender, address to, uint256 value);
error ReentrancyGuardReentrantCall();

contract ODDToken is
    ERC20Upgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IODDTokenBusiness
{
    using Math for uint256;

    uint256 internal constant SALE_ALLOCATION = 30_000_000 ether;
    uint256 internal constant HOUSE_VAULT_ALLOCATION = 25_000_000 ether;
    uint256 internal constant DEX_LIQUIDITY_ALLOCATION = 10_000_000 ether;
    uint256 internal constant ECOSYSTEM_REWARDS_ALLOCATION = 15_000_000 ether;
    uint256 internal constant OPS_TREASURY_ALLOCATION = 20_000_000 ether;
    uint256 internal constant SALE_UNLOCK_DENOMINATOR = 870;
    uint256 internal constant REWARD_UNLOCK_DURATION = 180 days;
    uint256 internal constant _NOT_ENTERED = 1;
    uint256 internal constant _ENTERED = 2;

    enum TransferContext {
        None,
        InitialAllocation,
        SaleDistribution,
        SaleReclaim,
        RewardDistribution,
        BusinessInflow,
        BusinessOutcome,
        BusinessProfit,
        DexLaunch,
        BusinessProfitSwap
    }

    FixedSources private _fixedSources;
    uint64 public poolLaunchTime;
    bool public fixedSourcesConfigured;
    bool public initialSupplyAllocated;
    uint256 public dexLiquidityTransferableAllocation;
    address public dexLaunchSpender;
    address public dexLaunchPool;

    mapping(address => bool) public whitelist;
    mapping(address => bool) public treasurySink;
    mapping(address => bool) public dexRestrictedTarget;
    mapping(address => SourceAccount) private _sources;
    mapping(bytes32 => BusinessSnapshot) private _businessSnapshots;
    mapping(bytes32 => bool) private _businessIdsUsed;
    mapping(address => mapping(address => mapping(address => uint256))) public businessProfitSwapAllowance;

    uint256 private _reentrancyStatus;
    TransferContext private _transferContext;

    uint256[36] private __gap;

    event TokenInitialized(address indexed adminTimelock, address indexed pauser, uint256 totalSupply);
    event FixedSourcesConfigured(
        address indexed tierSale,
        address indexed houseVault,
        address indexed dexLaunchController,
        address ecosystemRewards,
        address opsTreasury
    );
    event InitialSupplyAllocated(
        address indexed tierSale,
        address indexed houseVault,
        address indexed dexLaunchController,
        address ecosystemRewards,
        address opsTreasury
    );
    event WhitelistUpdated(address indexed account, bool allowed);
    event TreasurySinkUpdated(address indexed account, bool allowed);
    event DexRestrictedTargetUpdated(address indexed account, bool restricted);
    event DexLaunchTransferTargetUpdated(address indexed spender, address indexed pool);
    event SalePurchaseDistributed(address indexed user, uint256 amount);
    event SalePurchaseReclaimed(address indexed user, uint256 amount);
    event RewardClaimDistributed(address indexed user, uint256 amount);
    event BusinessInflowConsumed(
        bytes32 indexed businessId,
        address indexed user,
        address indexed businessContract,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount,
        SourceBreakdown sourceIn
    );
    event BusinessOutcomeRegistered(
        bytes32 indexed businessId,
        address indexed user,
        address indexed businessContract,
        uint256 businessOutDelta,
        uint256 principalReturnedDelta,
        uint256 lossDelta,
        uint256 profitDelta,
        uint256 totalBusinessOut,
        bool finalized
    );
    event BusinessProfitTransferred(
        bytes32 indexed businessId, address indexed user, address indexed businessContract, uint256 amount
    );
    event BusinessProfitSwapped(
        bytes32 indexed businessId,
        address indexed user,
        address indexed businessContract,
        uint256 amount,
        address routerOrSpender,
        address expectedPoolOrTarget
    );
    event DexPoolLaunchMarked(uint64 launchTime);
    event SourceBurned(address indexed account, uint256 amount, SourceBreakdown sourceBurned);

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address adminTimelock, address pauser) external initializer {
        if (adminTimelock == address(0) || pauser == address(0)) revert InvalidAddress();
        __ERC20_init("OddFi", "ODD");
        __Pausable_init();
        __AccessControl_init();

        _grantRole(Roles.DEFAULT_ADMIN_ROLE, adminTimelock);
        _grantRole(Roles.UPGRADER_ROLE, adminTimelock);
        _grantRole(Roles.WHITELIST_ADMIN_ROLE, adminTimelock);
        _grantRole(Roles.HOUSEVAULT_MANAGER_ROLE, adminTimelock);
        _grantRole(Roles.DEX_LAUNCHER_ROLE, adminTimelock);
        _grantRole(Roles.SALE_ADMIN_ROLE, adminTimelock);
        _grantRole(Roles.REWARD_DISTRIBUTOR_ROLE, adminTimelock);
        _grantRole(Roles.PAUSER_ROLE, pauser);

        _reentrancyStatus = _NOT_ENTERED;
        _mint(address(this), TokenConstants.TOTAL_SUPPLY);
        emit TokenInitialized(adminTimelock, pauser, TokenConstants.TOTAL_SUPPLY);
    }

    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    function setFixedSourceContracts(FixedSources calldata sources) external onlyRole(Roles.WHITELIST_ADMIN_ROLE) {
        if (fixedSourcesConfigured) revert FixedSourcesAlreadyConfigured();
        _validateSourceAddress(sources.tierSale);
        _validateSourceAddress(sources.houseVault);
        _validateSourceAddress(sources.dexLaunchController);
        _validateSourceAddress(sources.ecosystemRewards);
        if (sources.opsTreasury == address(0)) revert InvalidAddress();

        _fixedSources = sources;
        fixedSourcesConfigured = true;
        emit FixedSourcesConfigured(
            sources.tierSale,
            sources.houseVault,
            sources.dexLaunchController,
            sources.ecosystemRewards,
            sources.opsTreasury
        );
    }

    function setWhitelist(address account, bool allowed) external onlyRole(Roles.WHITELIST_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        if (allowed) {
            if (account.code.length == 0 || dexRestrictedTarget[account]) revert InvalidWhitelistAccount(account);
        }
        whitelist[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }

    function setTreasurySink(address account, bool allowed) external onlyRole(Roles.WHITELIST_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        if (allowed && dexRestrictedTarget[account]) revert InvalidWhitelistAccount(account);
        treasurySink[account] = allowed;
        emit TreasurySinkUpdated(account, allowed);
    }

    function setDexRestrictedTarget(address account, bool restricted) external onlyRole(Roles.WHITELIST_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        if (restricted && (whitelist[account] || treasurySink[account])) revert InvalidWhitelistAccount(account);
        dexRestrictedTarget[account] = restricted;
        emit DexRestrictedTargetUpdated(account, restricted);
    }

    function setDexLaunchTransferTarget(address spender, address pool) external onlyRole(Roles.WHITELIST_ADMIN_ROLE) {
        if (spender == address(0) || pool == address(0)) revert InvalidAddress();
        if (!dexRestrictedTarget[spender] || !dexRestrictedTarget[pool]) {
            revert InvalidDexSpend(address(0), spender, pool, 0);
        }
        dexLaunchSpender = spender;
        dexLaunchPool = pool;
        emit DexLaunchTransferTargetUpdated(spender, pool);
    }

    function allocateInitialSupply() external nonReentrant onlyRole(Roles.WHITELIST_ADMIN_ROLE) {
        if (!fixedSourcesConfigured) revert FixedSourcesNotConfigured();
        if (initialSupplyAllocated) revert InitialSupplyAlreadyAllocated();
        if (!treasurySink[_fixedSources.opsTreasury]) revert InvalidAddress();

        initialSupplyAllocated = true;
        dexLiquidityTransferableAllocation = DEX_LIQUIDITY_ALLOCATION;

        _transferWithContext(TransferContext.InitialAllocation, address(this), _fixedSources.tierSale, SALE_ALLOCATION);
        _transferWithContext(
            TransferContext.InitialAllocation, address(this), _fixedSources.houseVault, HOUSE_VAULT_ALLOCATION
        );
        _transferWithContext(
            TransferContext.InitialAllocation,
            address(this),
            _fixedSources.dexLaunchController,
            DEX_LIQUIDITY_ALLOCATION
        );
        _transferWithContext(
            TransferContext.InitialAllocation,
            address(this),
            _fixedSources.ecosystemRewards,
            ECOSYSTEM_REWARDS_ALLOCATION
        );
        _transferWithContext(
            TransferContext.InitialAllocation, address(this), _fixedSources.opsTreasury, OPS_TREASURY_ALLOCATION
        );

        emit InitialSupplyAllocated(
            _fixedSources.tierSale,
            _fixedSources.houseVault,
            _fixedSources.dexLaunchController,
            _fixedSources.ecosystemRewards,
            _fixedSources.opsTreasury
        );
    }

    function distributeSalePurchase(address user, uint256 amount) external nonReentrant {
        if (msg.sender != _fixedSources.tierSale) revert InvalidAddress();
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        _sources[user].salePrincipalRemaining += amount;
        _transferWithContext(TransferContext.SaleDistribution, msg.sender, user, amount);
        emit SalePurchaseDistributed(user, amount);
    }

    function reclaimSalePurchase(address user, uint256 amount) external nonReentrant {
        if (msg.sender != _fixedSources.tierSale) revert InvalidAddress();
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        SourceAccount storage source = _sources[user];
        if (source.salePrincipalRemaining < amount) revert InvalidBusinessOutcome(bytes32(0));
        source.salePrincipalRemaining -= amount;
        _spendAllowance(user, msg.sender, amount);
        _transferWithContext(TransferContext.SaleReclaim, user, msg.sender, amount);
        emit SalePurchaseReclaimed(user, amount);
    }

    function distributeRewardClaim(address user, uint256 amount) external nonReentrant {
        if (msg.sender != _fixedSources.ecosystemRewards) revert InvalidAddress();
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        _sources[user].rewardPrincipalRemaining += amount;
        _transferWithContext(TransferContext.RewardDistribution, msg.sender, user, amount);
        emit RewardClaimDistributed(user, amount);
    }

    function consumeBusinessInflow(address user, uint16 businessType, bytes32 rawId, uint256 amount)
        external
        nonReentrant
        returns (bytes32 businessId)
    {
        if (!whitelist[msg.sender]) revert InvalidAddress();
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        businessId = _businessId(msg.sender, businessType, rawId);
        BusinessSnapshot storage snapshot = _businessSnapshots[businessId];
        if (_businessIdsUsed[businessId]) revert BusinessSnapshotAlreadyExists(businessId);
        _businessIdsUsed[businessId] = true;

        SourceBreakdown memory sourceIn = _consumeSources(user, amount);
        _spendAllowance(user, msg.sender, amount);

        snapshot.user = user;
        snapshot.businessContract = msg.sender;
        snapshot.businessType = businessType;
        snapshot.rawId = rawId;
        snapshot.createdAt = uint64(block.timestamp);
        snapshot.businessIn = amount;
        snapshot.sourceIn = sourceIn;

        _transferWithContext(TransferContext.BusinessInflow, user, msg.sender, amount);
        emit BusinessInflowConsumed(businessId, user, msg.sender, businessType, rawId, amount, sourceIn);
    }

    function registerBusinessOutcomeDelta(address user, bytes32 businessId, uint256 businessOutDelta, bool finalized)
        external
        nonReentrant
    {
        BusinessSnapshot storage snapshot = _requireBusinessSnapshot(user, businessId);
        if (snapshot.businessContract != msg.sender) revert InvalidBusinessSnapshotCaller(businessId, msg.sender);
        if (snapshot.finalized) revert BusinessSnapshotFinalized(businessId);
        if (businessOutDelta == 0 && !finalized) revert InvalidBusinessOutcome(businessId);

        uint256 previousTotalOut = snapshot.totalBusinessOut;
        uint256 newTotalOut = previousTotalOut + businessOutDelta;
        uint256 principalReturnedBefore = snapshot.principalReturned;
        uint256 principalReturnedAfter = _min(newTotalOut, snapshot.businessIn);
        uint256 principalReturnedDelta = principalReturnedAfter - principalReturnedBefore;
        uint256 profitAfter = newTotalOut > snapshot.businessIn ? newTotalOut - snapshot.businessIn : 0;
        uint256 profitDelta = profitAfter - snapshot.profitRecognized;
        uint256 lossDelta;

        if (principalReturnedDelta > 0) {
            _restorePrincipalSources(snapshot, principalReturnedBefore, principalReturnedAfter);
            snapshot.principalReturned = principalReturnedAfter;
        }

        snapshot.totalBusinessOut = newTotalOut;
        snapshot.profitRecognized = profitAfter;

        if (finalized) {
            uint256 lossAfter = snapshot.businessIn - _min(newTotalOut, snapshot.businessIn);
            lossDelta = lossAfter - snapshot.lossRecognized;
            snapshot.lossRecognized = lossAfter;
            snapshot.finalized = true;
            snapshot.finalizedAt = uint64(block.timestamp);
        }

        if (businessOutDelta > 0) {
            _transferWithContext(TransferContext.BusinessOutcome, msg.sender, user, businessOutDelta);
        }

        emit BusinessOutcomeRegistered(
            businessId,
            user,
            msg.sender,
            businessOutDelta,
            principalReturnedDelta,
            lossDelta,
            profitDelta,
            newTotalOut,
            finalized
        );
    }

    function registerBusinessProfitAndTransfer(address user, uint16 businessType, bytes32 rawId, uint256 amount)
        external
        nonReentrant
        returns (bytes32 businessId)
    {
        if (!whitelist[msg.sender]) revert InvalidAddress();
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        businessId = _businessId(msg.sender, businessType, rawId);
        if (_businessIdsUsed[businessId]) revert BusinessSnapshotAlreadyExists(businessId);
        _businessIdsUsed[businessId] = true;

        _transferWithContext(TransferContext.BusinessProfit, msg.sender, user, amount);
        emit BusinessProfitTransferred(businessId, user, msg.sender, amount);
    }

    function registerBusinessProfitForDexSwap(
        address user,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount,
        address routerOrSpender,
        address expectedPoolOrTarget
    ) external nonReentrant returns (bytes32 businessId) {
        if (!whitelist[msg.sender]) revert InvalidAddress();
        if (user == address(0) || routerOrSpender == address(0) || expectedPoolOrTarget == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) revert ZeroAmount();
        if (!dexRestrictedTarget[routerOrSpender] || !dexRestrictedTarget[expectedPoolOrTarget]) {
            revert InvalidDexSpend(msg.sender, routerOrSpender, expectedPoolOrTarget, amount);
        }

        businessId = _businessId(msg.sender, businessType, rawId);
        if (_businessIdsUsed[businessId]) revert BusinessSnapshotAlreadyExists(businessId);
        _businessIdsUsed[businessId] = true;

        businessProfitSwapAllowance[msg.sender][routerOrSpender][expectedPoolOrTarget] += amount;
        emit BusinessProfitSwapped(businessId, user, msg.sender, amount, routerOrSpender, expectedPoolOrTarget);
    }

    function clearBusinessProfitSwapAllowance(address routerOrSpender, address expectedPoolOrTarget)
        external
        returns (uint256 clearedAmount)
    {
        clearedAmount = businessProfitSwapAllowance[msg.sender][routerOrSpender][expectedPoolOrTarget];
        businessProfitSwapAllowance[msg.sender][routerOrSpender][expectedPoolOrTarget] = 0;
    }

    function markDexPoolLaunched(uint64 launchTime) external onlyRole(Roles.DEX_LAUNCHER_ROLE) {
        if (poolLaunchTime != 0) revert DexPoolLaunchAlreadyMarked(poolLaunchTime);
        if (launchTime == 0 || launchTime > block.timestamp) revert InvalidBusinessOutcome(bytes32(0));
        poolLaunchTime = launchTime;
        emit DexPoolLaunchMarked(launchTime);
    }

    function burn(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        SourceBreakdown memory burnedSources = _consumeSources(msg.sender, amount);
        _burn(msg.sender, amount);
        emit SourceBurned(msg.sender, amount, burnedSources);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);

        TransferContext context = _consumeExternalTransferContext(from, spender, to, value);
        if (context == TransferContext.None) {
            _transfer(from, to, value);
        } else {
            _transferWithContext(context, from, to, value);
        }
        return true;
    }

    function fixedSources() external view returns (FixedSources memory) {
        return _fixedSources;
    }

    function sourceBalanceOf(address account) public view returns (SourceBreakdown memory breakdown) {
        SourceAccount storage source = _sources[account];
        breakdown.saleLocked = _lockedSaleAmount(source.salePrincipalRemaining);
        breakdown.rewardLocked = _lockedRewardAmount(source.rewardPrincipalRemaining);
        breakdown.businessLocked = source.businessLockedRemaining;
        breakdown.transferable = transferableBalanceOf(account);
    }

    function businessSnapshotOf(bytes32 businessId) external view returns (BusinessSnapshot memory) {
        return _businessSnapshots[businessId];
    }

    function businessLossOf(bytes32 businessId) external view returns (uint256) {
        return _businessSnapshots[businessId].lossRecognized;
    }

    function transferableBalanceOf(address account) public view returns (uint256) {
        uint256 balance = balanceOf(account);
        uint256 locked = lockedBalanceOf(account);
        return balance > locked ? balance - locked : 0;
    }

    function lockedBalanceOf(address account) public view returns (uint256) {
        SourceAccount storage source = _sources[account];
        uint256 locked = _lockedSaleAmount(source.salePrincipalRemaining)
            + _lockedRewardAmount(source.rewardPrincipalRemaining) + source.businessLockedRemaining;
        uint256 balance = balanceOf(account);
        return locked > balance ? balance : locked;
    }

    function previewSaleUnlock(address account) external view returns (uint256 unlockedAmount, uint256 lockedAmount) {
        uint256 saleRemaining = _sources[account].salePrincipalRemaining;
        lockedAmount = _lockedSaleAmount(saleRemaining);
        unlockedAmount = saleRemaining - lockedAmount;
    }

    function previewRewardUnlock(address account) external view returns (uint256 unlockedAmount, uint256 lockedAmount) {
        uint256 rewardRemaining = _sources[account].rewardPrincipalRemaining;
        lockedAmount = _lockedRewardAmount(rewardRemaining);
        unlockedAmount = rewardRemaining - lockedAmount;
    }

    function isWhitelist(address account) external view returns (bool) {
        return whitelist[account];
    }

    function isTreasurySink(address account) external view returns (bool) {
        return treasurySink[account];
    }

    function isDexRestrictedTarget(address account) external view returns (bool) {
        return dexRestrictedTarget[account];
    }

    function _update(address from, address to, uint256 value) internal override {
        _requireNotPaused();
        _enforceTransferRules(from, to, value);
        super._update(from, to, value);
    }

    function _authorizeUpgrade(address) internal view override onlyRole(Roles.UPGRADER_ROLE) {}

    function _nonReentrantBefore() internal {
        if (_reentrancyStatus == _ENTERED) revert ReentrancyGuardReentrantCall();
        _reentrancyStatus = _ENTERED;
    }

    function _nonReentrantAfter() internal {
        _reentrancyStatus = _NOT_ENTERED;
    }

    function _validateSourceAddress(address account) internal view {
        if (account == address(0) || account.code.length == 0) revert InvalidAddress();
    }

    function _transferWithContext(TransferContext context, address from, address to, uint256 amount) internal {
        TransferContext previousContext = _transferContext;
        _transferContext = context;
        _transfer(from, to, amount);
        _transferContext = previousContext;
    }

    function _enforceTransferRules(address from, address to, uint256 value) internal view {
        if (_transferContext != TransferContext.None) return;
        if (from == address(0) || to == address(0)) return;
        if (treasurySink[from]) return;

        if (from == _fixedSources.houseVault) {
            if (!whitelist[to] && !treasurySink[to]) {
                revert InvalidTransferRestricted(from, to, value);
            }
            return;
        }

        if (from == _fixedSources.dexLaunchController) {
            if (!treasurySink[to]) {
                revert InvalidTransferRestricted(from, to, value);
            }
            return;
        }

        if (!whitelist[from] && !treasurySink[from] && whitelist[to]) {
            revert InvalidTransferRestricted(from, to, value);
        }

        if (whitelist[from] && !whitelist[to] && !treasurySink[to]) {
            revert InvalidTransferRestricted(from, to, value);
        }

        if (_isSaleOrRewardSource(from) && !treasurySink[to]) {
            revert InvalidTransferRestricted(from, to, value);
        }

        if (value > transferableBalanceOf(from)) {
            revert InvalidTransferRestricted(from, to, value);
        }
    }

    function _consumeExternalTransferContext(address from, address spender, address to, uint256 value)
        internal
        returns (TransferContext)
    {
        if (
            from == _fixedSources.dexLaunchController && spender == dexLaunchSpender && to == dexLaunchPool
                && value <= dexLiquidityTransferableAllocation
        ) {
            dexLiquidityTransferableAllocation -= value;
            return TransferContext.DexLaunch;
        }

        uint256 profitSwapAllowance = businessProfitSwapAllowance[from][spender][to];
        if (profitSwapAllowance >= value && profitSwapAllowance != 0) {
            businessProfitSwapAllowance[from][spender][to] = profitSwapAllowance - value;
            return TransferContext.BusinessProfitSwap;
        }

        return TransferContext.None;
    }

    function _consumeSources(address account, uint256 amount) internal returns (SourceBreakdown memory consumed) {
        uint256 remaining = amount;
        SourceAccount storage source = _sources[account];

        consumed.businessLocked = _consumeSourceField(source.businessLockedRemaining, remaining);
        source.businessLockedRemaining -= consumed.businessLocked;
        remaining -= consumed.businessLocked;

        consumed.saleLocked = _consumeSourceField(source.salePrincipalRemaining, remaining);
        source.salePrincipalRemaining -= consumed.saleLocked;
        remaining -= consumed.saleLocked;

        consumed.rewardLocked = _consumeSourceField(source.rewardPrincipalRemaining, remaining);
        source.rewardPrincipalRemaining -= consumed.rewardLocked;
        remaining -= consumed.rewardLocked;

        consumed.transferable = remaining;
    }

    function _consumeSourceField(uint256 available, uint256 requested) internal pure returns (uint256) {
        return available < requested ? available : requested;
    }

    function _restorePrincipalSources(
        BusinessSnapshot storage snapshot,
        uint256 principalReturnedBefore,
        uint256 principalReturnedAfter
    ) internal {
        SourceAccount storage source = _sources[snapshot.user];
        source.salePrincipalRemaining += _principalSourceDelta(
            snapshot.sourceIn.saleLocked, principalReturnedBefore, principalReturnedAfter, snapshot.businessIn
        );
        source.rewardPrincipalRemaining += _principalSourceDelta(
            snapshot.sourceIn.rewardLocked, principalReturnedBefore, principalReturnedAfter, snapshot.businessIn
        );
        source.businessLockedRemaining += _principalSourceDelta(
            snapshot.sourceIn.businessLocked, principalReturnedBefore, principalReturnedAfter, snapshot.businessIn
        );
    }

    function _principalSourceDelta(
        uint256 sourceAmount,
        uint256 principalReturnedBefore,
        uint256 principalReturnedAfter,
        uint256 businessIn
    ) internal pure returns (uint256) {
        if (sourceAmount == 0) return 0;
        uint256 afterAmount = sourceAmount.mulDiv(principalReturnedAfter, businessIn);
        uint256 beforeAmount = sourceAmount.mulDiv(principalReturnedBefore, businessIn);
        return afterAmount - beforeAmount;
    }

    function _requireBusinessSnapshot(address user, bytes32 businessId)
        internal
        view
        returns (BusinessSnapshot storage)
    {
        BusinessSnapshot storage snapshot = _businessSnapshots[businessId];
        if (snapshot.user == address(0)) revert BusinessSnapshotNotFound(businessId);
        if (snapshot.user != user) revert InvalidBusinessOutcome(businessId);
        return snapshot;
    }

    function _businessId(address businessContract, uint16 businessType, bytes32 rawId) internal pure returns (bytes32) {
        return keccak256(abi.encode(businessContract, businessType, rawId));
    }

    function _isSaleOrRewardSource(address account) internal view returns (bool) {
        return account == _fixedSources.tierSale || account == _fixedSources.ecosystemRewards;
    }

    function _lockedSaleAmount(uint256 saleRemaining) internal view returns (uint256) {
        if (saleRemaining == 0) return 0;
        uint256 launchTime = poolLaunchTime;
        if (launchTime == 0) return saleRemaining;
        if (block.timestamp < launchTime) return saleRemaining;
        uint256 elapsedDays = (block.timestamp - launchTime) / 1 days + 1;
        if (elapsedDays >= 29) return 0;
        uint256 unlocked = saleRemaining.mulDiv(elapsedDays * (elapsedDays + 1), SALE_UNLOCK_DENOMINATOR);
        return saleRemaining - unlocked;
    }

    function _lockedRewardAmount(uint256 rewardRemaining) internal view returns (uint256) {
        if (rewardRemaining == 0) return 0;
        uint256 launchTime = poolLaunchTime;
        if (launchTime == 0) return rewardRemaining;
        if (block.timestamp < launchTime) return rewardRemaining;
        uint256 elapsed = block.timestamp - launchTime;
        if (elapsed >= REWARD_UNLOCK_DURATION) return 0;
        uint256 unlocked = rewardRemaining.mulDiv(elapsed, REWARD_UNLOCK_DURATION);
        return rewardRemaining - unlocked;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
