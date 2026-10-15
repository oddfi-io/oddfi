// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ODDToken} from "./ODDToken.sol";
import {Roles} from "../../shared/access/Roles.sol";
import {InvalidAddress, ZeroAmount} from "../../shared/errors/CommonErrors.sol";

interface ITierSaleLaunchSource {
    function launchApproval()
        external
        view
        returns (bool approved, address spender, uint256 usdtAmount, uint256 oddAmount);
}

interface IPancakeV3PositionManagerMintLike {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96)
        external
        payable
        returns (address pool);

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

interface IDexLpLocker {
    function lockPosition(uint256 tokenId, uint64 unlockAt) external;
}

error InvalidLaunchConfig();
error LaunchNotApproved();
error LaunchAlreadyExecuted();
error LaunchAmountMismatch(uint256 requested, uint256 approved);
error LaunchDeadlineExpired(uint256 deadline);
error InvalidSweepTarget(address target);
error ReentrancyGuardReentrantCall();

contract DexLaunchController is AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    uint256 internal constant DEFAULT_LP_LOCK_DURATION = 365 days;
    uint256 internal constant _NOT_ENTERED = 1;
    uint256 internal constant _ENTERED = 2;

    ODDToken public oddToken;
    IERC20 public usdt;
    ITierSaleLaunchSource public tierSale;
    IPancakeV3PositionManagerMintLike public positionManager;
    address public lpLocker;
    address public treasurySink;
    uint24 public poolFee;
    int24 public tickLower;
    int24 public tickUpper;
    uint160 public sqrtPriceX96;
    uint256 public lpLockDuration;

    bool public launched;
    address public pool;
    uint256 public lpTokenId;
    uint128 public lpLiquidity;
    uint256 public oddUsed;
    uint256 public usdtUsed;
    uint64 public launchTime;

    uint256 private _reentrancyStatus;
    uint256[32] private __gap;

    event DexLaunchControllerInitialized(
        address indexed admin,
        address indexed oddToken,
        address indexed usdt,
        address tierSale,
        address positionManager,
        address lpLocker,
        address treasurySink
    );
    event DexLaunchConfigUpdated(
        address indexed operator,
        uint24 poolFee,
        int24 tickLower,
        int24 tickUpper,
        uint160 sqrtPriceX96,
        uint256 lpLockDuration
    );
    event DexPoolLaunched(
        address indexed pool,
        uint256 indexed tokenId,
        address indexed lpLocker,
        uint128 liquidity,
        uint256 oddUsed,
        uint256 usdtUsed,
        uint64 launchTime,
        uint256 unlockTime
    );
    event LaunchRemainderSwept(address indexed operator, address indexed token, address indexed to, uint256 amount);

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
        address usdtAddress,
        address tierSaleAddress,
        address positionManagerAddress,
        address lpLockerAddress,
        address treasurySinkAddress
    ) external initializer {
        if (
            admin == address(0) || oddTokenAddress == address(0) || usdtAddress == address(0)
                || tierSaleAddress == address(0) || positionManagerAddress == address(0)
                || lpLockerAddress == address(0) || treasurySinkAddress == address(0)
        ) {
            revert InvalidAddress();
        }
        if (
            oddTokenAddress.code.length == 0 || usdtAddress.code.length == 0 || tierSaleAddress.code.length == 0
                || positionManagerAddress.code.length == 0 || lpLockerAddress.code.length == 0
        ) {
            revert InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        _grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.UPGRADER_ROLE, admin);
        _grantRole(Roles.PAUSER_ROLE, admin);
        _grantRole(Roles.DEX_LAUNCHER_ROLE, admin);

        oddToken = ODDToken(oddTokenAddress);
        usdt = IERC20(usdtAddress);
        tierSale = ITierSaleLaunchSource(tierSaleAddress);
        positionManager = IPancakeV3PositionManagerMintLike(positionManagerAddress);
        lpLocker = lpLockerAddress;
        treasurySink = treasurySinkAddress;
        lpLockDuration = DEFAULT_LP_LOCK_DURATION;
        _reentrancyStatus = _NOT_ENTERED;

        emit DexLaunchControllerInitialized(
            admin,
            oddTokenAddress,
            usdtAddress,
            tierSaleAddress,
            positionManagerAddress,
            lpLockerAddress,
            treasurySinkAddress
        );
    }

    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    function setLaunchConfig(
        uint24 newPoolFee,
        int24 newTickLower,
        int24 newTickUpper,
        uint160 newSqrtPriceX96,
        uint256 newLpLockDuration
    ) external onlyRole(Roles.DEX_LAUNCHER_ROLE) {
        if (newPoolFee == 0 || newTickLower >= newTickUpper || newSqrtPriceX96 == 0 || newLpLockDuration == 0) {
            revert InvalidLaunchConfig();
        }

        poolFee = newPoolFee;
        tickLower = newTickLower;
        tickUpper = newTickUpper;
        sqrtPriceX96 = newSqrtPriceX96;
        lpLockDuration = newLpLockDuration;

        emit DexLaunchConfigUpdated(
            msg.sender, newPoolFee, newTickLower, newTickUpper, newSqrtPriceX96, newLpLockDuration
        );
    }

    function launch(
        uint256 oddAmountDesired,
        uint256 usdtAmountDesired,
        uint256 oddAmountMin,
        uint256 usdtAmountMin,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        onlyRole(Roles.DEX_LAUNCHER_ROLE)
        returns (
            address launchedPool,
            uint256 tokenId,
            uint128 liquidity,
            uint256 actualOddUsed,
            uint256 actualUsdtUsed
        )
    {
        if (launched) revert LaunchAlreadyExecuted();
        if (deadline < block.timestamp) revert LaunchDeadlineExpired(deadline);
        if (oddAmountDesired == 0 || usdtAmountDesired == 0) revert ZeroAmount();
        if (poolFee == 0 || tickLower >= tickUpper || sqrtPriceX96 == 0) revert InvalidLaunchConfig();

        (bool approved, address spender, uint256 approvedUsdtAmount, uint256 approvedOddAmount) =
            tierSale.launchApproval();
        if (!approved || spender != address(this)) revert LaunchNotApproved();
        if (usdtAmountDesired != approvedUsdtAmount) {
            revert LaunchAmountMismatch(usdtAmountDesired, approvedUsdtAmount);
        }
        if (oddAmountDesired != approvedOddAmount) revert LaunchAmountMismatch(oddAmountDesired, approvedOddAmount);

        (address token0, address token1, bool oddIsToken0) = _orderedTokens();
        launchedPool = positionManager.createAndInitializePoolIfNecessary(token0, token1, poolFee, sqrtPriceX96);
        if (launchedPool == address(0)) revert InvalidLaunchConfig();

        oddToken.setDexRestrictedTarget(address(positionManager), true);
        oddToken.setDexRestrictedTarget(launchedPool, true);
        oddToken.setDexLaunchTransferTarget(address(positionManager), launchedPool);

        usdt.safeTransferFrom(address(tierSale), address(this), usdtAmountDesired);
        IERC20(address(oddToken)).forceApprove(address(positionManager), oddAmountDesired);
        usdt.forceApprove(address(positionManager), usdtAmountDesired);

        IPancakeV3PositionManagerMintLike.MintParams memory params = IPancakeV3PositionManagerMintLike.MintParams({
            token0: token0,
            token1: token1,
            fee: poolFee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: oddIsToken0 ? oddAmountDesired : usdtAmountDesired,
            amount1Desired: oddIsToken0 ? usdtAmountDesired : oddAmountDesired,
            amount0Min: oddIsToken0 ? oddAmountMin : usdtAmountMin,
            amount1Min: oddIsToken0 ? usdtAmountMin : oddAmountMin,
            recipient: lpLocker,
            deadline: deadline
        });

        uint256 amount0;
        uint256 amount1;
        (tokenId, liquidity, amount0, amount1) = positionManager.mint(params);

        IERC20(address(oddToken)).forceApprove(address(positionManager), 0);
        usdt.forceApprove(address(positionManager), 0);

        actualOddUsed = oddIsToken0 ? amount0 : amount1;
        actualUsdtUsed = oddIsToken0 ? amount1 : amount0;
        uint256 lockedUntilValue = block.timestamp + lpLockDuration;
        if (lockedUntilValue > type(uint64).max) revert InvalidLaunchConfig();
        // Safe: lockedUntilValue is bounded by uint64 max immediately above.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 lockedUntil = uint64(lockedUntilValue);
        IDexLpLocker(lpLocker).lockPosition(tokenId, lockedUntil);

        launched = true;
        pool = launchedPool;
        lpTokenId = tokenId;
        lpLiquidity = liquidity;
        oddUsed = actualOddUsed;
        usdtUsed = actualUsdtUsed;
        launchTime = uint64(block.timestamp);

        oddToken.markDexPoolLaunched(launchTime);

        emit DexPoolLaunched(
            launchedPool, tokenId, lpLocker, liquidity, actualOddUsed, actualUsdtUsed, launchTime, lockedUntil
        );
    }

    function sweepRemainder(address token, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(Roles.DEX_LAUNCHER_ROLE)
    {
        if (!launched) revert LaunchNotApproved();
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (!oddToken.isTreasurySink(to)) revert InvalidSweepTarget(to);

        IERC20(token).safeTransfer(to, amount);
        emit LaunchRemainderSwept(msg.sender, token, to, amount);
    }

    function _orderedTokens() internal view returns (address token0, address token1, bool oddIsToken0) {
        address oddAddress = address(oddToken);
        address usdtAddress = address(usdt);
        oddIsToken0 = oddAddress < usdtAddress;
        token0 = oddIsToken0 ? oddAddress : usdtAddress;
        token1 = oddIsToken0 ? usdtAddress : oddAddress;
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
