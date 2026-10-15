// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../shared/types/BetTypes.sol";
import "../shared/constants/Constants.sol";
import "../shared/errors/Errors.sol";
import "./interfaces/IBettingPool.sol";
import "./libraries/LiquidityLib.sol";
import "./libraries/SignalLib.sol";

/// @title BettingPool
/// @notice Aggregate root for the OddFi USDT sports betting platform.
/// @dev UUPS upgradeable. All funds are USDT-denominated.
contract BettingPool is
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    IBettingPool
{
    using SafeERC20 for IERC20;

    // ── Storage Layout (order MUST NOT change) ────────────────────────────────

    // Slot 1-3: Base config
    IERC20 public usdt;
    address public admin;
    address public multisig;

    // Slot 4-5: User balances
    mapping(address => uint256) public userBalances;
    mapping(address => uint256) public lockedBalances;

    // Slot 6: Bets
    mapping(bytes32 => Bet) public bets;

    // Slot 7: Parlays
    mapping(bytes32 => Parlay) public parlays;

    // Slot 8-11: Betting pool
    uint256 public bettingPool;
    uint256 public totalLpShares;
    mapping(address => uint256) public lpShares;
    uint256 public platformBalance;

    // Slot 12: Signals
    mapping(bytes32 => MarketSignal) public signals;

    // Slot 13: Market lifecycle
    mapping(bytes32 => MarketStatus) public marketStatus;
    mapping(bytes32 => uint8) public marketOutcome; // 0 = not settled, stored as winningOutcome + 1

    // Slot 14: Match → market keys
    mapping(bytes32 => bytes32[]) public matchMarkets;

    // Slot 15-16: Credit positions
    mapping(bytes32 => uint256) public frozenPayouts;
    mapping(bytes32 => uint256) public collateralUsed;

    // Slot 17-18: Large withdrawal requests
    mapping(bytes32 => WithdrawalRequest) public withdrawalRequests;
    uint256 public withdrawalNonce;

    // Slot 19: Deposit dedup
    mapping(bytes32 => bool) public processedDeposits;

    // Slot 20-21: Payout tracking
    uint256 public totalPotentialPayout;
    uint256 public totalFrozenPayouts;

    // Slot 22-24: Accounting invariants
    uint256 public totalUserBalances;
    uint256 public totalPendingWithdrawals;
    uint256 public totalCreditOutstanding;

    // Slot 25-27: Configurable params
    uint256 public redLightThreshold;
    uint256 public lpShareBps;
    uint256 public maxMarketsPerMatch;

    // Storage gap for future upgrades (MUST remain last)
    uint256[50] private __gap;

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    modifier onlyMultisig() {
        if (msg.sender != multisig) revert Unauthorized();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ── Initializer ───────────────────────────────────────────────────────────

    function initialize(address _usdt, address _admin, address _multisig) external initializer {
        __Pausable_init();
        if (_usdt == address(0) || _admin == address(0) || _multisig == address(0)) revert InvalidAddress();
        usdt = IERC20(_usdt);
        admin = _admin;
        multisig = _multisig;
        redLightThreshold = DEFAULT_RED_THRESHOLD;
        lpShareBps = DEFAULT_LP_SHARE_BPS;
        maxMarketsPerMatch = DEFAULT_MAX_MARKETS_PER_MATCH;
    }

    // ── UUPS ──────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyMultisig {}

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _marketKey(bytes32 matchId, MarketType market, uint8 line) internal pure returns (bytes32) {
        return keccak256(abi.encode(matchId, market, line));
    }

    function _totalAccountedBalance() internal view returns (uint256) {
        return totalUserBalances + bettingPool + platformBalance + totalPendingWithdrawals + totalCreditOutstanding;
    }

    // ── 6.2 User Functions ────────────────────────────────────────────────────

    /// @inheritdoc IBettingPool
    function creditDeposit(address user, uint256 amount, bytes32 txHash) external onlyAdmin whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (user == address(0)) revert InvalidAddress();
        require(!processedDeposits[txHash], "already processed");
        processedDeposits[txHash] = true;
        require(usdt.balanceOf(address(this)) >= _totalAccountedBalance() + amount, "balance mismatch");
        userBalances[user] += amount;
        totalUserBalances += amount;
        emit Deposited(user, amount, txHash);
    }

    /// @inheritdoc IBettingPool
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        uint256 available = userBalances[msg.sender] - lockedBalances[msg.sender];
        require(amount > 0 && amount <= available, "bad amount");

        if (amount <= LARGE_WITHDRAWAL_THRESHOLD) {
            userBalances[msg.sender] -= amount;
            totalUserBalances -= amount;
            usdt.safeTransfer(msg.sender, amount);
            emit Withdrawn(msg.sender, amount);
        } else {
            userBalances[msg.sender] -= amount;
            totalUserBalances -= amount;
            totalPendingWithdrawals += amount;

            bytes32 requestId = keccak256(abi.encode(msg.sender, withdrawalNonce++));
            withdrawalRequests[requestId] = WithdrawalRequest({
                user: msg.sender,
                amount: amount,
                requestTime: block.timestamp,
                executed: false,
                rejected: false
            });
            emit LargeWithdrawalRequested(requestId, msg.sender, amount);
        }
    }

    /// @inheritdoc IBettingPool
    function executeLargeWithdrawal(bytes32 requestId) external nonReentrant whenNotPaused {
        WithdrawalRequest storage req = withdrawalRequests[requestId];
        require(req.user == msg.sender, "not owner");
        if (req.executed || req.rejected) revert WithdrawalAlreadyProcessed();
        if (block.timestamp < req.requestTime + WITHDRAWAL_DELAY) revert WithdrawalNotReady();
        req.executed = true;
        uint256 amount = req.amount;
        totalPendingWithdrawals -= amount;
        usdt.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @inheritdoc IBettingPool
    function rejectLargeWithdrawal(bytes32 requestId) external onlyAdmin {
        WithdrawalRequest storage req = withdrawalRequests[requestId];
        if (req.executed || req.rejected) revert WithdrawalAlreadyProcessed();
        require(block.timestamp < req.requestTime + WITHDRAWAL_DELAY, "delay passed");
        req.rejected = true;
        uint256 amount = req.amount;
        address user = req.user;
        totalPendingWithdrawals -= amount;
        userBalances[user] += amount;
        totalUserBalances += amount;
        emit LargeWithdrawalRejected(requestId, user, amount);
    }

    // ── 6.3 Admin Functions ───────────────────────────────────────────────────

    /// @inheritdoc IBettingPool
    function openMarket(bytes32 matchId, MarketType market, uint8 line) external onlyAdmin {
        bytes32 key = _marketKey(matchId, market, line);
        require(marketStatus[key] == MarketStatus.NotCreated, "already exists");
        if (matchMarkets[matchId].length >= maxMarketsPerMatch) revert TooManyMarkets();
        marketStatus[key] = MarketStatus.Open;
        matchMarkets[matchId].push(key);
        emit MarketOpened(matchId, market, line);
    }

    /// @inheritdoc IBettingPool
    function closeMarket(bytes32 matchId, MarketType market, uint8 line) external onlyAdmin {
        bytes32 key = _marketKey(matchId, market, line);
        require(marketStatus[key] == MarketStatus.Open, "not open");
        marketStatus[key] = MarketStatus.Closed;
        emit MarketClosed(matchId, market, line);
    }

    /// @inheritdoc IBettingPool
    function batchOpenMarkets(
        bytes32 matchId,
        MarketType[] calldata markets,
        uint8[] calldata lines
    ) external onlyAdmin {
        require(markets.length == lines.length, "length mismatch");
        for (uint256 i = 0; i < markets.length; i++) {
            bytes32 key = _marketKey(matchId, markets[i], lines[i]);
            require(marketStatus[key] == MarketStatus.NotCreated, "already exists");
            if (matchMarkets[matchId].length >= maxMarketsPerMatch) revert TooManyMarkets();
            marketStatus[key] = MarketStatus.Open;
            matchMarkets[matchId].push(key);
            emit MarketOpened(matchId, markets[i], lines[i]);
        }
    }

    /// @inheritdoc IBettingPool
    function batchCloseMarkets(
        bytes32 matchId,
        MarketType[] calldata markets,
        uint8[] calldata lines
    ) external onlyAdmin {
        require(markets.length == lines.length, "length mismatch");
        for (uint256 i = 0; i < markets.length; i++) {
            bytes32 key = _marketKey(matchId, markets[i], lines[i]);
            require(marketStatus[key] == MarketStatus.Open, "not open");
            marketStatus[key] = MarketStatus.Closed;
            emit MarketClosed(matchId, markets[i], lines[i]);
        }
    }

    /// @inheritdoc IBettingPool
    function reopenMarket(bytes32 matchId, MarketType market, uint8 line) external onlyMultisig {
        bytes32 key = _marketKey(matchId, market, line);
        require(marketStatus[key] == MarketStatus.Closed, "not closed");
        marketStatus[key] = MarketStatus.Open;
        emit MarketReopened(matchId, market, line);
    }

    /// @inheritdoc IBettingPool
    function lockBet(
        bytes32 betId,
        address user,
        uint256 amount,
        bytes32 matchId,
        MarketType market,
        uint8 outcome,
        uint8 line,
        uint256 lockedOdds
    ) external onlyAdmin whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (lockedOdds < ODDS_PRECISION) revert InvalidOdds();
        if (bets[betId].user != address(0)) revert BetIdAlreadyExists();

        bytes32 key = _marketKey(matchId, market, line);
        if (marketStatus[key] != MarketStatus.Open) revert MarketNotOpen();
        if (!SignalLib.isAccepting(signals[key], outcome)) revert MarketRedLight();
        if (amount > GLOBAL_MAX_BET) revert GlobalMaxBetExceeded();

        uint256 available = userBalances[user] - lockedBalances[user];
        if (available < amount) revert InsufficientBalance();

        uint256 potentialPayout = (amount * lockedOdds) / ODDS_PRECISION;
        if (potentialPayout > bettingPool - totalPotentialPayout - totalFrozenPayouts) {
            revert InsufficientLiquidity();
        }

        lockedBalances[user] += amount;
        bets[betId] = Bet({
            user: user,
            amount: amount,
            matchId: matchId,
            market: market,
            outcome: outcome,
            line: line,
            lockedOdds: lockedOdds,
            status: BetStatus.Pending,
            isCredit: false,
            collateralBetId: bytes32(0),
            isParlay: false,
            parlayId: bytes32(0)
        });
        totalPotentialPayout += potentialPayout;
        emit BetLocked(betId, user, amount, matchId);
    }

    /// @inheritdoc IBettingPool
    function lockCreditBet(
        bytes32 betId,
        bytes32 collateralBetId,
        address user,
        uint256 amount,
        bytes32 matchId,
        MarketType market,
        uint8 outcome,
        uint8 line,
        uint256 lockedOdds
    ) external onlyAdmin whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (lockedOdds < ODDS_PRECISION) revert InvalidOdds();
        if (bets[betId].user != address(0)) revert BetIdAlreadyExists();

        bytes32 key = _marketKey(matchId, market, line);
        if (marketStatus[key] != MarketStatus.Open) revert MarketNotOpen();
        if (!SignalLib.isAccepting(signals[key], outcome)) revert MarketRedLight();
        if (amount > GLOBAL_MAX_BET) revert GlobalMaxBetExceeded();

        // Collateral checks
        Bet storage collateral = bets[collateralBetId];
        if (collateral.user != user) revert Unauthorized();
        if (collateral.status != BetStatus.Pending) revert BetAlreadySettled();
        if (collateral.isCredit) revert CreditChainForbidden();
        if (collateral.isParlay) revert ParlayNotCollateralizable();

        uint256 maxCredit = (collateral.amount * CREDIT_RATIO_BPS) / BPS_DENOMINATOR;
        if (collateralUsed[collateralBetId] + amount > maxCredit) revert CreditLimitExceeded();

        uint256 potentialPayout = (amount * lockedOdds) / ODDS_PRECISION;
        // Pool after lending: bettingPool - amount; remaining must cover all potential payouts incl this one
        if (potentialPayout > (bettingPool - amount) - totalPotentialPayout - totalFrozenPayouts) {
            revert InsufficientLiquidity();
        }

        collateralUsed[collateralBetId] += amount;
        bettingPool -= amount;
        totalCreditOutstanding += amount;

        bets[betId] = Bet({
            user: user,
            amount: amount,
            matchId: matchId,
            market: market,
            outcome: outcome,
            line: line,
            lockedOdds: lockedOdds,
            status: BetStatus.Pending,
            isCredit: true,
            collateralBetId: collateralBetId,
            isParlay: false,
            parlayId: bytes32(0)
        });
        totalPotentialPayout += potentialPayout;
        emit CreditBetLocked(betId, collateralBetId, user, amount);
    }

    /// @inheritdoc IBettingPool
    function lockParlay(
        bytes32 parlayId,
        address user,
        uint256 stake,
        bytes32[] calldata matchIds,
        MarketType[] calldata markets,
        uint8[] calldata outcomes,
        uint8[] calldata lines,
        uint256[] calldata legOdds,
        bytes32[] calldata legBetIds
    ) external onlyAdmin whenNotPaused {
        if (stake == 0) revert ZeroAmount();
        if (parlays[parlayId].user != address(0)) revert ParlayIdAlreadyExists();

        uint256 numLegs = legBetIds.length;
        if (numLegs < MIN_PARLAY_LEGS || numLegs > MAX_PARLAY_LEGS) revert InvalidParlayLegs();
        require(
            matchIds.length == numLegs && markets.length == numLegs && outcomes.length == numLegs
                && lines.length == numLegs && legOdds.length == numLegs,
            "length mismatch"
        );

        // Validate each leg odds
        for (uint256 i = 0; i < numLegs; i++) {
            if (legOdds[i] < ODDS_PRECISION) revert InvalidOdds();
        }

        // Check market statuses and no duplicate matches
        for (uint256 i = 0; i < numLegs; i++) {
            bytes32 key = _marketKey(matchIds[i], markets[i], lines[i]);
            if (marketStatus[key] != MarketStatus.Open) revert MarketNotOpen();
            if (!SignalLib.isAccepting(signals[key], outcomes[i])) revert MarketRedLight();

            // Duplicate match check
            for (uint256 j = i + 1; j < numLegs; j++) {
                if (matchIds[i] == matchIds[j]) revert DuplicateMatchInParlay();
            }
        }

        uint256 available = userBalances[user] - lockedBalances[user];
        if (available < stake) revert InsufficientBalance();
        if (stake > GLOBAL_MAX_BET) revert GlobalMaxBetExceeded();

        // Calculate combined odds: product / ODDS_PRECISION^(n-1)
        uint256 combinedOdds = legOdds[0];
        for (uint256 i = 1; i < numLegs; i++) {
            combinedOdds = (combinedOdds * legOdds[i]) / ODDS_PRECISION;
        }

        uint256 maxPayout = (stake * combinedOdds) / ODDS_PRECISION;
        if (maxPayout > MAX_PARLAY_PAYOUT) revert ParlayPayoutExceeded();
        if (maxPayout > bettingPool - totalPotentialPayout - totalFrozenPayouts) revert InsufficientLiquidity();

        lockedBalances[user] += stake;

        // Create leg bets
        bytes32[] memory legBetIdsCopy = new bytes32[](numLegs);
        for (uint256 i = 0; i < numLegs; i++) {
            if (bets[legBetIds[i]].user != address(0)) revert BetIdAlreadyExists();
            bets[legBetIds[i]] = Bet({
                user: user,
                amount: 0,
                matchId: matchIds[i],
                market: markets[i],
                outcome: outcomes[i],
                line: lines[i],
                lockedOdds: legOdds[i],
                status: BetStatus.Pending,
                isCredit: false,
                collateralBetId: bytes32(0),
                isParlay: true,
                parlayId: parlayId
            });
            legBetIdsCopy[i] = legBetIds[i];
        }

        parlays[parlayId] = Parlay({
            user: user,
            stake: stake,
            legBetIds: legBetIdsCopy,
            combinedOdds: combinedOdds,
            maxPayout: maxPayout,
            status: BetStatus.Pending,
            settledLegs: 0,
            wonLegs: 0,
            cancelledLegs: 0
        });

        totalPotentialPayout += maxPayout;
        emit ParlayLocked(parlayId, user, stake, uint8(numLegs), combinedOdds, legBetIdsCopy);
    }

    /// @inheritdoc IBettingPool
    function unlockBet(bytes32 betId, bytes32[] calldata creditBetIds) external onlyAdmin {
        Bet storage bet = bets[betId];
        if (bet.user == address(0)) revert BetNotFound();
        require(!bet.isParlay, "use unlockParlay");
        if (bet.status != BetStatus.Pending) revert BetAlreadySettled();

        address user = bet.user;
        uint256 amount = bet.amount;
        uint256 lockedOdds = bet.lockedOdds;

        lockedBalances[user] -= amount;
        totalPotentialPayout -= (amount * lockedOdds) / ODDS_PRECISION;
        bet.status = BetStatus.Cancelled;

        // Handle associated credit bets
        for (uint256 i = 0; i < creditBetIds.length; i++) {
            bytes32 cid = creditBetIds[i];
            Bet storage cbet = bets[cid];
            require(cbet.collateralBetId == betId, "wrong collateral");
            if (cbet.status != BetStatus.Pending) continue;

            bettingPool += cbet.amount;
            totalCreditOutstanding -= cbet.amount;
            totalPotentialPayout -= (cbet.amount * cbet.lockedOdds) / ODDS_PRECISION;
            cbet.status = BetStatus.Cancelled;
            emit CreditBetSettled(cid, user, BetStatus.Cancelled, 0, 0);
            emit CreditCollateralCancelled(cid, betId, cbet.amount);
        }
        collateralUsed[betId] = 0;

        emit BetUnlocked(betId, user, amount);
    }

    /// @inheritdoc IBettingPool
    function unlockParlay(bytes32 parlayId) external onlyAdmin {
        Parlay storage parlay = parlays[parlayId];
        if (parlay.user == address(0)) revert BetNotFound();
        if (parlay.status != BetStatus.Pending) revert BetAlreadySettled();
        if (parlay.settledLegs != 0) revert ParlayPartiallySettled();

        address user = parlay.user;
        bytes32[] storage legIds = parlay.legBetIds;
        for (uint256 i = 0; i < legIds.length; i++) {
            bets[legIds[i]].status = BetStatus.Cancelled;
        }

        lockedBalances[user] -= parlay.stake;
        totalPotentialPayout -= parlay.maxPayout;
        parlay.status = BetStatus.Cancelled;
        emit ParlayUnlocked(parlayId, user, parlay.stake);
    }

    /// @inheritdoc IBettingPool
    function updateSignal(
        bytes32 matchId,
        MarketType market,
        uint8 line,
        uint256 heavyAmount,
        uint8 heavySide,
        SignalColor color
    ) external onlyAdmin {
        bytes32 key = _marketKey(matchId, market, line);
        signals[key] = MarketSignal({heavyAmount: heavyAmount, heavySide: heavySide, color: color});
        emit SignalUpdated(matchId, market, line, color);
    }

    /// @inheritdoc IBettingPool
    function isAccepting(
        bytes32 matchId,
        MarketType market,
        uint8 line,
        uint8 outcome
    ) external view returns (bool) {
        bytes32 key = _marketKey(matchId, market, line);
        return SignalLib.isAccepting(signals[key], outcome);
    }

    /// @inheritdoc IBettingPool
    function getParlayLegs(bytes32 parlayId) external view returns (bytes32[] memory) {
        return parlays[parlayId].legBetIds;
    }

    // ── 6.4 Settle ────────────────────────────────────────────────────────────

    /// @inheritdoc IBettingPool
    function settle(
        bytes32 matchId,
        MarketType market,
        uint8 line,
        uint8 winningOutcome,
        bytes32[] calldata betIds
    ) external onlyMultisig nonReentrant {
        // Validate winningOutcome range: X12 supports 0-2, AH/OU support 0-1
        if (market == MarketType.X12) {
            require(winningOutcome <= 2, "invalid outcome");
        } else {
            require(winningOutcome <= 1, "invalid outcome");
        }

        bytes32 key = _marketKey(matchId, market, line);
        MarketStatus mStatus = marketStatus[key];
        require(mStatus == MarketStatus.Closed || mStatus == MarketStatus.Settled, "not closed/settled");

        bool firstBatch = (marketOutcome[key] == 0);
        if (firstBatch) {
            marketOutcome[key] = winningOutcome + 1;
            marketStatus[key] = MarketStatus.Settled;
        } else {
            if (marketOutcome[key] != winningOutcome + 1) revert OutcomeInconsistent();
        }

        for (uint256 i = 0; i < betIds.length; i++) {
            bytes32 betId = betIds[i];
            Bet storage bet = bets[betId];
            if (bet.matchId != matchId || bet.market != market || bet.line != line) revert InvalidBetForMarket();
            if (bet.status != BetStatus.Pending) continue;

            if (bet.isParlay) {
                _settleParlayLeg(betId, bet.parlayId, winningOutcome);
            } else if (bet.isCredit) {
                _settleCreditBet(betId, winningOutcome);
            } else {
                _settleNormalBet(betId, winningOutcome);
            }
        }

        if (firstBatch) {
            emit MatchSettled(matchId, market, line, winningOutcome);
        }
    }

    function _settleNormalBet(bytes32 betId, uint8 winningOutcome) internal {
        Bet storage bet = bets[betId];
        address user = bet.user;
        uint256 amount = bet.amount;
        uint256 lockedOdds = bet.lockedOdds;
        uint256 potPayout = (amount * lockedOdds) / ODDS_PRECISION;

        if (bet.outcome == winningOutcome) {
            // Winner
            uint256 profit = potPayout - amount;
            userBalances[user] += profit;
            totalUserBalances += profit;
            lockedBalances[user] -= amount;
            bettingPool -= profit;
            totalPotentialPayout -= potPayout;
            bet.status = BetStatus.Won;
            emit BetSettled(betId, user, BetStatus.Won, potPayout);
        } else {
            // Loser
            userBalances[user] -= amount;
            totalUserBalances -= amount;
            lockedBalances[user] -= amount;
            uint256 lpShare = (amount * lpShareBps) / BPS_DENOMINATOR;
            bettingPool += lpShare;
            platformBalance += amount - lpShare;
            totalPotentialPayout -= potPayout;
            bet.status = BetStatus.Lost;
            emit BetSettled(betId, user, BetStatus.Lost, 0);
        }

        // Clean up collateral tracking if this bet was used as collateral
        if (collateralUsed[betId] > 0) {
            collateralUsed[betId] = 0;
        }
    }

    function _settleParlayLeg(bytes32 legBetId, bytes32 parlayId, uint8 winningOutcome) internal {
        Parlay storage parlay = parlays[parlayId];
        if (parlay.status != BetStatus.Pending) return;

        Bet storage bet = bets[legBetId];
        address user = parlay.user;
        bool legWon = (bet.outcome == winningOutcome);

        if (legWon) {
            bet.status = BetStatus.Won;
        } else {
            bet.status = BetStatus.Lost;
        }
        parlay.settledLegs += 1;

        if (!legWon) {
            // Parlay lost
            parlay.status = BetStatus.Lost;

            // Mark remaining Pending legs as Cancelled
            bytes32[] storage legIds = parlay.legBetIds;
            for (uint256 i = 0; i < legIds.length; i++) {
                if (bets[legIds[i]].status == BetStatus.Pending) {
                    bets[legIds[i]].status = BetStatus.Cancelled;
                }
            }

            uint256 stake = parlay.stake;
            userBalances[user] -= stake;
            totalUserBalances -= stake;
            lockedBalances[user] -= stake;
            uint256 lpShare = (stake * lpShareBps) / BPS_DENOMINATOR;
            bettingPool += lpShare;
            platformBalance += stake - lpShare;
            totalPotentialPayout -= parlay.maxPayout;

            emit BetSettled(legBetId, user, BetStatus.Lost, 0);
            emit ParlayLost(parlayId, user, stake);
        } else {
            // Leg won
            parlay.wonLegs += 1;
            emit BetSettled(legBetId, user, BetStatus.Won, 0);

            // Check if all legs resolved
            if (parlay.wonLegs + parlay.cancelledLegs == parlay.legBetIds.length) {
                _finalizeParlayWin(parlayId);
            }
        }
    }

    function _finalizeParlayWin(bytes32 parlayId) internal {
        Parlay storage parlay = parlays[parlayId];
        address user = parlay.user;
        uint256 stake = parlay.stake;
        uint256 payout = (stake * parlay.combinedOdds) / ODDS_PRECISION;
        uint256 profit = payout - stake;

        userBalances[user] += profit;
        totalUserBalances += profit;
        lockedBalances[user] -= stake;
        bettingPool -= profit;
        totalPotentialPayout -= parlay.maxPayout;
        parlay.status = BetStatus.Won;

        emit ParlayWon(parlayId, user, payout);
    }

    function _settleCreditBet(bytes32 betId, uint8 winningOutcome) internal {
        Bet storage bet = bets[betId];
        bytes32 collateralBetId = bet.collateralBetId;
        BetStatus collateralStatus = bets[collateralBetId].status;
        address user = bet.user;
        uint256 amount = bet.amount;
        uint256 lockedOdds = bet.lockedOdds;
        uint256 potPayout = (amount * lockedOdds) / ODDS_PRECISION;
        bool betWon = (bet.outcome == winningOutcome);

        totalPotentialPayout -= potPayout;
        totalCreditOutstanding -= amount;

        if (collateralStatus == BetStatus.Lost) {
            bet.status = BetStatus.Cancelled;
            if (betWon) {
                platformBalance += potPayout;
                bettingPool -= (potPayout - amount);
            } else {
                bettingPool += amount;
            }
            emit CreditBetForfeited(betId, collateralBetId, amount);
            emit CreditBetSettled(betId, user, BetStatus.Cancelled, 0, 0);
        } else if (collateralStatus == BetStatus.Won) {
            if (betWon) {
                uint256 deduction = amount;
                uint256 netToUser = potPayout - deduction;
                userBalances[user] += netToUser;
                totalUserBalances += netToUser;
                // bettingPool: -(potPayout - amount) + deduction = -(potPayout - 2*amount)
                if (potPayout >= 2 * amount) {
                    bettingPool -= (potPayout - 2 * amount);
                } else {
                    bettingPool += (2 * amount - potPayout);
                }
                bet.status = BetStatus.Won;
                emit CreditBetSettled(betId, user, BetStatus.Won, netToUser, deduction);
            } else {
                uint256 lpShare = (amount * lpShareBps) / BPS_DENOMINATOR;
                uint256 platShare = amount - lpShare;
                bettingPool += lpShare;
                platformBalance += platShare;
                bet.status = BetStatus.Lost;
                emit CreditBetSettled(betId, user, BetStatus.Lost, 0, 0);
            }
        } else if (collateralStatus == BetStatus.Pending) {
            if (betWon) {
                uint256 payout = potPayout;
                frozenPayouts[betId] = payout;
                totalFrozenPayouts += payout;
                bet.status = BetStatus.Won;
                emit CreditPayoutFrozen(betId, user, payout);
            } else {
                uint256 lpShare = (amount * lpShareBps) / BPS_DENOMINATOR;
                uint256 platShare = amount - lpShare;
                bettingPool += lpShare;
                platformBalance += platShare;
                bet.status = BetStatus.Lost;
                emit CreditBetSettled(betId, user, BetStatus.Lost, 0, 0);
            }
        } else {
            // collateral Cancelled: Pool bears risk — settle bet by normal rules
            if (betWon) {
                uint256 payout = potPayout;
                userBalances[user] += payout;
                totalUserBalances += payout;
                bettingPool -= (payout - amount);
                bet.status = BetStatus.Won;
                emit CreditBetSettled(betId, user, BetStatus.Won, payout, 0);
            } else {
                uint256 lpShare = (amount * lpShareBps) / BPS_DENOMINATOR;
                uint256 platShare = amount - lpShare;
                bettingPool += lpShare;
                platformBalance += platShare;
                bet.status = BetStatus.Lost;
                emit CreditBetSettled(betId, user, BetStatus.Lost, 0, 0);
            }
            emit CreditCollateralCancelled(betId, collateralBetId, amount);
        }
    }

    // ── 6.6 Release / Forfeiture ──────────────────────────────────────────────

    /// @inheritdoc IBettingPool
    function releaseOrForfeiture(bytes32 creditBetId) external onlyAdmin {
        uint256 frozen = frozenPayouts[creditBetId];
        if (frozen == 0) revert FrozenPayoutNotFound();

        Bet storage creditBet = bets[creditBetId];
        bytes32 collateralBetId = creditBet.collateralBetId;
        BetStatus collateralStatus = bets[collateralBetId].status;
        address user = creditBet.user;
        uint256 amount = creditBet.amount;

        totalFrozenPayouts -= frozen;
        delete frozenPayouts[creditBetId];

        if (collateralStatus == BetStatus.Won) {
            uint256 deduction = amount;
            uint256 netPayout = frozen - deduction;
            userBalances[user] += netPayout;
            totalUserBalances += netPayout;
            // bettingPool: -(frozen - amount) + amount = -(frozen - 2*amount)
            if (frozen >= 2 * amount) {
                bettingPool -= (frozen - 2 * amount);
            } else {
                bettingPool += (2 * amount - frozen);
            }
            emit CreditPayoutReleased(creditBetId, user, netPayout);
        } else if (collateralStatus == BetStatus.Lost) {
            platformBalance += frozen;
            bettingPool -= (frozen - amount);
            emit CreditPayoutForfeited(creditBetId, frozen);
        } else {
            // Cancelled
            userBalances[user] += frozen;
            totalUserBalances += frozen;
            bettingPool -= (frozen - amount);
            emit CreditPayoutReleased(creditBetId, user, frozen);
        }
    }

    // ── 6.7 Cancel Match ──────────────────────────────────────────────────────

    /// @inheritdoc IBettingPool
    function cancelMatch(
        bytes32 matchId,
        MarketType market,
        uint8 line,
        bytes32[] calldata betIds
    ) external onlyMultisig nonReentrant {
        bytes32 key = _marketKey(matchId, market, line);
        MarketStatus mStatus = marketStatus[key];
        require(
            mStatus == MarketStatus.Open || mStatus == MarketStatus.Closed || mStatus == MarketStatus.Cancelled,
            "invalid status"
        );

        if (mStatus != MarketStatus.Cancelled) {
            marketStatus[key] = MarketStatus.Cancelled;
        }

        for (uint256 i = 0; i < betIds.length; i++) {
            bytes32 betId = betIds[i];
            Bet storage bet = bets[betId];
            if (bet.matchId != matchId || bet.market != market || bet.line != line) revert InvalidBetForMarket();
            if (bet.status != BetStatus.Pending) continue;

            if (bet.isParlay) {
                _cancelParlayLeg(betId, bet.parlayId);
            } else if (bet.isCredit) {
                _cancelCreditBet(betId);
            } else {
                // Normal bet
                lockedBalances[bet.user] -= bet.amount;
                totalPotentialPayout -= (bet.amount * bet.lockedOdds) / ODDS_PRECISION;
                bet.status = BetStatus.Cancelled;
                // Clean up collateral tracking
                if (collateralUsed[betId] > 0) {
                    collateralUsed[betId] = 0;
                }
                emit BetSettled(betId, bet.user, BetStatus.Cancelled, 0);
            }
        }

        emit MatchCancelled(matchId, market, line);
    }

    function _cancelCreditBet(bytes32 betId) internal {
        Bet storage bet = bets[betId];
        uint256 amount = bet.amount;
        bytes32 collateralBetId = bet.collateralBetId;

        bettingPool += amount;
        totalCreditOutstanding -= amount;
        // Safe collateralUsed decrement
        if (collateralUsed[collateralBetId] >= amount) {
            collateralUsed[collateralBetId] -= amount;
        } else {
            collateralUsed[collateralBetId] = 0;
        }
        totalPotentialPayout -= (amount * bet.lockedOdds) / ODDS_PRECISION;
        bet.status = BetStatus.Cancelled;
        emit CreditBetSettled(betId, bet.user, BetStatus.Cancelled, 0, 0);
    }

    function _cancelParlayLeg(bytes32 legBetId, bytes32 parlayId) internal {
        Parlay storage parlay = parlays[parlayId];
        if (parlay.status != BetStatus.Pending) return;

        Bet storage bet = bets[legBetId];
        bet.status = BetStatus.Cancelled;
        parlay.cancelledLegs += 1;

        uint256 oldMaxPayout = parlay.maxPayout;
        uint256 remainingLegs = parlay.legBetIds.length - parlay.cancelledLegs;

        if (remainingLegs == 0) {
            // All legs cancelled — full refund
            lockedBalances[parlay.user] -= parlay.stake;
            totalPotentialPayout -= oldMaxPayout;
            parlay.status = BetStatus.Cancelled;
            emit ParlayUnlocked(parlayId, parlay.user, parlay.stake);
            return;
        }

        // Recalculate combined odds removing this leg
        uint256 newCombinedOdds = (parlay.combinedOdds * ODDS_PRECISION) / bet.lockedOdds;
        uint256 newMaxPayout;

        if (remainingLegs == 1) {
            // Degrade to single — find remaining non-cancelled leg
            bytes32 remainingBetId;
            bytes32[] storage legIds = parlay.legBetIds;
            for (uint256 i = 0; i < legIds.length; i++) {
                if (bets[legIds[i]].status != BetStatus.Cancelled) {
                    remainingBetId = legIds[i];
                    break;
                }
            }
            newCombinedOdds = bets[remainingBetId].lockedOdds;
            parlay.combinedOdds = newCombinedOdds;
            newMaxPayout = (parlay.stake * newCombinedOdds) / ODDS_PRECISION;
            parlay.maxPayout = newMaxPayout;
            // Update totalPotentialPayout
            totalPotentialPayout = totalPotentialPayout - oldMaxPayout + newMaxPayout;
            emit ParlayDegradedToSingle(parlayId, remainingBetId, newCombinedOdds);
        } else {
            parlay.combinedOdds = newCombinedOdds;
            newMaxPayout = (parlay.stake * newCombinedOdds) / ODDS_PRECISION;
            parlay.maxPayout = newMaxPayout;
            totalPotentialPayout = totalPotentialPayout - oldMaxPayout + newMaxPayout;
            emit ParlayLegCancelled(parlayId, legBetId, newCombinedOdds);
        }

        // Step 9: auto-settle check
        if (
            parlay.wonLegs + parlay.cancelledLegs == parlay.legBetIds.length && parlay.status == BetStatus.Pending
        ) {
            address user = parlay.user;
            uint256 stake = parlay.stake;
            uint256 payout = (stake * parlay.combinedOdds) / ODDS_PRECISION;
            uint256 profit = payout - stake;

            userBalances[user] += profit;
            totalUserBalances += profit;
            lockedBalances[user] -= stake;
            bettingPool -= profit;
            totalPotentialPayout -= newMaxPayout;
            parlay.status = BetStatus.Won;

            emit ParlayWon(parlayId, user, payout);
        }
    }

    /// @inheritdoc IBettingPool
    function batchCancelMatch(
        bytes32 matchId,
        MarketType[] calldata markets,
        uint8[] calldata lines,
        bytes32[][] calldata betIdsByMarket
    ) external onlyMultisig nonReentrant {
        require(markets.length == lines.length && markets.length == betIdsByMarket.length, "length mismatch");
        for (uint256 i = 0; i < markets.length; i++) {
            bytes32 key = _marketKey(matchId, markets[i], lines[i]);
            MarketStatus mStatus = marketStatus[key];
            require(
                mStatus == MarketStatus.Open || mStatus == MarketStatus.Closed || mStatus == MarketStatus.Cancelled,
                "invalid status"
            );
            if (mStatus != MarketStatus.Cancelled) {
                marketStatus[key] = MarketStatus.Cancelled;
            }

            bytes32[] calldata betIds = betIdsByMarket[i];
            for (uint256 j = 0; j < betIds.length; j++) {
                bytes32 betId = betIds[j];
                Bet storage bet = bets[betId];
                if (bet.matchId != matchId || bet.market != markets[i] || bet.line != lines[i]) {
                    revert InvalidBetForMarket();
                }
                if (bet.status != BetStatus.Pending) continue;

                if (bet.isParlay) {
                    _cancelParlayLeg(betId, bet.parlayId);
                } else if (bet.isCredit) {
                    _cancelCreditBet(betId);
                } else {
                    lockedBalances[bet.user] -= bet.amount;
                    totalPotentialPayout -= (bet.amount * bet.lockedOdds) / ODDS_PRECISION;
                    bet.status = BetStatus.Cancelled;
                    if (collateralUsed[betId] > 0) {
                        collateralUsed[betId] = 0;
                    }
                    emit BetSettled(betId, bet.user, BetStatus.Cancelled, 0);
                }
            }

            emit MatchCancelled(matchId, markets[i], lines[i]);
        }
    }

    // ── 6.8 LP Functions ──────────────────────────────────────────────────────

    /// @inheritdoc IBettingPool
    function addLiquidity(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_LP_DEPOSIT, "below min deposit");
        uint256 shares = LiquidityLib.calcShares(amount, totalLpShares, bettingPool);
        lpShares[msg.sender] += shares;
        totalLpShares += shares;
        bettingPool += amount;
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(msg.sender, amount, shares);
    }

    /// @inheritdoc IBettingPool
    function removeLiquidity(uint256 shares) external nonReentrant whenNotPaused {
        uint256 amount = LiquidityLib.calcAmount(shares, totalLpShares, bettingPool);
        uint256 availableLiquidity = bettingPool - totalPotentialPayout - totalFrozenPayouts;
        if (amount > availableLiquidity) revert InsufficientLiquidity();
        lpShares[msg.sender] -= shares;
        totalLpShares -= shares;
        bettingPool -= amount;
        usdt.safeTransfer(msg.sender, amount);
        emit LiquidityRemoved(msg.sender, amount, shares);
    }

    /// @inheritdoc IBettingPool
    function withdrawPlatform(address to, uint256 amount) external onlyMultisig nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        require(amount <= platformBalance, "exceeds platform balance");
        platformBalance -= amount;
        usdt.safeTransfer(to, amount);
        emit PlatformWithdrawn(to, amount);
    }

    /// @inheritdoc IBettingPool
    function setMaxMarketsPerMatch(uint256 max) external onlyMultisig {
        maxMarketsPerMatch = max;
        emit MaxMarketsPerMatchUpdated(max);
    }

    /// @inheritdoc IBettingPool
    function setRedLightThreshold(uint256 threshold) external onlyMultisig {
        uint256 old = redLightThreshold;
        redLightThreshold = threshold;
        emit RedLightThresholdUpdated(old, threshold);
    }

    /// @inheritdoc IBettingPool
    function setAdmin(address newAdmin) external onlyMultisig {
        if (newAdmin == address(0)) revert InvalidAddress();
        address old = admin;
        admin = newAdmin;
        emit AdminUpdated(old, newAdmin);
    }

    /// @inheritdoc IBettingPool
    function setLpShareBps(uint256 newBps) external onlyMultisig {
        if (newBps < 5000 || newBps > 9000) revert InvalidLpShareBps();
        uint256 old = lpShareBps;
        lpShareBps = newBps;
        emit LpShareBpsUpdated(old, newBps);
    }

    /// @inheritdoc IBettingPool
    function pause() external onlyMultisig {
        _pause();
    }

    /// @inheritdoc IBettingPool
    function unpause() external onlyMultisig {
        _unpause();
    }
}
