// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {Roles} from "../../shared/access/Roles.sol";
import {InvalidAddress} from "../../shared/errors/CommonErrors.sol";

error InvalidLockerPosition(uint256 tokenId);
error PositionAlreadyLocked(uint256 tokenId);
error PositionNotLocked(uint256 tokenId);
error PositionStillLocked(uint256 tokenId, uint64 unlockAt);
error ReentrancyGuardReentrantCall();

contract DexLpLocker is AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable, IERC721Receiver {
    struct LockedPosition {
        address beneficiary;
        uint64 lockedAt;
        uint64 unlockAt;
        bool released;
    }

    uint256 internal constant _NOT_ENTERED = 1;
    uint256 internal constant _ENTERED = 2;

    IERC721 public positionManager;
    address public defaultBeneficiary;

    mapping(uint256 => LockedPosition) public lockedPositions;

    uint256 private _reentrancyStatus;
    uint256[45] private __gap;

    event DexLpLockerInitialized(
        address indexed admin, address indexed positionManager, address indexed defaultBeneficiary
    );
    event DefaultBeneficiaryUpdated(
        address indexed operator, address indexed oldBeneficiary, address indexed newBeneficiary
    );
    event PositionLocked(
        address indexed operator, uint256 indexed tokenId, address indexed beneficiary, uint64 lockedAt, uint64 unlockAt
    );
    event PositionReleased(address indexed operator, uint256 indexed tokenId, address indexed to);

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address positionManagerAddress, address beneficiary) external initializer {
        if (
            admin == address(0) || positionManagerAddress == address(0) || positionManagerAddress.code.length == 0
                || beneficiary == address(0)
        ) {
            revert InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        _grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.UPGRADER_ROLE, admin);
        _grantRole(Roles.PAUSER_ROLE, admin);
        _grantRole(Roles.DEX_LAUNCHER_ROLE, admin);

        positionManager = IERC721(positionManagerAddress);
        defaultBeneficiary = beneficiary;
        _reentrancyStatus = _NOT_ENTERED;

        emit DexLpLockerInitialized(admin, positionManagerAddress, beneficiary);
    }

    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    function setDefaultBeneficiary(address beneficiary) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (beneficiary == address(0)) revert InvalidAddress();
        emit DefaultBeneficiaryUpdated(msg.sender, defaultBeneficiary, beneficiary);
        defaultBeneficiary = beneficiary;
    }

    function lockPosition(uint256 tokenId, uint64 unlockAt) external whenNotPaused onlyRole(Roles.DEX_LAUNCHER_ROLE) {
        if (lockedPositions[tokenId].lockedAt != 0) revert PositionAlreadyLocked(tokenId);
        if (unlockAt <= block.timestamp) revert PositionStillLocked(tokenId, unlockAt);
        if (positionManager.ownerOf(tokenId) != address(this)) revert InvalidLockerPosition(tokenId);

        lockedPositions[tokenId] = LockedPosition({
            beneficiary: defaultBeneficiary, lockedAt: uint64(block.timestamp), unlockAt: unlockAt, released: false
        });

        emit PositionLocked(msg.sender, tokenId, defaultBeneficiary, uint64(block.timestamp), unlockAt);
    }

    function releasePosition(uint256 tokenId, address to)
        external
        nonReentrant
        whenNotPaused
        onlyRole(Roles.DEX_LAUNCHER_ROLE)
    {
        if (to == address(0)) revert InvalidAddress();
        LockedPosition storage locked = lockedPositions[tokenId];
        if (locked.lockedAt == 0 || locked.released) revert PositionNotLocked(tokenId);
        if (block.timestamp < locked.unlockAt) revert PositionStillLocked(tokenId, locked.unlockAt);
        if (to != locked.beneficiary) revert InvalidAddress();

        locked.released = true;
        positionManager.safeTransferFrom(address(this), to, tokenId);

        emit PositionReleased(msg.sender, tokenId, to);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external view override returns (bytes4) {
        if (msg.sender != address(positionManager)) revert InvalidAddress();
        return IERC721Receiver.onERC721Received.selector;
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
