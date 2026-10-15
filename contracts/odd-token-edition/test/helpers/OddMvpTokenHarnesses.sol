// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ODDToken} from "../../src/modules/token/ODDToken.sol";
import {IPancakeV3PositionManagerMintLike} from "../../src/modules/token/DexLaunchController.sol";

contract OddMvpSourceHarness {
    function distributeSale(ODDToken odd, address user, uint256 amount) external {
        odd.distributeSalePurchase(user, amount);
    }

    function reclaimSale(ODDToken odd, address user, uint256 amount) external {
        odd.reclaimSalePurchase(user, amount);
    }

    function distributeReward(ODDToken odd, address user, uint256 amount) external {
        odd.distributeRewardClaim(user, amount);
    }
}

contract OddMvpBusinessHarness {
    function approveOdd(ODDToken odd, address spender, uint256 amount) external {
        odd.approve(spender, amount);
    }

    function consume(ODDToken odd, address user, uint16 businessType, bytes32 rawId, uint256 amount)
        external
        returns (bytes32)
    {
        return odd.consumeBusinessInflow(user, businessType, rawId, amount);
    }

    function outcome(ODDToken odd, address user, bytes32 businessId, uint256 businessOutDelta, bool finalized)
        external
    {
        odd.registerBusinessOutcomeDelta(user, businessId, businessOutDelta, finalized);
    }

    function profit(ODDToken odd, address user, uint16 businessType, bytes32 rawId, uint256 amount)
        external
        returns (bytes32)
    {
        return odd.registerBusinessProfitAndTransfer(user, businessType, rawId, amount);
    }

    function profitForSwap(
        ODDToken odd,
        address user,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount,
        address router,
        address expectedPool
    ) external returns (bytes32) {
        return odd.registerBusinessProfitForDexSwap(user, businessType, rawId, amount, router, expectedPool);
    }
}

contract OddMvpHarnessERC20 is ERC20 {
    uint8 internal immutable TOKEN_DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        TOKEN_DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract OddMvpHarnessV3Pool {}

contract OddMvpHarnessPositionManager is ERC721 {
    using SafeERC20 for IERC20;

    address internal immutable POOL;
    uint256 public nextTokenId = 1;

    constructor() ERC721("OddFi Harness V3 Position", "OHV3P") {
        POOL = address(new OddMvpHarnessV3Pool());
    }

    function pool() external view returns (address) {
        return POOL;
    }

    function createAndInitializePoolIfNecessary(address, address, uint24, uint160) external view returns (address) {
        return POOL;
    }

    function mint(IPancakeV3PositionManagerMintLike.MintParams calldata params)
        external
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        IERC20(params.token0).safeTransferFrom(msg.sender, POOL, params.amount0Desired);
        IERC20(params.token1).safeTransferFrom(msg.sender, POOL, params.amount1Desired);
        tokenId = nextTokenId++;
        liquidity = uint128((params.amount0Desired + params.amount1Desired) / 1e12);
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        _safeMint(params.recipient, tokenId);
    }
}
