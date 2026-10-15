// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IODDTokenBusiness} from "./interfaces/IODDTokenBusiness.sol";
import {Roles} from "../../shared/access/Roles.sol";
import {InvalidAddress, ZeroAmount} from "../../shared/errors/CommonErrors.sol";

error SaleAlreadyStarted();
error SaleNotActive();
error SaleClosed();
error SaleCancelled();
error SaleNotCancelled();
error SaleNotFinalized();
error SaleCapExceeded(uint256 requested, uint256 remaining);
error UserSaleCapExceeded(address user, uint256 requested, uint256 cap);
error InvalidPurchase(uint256 purchaseId);
error InvalidRefundAmount(uint256 requested, uint256 refundable);
error LaunchAlreadyApproved();
error ReentrancyGuardReentrantCall();

contract TierSale is AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    struct Purchase {
        address user;
        uint256 oddAmount;
        uint256 usdtPaid;
        uint256 refundedOdd;
        uint256 refundedUsdt;
    }

    uint256 internal constant TIER_COUNT = 10;
    uint256 internal constant TIER_SIZE = 3_000_000 ether;
    uint256 internal constant TOTAL_SALE_ODD = 30_000_000 ether;
    uint256 internal constant PRICE_DENOMINATOR = 100 ether;
    uint256 internal constant _NOT_ENTERED = 1;
    uint256 internal constant _ENTERED = 2;

    IODDTokenBusiness public oddToken;
    IERC20 public usdt;
    uint8 public usdtDecimals;

    uint64 public saleStartTime;
    uint64 public soldOutTime;
    uint64 public forceFinalizeTime;
    bool public saleClosed;
    bool public saleCancelled;
    bool public forceFinalized;
    uint256 public perAddressCap;
    uint256 public totalSold;
    uint256 public totalUsdtRaised;
    uint256 public totalUsdtRefunded;
    uint256 public totalOddRefunded;
    uint256 public nextPurchaseId;
    address public launchSpender;
    uint256 public launchUsdtAmount;
    uint256 public launchOddAmount;
    bool public launchApproved;

    mapping(uint256 => Purchase) public purchases;
    mapping(address => uint256) public purchasedOddByUser;

    uint256 private _reentrancyStatus;
    uint256[32] private __gap;

    event TierSaleInitialized(address indexed admin, address indexed oddToken, address indexed usdt);
    event SaleStarted(uint64 startTime);
    event SalePaused(address indexed operator);
    event SaleResumed(address indexed operator);
    event SaleClosedByAdmin(address indexed operator);
    event SaleCancelledByAdmin(address indexed operator);
    event PurchaseRecorded(
        uint256 indexed purchaseId, address indexed user, uint256 oddAmount, uint256 usdtPaid, uint256 totalSoldAfter
    );
    event PurchaseRefunded(
        uint256 indexed purchaseId, address indexed user, uint256 oddAmount, uint256 usdtAmount, uint256 refundedOdd
    );
    event ForceFinalized(
        address indexed operator, uint64 forceFinalizeTime, uint256 launchUsdtAmount, uint256 launchOddAmount
    );
    event LaunchApproved(address indexed operator, address indexed spender, uint256 usdtAmount, uint256 oddAmount);
    event PerAddressCapUpdated(address indexed operator, uint256 oldCap, uint256 newCap);

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address oddTokenAddress, address usdtAddress) external initializer {
        if (admin == address(0) || oddTokenAddress == address(0) || usdtAddress == address(0)) {
            revert InvalidAddress();
        }
        if (oddTokenAddress.code.length == 0 || usdtAddress.code.length == 0) revert InvalidAddress();

        __AccessControl_init();
        __Pausable_init();

        _grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.UPGRADER_ROLE, admin);
        _grantRole(Roles.PAUSER_ROLE, admin);
        _grantRole(Roles.SALE_ADMIN_ROLE, admin);

        oddToken = IODDTokenBusiness(oddTokenAddress);
        usdt = IERC20(usdtAddress);
        usdtDecimals = IERC20Metadata(usdtAddress).decimals();
        nextPurchaseId = 1;
        _reentrancyStatus = _NOT_ENTERED;

        emit TierSaleInitialized(admin, oddTokenAddress, usdtAddress);
    }

    function startSale() external onlyRole(Roles.SALE_ADMIN_ROLE) {
        if (saleStartTime != 0) revert SaleAlreadyStarted();
        saleStartTime = uint64(block.timestamp);
        emit SaleStarted(saleStartTime);
    }

    function pauseSale() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
        emit SalePaused(msg.sender);
    }

    function resumeSale() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
        emit SaleResumed(msg.sender);
    }

    function closeSale() external onlyRole(Roles.SALE_ADMIN_ROLE) {
        if (saleCancelled) revert SaleCancelled();
        saleClosed = true;
        emit SaleClosedByAdmin(msg.sender);
    }

    function cancelSale() external onlyRole(Roles.SALE_ADMIN_ROLE) {
        if (launchApproved) revert LaunchAlreadyApproved();
        saleCancelled = true;
        saleClosed = true;
        emit SaleCancelledByAdmin(msg.sender);
    }

    function setPerAddressCap(uint256 newCap) external onlyRole(Roles.SALE_ADMIN_ROLE) {
        emit PerAddressCapUpdated(msg.sender, perAddressCap, newCap);
        perAddressCap = newCap;
    }

    function buy(uint256 oddAmount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 purchaseId, uint256 usdtAmount)
    {
        _requireSaleActive();
        if (oddAmount == 0) revert ZeroAmount();

        uint256 remaining = TOTAL_SALE_ODD - totalSold;
        if (oddAmount > remaining) revert SaleCapExceeded(oddAmount, remaining);
        uint256 cap = perAddressCap;
        if (cap != 0 && purchasedOddByUser[msg.sender] + oddAmount > cap) {
            revert UserSaleCapExceeded(msg.sender, purchasedOddByUser[msg.sender] + oddAmount, cap);
        }

        usdtAmount = previewBuy(oddAmount);
        purchaseId = nextPurchaseId++;

        totalSold += oddAmount;
        totalUsdtRaised += usdtAmount;
        purchasedOddByUser[msg.sender] += oddAmount;
        purchases[purchaseId] =
            Purchase({user: msg.sender, oddAmount: oddAmount, usdtPaid: usdtAmount, refundedOdd: 0, refundedUsdt: 0});

        if (totalSold == TOTAL_SALE_ODD) {
            saleClosed = true;
            soldOutTime = uint64(block.timestamp);
        }

        usdt.safeTransferFrom(msg.sender, address(this), usdtAmount);
        oddToken.distributeSalePurchase(msg.sender, oddAmount);

        emit PurchaseRecorded(purchaseId, msg.sender, oddAmount, usdtAmount, totalSold);
    }

    function refundPurchase(uint256 purchaseId, uint256 oddAmount) external nonReentrant returns (uint256 usdtAmount) {
        if (!saleCancelled) revert SaleNotCancelled();
        Purchase storage purchase = purchases[purchaseId];
        if (purchase.user != msg.sender) revert InvalidPurchase(purchaseId);
        uint256 refundableOdd = purchase.oddAmount - purchase.refundedOdd;
        if (oddAmount == 0 || oddAmount > refundableOdd) revert InvalidRefundAmount(oddAmount, refundableOdd);

        usdtAmount = (purchase.usdtPaid - purchase.refundedUsdt) * oddAmount / refundableOdd;
        purchase.refundedOdd += oddAmount;
        purchase.refundedUsdt += usdtAmount;
        totalOddRefunded += oddAmount;
        totalUsdtRefunded += usdtAmount;

        oddToken.reclaimSalePurchase(msg.sender, oddAmount);
        usdt.safeTransfer(msg.sender, usdtAmount);

        emit PurchaseRefunded(purchaseId, msg.sender, oddAmount, usdtAmount, purchase.refundedOdd);
    }

    function forceFinalize(uint256 usdtAmount, uint256 oddAmount) external onlyRole(Roles.SALE_ADMIN_ROLE) {
        if (saleCancelled) revert SaleCancelled();
        if (forceFinalized) revert SaleNotActive();
        if (usdtAmount == 0 || oddAmount == 0) revert ZeroAmount();
        if (usdtAmount > usdt.balanceOf(address(this))) {
            revert SaleCapExceeded(usdtAmount, usdt.balanceOf(address(this)));
        }

        forceFinalized = true;
        saleClosed = true;
        forceFinalizeTime = uint64(block.timestamp);
        launchUsdtAmount = usdtAmount;
        launchOddAmount = oddAmount;

        emit ForceFinalized(msg.sender, forceFinalizeTime, usdtAmount, oddAmount);
    }

    function approveLaunch(address spender, uint256 usdtAmount, uint256 oddAmount)
        external
        onlyRole(Roles.SALE_ADMIN_ROLE)
    {
        if (spender == address(0)) revert InvalidAddress();
        if (launchApproved) revert LaunchAlreadyApproved();
        if (!soldOut() && !forceFinalized) revert SaleNotFinalized();
        if (usdtAmount == 0 || oddAmount == 0) revert ZeroAmount();
        if (usdtAmount > usdt.balanceOf(address(this))) {
            revert SaleCapExceeded(usdtAmount, usdt.balanceOf(address(this)));
        }

        launchSpender = spender;
        launchUsdtAmount = usdtAmount;
        launchOddAmount = oddAmount;
        launchApproved = true;
        usdt.forceApprove(spender, usdtAmount);

        emit LaunchApproved(msg.sender, spender, usdtAmount, oddAmount);
    }

    function launchApproval()
        external
        view
        returns (bool approved, address spender, uint256 usdtAmount, uint256 oddAmount)
    {
        return (launchApproved, launchSpender, launchUsdtAmount, launchOddAmount);
    }

    function previewBuy(uint256 oddAmount) public view returns (uint256 usdtAmount) {
        if (oddAmount == 0) return 0;
        if (totalSold + oddAmount > TOTAL_SALE_ODD) {
            revert SaleCapExceeded(oddAmount, TOTAL_SALE_ODD - totalSold);
        }

        uint256 remaining = oddAmount;
        uint256 cursor = totalSold;
        uint256 usdtScale = 10 ** uint256(usdtDecimals);

        while (remaining > 0) {
            uint256 tierIndex = cursor / TIER_SIZE;
            uint256 tierEnd = (tierIndex + 1) * TIER_SIZE;
            uint256 availableInTier = tierEnd - cursor;
            uint256 chunk = remaining < availableInTier ? remaining : availableInTier;
            uint256 priceNumerator = (tierIndex + 1) * usdtScale;
            usdtAmount += _ceilDiv(chunk * priceNumerator, PRICE_DENOMINATOR);
            cursor += chunk;
            remaining -= chunk;
        }
    }

    function getCurrentTier() external view returns (uint256 tier) {
        if (totalSold >= TOTAL_SALE_ODD) return TIER_COUNT;
        return totalSold / TIER_SIZE + 1;
    }

    function getRemainingByTier(uint256 tier) external view returns (uint256 remaining) {
        if (tier == 0 || tier > TIER_COUNT) revert InvalidPurchase(tier);
        uint256 tierStart = (tier - 1) * TIER_SIZE;
        uint256 tierEnd = tier * TIER_SIZE;
        if (totalSold >= tierEnd) return 0;
        if (totalSold <= tierStart) return TIER_SIZE;
        return tierEnd - totalSold;
    }

    function soldOut() public view returns (bool) {
        return totalSold == TOTAL_SALE_ODD;
    }

    function _requireSaleActive() internal view {
        if (saleStartTime == 0) revert SaleNotActive();
        if (saleClosed) revert SaleClosed();
        if (saleCancelled) revert SaleCancelled();
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        return (a - 1) / b + 1;
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
