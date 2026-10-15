package storage

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"math/big"
	"oddfi-web-api/model"

	"gorm.io/gorm"
)

// bizIDBase36Len biz_id 中 base36 随机部分的字符长度
const bizIDBase36Len = 12

// GenBizID 生成早鸟登记业务 ID：ea_ + 12 位 base36 随机字符
// 使用 crypto/rand 8 字节随机数 → base36 ≈ 12.4 位，碰撞概率可忽略
func GenBizID() string {
	var buf [8]byte
	_, _ = rand.Read(buf[:])
	n := new(big.Int).SetUint64(binary.BigEndian.Uint64(buf[:]))
	s := n.Text(36)
	// 不足 12 位前补 0；超长截尾
	for len(s) < bizIDBase36Len {
		s = "0" + s
	}
	if len(s) > bizIDBase36Len {
		s = s[:bizIDBase36Len]
	}
	return "ea_" + s
}

// EarlyAccessRepo 早鸟登记数据访问接口
type EarlyAccessRepo interface {
	// FindActiveByEmailOrWallet 查询 status=1 的记录（email 或 wallet 命中任一）
	// 未找到时返回 (nil, nil)，不返回 gorm.ErrRecordNotFound
	FindActiveByEmailOrWallet(ctx context.Context, email, wallet string) (*model.EarlyAccessRegistration, error)
	// Create 插入一条早鸟登记记录
	Create(ctx context.Context, rec *model.EarlyAccessRegistration) error
	// CountRankByID 计算排名：status=1 且 id <= 当前记录 id 的总数
	CountRankByID(ctx context.Context, id uint64) (int64, error)
}

type earlyAccessRepo struct{ db *gorm.DB }

// NewEarlyAccessRepo 构造早鸟登记 Repo
func NewEarlyAccessRepo(s *DBStorage) EarlyAccessRepo {
	return &earlyAccessRepo{db: s.GetDB()}
}

// FindActiveByEmailOrWallet 查询 email 或 wallet 命中的 status=1 记录
func (r *earlyAccessRepo) FindActiveByEmailOrWallet(ctx context.Context, email, wallet string) (*model.EarlyAccessRegistration, error) {
	var rec model.EarlyAccessRegistration
	err := r.db.WithContext(ctx).
		Where("(email = ? OR wallet_address = ?) AND status = 1", email, wallet).
		Limit(1).
		First(&rec).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &rec, nil
}

// Create 插入早鸟登记记录
func (r *earlyAccessRepo) Create(ctx context.Context, rec *model.EarlyAccessRegistration) error {
	return r.db.WithContext(ctx).Create(rec).Error
}

// CountRankByID 计算排名：id <= 当前 id 且 status=1 的行数
func (r *earlyAccessRepo) CountRankByID(ctx context.Context, id uint64) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.EarlyAccessRegistration{}).
		Where("id <= ? AND status = 1", id).
		Count(&count).Error
	return count, err
}
