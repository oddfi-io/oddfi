package service

import (
	"context"
	"errors"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/repository"
)

var (
	ErrAdminUserNotFound       = errors.New("admin user not found")
	ErrAdminInvalidCredentials = errors.New("invalid admin credentials")
)

type UserService interface {
	GetProfile(ctx context.Context, userID uint64) (*model.UserProfileResponse, error)
	UpdateProfile(ctx context.Context, userID uint64, req *model.UpdateProfileRequest) (*model.UserProfileResponse, error)
	ChangePassword(ctx context.Context, userID uint64, oldPassword, newPassword string) error
	GetPendingOrders(ctx context.Context, param model.GetPendingOrdersRequest) (*model.PendingOrdersResponse, error)
	ApproveOrder(ctx context.Context, param model.ApproveOrderRequest) error
	OrderInfo(ctx context.Context, param model.OrderInfoRequest) (*model.OrderInfoResponse, error)
}

type userService struct {
	userRepo repository.UserRepo
}

func NewUserService(userRepo repository.UserRepo) UserService {
	return &userService{userRepo: userRepo}
}

func (s *userService) GetProfile(ctx context.Context, userID uint64) (*model.UserProfileResponse, error) {
	user, err := s.userRepo.GetUserInfoByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &model.UserProfileResponse{
		UserID:   user.UserID,
		Email:    user.Email,
		Nickname: user.Nickname,
		Phone:    user.Phone,
	}, nil
}

func (s *userService) UpdateProfile(ctx context.Context, userID uint64, req *model.UpdateProfileRequest) (*model.UserProfileResponse, error) {
	user, err := s.userRepo.GetUserInfoByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	if req.Nickname != "" {
		user.Nickname = req.Nickname
	}
	if req.Email != "" {
		user.Email = req.Email
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}

	return &model.UserProfileResponse{
		UserID:   user.UserID,
		Email:    user.Email,
		Nickname: user.Nickname,
		Phone:    user.Phone,
	}, nil
}

func (s *userService) ChangePassword(ctx context.Context, userID uint64, oldPassword, newPassword string) error {
	user, err := s.userRepo.GetUserInfoByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	if !s.checkPassword(oldPassword, user.PasswordHash) {
		return ErrInvalidCredentials
	}

	hashedPassword := s.hashPassword(newPassword)
	user.PasswordHash = hashedPassword
	return s.userRepo.Update(ctx, user)
}

func (s *userService) hashPassword(password string) string {
	return password
}

func (s *userService) checkPassword(password, hashedPassword string) bool {
	return password == hashedPassword
}

func (s *userService) GetPendingOrders(ctx context.Context, param model.GetPendingOrdersRequest) (*model.PendingOrdersResponse, error) {
	ok, err := s.userRepo.VerifyAdminCredentials(ctx, param.User, param.Password)
	if err != nil {
		logger.Error(ctx, "VerifyAdminCredentials", err)
		return nil, ErrAdminInvalidCredentials
	}
	if !ok {
		return nil, ErrAdminUserNotFound
	}

	logger.Info(ctx, "GetPendingOrders", param)

	records, err := s.userRepo.GetPendingOrders(ctx, param.Type)
	if err != nil {
		return nil, err
	}

	items := make([]model.WithdrawRecordItem, 0, len(records))
	for _, r := range records {
		items = append(items, model.WithdrawRecordItem{
			ID:         r.ID,
			UserID:     r.UserID,
			OrderSn:    r.OrderSn,
			CoinSymbol: r.CoinSymbol,
			Chain:      r.Chain,
			Amount:     r.Amount,
			Fee:        r.Fee,
			RealAmount: r.RealAmount,
			ToAddress:  r.ToAddress,
			RiskLevel:  r.RiskLevel,
			Status:     r.Status,
			CreatedAt:  r.CreatedAt,
		})
	}

	return &model.PendingOrdersResponse{
		List:  items,
		Total: int64(len(items)),
	}, nil
}

func (s *userService) ApproveOrder(ctx context.Context, param model.ApproveOrderRequest) error {
	ok, err := s.userRepo.VerifyAdminCredentials(ctx, param.User, param.Password)
	if err != nil {
		logger.Error(ctx, "VerifyAdminCredentials", err)
		return ErrAdminInvalidCredentials
	}
	if !ok {
		return ErrAdminUserNotFound
	}

	return s.userRepo.ApproveWithdrawOrder(ctx, param.Order, param.User, param.Remark, param.Approve)
}

func (s *userService) OrderInfo(ctx context.Context, param model.OrderInfoRequest) (*model.OrderInfoResponse, error) {
	ok, err := s.userRepo.VerifyAdminCredentials(ctx, param.User, param.Password)
	if err != nil {
		logger.Error(ctx, "VerifyAdminCredentials", err)
		return nil, ErrAdminInvalidCredentials
	}
	if !ok {
		return nil, ErrAdminUserNotFound
	}

	records, err := s.userRepo.GetWithdrawRecordsByOrderSns(ctx, param.Orders)
	if err != nil {
		return nil, err
	}

	return &model.OrderInfoResponse{
		List:  records,
		Total: int64(len(records)),
	}, nil
}
