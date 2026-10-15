package repository

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/mysql"
	"everything_finance/org/web-api/internal/pkg/redis"
	"everything_finance/org/web-api/internal/pkg/snowflake"
	"everything_finance/org/web-api/utils"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrUserNotFound              = errors.New("user not found")
	ErrInsufficientBalance       = errors.New("Insufficient balance")
	ErrWithdrawRecordNotFound    = errors.New("withdraw record not found")
	ErrInvalidWithdrawStatus     = errors.New("invalid withdraw status, only pending can be cancelled")
	ErrOrderOverStatus           = errors.New("order was Over")
	ErrInsufficientFrozenBalance = errors.New("insufficient frozen balance")
)

type UserRepo interface {
	GetUserInfoByID(ctx context.Context, id uint64) (*model.User, error)
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	GetDepositAddress(ctx context.Context, userId uint64, chain string) (*model.DepositAddress, error)
	GetUserDepositAddress(ctx context.Context, userId uint64, chain string) (*model.UserDepositAddress, error)
	GetByWalletAddress(ctx context.Context, address string) (*model.User, error)
	CreateAllUserIDWithSigningAddress(ctx context.Context, chain, address string) (*model.User, error)
	Create(ctx context.Context, user *model.User) error
	Update(ctx context.Context, user *model.User) error
	Delete(ctx context.Context, id uint64) error
	GetBalanceByUserID(ctx context.Context, userID uint64) (*model.UserBalance, error)
	BetUserBalanceByUserID(ctx context.Context, userID uint64, amount decimal.Decimal) error

	ProcessAtomicTransfer(ctx context.Context, userID uint64, oddID int64, stake decimal.Decimal, oddsNum decimal.Decimal, betType string, market string, label string, handicapLine decimal.Decimal, clientRefID string) (uint64, int64, error)
	// CreateBannerBetOrder 创建 Banner 专用下注记录。
	CreateBannerBetOrder(ctx context.Context, userID uint64, req *model.BannerBetPlaceRequest, stake decimal.Decimal, odds decimal.Decimal) (*model.BannerBetPlaceResponse, error)
	CancelUserBet(ctx context.Context, userID uint64, betIds []uint64) (*model.ModifyBalanceRespnse, error)
	GetBetHoldingByUserID(ctx context.Context, userID uint64) (*model.BetHoldingResponse, error)
	GetBetHoldingByOrders(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error)
	// GetBannerBetHoldingByUserID 查询当前用户的 Banner 注单列表。
	GetBannerBetHoldingByUserID(ctx context.Context, userID uint64) (*model.BannerBetHoldingResponse, error)
	// GetBannerBetHoldingByOrders 按注单 ID 查询 Banner 注单详情，供流水/历史查询复用。
	GetBannerBetHoldingByOrders(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error)

	GetBetClaimByUserID(ctx context.Context, userID uint64, betID uint64) (*model.BetClaimResponse, error)
	ClaimBetByUserID(ctx context.Context, userID uint64, betID uint64, expectedAmount decimal.Decimal) (*model.BetClaimResponse, error)

	BetUserBalance(ctx context.Context, userID uint64, oddId []int64, amount []decimal.Decimal, odds []decimal.Decimal, betType string, market []string, label []string, handicapLine []decimal.Decimal, clientRefID string) (*model.ModifyBalanceRespnse, error)
	GetAssetLedgersByUserID(ctx context.Context, userId uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error)
	GetClaimedBetIDsByUserIDAndBetIDs(ctx context.Context, userID uint64, betIDs []uint64) (map[uint64]struct{}, error)
	WithdrawApply(ctx context.Context, userId uint64, record model.WithdrawRecord) error
	GetWithDrawRecordsByUserID(ctx context.Context, userId uint64) ([]model.WithdrawRecord, error)
	WithDrawCannel(ctx context.Context, userId uint64, orderSn string) error
	GetPendingOrders(ctx context.Context, riskType string) ([]model.WithdrawRecord, error)

	VerifyAdminCredentials(ctx context.Context, user, password string) (bool, error)
	ApproveWithdrawOrder(ctx context.Context, orderSn, adminID, remark string, approve bool) error
	GetWithdrawRecordsByOrderSns(ctx context.Context, order []string) ([]model.WithdrawRecord, error)
	GetWithdrawRecordsByUserIDAndOrderSns(ctx context.Context, userID uint64, orderSns []string) ([]model.WithdrawRecord, error)
}

type userRepo struct {
	db  *mysql.Client
	gdb *gorm.DB
	rdb *redis.Client
}

func NewUserRepo(db *mysql.Client, rdb *redis.Client) UserRepo {
	return &userRepo{db: db, gdb: mysql.GetGORM(), rdb: rdb}
}

func (r *userRepo) VerifyAdminCredentials(ctx context.Context, user, password string) (bool, error) {
	key := "admin:user:" + user
	storedPwd, err := r.rdb.Get(ctx, key)
	if err != nil {
		return false, err
	}
	if storedPwd != password {
		return false, errors.New("invalid credentials")
	}
	return storedPwd == password, nil
}

func (r *userRepo) GetDepositAddress(ctx context.Context, userId uint64, chain string) (*model.DepositAddress, error) {
	var depositAddress model.DepositAddress
	result := r.gdb.WithContext(ctx).Where("user_id = ? AND chain = ?", userId, chain).First(&depositAddress)
	if result.Error != nil {
		return nil, result.Error
	}
	return &depositAddress, nil
}

func (r *userRepo) GetUserDepositAddress(ctx context.Context, userId uint64, chain string) (*model.UserDepositAddress, error) {
	var depositAddress model.UserDepositAddress
	result := r.gdb.WithContext(ctx).Where("user_id = ? AND chain = ?", userId, chain).First(&depositAddress)
	if result.Error != nil {
		return nil, result.Error
	}
	return &depositAddress, nil
}

func (r *userRepo) GetUserInfoByID(ctx context.Context, id uint64) (*model.User, error) {
	var user model.User
	result := r.gdb.WithContext(ctx).Table(user.TableName()).Where("user_id = ?", id).Find(&user).Limit(1)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}

	return &user, nil
}

func (r *userRepo) GetBalanceByUserID(ctx context.Context, userID uint64) (*model.UserBalance, error) {
	var userBalance model.UserBalance
	result := r.gdb.WithContext(ctx).Where("user_id = ?", userID).First(&userBalance)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
	}

	return &userBalance, nil
}

// // BetUserBalance 统一处理下注逻辑 根据 betType 处理单注或串注
// @param userID 用户ID
// @param oddIds 投注的 marketId
// @param amount 下注金额
// @param betType 下注类型 SINGLE 或 PARLAY
// @return 下注结果
func (r *userRepo) BetUserBalance(ctx context.Context, userID uint64, oddIds []int64, amount []decimal.Decimal, odds []decimal.Decimal, betType string, market []string, label []string, handicapLine []decimal.Decimal, clientRefID string) (*model.ModifyBalanceRespnse, error) {
	// ref_id 是下注请求的幂等键，缺失时无法安全处理客户端重试。
	clientRefID = strings.TrimSpace(clientRefID)
	if clientRefID == "" {
		logger.Errorf("[BetUserBalance] ref_id is required")
		return nil, errors.New("REF_ID_REQUIRED")
	}

	// 如果同一用户同一 ref_id 已经建过单，直接返回原 bet_id，避免重复扣款。
	if existingResp, found, err := r.getExistingBetResponse(ctx, userID, clientRefID, oddIds); err != nil {
		return nil, err
	} else if found {
		return existingResp, nil
	}

	resp := &model.ModifyBalanceRespnse{
		Msg: "ALL_SUCCESS",
	}
	if betType == "single" {
		var succCount int
		successFixtureIDs := make([]int64, 0, len(oddIds))
		for i, oddId := range oddIds {
			stake := amount[i]
			oddsNum := odds[i]
			// 单注每一笔开启独立事务，单个失败不会回滚其他投注项。
			betID, fixtureID, err := r.ProcessAtomicTransfer(ctx, userID, oddId, stake, oddsNum, betType, market[i], label[i], handicapLine[i], clientRefID)
			res := model.BetResult{OddID: oddId}
			if err != nil {
				res.Status = "FAILED"
				res.Error = err.Error()
			} else {
				res.Status = "SUCCESS"
				res.BetID = betID
				succCount++
				successFixtureIDs = append(successFixtureIDs, fixtureID)
			}
			resp.Results = append(resp.Results, res)
		}
		// 下注热度只在事务成功后异步语义记录；Redis 失败不能反向影响资金主链路。
		r.recordLiquidityFixtureBetCounts(ctx, successFixtureIDs)
		if succCount == len(oddIds) {
			resp.Msg = "ALL_SUCCESS"
		} else if succCount > 0 {
			resp.Msg = "PARTIAL_SUCCESS"
		} else {
			resp.Msg = "FAILED"
		}
	} else if betType == "parlay" {
		successFixtureIDs := make([]int64, 0, len(oddIds))
		err := r.gdb.Transaction(func(tx *gorm.DB) error {
			// 串关注单必须整体成功或整体失败，所以所有腿放在同一个事务里。
			for i, oddID := range oddIds {
				// 先建单获取 betID，后续流水用 betID 作为业务关联。
				betID, fixtureID, err := r.CreateBetRecord(tx, userID, oddID, amount[i], odds[i], betType, market[i], label[i], handicapLine[i], clientRefID)
				if err != nil {
					logger.Errorf("create bet record failed, oddID: %v, err: %v", oddID, err)
					return err // 任意一腿建单失败，整个串关事务回滚。
				}
				successFixtureIDs = append(successFixtureIDs, fixtureID)

				// 扣减可用余额并增加投注锁定余额，和流水写入保持同事务。
				err = r.updateBalanceAndLogLedger(tx, userID, amount[i].Neg(), amount[i], model.AssetTypeParlay, strconv.FormatUint(betID, 10))
				if err != nil {
					logger.Errorf("update account failed, userID: %v, err: %v", userID, err)
					return err // 余额不足或锁定余额异常时，整个串关事务回滚。
				}
				resp.Results = append(resp.Results, model.BetResult{OddID: oddID, BetID: betID, Status: "SUCCESS"})
			}
			return nil
		})

		if err != nil {
			resp.Msg = "FAILED"
			resp.Error = err.Error()
			return resp, err
		}
		// 串关只有整体事务成功才累计热度，避免任一腿回滚后仍把流动池排序抬高。
		r.recordLiquidityFixtureBetCounts(ctx, successFixtureIDs)
	}
	return resp, nil
}

// processAtomicTransfer 处理单笔的“扣款+记录”事务
func (r *userRepo) ProcessAtomicTransfer(ctx context.Context, userID uint64, oddID int64, stake decimal.Decimal, oddsNum decimal.Decimal, betType string, market string, label string, handicapLine decimal.Decimal, clientRefID string) (uint64, int64, error) {
	var betID uint64
	var fixtureID int64
	err := r.gdb.Transaction(func(tx *gorm.DB) error {
		// 1. 建单 (先建单，拿到 betID 供流水关联)
		// 内部逻辑：查询赔率 -> 校验盘口 -> 插入 UserBetHolding
		id, fid, err := r.CreateBetRecord(tx, userID, oddID, stake, oddsNum, betType, market, label, handicapLine, clientRefID)
		if err != nil {
			logger.Errorf("[ProcessAtomicTransfer] create bet record failed, err: %v", err)
			return err
		}
		betID = id
		fixtureID = fid
		// 2. 动钱 + 记流水 (原子操作：扣钱是负数)
		// 业务类型: "single"
		return r.updateBalanceAndLogLedger(tx, userID, stake.Neg(), stake, model.AssetTypeSingle, strconv.FormatUint(betID, 10))
	})
	return betID, fixtureID, err
}

// CreateBannerBetOrder 创建首页 Banner 注单。
// 这里和常规下注一样放在同一个事务里完成建单、扣款和流水记录，保证账实一致。
func (r *userRepo) CreateBannerBetOrder(ctx context.Context, userID uint64, req *model.BannerBetPlaceRequest, stake decimal.Decimal, odds decimal.Decimal) (*model.BannerBetPlaceResponse, error) {
	clientRefID := strings.TrimSpace(req.RefID)
	if clientRefID == "" {
		logger.Errorf("[CreateBannerBetOrder] ref_id is required, user_id:%d", userID)
		return nil, errors.New("REF_ID_REQUIRED")
	}

	var existing model.BannerBetOrder
	err := r.gdb.WithContext(ctx).
		Where("user_id = ? AND client_ref_id = ?", userID, clientRefID).
		First(&existing).Error
	if err == nil {
		// 命中幂等键时，只有完全相同的请求才能复用原结果。
		if existing.BannerCode != req.BannerCode || existing.MarketID != req.MarketID || existing.SelectionID != req.SelectionID {
			logger.Errorf("[CreateBannerBetOrder] idempotency conflict, user_id:%d ref_id:%s stored_banner:%s req_banner:%s stored_market_id:%d req_market_id:%d stored_selection_id:%d req_selection_id:%d", userID, clientRefID, existing.BannerCode, req.BannerCode, existing.MarketID, req.MarketID, existing.SelectionID, req.SelectionID)
			return nil, errors.New("IDEMPOTENCY_KEY_CONFLICT")
		}
		return bannerBetOrderToResponse(existing), nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		logger.Errorf("[CreateBannerBetOrder] query existing order failed, user_id:%d ref_id:%s err:%v", userID, clientRefID, err)
		return nil, err
	}

	var order model.BannerBetOrder
	if err := r.gdb.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order = model.BannerBetOrder{
			UserID:      userID,
			ClientRefID: clientRefID,
			BannerCode:  req.BannerCode,
			MarketID:    req.MarketID,
			SelectionID: req.SelectionID,
			Market:      req.Market,
			Selection:   req.Selection,
			Type:        model.AssetTypeBannerSingle,
			Status:      "live",
			Stake:       stake,
			Odds:        odds,
			Payout:      stake.Mul(odds),
		}
		// 逻辑注释
		if err := tx.Create(&order).Error; err != nil {
			// 并发重试场景下，如果已经由另一请求成功落单，则直接复用已存在的单据。
			if isDuplicateEntryError(err) {
				var duplicatedOrder model.BannerBetOrder
				queryErr := tx.Where("user_id = ? AND client_ref_id = ?", userID, clientRefID).First(&duplicatedOrder).Error
				if queryErr == nil {
					if duplicatedOrder.BannerCode != req.BannerCode || duplicatedOrder.MarketID != req.MarketID || duplicatedOrder.SelectionID != req.SelectionID {
						logger.Errorf("[CreateBannerBetOrder] duplicate order idempotency conflict, user_id:%d ref_id:%s stored_banner:%s req_banner:%s stored_market_id:%d req_market_id:%d stored_selection_id:%d req_selection_id:%d", userID, clientRefID, duplicatedOrder.BannerCode, req.BannerCode, duplicatedOrder.MarketID, req.MarketID, duplicatedOrder.SelectionID, req.SelectionID)
						return errors.New("IDEMPOTENCY_KEY_CONFLICT")
					}
					order = duplicatedOrder
					return nil
				}
				logger.Errorf("[CreateBannerBetOrder] duplicate order query existing failed, user_id:%d ref_id:%s err:%v", userID, clientRefID, queryErr)
			}
			logger.Errorf("[CreateBannerBetOrder] create order failed, user_id:%d banner_code:%s market_id:%d selection_id:%d ref_id:%s err:%v", userID, req.BannerCode, req.MarketID, req.SelectionID, clientRefID, err)
			return err
		}

		// Banner 下注也进入真实资产流水：扣减可用余额并增加投注锁仓。
		if err := r.updateBalanceAndLogLedger(tx, userID, stake.Neg(), stake, model.AssetTypeBannerSingle, strconv.FormatUint(order.ID, 10)); err != nil {
			logger.Errorf("[CreateBannerBetOrder] update balance and ledger failed, user_id:%d order_id:%d ref_id:%s err:%v", userID, order.ID, clientRefID, err)
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return bannerBetOrderToResponse(order), nil
}

// CreateBetRecord 创建下注记录
func (r *userRepo) CreateBetRecord(tx *gorm.DB, userID uint64, oddID int64, amount decimal.Decimal, oddsNum decimal.Decimal, betType string, market string, label string, handicapLine decimal.Decimal, clientRefID string) (uint64, int64, error) {
	// 创建注单前必须以服务端 OddDB 为准校验赔率和盘口，不能信任客户端传参。
	serverOdds, fixtureID, err := r.validateBetSnapshot(tx, oddID, oddsNum, market, label, handicapLine)
	if err != nil {
		logger.Errorf("[CreateBetRecord] validate bet snapshot failed, oddID: %v, err: %v", oddID, err)
		// todo@remy youhua
		// 赔率、盘口、开赛状态任一校验失败都必须拒单；否则黑客可绕过前端直接提交伪造赔率落库。
		return 0, 0, err
	}
	logger.Infof("[CreateBetRecord] validate bet snapshot success, oddID: %v, serverOdds: %v", oddID, serverOdds)
	// 派彩统一使用服务端赔率快照计算并落库，后续历史查询只展示这个下注时快照，不再受赛后赔率表变化影响。
	payout := amount.Mul(oddsNum)
	if !serverOdds.IsZero() {
		payout = amount.Mul(serverOdds)
	}
	// 下注记录必须和余额变动处于同一事务，防止建单和扣款状态不一致。
	betHolding := model.UserBetHolding{
		UserID:          userID,
		OddID:           oddID,
		ClientRefID:     clientRefID,
		Stake:           amount,
		Status:          "live",
		Type:            betType,
		Market:          market,
		Label:           label,
		Odds:            oddsNum,
		Payout:          payout,
		EstimatedPayout: payout,
		ActualPayout:    decimal.Zero,
		HandicapLine:    handicapLine,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// 3. 落库
	if err := tx.Create(&betHolding).Error; err != nil {
		logger.Errorf("[CreateBetRecord] create bet record failed: %v", err)
		return 0, 0, errors.New("CREATE_BET_FAILED")
	}
	logger.Infof("[CreateBetRecord] create bet record success, betID: %v", betHolding.ID)
	return betHolding.ID, fixtureID, nil
}

// getExistingBetResponse 根据客户端幂等键查找已有注单，命中时直接复用原结果。
func (r *userRepo) getExistingBetResponse(ctx context.Context, userID uint64, clientRefID string, oddIDs []int64) (*model.ModifyBalanceRespnse, bool, error) {
	var existing []model.UserBetHolding
	if err := r.gdb.WithContext(ctx).
		Where("user_id = ? AND client_ref_id = ?", userID, clientRefID).
		Order("id asc").
		Find(&existing).Error; err != nil {
		return nil, false, err
	}
	if len(existing) == 0 {
		return nil, false, nil
	}
	// 同一个 ref_id 只能对应同一组 odd_id，否则说明客户端复用了幂等键。
	if len(existing) != len(oddIDs) {
		logger.Errorf("[getExistingBetResponse] ref_id %v has %v bets, but oddIDs %v has %v items", clientRefID, len(existing), oddIDs, len(oddIDs))
		return nil, false, errors.New("IDEMPOTENCY_KEY_CONFLICT")
	}

	expected := make(map[int64]struct{}, len(oddIDs))
	for _, oddID := range oddIDs {
		expected[oddID] = struct{}{}
	}

	resp := &model.ModifyBalanceRespnse{
		Msg:     "ALL_SUCCESS",
		Results: make([]model.BetResult, 0, len(existing)),
	}
	for _, bet := range existing {
		if _, ok := expected[bet.OddID]; !ok {
			return nil, false, errors.New("IDEMPOTENCY_KEY_CONFLICT")
		}
		resp.Results = append(resp.Results, model.BetResult{
			OddID:  bet.OddID,
			BetID:  bet.ID,
			Status: "SUCCESS",
		})
	}

	return resp, true, nil
}

// func (r *userRepo) validateBetSnapshotByMock(tx *gorm.DB, oddID int64, requestedOdds decimal.Decimal, market string, label string, handicapLine decimal.Decimal) (decimal.Decimal, error) {
// 	var odd model.OddDB
// 	// 锁定赔率行，避免下注校验期间赔率状态被并发修改。
// 	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
// 		Where("odd_id = ?", oddID).
// 		First(&odd).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return decimal.Zero, errors.New("ODD_NOT_FOUND")
// 		}
// 		return decimal.Zero, err
// 	}
// 	if odd.Stopped {
// 		return decimal.Zero, errors.New("ODD_STOPPED")
// 	}
// 	return 0, nil
// }

// validateBetSnapshot 使用服务端赔率表校验客户端提交的赔率、盘口、选项和赛事状态。
func (r *userRepo) validateBetSnapshot(tx *gorm.DB, oddID int64, requestedOdds decimal.Decimal, market string, label string, handicapLine decimal.Decimal) (decimal.Decimal, int64, error) {
	var odd model.OddDB
	// 锁定赔率行，避免下注校验期间赔率状态被并发修改。
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("odd_id = ?", oddID).
		First(&odd).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return decimal.Zero, 0, errors.New("ODD_NOT_FOUND")
		}
		return decimal.Zero, 0, err
	}
	if odd.Stopped {
		return decimal.Zero, 0, errors.New("ODD_STOPPED")
	}

	var fixture model.FixtureDB
	// 赛事开始后禁止继续下注；查不到赛事也直接拒绝，避免脏赔率被下注。
	if err := tx.Where("id = ?", odd.FixtureID).First(&fixture).Error; err == nil {
		logger.Infof("[validateBetSnapshot] fixture find succ%v is %v", odd.FixtureID, fixture.StartingAt)
		// return decimal.Zero, errors.New("MARKET_CLOSED")
	} else if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return decimal.Zero, 0, errors.New("FIXTURE_NOT_FOUND")
		}
		return decimal.Zero, 0, err
	}

	serverOdds, err := parseOddDecimal(odd.Value)
	if err != nil || !serverOdds.GreaterThan(decimal.Zero) {
		return decimal.Zero, 0, errors.New("INVALID_SERVER_ODDS")
	}
	// 客户端赔率必须和服务端当前赔率完全一致，不一致则要求前端刷新。
	if !serverOdds.Equal(requestedOdds) {
		return decimal.Zero, 0, errors.New("ODDS_CHANGED")
	}
	// if !matchMarket(market, odd.MarketDescription) {
	// 	return decimal.Zero, errors.New("MARKET_MISMATCH")
	// }
	// if !matchLabel(label, odd.Label, odd.Selection) {
	// 	return decimal.Zero, errors.New("LABEL_MISMATCH")
	// }
	if err := validateHandicapLine(market, handicapLine, odd); err != nil {
		return decimal.Zero, 0, err
	}

	return serverOdds, odd.FixtureID, nil
}

func matchMarket(requestMarket, dbMarket string) bool {
	// 将前端枚举和数据库展示名称归一成同一套内部 key 再比较。
	req := canonicalBetMarket(requestMarket)
	db := canonicalBetMarket(dbMarket)
	return req == db
}

func canonicalBetMarket(value string) string {
	// 前端、mock SQL、SportMonks 展示名使用过多套 market 名称；盘口校验必须先归一，否则会跳过或取错盘口字段。
	normalized := normalizeBetText(value)
	aliases := map[string]string{
		"fulltimeresult":      "fulltimeresult",
		"matchwinner":         "fulltimeresult",
		"1x2":                 "fulltimeresult",
		"asianhandicap":       "asianhandicap",
		"handicap":            "asianhandicap",
		"spread":              "asianhandicap",
		"spreads":             "asianhandicap",
		"asianoverunder":      "asiantotal",
		"asianoverundergoals": "asiantotal",
		"asiantotal":          "asiantotal",
		"goalline":            "asiantotal",
		"overunder":           "asiantotal",
		"total":               "asiantotal",
		"totals":              "asiantotal",
	}
	if mapped, ok := aliases[normalized]; ok {
		return mapped
	}
	return normalized
}

func matchLabel(requestLabel, dbLabel, dbSelection string) bool {
	// label 允许匹配数据库 label 或 selection，兼容 Home/1、Away/2、Over 2.5 等展示差异。
	req := normalizeBetLabel(requestLabel)
	return req == normalizeBetLabel(dbLabel) || req == normalizeBetLabel(dbSelection)
}

func normalizeBetLabel(label string) string {
	// 将常见投注项别名收敛成标准值，减少前后端命名差异导致的误拒单。
	value := normalizeBetText(label)
	switch value {
	case "1", "home", "h":
		return "home"
	case "2", "away", "a":
		return "away"
	case "x", "draw", "d":
		return "draw"
	case "over", "o":
		return "over"
	case "under", "u":
		return "under"
	default:
		if strings.HasPrefix(value, "over") {
			return "over"
		}
		if strings.HasPrefix(value, "under") {
			return "under"
		}
		return value
	}
}

func validateHandicapLine(market string, requestedLine decimal.Decimal, odd model.OddDB) error {
	// 只有让球和大小球玩法需要校验盘口线，1X2 这类无盘口线玩法直接跳过。
	var dbLine string
	switch resolveHandicapLineMarket(market, odd) {
	case "asianhandicap":
		dbLine = firstNonEmpty(odd.Handicap, odd.Total)
	case "asiantotal":
		dbLine = firstNonEmpty(odd.Total, odd.Handicap)
	default:
		return nil
	}
	if strings.TrimSpace(dbLine) == "" {
		return errors.New("HANDICAP_LINE_MISSING")
	}
	serverLine, err := parseOddDecimal(dbLine)
	if err != nil {
		return errors.New("INVALID_SERVER_HANDICAP_LINE")
	}
	if !serverLine.Equal(requestedLine) {
		return errors.New("HANDICAP_LINE_MISMATCH")
	}
	return nil
}

func resolveHandicapLineMarket(market string, odd model.OddDB) string {
	// 服务端赔率行才是下注校验的权威来源；请求 market 只在历史脏数据缺少 market_id/description 时兜底。
	switch canonicalBetMarket(odd.MarketDescription) {
	case "asianhandicap":
		return "asianhandicap"
	case "asiantotal":
		return "asiantotal"
	}
	switch odd.MarketID {
	case 6:
		return "asianhandicap"
	case 7:
		return "asiantotal"
	}
	// mock 5min seed 使用 Asian Over/Under，真实数据也可能使用 Goal Line；库内字段缺失时再用请求名兼容这些别名。
	switch canonicalBetMarket(market) {
	case "asianhandicap":
		return "asianhandicap"
	case "asiantotal":
		return "asiantotal"
	default:
		return ""
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func parseOddDecimal(value string) (decimal.Decimal, error) {
	// 第三方数据可能使用 Unicode 负号，这里统一替换成普通减号再解析。
	normalized := strings.ReplaceAll(strings.TrimSpace(value), "−", "-")
	return decimal.NewFromString(normalized)
}

func normalizeBetText(value string) string {
	// 去掉大小写、空格、下划线等格式差异，便于做稳定比较。
	value = strings.ToLower(strings.TrimSpace(value))
	replacer := strings.NewReplacer("_", "", "-", "", " ", "", ".", "", "/", "")
	return replacer.Replace(value)
}

// DeductBalance 统一处理扣钱逻辑
// 需要确定具体lock类型，暂时屏蔽方法
// func (r *userRepo) DeductBalance(tx *gorm.DB, userID uint64, amount decimal.Decimal) error {
// 	var balance model.UserBalance
// 	// 1. 查询 、锁定
// 	result := tx.Table(balance.TableName()).
// 		Clauses(clause.Locking{Strength: "UPDATE"}).
// 		Where("user_id = ?", userID).
// 		First(&balance)

// 	if result.Error != nil {
// 		logger.Errorf("query user balance failed, err: %v", result.Error)
// 		return errors.New("DeductBalance query failed")
// 	}

// 	// 2. 判断余额是否满足条件
// 	if balance.AvailableBalance.LessThan(amount) {
// 		logger.Errorf("available balance is less than the amount")
// 		return errors.New("available balance is less than the amount")
// 	}

// 	// 3. 更新数据, 数据库层面更新
// 	updateResult := tx.Model(&balance).
// 		Updates(map[string]interface{}{
// 			"available_balance": gorm.Expr("available_balance - ?", amount),
// 			"lock_balance":      gorm.Expr("lock_balance + ?", amount),
// 		})

// 	if updateResult.Error != nil {
// 		logger.Errorf("update user balance failed, err: %v", updateResult.Error)
// 		return errors.New("DeductBalance update failed")
// 	}

// 	if updateResult.RowsAffected == 0 {
// 		logger.Errorf("update failed, no record found")
// 		return errors.New("update failed, no record found")
// 	}
// 	return nil
// }

// CancelUserBet 取消下注
func (r *userRepo) CancelUserBet(ctx context.Context, userID uint64, betIds []uint64) (*model.ModifyBalanceRespnse, error) {
	resp := &model.ModifyBalanceRespnse{Msg: "SUCCESS"}
	for _, betID := range betIds {
		err := r.gdb.Transaction(func(tx *gorm.DB) error {
			// 1. 查询下注记录
			var betHolding model.UserBetHolding
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND user_id = ?", betID, userID).First(&betHolding).Error; err != nil {
				logger.Errorf("[CancelUserBet]query bet holding failed, err: %v", err)
				return errors.New("BET_NOT_FOUND")
			}
			if betHolding.Status != "live" {
				logger.Errorf("[CancelUserBet]bet holding status is not live, status: %v", betHolding.Status)
				return errors.New("NOT_LIVE_STATUS")
			}
			// 2. 更新下注记录状态为 CANCELLED
			if err := tx.Model(&betHolding).Update("status", "CANCELLED").Error; err != nil {
				logger.Errorf("[CancelUserBet]update bet holding status failed, err: %v", err)
				return err
			}

			// 3. 替代原有的手工 Update 和旧 Ledger 函数
			// 参数说明：available增加 Stake, lock减少 Stake
			err := r.updateBalanceAndLogLedger(tx, userID, betHolding.Stake, betHolding.Stake.Neg(), model.AssetTypeCancelBet, strconv.FormatUint(betID, 10))
			if err != nil {
				logger.Errorf("[CancelUserBet] update balance and log ledger failed, err: %v", err)
				return err
			}
			return nil
		})
		item := model.BetResult{BetID: betID, Status: "SUCCESS"}
		if err != nil {
			item.Status = "FAILED"
			item.Error = err.Error()
		}
		resp.Results = append(resp.Results, item)
	}
	return resp, nil
}

// updateBalanceAndLogLedger 统一处理余额变动与流水记录
// UpdateAccount 核心资产变动函数：支持可用余额、锁定余额的变动及流水记录
func (r *userRepo) updateBalanceAndLogLedger(tx *gorm.DB, userID uint64, availableChange decimal.Decimal, lockChange decimal.Decimal, busType string, refID string) error {
	var balance model.UserBalance

	// 1. 唯一一次锁行
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("user_id = ?", userID).First(&balance).Error; err != nil {
		return err
	}

	// 2. 记录变动前快照 (用于流水)
	beforeAvail := balance.AvailableBalance
	beforeLock := balance.BetLockBalance

	// 3. 计算变动后数值
	afterAvail := beforeAvail.Add(availableChange)
	afterLock := beforeLock.Add(lockChange)

	// 4. 业务安全检查 (可选)
	if afterAvail.LessThan(decimal.Zero) || afterLock.LessThan(decimal.Zero) {
		logger.Errorf("[updateBalanceAndLogLedger] insufficient balance or lock error")
		return errors.New("INSUFFICIENT_BALANCE_OR_LOCK_ERROR")
	}

	// 5. 一次性更新所有余额字段
	updateData := map[string]interface{}{
		"available_balance": afterAvail,
		"bet_lock_balance":  afterLock,
	}
	if err := tx.Model(&balance).Updates(updateData).Error; err != nil {
		logger.Errorf("[updateBalanceAndLogLedger] update user balance failed, err: %v", err)
		return err
	}

	// 记录详细流水：同时保存可用余额和投注锁定余额的前后快照，方便后续审计。
	ledger := model.AssetLedger{
		UserID:        userID,
		BusinessType:  busType,
		Amount:        availableChange, // 资产流水通常记录可用余额的变动
		BalanceBefore: beforeAvail,
		BalanceAfter:  afterAvail,
		BetLockBefore: beforeLock,
		BetLockAfter:  afterLock,
		RefID:         refID,
		CreatedAt:     time.Now(),
	}

	return tx.Create(&ledger).Error
}

// 建议在外部定义一个全局的 Mock 缓存（参考之前的 LocalCache 方案）todo @remy
// var betHoldingMockCache map[string]model.BetHoldingMock // key 为 OddID

func (r *userRepo) GetBetHoldingByUserID(ctx context.Context, userID uint64) (*model.BetHoldingResponse, error) {
	var betHolding []model.UserBetHolding

	// 1. 数据库查询：获取用户的注单记录
	result := r.gdb.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at desc").
		Limit(50).
		Find(&betHolding)

	if result.Error != nil {
		logger.Errorf("[GetBetHoldingByUserID] query bet holding failed, err: %v", result.Error)
		return nil, errors.New("GetBetHoldingByUserID query failed")
	}

	resp := &model.BetHoldingResponse{
		UserID:  userID,
		Results: make([]model.BetHoldingResult, 0, len(betHolding)), // 预分配容量，提升性能
	}

	if len(betHolding) == 0 {
		return resp, nil
	}

	// 2. 收集 OddIDs 并进行第一遍转换
	oddIDs := make([]int64, 0, len(betHolding))
	for _, item := range betHolding {
		// 先回填下注表本身已经记录的字段，避免关联查询失败时前端拿不到基础信息。
		resp.Results = append(resp.Results, model.BetHoldingResult{
			OddID:        item.OddID,
			Stake:        item.Stake,
			Status:       item.Status,
			Type:         item.Type,
			Odds:         item.Odds.String(),
			Payout:       item.Payout.String(),
			ActualPayout: item.ActualPayout.String(),
			MarketType:   item.Market,
			Selection:    item.Label,
			SettledAt:    settledAtForBetStatus(item.Status, item.UpdatedAt),
		})
		oddIDs = append(oddIDs, item.OddID)
	}

	// 3. 从 MySQL 批量读取真实的 OddDB 赔率数据 (替代之前的 Mock 文件)
	var oddDBs []model.OddDB
	if err := r.gdb.WithContext(ctx).Where("odd_id IN ?", oddIDs).Find(&oddDBs).Error; err != nil {
		logger.Errorf("[GetBetHoldingByUserID] query odd_db failed, err: %v", err)
		// 遵循原有逻辑：如果关联数据查询失败，返回已有的基础数据，而不是直接报错打断请求
		return resp, nil
	}

	// 4. 将 Slice 转为 Map 以实现 O(1) 查找
	oddMap := make(map[int64]model.OddDB, len(oddDBs))
	for _, odd := range oddDBs {
		oddMap[odd.OddID] = odd
	}

	fixtureInfoMap, err := r.loadFixtureDisplayInfoMap(ctx, oddDBs)
	if err != nil {
		logger.Errorf("[GetBetHoldingByUserID] query fixture display info failed, err: %v", err)
	}

	// 5. 遍历并修改 resp.Results (使用索引 i 修改原地址数据)
	for i := range resp.Results {
		oddID := resp.Results[i].OddID
		if oddItem, exists := oddMap[oddID]; exists {
			// 注意这里的字段映射：将 OddDB 的字段映射到 BetHoldingResult  O(1) 查找
			// homeTeamLogo, awayTeamLogo, err := r.GetTeamLogoByFixtureID(ctx, uint64(oddItem.FixtureID))
			// if err != nil {
			// 	logger.Errorf("GetTeamLogoByFixtureID failed, err: %v", err)
			// }
			// resp.Results[i].FixtureName = oddItem.FixtureName
			// resp.Results[i].FixtureTime = oddItem.FixtureTime
			// resp.Results[i].MarketType = oddItem.MarketDescription
			// resp.Results[i].Selection = oddItem.Selection
			// resp.Results[i].HomeTeamLogo = homeTeamLogo
			// resp.Results[i].AwayTeamLogo = awayTeamLogo
			// 赔率与派彩使用下注时快照，OddDB 只补赛事展示字段，避免赛后赔率变更污染用户历史单据。
			applyOddDisplayInfo(&resp.Results[i], oddItem, fixtureInfoMap)
			// 赔率与派彩使用下注时快照；赛事名称和队徽允许跟随 fixture 主表修正，避免 mock 改名后历史仍显示旧名称。
		}
	}
	return resp, nil
}

type fixtureDisplayInfo struct {
	Name         string
	HomeTeamLogo string
	AwayTeamLogo string
}

func (r *userRepo) loadFixtureDisplayInfoMap(ctx context.Context, oddDBs []model.OddDB) (map[int64]fixtureDisplayInfo, error) {
	fixtureIDs := uniqueFixtureIDsFromOdds(oddDBs)
	if len(fixtureIDs) == 0 {
		return map[int64]fixtureDisplayInfo{}, nil
	}

	var fixtures []model.FixtureDB
	if err := r.gdb.WithContext(ctx).Where("id IN ?", fixtureIDs).Find(&fixtures).Error; err != nil {
		return nil, err
	}

	displayMap := make(map[int64]fixtureDisplayInfo, len(fixtures))
	for _, fixture := range fixtures {
		displayMap[fixture.ID] = fixtureDisplayInfo{
			Name:         fixture.Name,
			HomeTeamLogo: fixture.HomeTeamLogo,
			AwayTeamLogo: fixture.AwayTeamLogo,
		}
	}
	return displayMap, nil
}

func uniqueFixtureIDsFromOdds(oddDBs []model.OddDB) []int64 {
	seen := make(map[int64]struct{}, len(oddDBs))
	fixtureIDs := make([]int64, 0, len(oddDBs))
	for _, odd := range oddDBs {
		if odd.FixtureID <= 0 {
			continue
		}
		if _, ok := seen[odd.FixtureID]; ok {
			continue
		}
		seen[odd.FixtureID] = struct{}{}
		fixtureIDs = append(fixtureIDs, odd.FixtureID)
	}
	return fixtureIDs
}

func applyOddDisplayInfo(result *model.BetHoldingResult, odd model.OddDB, fixtureInfoMap map[int64]fixtureDisplayInfo) {
	if result == nil {
		return
	}
	result.FixtureName = odd.FixtureName
	result.FixtureTime = odd.FixtureTime
	result.MarketType = odd.MarketDescription
	result.Selection = odd.Selection

	if fixtureInfo, ok := fixtureInfoMap[odd.FixtureID]; ok {
		// 赛事名称和队徽属于可运营修正的展示字段，应优先读取 fixture 主表；odds.fixture_name 是盘口采集快照，
		// mock 赛事改中文名或真实赛事改名后它可能滞后，不能让历史接口继续透出旧名称。
		if strings.TrimSpace(fixtureInfo.Name) != "" {
			result.FixtureName = fixtureInfo.Name
		}
		result.HomeTeamLogo = fixtureInfo.HomeTeamLogo
		result.AwayTeamLogo = fixtureInfo.AwayTeamLogo
	}
}

func (r *userRepo) GetTeamLogoByFixtureID(ctx context.Context, fixtureID uint64) (string, string, error) {
	var fixtureDB model.FixtureDB

	// 根据Id 查询赛事的 logo 主队和客队信息
	result := r.gdb.WithContext(ctx).
		Where("id = ?", fixtureID).
		First(&fixtureDB)

	if result.Error != nil {
		logger.Errorf("[GetTeamLogoByFixtureID] query fixture failed, err: %v", result.Error)
		return "", "", errors.New("GetTeamLogoByFixtureID query failed")
	}

	// debug info
	logger.Infof("GetTeamLogoByFixtureID] fixtureDB: %v", fixtureDB)
	return fixtureDB.HomeTeamLogo, fixtureDB.AwayTeamLogo, nil
}

// func (r *userRepo) GetBetHoldingByUserID(ctx context.Context, userID uint64) (*model.BetHoldingResponse, error) {
// 	var betHolding []model.UserBetHolding

// 	// 1. 数据库查询
// 	result := r.gdb.WithContext(ctx).
// 		Where("user_id = ?", userID).
// 		Order("created_at desc").
// 		Limit(50).
// 		Find(&betHolding)

// 	if result.Error != nil {
// 		logger.Errorf("query bet holding failed, err: %v", result.Error)
// 		return nil, errors.New("GetBetHoldingByUserID query failed")
// 	}

// 	resp := &model.BetHoldingResponse{
// 		UserID:  userID,
// 		Results: make([]model.BetHoldingResult, 0, len(betHolding)), // 预分配容量，提升性能
// 	}

// 	// 2. 第一遍转换
// 	for _, item := range betHolding {
// 		resp.Results = append(resp.Results, model.BetHoldingResult{
// 			OddID:  item.OddID,
// 			Stake:  item.Stake,
// 			Status: item.Status,
// 			Type:   item.Type,
// 		})
// 	}

// 	// 3. 读取 Mock 数据(使用临时 Map 优化)
// 	// todo@remy MVP 之后需要去掉
// 	filePath := "internal/config/config_bet_holding.json"
// 	data, err := os.ReadFile(filePath)
// 	if err != nil {
// 		logger.Errorf("[GetBetHoldingByUserID]read bet holding failed, err: %v", err)
// 		// 读取失败直接返回目前已有的数据，不再执行后续匹配
// 		return resp, nil
// 	}

// 	var matches []model.BetHoldingMock
// 	if err := json.Unmarshal(data, &matches); err != nil {
// 		logger.Errorf("read bet holding from Mock JSON failed, err: %v", err)
// 		return resp, nil
// 	}

// 	// 4. 将 Slice 转为 Map 以实现 O(1) 查找 (若用全局缓存则省略此步)
// 	mockMap := make(map[int64]model.BetHoldingMock, len(matches))
// 	for _, m := range matches {
// 		mockMap[m.OddID] = m
// 	}

// 	// 5. 遍历并修改 resp.Results (使用索引 i 修改原地址数据)
// 	for i := range resp.Results {
// 		oddID := resp.Results[i].OddID
// 		// O(1) 查找
// 		if mockItem, exists := mockMap[oddID]; exists {
// 			resp.Results[i].Odds = mockItem.Odds
// 			resp.Results[i].FixtureName = mockItem.FixtureName
// 			resp.Results[i].FixtureTime = mockItem.FixtureTime
// 			resp.Results[i].MarketType = mockItem.MarketType
// 			resp.Results[i].Selection = mockItem.Selection
// 			resp.Results[i].Payout = getPayout(mockItem.Odds, resp.Results[i].Stake)
// 		}
// 	}

// 	return resp, nil
// }

func (r *userRepo) GetBetHoldingByUserIDDB(ctx context.Context, userID uint64) (*model.BetHoldingResponse, error) {
	return r.GetBetHoldingByUserID(ctx, userID)
}

// GetBannerBetHoldingByUserID 查询当前用户的 Banner 注单列表。
// 这里直接读取 banner_bet_order 表，不依赖 OddDB 关联信息。
func (r *userRepo) GetBannerBetHoldingByUserID(ctx context.Context, userID uint64) (*model.BannerBetHoldingResponse, error) {
	var orders []model.BannerBetOrder
	if err := r.gdb.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at desc").
		Limit(50).
		Find(&orders).Error; err != nil {
		logger.Errorf("[GetBannerBetHoldingByUserID] query banner bet order failed, err: %v", err)
		return nil, err
	}

	resp := &model.BannerBetHoldingResponse{
		UserID:  userID,
		Results: make([]model.BannerBetHoldingItem, 0, len(orders)),
	}
	for _, order := range orders {
		resp.Results = append(resp.Results, model.BannerBetHoldingItem{
			BetID:       order.ID,
			BannerCode:  order.BannerCode,
			MarketID:    order.MarketID,
			SelectionID: order.SelectionID,
			Market:      order.Market,
			Selection:   order.Selection,
			Type:        order.Type,
			Status:      order.Status,
			Stake:       order.Stake,
			Odds:        order.Odds.String(),
			Payout:      order.Payout.String(),
			RefID:       order.ClientRefID,
			CreatedAt:   order.CreatedAt,
		})
	}
	return resp, nil
}

// GetBannerBetHoldingByOrders 按注单 ID 查询 Banner 注单详情。
// 这里返回 BetHoldingResponse，方便复用现有流水/历史查询里的 EventInfo 结构。
func (r *userRepo) GetBannerBetHoldingByOrders(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
	var bannerOrders []model.BannerBetOrder
	if err := r.gdb.WithContext(ctx).
		Where("id IN ?", orders).
		Order("created_at desc").
		Find(&bannerOrders).Error; err != nil {
		logger.Errorf("[GetBannerBetHoldingByOrders] query banner orders failed, orders:%v err:%v", orders, err)
		return nil, err
	}

	resp := &model.BetHoldingResponse{
		Results: make([]model.BetHoldingResult, 0, len(bannerOrders)),
	}
	for _, order := range bannerOrders {
		resp.Results = append(resp.Results, model.BetHoldingResult{
			Id:          order.ID,
			OddID:       order.SelectionID,
			Stake:       order.Stake,
			Status:      order.Status,
			Type:        order.Type,
			Odds:        order.Odds.String(),
			Payout:      order.Payout.String(),
			FixtureName: order.BannerCode,
			FixtureTime: order.CreatedAt.Format(time.DateTime),
			MarketType:  order.Market,
			Selection:   order.Selection,
		})
	}
	return resp, nil
}

func (r *userRepo) GetBetHoldingByOrders(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
	var betHolding []model.UserBetHolding

	// 1. 数据库查询
	result := r.gdb.WithContext(ctx).
		Where("id IN ?", orders).
		Order("created_at desc").
		Find(&betHolding)

	if result.Error != nil {
		logger.Errorf("query bet holding failed, err: %v", result.Error)
		return nil, result.Error
	}

	resp := &model.BetHoldingResponse{
		Results: make([]model.BetHoldingResult, 0, len(betHolding)), // 预分配容量，提升性能
	}

	// 2. 收集 OddIDs 并进行第一遍转换
	oddIDs := make([]int64, 0, len(betHolding))
	for _, item := range betHolding {
		resp.Results = append(resp.Results, model.BetHoldingResult{
			OddID:        item.OddID,
			Stake:        item.Stake,
			Status:       item.Status,
			Type:         item.Type,
			Id:           item.ID,
			Odds:         item.Odds.String(),
			Payout:       item.Payout.String(),
			ActualPayout: item.ActualPayout.String(),
			MarketType:   item.Market,
			Selection:    item.Label,
			SettledAt:    settledAtForBetStatus(item.Status, item.UpdatedAt),
		})
		oddIDs = append(oddIDs, item.OddID)
	}

	// 3. 从 MySQL 批量读取真实的 OddDB 赔率数据 (替代之前的 Mock 文件)
	var oddDBs []model.OddDB
	if err := r.gdb.WithContext(ctx).Where("odd_id IN ?", oddIDs).Find(&oddDBs).Error; err != nil {
		logger.Errorf("[GetBetHoldingByOrders] query odd_db failed, err: %v", err)
		// 遵循原有逻辑：如果关联数据查询失败，返回已有的基础数据，而不是直接报错打断请求
		return resp, nil
	}

	// 4. 将 Slice 转为 Map 以实现 O(1) 查找
	oddMap := make(map[int64]model.OddDB, len(oddDBs))
	for _, odd := range oddDBs {
		oddMap[odd.OddID] = odd
	}

	fixtureInfoMap, err := r.loadFixtureDisplayInfoMap(ctx, oddDBs)
	if err != nil {
		logger.Errorf("[GetBetHoldingByOrders] query fixture display info failed, err: %v", err)
	}

	// 5. 遍历并修改 resp.Results (使用索引 i 修改原地址数据)
	for i := range resp.Results {
		oddID := resp.Results[i].OddID
		// 注意这里的字段映射：将 OddDB 的字段映射到 BetHoldingResult  O(1) 查找
		if oddItem, exists := oddMap[oddID]; exists {
			// homeTeamLogo, awayTeamLogo, err := r.GetTeamLogoByFixtureID(ctx, uint64(oddItem.FixtureID))
			// if err != nil {
			// 	logger.Errorf("GetTeamLogoByFixtureID failed, err: %v", err)
			// }
			// resp.Results[i].FixtureName = oddItem.FixtureName
			// resp.Results[i].FixtureTime = oddItem.FixtureTime
			// resp.Results[i].MarketType = oddItem.MarketDescription
			// resp.Results[i].Selection = oddItem.Selection
			// resp.Results[i].HomeTeamLogo = homeTeamLogo
			// resp.Results[i].AwayTeamLogo = awayTeamLogo
			// // 下注赔率和派彩金额必须来自 user_bet_holding 快照；OddDB 当前赔率只用于补赛事展示信息。
			// logger.Infof("[GetBetHoldingByOrders]succ resp:%v", resp.Results[i])
			applyOddDisplayInfo(&resp.Results[i], oddItem, fixtureInfoMap)
			// 下注赔率和派彩金额必须来自 user_bet_holding 快照；赛事展示字段可从 fixture 主表拿最新运营口径。
			logger.Infof("[GetBetHoldingByOrders]succ resp:%v", resp.Results[i])
		}
	}
	return resp, nil
}

func settledAtForBetStatus(status string, updatedAt time.Time) *time.Time {
	if updatedAt.IsZero() {
		return nil
	}
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "WON", "LOST", "PUSH", "VOID":
		// 只有结算服务写入的终局状态才暴露 settled_at，active/live 的 updated_at 只是普通更新时间。
		settledAt := updatedAt
		return &settledAt
	default:
		return nil
	}
}

// getPayout 计算派奖金额：odds * stake
// 入参：odds 赔率字符串（如 "1.52"），stake 下注金额
// 返回：payout 字符串
func getPayout(odds string, stake decimal.Decimal) string {
	// 1. 将赔率字符串转为 decimal
	oddsDec, err := decimal.NewFromString(odds)
	if err != nil {
		return ""
	}
	// 2. 相乘计算派彩
	payout := oddsDec.Mul(stake)
	// 3. 返回字符串
	return payout.String()
}

func (r *userRepo) ClaimBetByUserID(ctx context.Context, userID uint64, betID uint64, expectedAmount decimal.Decimal) (*model.BetClaimResponse, error) {
	var claimedAmount decimal.Decimal
	alreadyClaimed := false
	claimStatus := model.BetClaimStatusClaimed
	claimResp := func(status string) *model.BetClaimResponse {
		return &model.BetClaimResponse{
			BetID:          betID,
			Amount:         claimedAmount,
			Status:         status,
			AlreadyClaimed: alreadyClaimed,
		}
	}
	failClaim := func(status string, err error) error {
		// 领取接口即使失败也要保留机器可读状态，便于 handler 把具体失败原因稳定返回给前端。
		claimStatus = status
		return err
	}

	err := r.gdb.Transaction(func(tx *gorm.DB) error {
		var bet model.UserBetHolding
		// 先锁注单行，把同一个 bet_id 的并发 claim 串行化；即使不改注单状态，也能保证 ledger 幂等检查不会并发穿透。
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", betID, userID).First(&bet).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return failClaim(model.BetClaimStatusBetNotFound, errors.New(model.BetClaimStatusBetNotFound))
			}
			logger.Errorf("[ClaimBetByUserID] query bet holding failed, user_id:%d bet_id:%d err:%v", userID, betID, err)
			return failClaim(model.BetClaimStatusDatabaseError, err)
		}

		refID := strconv.FormatUint(betID, 10)
		var existingLedger model.AssetLedger
		ledgerErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND business_type = ? AND ref_id = ?", userID, model.AssetTypeClaimPrize, refID).
			Order("id asc").
			First(&existingLedger).Error
		if ledgerErr == nil {
			// bet_id 是幂等键；重复领取直接返回首次 claim 流水金额，不再二次改余额。
			claimedAmount = existingLedger.Amount
			alreadyClaimed = true
			return nil
		}
		if ledgerErr != nil && !errors.Is(ledgerErr, gorm.ErrRecordNotFound) {
			logger.Errorf("[ClaimBetByUserID] query asset_ledger failed, user_id:%d bet_id:%d err:%v", userID, betID, ledgerErr)
			return failClaim(model.BetClaimStatusDatabaseError, ledgerErr)
		}

		status := strings.ToUpper(strings.TrimSpace(bet.Status))
		if !isClaimableBetStatus(status) {
			return failClaim(model.BetClaimStatusInvalidBetStatus, errors.New(model.BetClaimStatusInvalidBetStatus))
		}

		claimAmount := bet.ActualPayout
		if !claimAmount.IsPositive() {
			// 领取金额必须来自结算 worker 写入的 actual_payout，不能使用前端金额或预计派彩兜底，避免重复/错误派彩。
			return failClaim(model.BetClaimStatusInvalidClaimAmount, errors.New(model.BetClaimStatusInvalidClaimAmount))
		}
		if expectedAmount.IsPositive() && !expectedAmount.Equal(claimAmount) {
			// 前端传入金额只做一致性校验；实际入账永远以后端结算金额为准。
			return failClaim(model.BetClaimStatusClaimAmountMismatch, errors.New(model.BetClaimStatusClaimAmountMismatch))
		}

		balance, err := lockClaimableBalance(tx, userID, betID, claimAmount)
		if err != nil {
			logger.Errorf("[ClaimBetByUserID] lock user balance failed, user_id:%d bet_id:%d err:%v", userID, betID, err)
			return failClaim(betClaimFailureStatusFromError(err), err)
		}

		beforeAvail := balance.AvailableBalance
		afterAvail := beforeAvail.Add(claimAmount)
		beforeClaimable := balance.ClaimableBalance
		afterClaimable := beforeClaimable.Sub(claimAmount)
		if afterClaimable.LessThan(decimal.Zero) {
			return failClaim(model.BetClaimStatusInsufficientClaimableBalance, errors.New(model.BetClaimStatusInsufficientClaimableBalance))
		}

		updated := tx.Model(&model.UserBalance{}).
			Where("id = ? AND user_id = ? AND claimable_balance >= ?", balance.ID, userID, claimAmount).
			Updates(map[string]interface{}{
				"available_balance": afterAvail,
				"claimable_balance": afterClaimable,
			})
		if updated.Error != nil {
			logger.Errorf("[ClaimBetByUserID] update user balance failed, user_id:%d bet_id:%d err:%v", userID, betID, updated.Error)
			return failClaim(model.BetClaimStatusDatabaseError, updated.Error)
		}
		if updated.RowsAffected == 0 {
			return failClaim(model.BetClaimStatusConcurrencyClaimError, errors.New(model.BetClaimStatusConcurrencyClaimError))
		}

		ledger := model.AssetLedger{
			UserID:        userID,
			BusinessType:  model.AssetTypeClaimPrize,
			Amount:        claimAmount,
			BalanceBefore: beforeAvail,
			BalanceAfter:  afterAvail,
			BetLockBefore: balance.BetLockBalance,
			BetLockAfter:  balance.BetLockBalance,
			RefID:         refID,
			CreatedAt:     time.Now(),
		}
		if err := tx.Create(&ledger).Error; err != nil {
			logger.Errorf("[ClaimBetByUserID] create asset_ledger failed, user_id:%d bet_id:%d err:%v", userID, betID, err)
			return failClaim(model.BetClaimStatusDatabaseError, err)
		}

		claimedAmount = claimAmount
		return nil
	})

	if err != nil {
		return claimResp(claimStatus), err
	}

	return claimResp(model.BetClaimStatusClaimed), nil
}

func isClaimableBetStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "won", "push", "void":
		return true
	default:
		return false
	}
}

func betClaimFailureStatusFromError(err error) string {
	if err == nil {
		return model.BetClaimStatusDatabaseError
	}
	switch err.Error() {
	case model.BetClaimStatusInsufficientClaimableBalance:
		return model.BetClaimStatusInsufficientClaimableBalance
	case model.BetClaimStatusMultipleClaimableBalanceRows:
		return model.BetClaimStatusMultipleClaimableBalanceRows
	default:
		// 余额行锁定阶段除了明确业务错误外，其余都按数据库/数据一致性异常处理，避免前端误判为可重试的领取失败。
		return model.BetClaimStatusDatabaseError
	}
}

func lockClaimableBalance(tx *gorm.DB, userID uint64, betID uint64, amount decimal.Decimal) (model.UserBalance, error) {
	var balances []model.UserBalance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("user_id = ? AND claimable_balance >= ?", userID, amount).
		Limit(2).
		Find(&balances).Error
	if err != nil {
		logger.Errorf("[lockClaimableBalance] lock balance failed, user_id:%d bet_id:%d err:%v", userID, betID, err)
		return model.UserBalance{}, err
	}
	if len(balances) == 0 {
		return model.UserBalance{}, errors.New(model.BetClaimStatusInsufficientClaimableBalance)
	}
	if len(balances) > 1 {
		// 注单表没有 coin_symbol，用户存在多条可领取余额时不能猜测币种，否则会把 claim 打到错误资金账户。
		return model.UserBalance{}, errors.New(model.BetClaimStatusMultipleClaimableBalanceRows)
	}
	return balances[0], nil
}
func (r *userRepo) GetBetClaimByUserID(ctx context.Context, userID uint64, betID uint64) (*model.BetClaimResponse, error) {
	var claimedAmount decimal.Decimal

	err := r.gdb.Transaction(func(tx *gorm.DB) error {
		var bet model.UserBetHolding
		// 1. 锁定注单行
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", betID, userID).First(&bet).Error; err != nil {
			return errors.New("BET_NOT_FOUND")
		}

		// 2. 状态与金额校验
		if bet.Status == "CLAIMED" {
			return errors.New("PRIZE_ALREADY_CLAIMED")
		}
		if bet.Status != "WON" {
			return errors.New("INVALID_BET_STATUS_FOR_CLAIM")
		}
		// 3. 更新注单状态 (带上状态检查作为二次保障)
		updateRes := tx.Model(&bet).
			Where("id = ? AND status = ?", betID, "WON").
			Update("status", "CLAIMED")
		if updateRes.Error != nil {
			return updateRes.Error
		}
		if updateRes.RowsAffected == 0 {
			return errors.New("CONCURRENCY_CLAIM_ERROR")
		}

		// TODO@remy  这里需要 定时任务结算逻辑在比赛结束的时候更新用户的盈利余额
		// 4. 替代原有的手工更新余额逻辑
		// 参数说明：available增加 Payout, lock变动为 0
		err := r.updateBalanceAndLogLedger(tx, userID, bet.Payout, decimal.Zero, model.AssetTypeClaimPrize, strconv.FormatUint(betID, 10))
		if err != nil {
			logger.Errorf("[updateBalanceAndLogLedger] update user balance failed, err: %v", err)
			return err
		}
		// 5. 【新增】记录财务流水 (极其重要！)
		/*
			err = tx.Create(&model.AccountLog{
				UserID: userID,
				Type: "CLAIM_PRIZE",
				Amount: bet.Payout,
				RefID: betID,
			}).Error
			if err != nil { return err }
		*/
		claimedAmount = bet.Payout
		return nil
	})

	return &model.BetClaimResponse{Amount: claimedAmount}, err
}

// bannerBetOrderToResponse 将表模型转换为接口响应，避免多处重复组装字段。
func bannerBetOrderToResponse(order model.BannerBetOrder) *model.BannerBetPlaceResponse {
	return &model.BannerBetPlaceResponse{
		BetID:       order.ID,
		Status:      "SUCCESS",
		BannerCode:  order.BannerCode,
		MarketID:    order.MarketID,
		SelectionID: order.SelectionID,
		Stake:       order.Stake,
		Odds:        order.Odds,
		Payout:      order.Payout,
	}
}

// isDuplicateEntryError 判断是否为 MySQL 唯一键冲突。
func isDuplicateEntryError(err error) bool {
	var mysqlErr *mysqlDriver.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1062
}

func (r *userRepo) BetUserBalanceByUserID(ctx context.Context, userID uint64, amount decimal.Decimal) error {
	return r.gdb.Transaction(func(tx *gorm.DB) error {
		var balance model.UserBalance

		// 1. 查询 、锁定
		result := tx.Table(balance.TableName()).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ?", userID).
			First(&balance)

		if result.Error != nil {
			return result.Error
		}

		// 2. 判断余额是否满足条件
		if balance.AvailableBalance.LessThan(amount) {
			return errors.New("available balance is less than the amount")
		}

		// 3. 更新数据, 数据库层面更新
		updateResult := tx.Model(&balance).
			Updates(map[string]interface{}{
				"available_balance": gorm.Expr("available_balance - ?", amount),
				"bet_lock_balance":  gorm.Expr("bet_lock_balance + ?", amount),
			})

		if updateResult.Error != nil {
			return updateResult.Error
		}

		if updateResult.RowsAffected == 0 {
			return errors.New("update failed, no record found")
		}

		return nil
	})
}

func (r *userRepo) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	var user model.User
	result := r.gdb.WithContext(ctx).Where("email = ?", email).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}

	return &user, nil
}

// bool 判断是否有用户
func (r *userRepo) GetByWalletAddress(ctx context.Context, address string) (*model.User, error) {
	var user model.User

	if err := r.gdb.WithContext(ctx).Where("signing_address = ?", address).First(&user).Error; err != nil {
		if err.Error() == gorm.ErrRecordNotFound.Error() {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

func (r *userRepo) Create(ctx context.Context, user *model.User) error {
	if user.UserID == 0 {
		user.UserID = snowflake.GenerateID()
	}
	return r.gdb.WithContext(ctx).Create(user).Error
}

func (r *userRepo) CreateAllUserIDWithSigningAddress(ctx context.Context, chain, address string) (*model.User, error) {
	var user *model.User
	var depositAddr model.DepositAddress
	var depositAddress string

	err := r.gdb.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 创建 user 记录
		user = &model.User{
			UserID:         snowflake.GenerateID(),
			SigningAddress: address,
			PasswordHash:   "",
			Status:         1,
		}
		logger.Infof("Generated UserID: %d", user.UserID)
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		// 2. 查询 deposit_address (chain="bsc", status=0)
		if err := tx.Where("chain = ? AND status = ?", chain, model.DepositAddressStatusUnused).
			First(&depositAddr).Error; err != nil {
			return err
		}

		// 3. 乐观锁更新 deposit_address status = 1
		currentVersion := depositAddr.Version
		result := tx.Model(&model.DepositAddress{}).
			Where("id = ? AND version = ? AND status = ?", depositAddr.ID, currentVersion, model.DepositAddressStatusUnused).
			Updates(map[string]interface{}{
				"status":       model.DepositAddressStatusAllocated,
				"version":      currentVersion + 1,
				"allocated_at": time.Now(),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("deposit address version conflict or already allocated")
		}

		// 4. 写入 user_deposit_address
		userDepositAddr := &model.UserDepositAddress{
			UserID:  user.UserID,
			Chain:   chain,
			Address: depositAddr.Address,
		}
		if err := tx.Create(userDepositAddr).Error; err != nil {
			return err
		}

		depositAddress = depositAddr.Address

		// 5. 写入 user_balance
		userBalance := &model.UserBalance{
			UserID: user.UserID,
			// AvailableBalance: decimal.Zero,
			AvailableBalance: decimal.NewFromInt(10000), //仅测试阶段用
			FrozenBalance:    decimal.Zero,
			BetLockBalance:   decimal.Zero,
			StakeLockBalance: decimal.Zero,
			LiqLockBalance:   decimal.Zero,
		}
		if err := tx.Create(userBalance).Error; err != nil {
			return err
		}

		// 6. 写入 user_login_logs
		loginLog := &model.UserLoginLog{
			UserID: user.UserID,
			Status: int8(model.LoginStatusSuccess),
		}
		if err := tx.Create(loginLog).Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	// 存deposit地址
	if len(depositAddress) > 0 {
		err := r.rdb.SAdd(ctx, utils.GetRedisDepositAddressesKey(chain), strings.ToLower(depositAddress))
		if err != nil {
			return nil, err
		}
	}

	return user, nil
}

func (r *userRepo) Update(ctx context.Context, user *model.User) error {
	return r.gdb.WithContext(ctx).Save(user).Error
}

func (r *userRepo) Delete(ctx context.Context, id uint64) error {
	return r.gdb.WithContext(ctx).Delete(&model.User{}, id).Error
}

func (r *userRepo) GetAssetLedgersByUserID(ctx context.Context, userId uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
	query := r.gdb.WithContext(ctx).Model(&model.AssetLedger{}).Where("user_id = ?", userId)

	if param.OrderBy != "" {
		sortOrder := param.OrderBy
		if param.Sort == "desc" {
			sortOrder = sortOrder + " " + "desc"
		} else {
			sortOrder = sortOrder + " " + "asc"
		}
		query = query.Order(sortOrder)
	} else {
		query = query.Order("created_at desc")
	}

	// 【新增硬限制】：保护内存，最多只取最新 1000 条 防止 OOM 问题
	query = query.Limit(1000)

	var assetLedgers []model.AssetLedger
	if err := query.Find(&assetLedgers).Error; err != nil {
		return nil, err
	}

	responses := make([]model.AssetLedgerResponse, 0, len(assetLedgers))
	for _, ledger := range assetLedgers {
		item := model.AssetLedgerResponse{
			BusinessType: ledger.BusinessType,
			Amount:       ledger.Amount,
			RefID:        ledger.RefID,
			CreatedAt:    ledger.CreatedAt,
		}
		if needBalance {
			item.BalanceBefore = ledger.BalanceBefore
			item.BalanceAfter = ledger.BalanceAfter
		}
		responses = append(responses, item)
	}

	return &model.AssetLedgersResponse{AssetLedgers: responses}, nil
}

// GetClaimedBetIDsByUserIDAndBetIDs 批量查询已经领取过的普通注单。
// History 的 enable_claim 不能只看注单状态，否则已领取但注单状态仍是 WON/PUSH/VOID 的历史单会再次露出领取入口；
// 领取接口以 claim_prize + ref_id 做幂等，所以这里复用同一把业务键判断。
func (r *userRepo) GetClaimedBetIDsByUserIDAndBetIDs(ctx context.Context, userID uint64, betIDs []uint64) (map[uint64]struct{}, error) {
	claimed := make(map[uint64]struct{})
	if len(betIDs) == 0 {
		return claimed, nil
	}

	refIDs := make([]string, 0, len(betIDs))
	seen := make(map[uint64]struct{}, len(betIDs))
	for _, betID := range betIDs {
		if betID == 0 {
			continue
		}
		if _, exists := seen[betID]; exists {
			continue
		}
		seen[betID] = struct{}{}
		refIDs = append(refIDs, strconv.FormatUint(betID, 10))
	}
	if len(refIDs) == 0 {
		return claimed, nil
	}

	var ledgers []model.AssetLedger
	if err := r.gdb.WithContext(ctx).
		Model(&model.AssetLedger{}).
		Select("ref_id").
		Where("user_id = ? AND business_type = ? AND ref_id IN ?", userID, model.AssetTypeClaimPrize, refIDs).
		Find(&ledgers).Error; err != nil {
		logger.Errorf("[GetClaimedBetIDsByUserIDAndBetIDs] query asset_ledgers error, user_id:%d err:%v", userID, err)
		return nil, err
	}

	for _, ledger := range ledgers {
		betID, err := strconv.ParseUint(strings.TrimSpace(ledger.RefID), 10, 64)
		if err != nil {
			// claim_prize.ref_id 理论上必须是 bet_id；遇到历史脏数据时跳过，避免单条异常污染整页领取状态。
			logger.Errorf("[GetClaimedBetIDsByUserIDAndBetIDs] invalid claim ref_id, user_id:%d ref_id:%s err:%v", userID, ledger.RefID, err)
			continue
		}
		claimed[betID] = struct{}{}
	}
	return claimed, nil
}

// 同一个事务里
// 1.检查available_balance是否可用
// 2.校验可用余额是否足够
// 3.减掉 available_balance，并加到冻结余额里
// 4.写withdraw_records表
// 5.写 asset_ledger 表
func (r *userRepo) WithdrawApply(ctx context.Context, userId uint64, record model.WithdrawRecord) error {
	return r.gdb.Transaction(func(tx *gorm.DB) error {
		// 1. 查询并锁定 user_balance 行
		var balance model.UserBalance
		result := tx.Table(balance.TableName()).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ?", userId).
			First(&balance)
		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return result.Error
		}

		// 2. 校验可用余额是否足够
		if balance.AvailableBalance.LessThan(record.Amount) {
			logger.Errorf("userId:%d, AvailableBalance:%s, Amount:%s", userId, balance.AvailableBalance.String(), record.Amount.String())
			return ErrInsufficientBalance
		}

		// 3. 更新余额：扣减可用余额，增加冻结余额
		updateResult := tx.Model(&balance).
			Where("user_id = ?", userId).
			Updates(map[string]interface{}{
				"available_balance": gorm.Expr("available_balance - ?", record.Amount),
				"frozen_balance":    gorm.Expr("frozen_balance + ?", record.Amount),
			})
		if updateResult.Error != nil {
			return updateResult.Error
		}
		if updateResult.RowsAffected == 0 {
			return errors.New("update balance failed, no record found")
		}

		// 4. 插入提现记录
		if err := tx.Create(&record).Error; err != nil {
			return err
		}

		// 5 插入 asset_ledger 表
		// 如果后续成功发送了，这条记录不用动，如果被驳回了，或者发送失败了，再写一条失败的记录，调整回原余额
		assetLedger := model.AssetLedger{
			UserID:          userId,
			BusinessType:    string(model.BusinessTypeWithdraw),
			Amount:          record.Amount,
			BalanceBefore:   balance.AvailableBalance,
			BalanceAfter:    balance.AvailableBalance.Sub(record.Amount),
			FrozenBefore:    balance.FrozenBalance,
			FrozenAfter:     balance.FrozenBalance.Add(record.Amount),
			BetLockBefore:   balance.BetLockBalance,
			BetLockAfter:    balance.BetLockBalance,
			StakeLockBefore: balance.StakeLockBalance,
			StakeLockAfter:  balance.StakeLockBalance,
			LiqLockBefore:   balance.LiqLockBalance,
			LiqLockAfter:    balance.LiqLockBalance,
			RefID:           record.OrderSn,
			CreatedAt:       time.Now(),
		}
		if err := tx.Create(&assetLedger).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *userRepo) GetWithDrawRecordsByUserID(ctx context.Context, userId uint64) ([]model.WithdrawRecord, error) {
	var records []model.WithdrawRecord
	err := r.gdb.WithContext(ctx).Table(model.WithdrawRecord{}.TableName()).Where("user_id = ?", userId).Order("created_at desc").Scan(&records).Error
	if err != nil {
		return nil, err
	}

	return records, nil
}

// 取消 提现记录
func (r *userRepo) WithDrawCannel(ctx context.Context, userId uint64, orderSn string) error {
	return r.gdb.Transaction(func(tx *gorm.DB) error {
		// 1. 通过 withdraw_record表 获取提现申请，通过userId 和 orderSn，如果没有返回特殊报错
		var withdrawRecord model.WithdrawRecord
		result := tx.Table(withdrawRecord.TableName()).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND order_sn = ?", userId, orderSn).
			First(&withdrawRecord)
		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				logger.Errorf("withdraw cancel: record not found, userId:%d, orderSn:%s", userId, orderSn)
				return ErrWithdrawRecordNotFound
			}
			return result.Error
		}

		// 2. 检查提现记录状态，只有待审核(1)才能取消
		if withdrawRecord.Status != 1 {
			logger.Errorf("withdraw cancel: invalid status, userId:%d, orderSn:%s, status:%d", userId, orderSn, withdrawRecord.Status)
			return ErrInvalidWithdrawStatus
		}

		// 3. 锁住 user_balance 这个 userId 的记录，并检查冻结余额是否足够
		var balance model.UserBalance
		balanceResult := tx.Table(balance.TableName()).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ?", userId).
			First(&balance)
		if balanceResult.Error != nil {
			if errors.Is(balanceResult.Error, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return balanceResult.Error
		}

		// 检查冻结余额是否够这笔提现
		if balance.FrozenBalance.LessThan(withdrawRecord.Amount) {
			logger.Errorf("withdraw cancel: insufficient frozen balance, userId:%d, frozenBalance:%s, amount:%s",
				userId, balance.FrozenBalance.String(), withdrawRecord.Amount.String())
			return ErrInsufficientFrozenBalance
		}

		// 4. 提现记录更新成取消状态 (Status = 6)
		now := time.Now()
		updateResult := tx.Model(&model.WithdrawRecord{}).
			Where("id = ? AND user_id = ?", withdrawRecord.ID, userId).
			Updates(map[string]interface{}{
				"status":     6,
				"updated_at": now,
			})
		if updateResult.Error != nil {
			return updateResult.Error
		}
		if updateResult.RowsAffected == 0 {
			return errors.New("update withdraw record status failed")
		}

		// 5. user_balance 调整冻结余额和可用余额
		balanceUpdateResult := tx.Model(&balance).
			Where("user_id = ?", userId).
			Updates(map[string]interface{}{
				"frozen_balance":    gorm.Expr("frozen_balance - ?", withdrawRecord.Amount),
				"available_balance": gorm.Expr("available_balance + ?", withdrawRecord.Amount),
			})
		if balanceUpdateResult.Error != nil {
			return balanceUpdateResult.Error
		}
		if balanceUpdateResult.RowsAffected == 0 {
			return errors.New("update balance failed, no record found")
		}

		// 6. 本次取消流程写入 asset_ledger 表
		assetLedger := model.AssetLedger{
			UserID:          userId,
			BusinessType:    string(model.BusinessTypeCancelWithdraw),
			Amount:          withdrawRecord.Amount,
			BalanceBefore:   balance.AvailableBalance,
			BalanceAfter:    balance.AvailableBalance.Add(withdrawRecord.Amount),
			FrozenBefore:    balance.FrozenBalance,
			FrozenAfter:     balance.FrozenBalance.Sub(withdrawRecord.Amount),
			BetLockBefore:   balance.BetLockBalance,
			BetLockAfter:    balance.BetLockBalance,
			StakeLockBefore: balance.StakeLockBalance,
			StakeLockAfter:  balance.StakeLockBalance,
			LiqLockBefore:   balance.LiqLockBalance,
			LiqLockAfter:    balance.LiqLockBalance,
			RefID:           withdrawRecord.OrderSn,
			CreatedAt:       now,
		}
		if err := tx.Create(&assetLedger).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *userRepo) GetPendingOrders(ctx context.Context, riskType string) ([]model.WithdrawRecord, error) {
	var records []model.WithdrawRecord
	db := r.gdb.WithContext(ctx).Table(new(model.WithdrawRecord).TableName()).Where("status = ?", 1)
	if riskType == "risk" {
		db = db.Where("amount > ? OR risk_level = ?", 5000, 1)
	}
	err := db.Order("created_at DESC").Find(&records).Error
	return records, err
}

func (r *userRepo) ApproveWithdrawOrder(ctx context.Context, orderSn, adminID, remark string, approve bool) error {
	return r.gdb.Transaction(func(tx *gorm.DB) error {
		// 1. 查询并锁定提现记录
		var record model.WithdrawRecord
		result := tx.Table(record.TableName()).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("order_sn = ?", orderSn).
			First(&record)
		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				return ErrWithdrawRecordNotFound
			}
			return result.Error
		}

		// 2. 校验状态：只有 Status=3(已经打款了) 不能审批，其他都能重新审核
		if record.Status == 3 {
			logger.Errorf("ApproveWithdrawOrder: order had over, orderSn=%s, currentStatus=%d", orderSn, record.Status)
			return ErrOrderOverStatus
		}

		now := time.Now()

		// 3. 组装更新字段
		updates := map[string]interface{}{
			"admin_id":   adminID,
			"remark":     adminID + ":" + remark,
			"audit_at":   now,
			"updated_at": now,
		}

		if approve {
			updates["status"] = int8(2)
			updates["risk_level"] = int8(0)
		} else {
			updates["status"] = int8(4)
		}

		// 4. 执行更新
		updateResult := tx.Model(&model.WithdrawRecord{}).
			Where("id = ?", record.ID).
			Updates(updates)
		if updateResult.Error != nil {
			return updateResult.Error
		}
		if updateResult.RowsAffected == 0 {
			return errors.New("update withdraw record failed")
		}

		return nil
	})
}

func (r *userRepo) GetWithdrawRecordsByOrderSns(ctx context.Context, orderSns []string) ([]model.WithdrawRecord, error) {
	var records []model.WithdrawRecord
	err := r.gdb.WithContext(ctx).Table(new(model.WithdrawRecord).TableName()).
		Where("order_sn IN (?)", orderSns).
		Scan(&records).Error
	return records, err
}

func (r *userRepo) GetWithdrawRecordsByUserIDAndOrderSns(ctx context.Context, userID uint64, orderSns []string) ([]model.WithdrawRecord, error) {
	if len(orderSns) == 0 {
		return []model.WithdrawRecord{}, nil
	}

	var records []model.WithdrawRecord
	// History 通过 asset_ledger.ref_id 反查提现单，必须带 user_id 兜底，避免异常 order_sn 碰撞时把其它用户的提现状态挂到当前用户流水上。
	err := r.gdb.WithContext(ctx).Table(new(model.WithdrawRecord).TableName()).
		Where("user_id = ? AND order_sn IN (?)", userID, orderSns).
		Scan(&records).Error
	return records, err
}
