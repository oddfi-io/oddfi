package withdrawal

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"fmt"
	"oddfi-cron-job/internal/bsc"
	"oddfi-cron-job/internal/config"
	"oddfi-cron-job/internal/lark"
	"oddfi-cron-job/internal/logger"
	"oddfi-cron-job/internal/mysql"
	"oddfi-cron-job/internal/redis"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
	"golang.org/x/sync/errgroup"
)

// WithdrawalTask 提现处理任务（每5分钟执行）
type WithdrawalTask struct{}

// NewWithdrawalTask 创建提现处理任务
func NewWithdrawalTask() *WithdrawalTask {
	return &WithdrawalTask{}
}

func (t *WithdrawalTask) Name() string {
	return "withdrawal_processing"
}

func (t *WithdrawalTask) Schedule() string {
	// return "*/10 * * * *" // 每10分钟
	return "@every 30s" /// 每30s
}

func (t *WithdrawalTask) Execute(ctx context.Context) error {

	// 检查分布式锁，是否在执行
	logger.Infof("start execute lock %s", t.Name())
	rlock := redis.NewLock(t.Name(), time.Minute)
	ok, err := rlock.Acquire(ctx)
	if err != nil {
		logger.Errorf("[%s]Acquire lock error: %s", t.Name(), err)
		return err
	}
	if !ok {
		logger.Infof("[%s]lock already held by another process", t.Name())
		return nil
	}
	defer rlock.Release(ctx)

	if config.GetConfig().Env == "prod" {
		// return t.ExecuteProd(ctx)
		return t.ExecuteDev(ctx)
	} else {
		return t.ExecuteDev(ctx)
	}

}

func (t *WithdrawalTask) ExecuteDev(ctx context.Context) error {
	logger.Infof("[%s]DEV Starting withdrawal processing...", t.Name())

	var (
		highRiskPending = make([]mysql.WithdrawRecord, 0)
		waitExecute     = make([]mysql.WithdrawRecord, 0)
		transferSuss    = make([]string, 0) // 成功提现的orderSn
		resultList      = make([]*BatchTransferResult, 0)
		needBalance     = decimal.Zero
		eg              errgroup.Group
		st              = time.Now()
	)
	// 1. 从 DB 查询待处理的提现记录
	pendingList, err := t.getWithdrawalPending()
	if err != nil {
		logger.Errorf("[%s]getWithdrawalPending error: %s", t.Name(), err)
		return err
	}

	// 2.获取所有未审核的提现记录，大于5000部分单独发送lark通知
	for _, item := range pendingList {
		if item.Amount.GreaterThan(decimal.NewFromInt(5000)) {
			highRiskPending = append(highRiskPending, item)
		} else {
			waitExecute = append(waitExecute, item)
		}
	}

	if len(highRiskPending) == 0 && len(waitExecute) == 0 {
		logger.Infof("[%s]无需处理，直接返回", t.Name())
		return nil
	}

	getWithdrawalAudited, err := t.getWithdrawalAudited()
	if err != nil {
		logger.Errorf("[%s]getWithdrawalAudited error: %s", t.Name(), err)
		return err
	}

	waitExecute = append(waitExecute, getWithdrawalAudited...)

	for _, item := range waitExecute {
		needBalance = item.Amount.Add(needBalance)
	}

	// 无需处理，直接返回
	if len(waitExecute) == 0 && len(highRiskPending) == 0 {
		logger.Infof("[%s]无需处理，直接返回", t.Name())
		return nil
	}

	// 3. 所有状态都改成审核通过
	err = t.updateWithdrawalAudited(waitExecute)
	if err != nil {
		logger.Errorf("[%s]updateWithdrawalAudited error: %s", t.Name(), err)
		return err
	}

	// 4. 检查发送地址余额
	sender, err := t.getAddress(config.GetConfig().Odd.SenderPrivateKey)
	if err != nil {
		logger.Errorf("[%s]getAddress error: %s", t.Name(), err)
		return err
	}

	tokenBalance, err := GetTokenBalance(context.Background(), bsc.GetClient(), common.HexToAddress(config.GetConfig().Odd.TokenAddress), sender)
	if err != nil {
		logger.Errorf("[%s]checkBalance error: %s", t.Name(), err)
		return err
	}
	balance := decimal.NewFromBigInt(tokenBalance, -int32(config.GetConfig().Odd.TokenDec))
	logger.Infof("[%s] Sender: %s, Balance: %s, needBalance: %s", t.Name(), sender.Hex(), balance.String(), needBalance.String())
	//	检查发送金额，小于需要发送金额，则不进行提现，并报警
	if balance.LessThan(needBalance) {
		logger.Errorf("[%s] Sender: %s, Balance: %s, NeedBalance: %s", t.Name(), sender.Hex(), balance.String(), needBalance.String())
		return errors.New("balance is less than needBalance")
	}

	// TODO: 5. 调用合约或API执行提现
	eg.Go(func() error {
		for _, chunk := range lo.Chunk(waitExecute, 100) {
			transfers := make([]Transfer, 0, len(chunk))
			for _, item := range chunk {
				transfers = append(transfers, Transfer{
					OrderSn:    item.OrderSn,
					To:         common.HexToAddress(strings.ToLower(item.ToAddress)),
					RealAmount: item.RealAmount.Shift(int32(config.GetConfig().Odd.TokenDec)).BigInt(),
				})
			}

			// 发送代币
			result, err := BatchTransferWithDistribute(context.Background(), bsc.GetClient(), &BatchTransferReq{
				TokenAddress:              common.HexToAddress(config.GetConfig().Odd.TokenAddress),
				Transfers:                 transfers,
				PrivateKeyHex:             config.GetConfig().Odd.SenderPrivateKey,
				DistributeContractAddress: common.HexToAddress(config.GetConfig().Odd.DistributeContractAddress),
			})
			if err != nil {
				logger.Errorf("[%s]BatchTransferWithDistribute error: %s", t.Name(), err)
				// 发送失败不报错，不影响其他提现
				return nil
			}

			resultList = append(resultList, result)

			// 发送后立刻更新库
			sr := make([]mysql.WithdrawRecord, 0)
			for _, item := range chunk {
				sr = append(sr, mysql.WithdrawRecord{
					ID:          item.ID,
					SendSuccess: true,
					TxHash:      result.TxHash.Hex(),
				})
			}

			err = t.updateWithdrawalSuccess(sr)
			if err != nil {
				logger.Errorf("[%s]updateWithdrawalSuccess error: %s", t.Name(), err)
				return err
			}

			logger.Infof("[%s]transferSuss, tx:%s, OrderSn:%v", t.Name(), result.TxHash.Hex(), lo.Map(chunk, func(item mysql.WithdrawRecord, _ int) string {
				return item.OrderSn
			}))

			// erc20ReceiptToInfo, err := Erc20ReceiptToInfo(ctx, *result.TxReceipt, common.HexToAddress(config.GetConfig().Odd.TokenAddress), config.GetConfig().Odd.TokenDec)
			// if err != nil {
			// 	logger.Errorf("[%s]Erc20ReceiptToInfo error: %s", t.Name(), err)
			// 	return err
			// }

			transferSuss = append(transferSuss, result.Orders...)
		}
		return nil
	})

	// 6. 提醒大额转账
	eg.Go(func() error {
		// 通过redis过滤提醒，大额重复的30min提醒一次
		highRiskMsg := make([]mysql.WithdrawRecord, 0, len(highRiskPending))

		for _, item := range highRiskPending {
			has, err := redis.HasKey(ctx, highRiskPendingKey(item.OrderSn))
			if err != nil {
				logger.Errorf("[%s]HasKey error: %s", t.Name(), err)
				continue
			}
			// logger.Infof("highRiskPendingKey: %s, has: %v", highRiskPendingKey(item.OrderSn), has)
			if has {
				continue
			}
			highRiskMsg = append(highRiskMsg, item)
			err = redis.SetTTl(ctx, highRiskPendingKey(item.OrderSn), 30*time.Minute)
			if err != nil {
				logger.Errorf("[%s]SetTTl error: %s", t.Name(), err)
				continue
			}
		}

		if len(highRiskMsg) == 0 {
			return nil
		}

		message := "[大额提现审核提醒]\n"
		for _, item := range highRiskMsg {
			message += fmt.Sprintf("提现ID: %d, 金额: %s, 提现地址: %s, 用户ID: %d\n", item.ID, item.Amount.String(), item.ToAddress, item.UserID)
		}
		return lark.GetClient().SendText(message)
	})

	if err != eg.Wait() {
		logger.Errorf("[%s]eg.Wait error: %s", t.Name(), err)
		return err
	}

	logger.Infof("[%s]transferSuss: %v", t.Name(), transferSuss)

	// TODO: 6. 更新DB提现状态
	er := make([]mysql.WithdrawRecord, 0)
	for _, item := range waitExecute {
		if ok := lo.Contains(transferSuss, item.OrderSn); !ok {
			er = append(er, item)
		}
	}

	// TODO: 7. 记录处理结果
	logger.Infof("[%s]duration: %s", t.Name(), time.Since(st))

	// TODO: 8. 发送飞书通知
	if len(er) == 0 && len(transferSuss) == 0 {
		return nil
	}

	msg := "[提现汇报]\n"
	// 本账户地址，及剩余token数
	msg += fmt.Sprintf("本账户地址: %s, 剩余token数: %s\n", sender.Hex(), balance.Sub(needBalance).String())
	// 处理发送时间
	msg += fmt.Sprintf("处理发送时间: %s\n", time.Since(st).String())
	// 成功失败数量
	msg += fmt.Sprintf("成功提现的数量: %d, 失败提现的数量:%d\n", len(transferSuss), len(er))
	// 发送的所有地址
	msg += fmt.Sprintf("发送的所有地址: %v\n", lo.Map(waitExecute, func(item mysql.WithdrawRecord, _ int) string {
		return item.ToAddress
	}))
	// 发送的交易hash
	msg += fmt.Sprintf("发送的交易hash: %v\n", lo.Map(resultList, func(item *BatchTransferResult, _ int) string {
		return item.TxHash.String()
	}))
	// 发送的手续费
	msg += fmt.Sprintf("发送的手续费: %v\n", lo.Map(resultList, func(item *BatchTransferResult, _ int) string {
		return decimal.NewFromBigInt(item.TotalFees, 0).Shift(int32(-config.GetConfig().Odd.TokenDec)).String() + "bnb"
	}))
	// 本次提现实际数量
	realAmountList := lo.Map(waitExecute, func(item mysql.WithdrawRecord, _ int) decimal.Decimal {
		return item.RealAmount
	})
	readlAmount := decimal.Zero
	for i := range realAmountList {
		readlAmount = readlAmount.Add(realAmountList[i])
	}
	msg += fmt.Sprintf("本次提现实际数量: %s\n", readlAmount.String())

	type errorRecord struct {
		ToAddress string
		UserId    uint64
		Amount    decimal.Decimal
		OrderSn   string
	}
	// 发送失败的交易
	msg += fmt.Sprintf("发送失败的提交请求: %v\n", lo.Map(er, func(item mysql.WithdrawRecord, _ int) errorRecord {
		return errorRecord{
			ToAddress: item.ToAddress,
			UserId:    item.UserID,
			Amount:    item.Amount,
			OrderSn:   item.OrderSn,
		}
	}))

	err = lark.GetClient().SendText(msg)
	if err != nil {
		logger.Errorf("[%s]SendText error: %s", t.Name(), err)
		return err
	}

	return nil
}

func highRiskPendingKey(order string) string {
	return fmt.Sprintf("high_risk_pending_notice:%s", order)
}

func (t *WithdrawalTask) getAddress(privateKeyHex string) (common.Address, error) {
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return common.Address{}, err
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return common.Address{}, errors.New("failed to cast public key to ECDSA")
	}

	return crypto.PubkeyToAddress(*publicKeyECDSA), nil
}

// 获取 待审核的提现记录
func (t *WithdrawalTask) getWithdrawalPending() ([]mysql.WithdrawRecord, error) {
	var withdrawal []mysql.WithdrawRecord
	err := mysql.GetDB().Model(&mysql.WithdrawRecord{}).Where("status = ?", WithdrawalStatusPending).Order("id DESC").Scan(&withdrawal).Error
	if err != nil {
		return nil, err
	}

	return withdrawal, nil
}

// 获取已审核但未发的提现记录
func (t *WithdrawalTask) getWithdrawalAudited() ([]mysql.WithdrawRecord, error) {
	var withdrawal []mysql.WithdrawRecord
	mysql.GetDB().Model(&mysql.WithdrawRecord{}).Where("status = ?", WithdrawalStatusAudited).Order("id DESC").Find(&withdrawal)
	return withdrawal, nil

}

// 修改审核记录到成功
func (t *WithdrawalTask) updateWithdrawalSuccess(withdrawal []mysql.WithdrawRecord) error {
	now := time.Now()
	for _, item := range withdrawal {
		updates := map[string]interface{}{
			"status":      WithdrawalStatusFinished,
			"finished_at": now,
			"updated_at":  now,
			"tx_hash":     item.TxHash,
		}
		err := mysql.GetDB().Model(&mysql.WithdrawRecord{}).Where("id = ?", item.ID).Updates(updates).Error
		if err != nil {
			return err
		}
	}
	return nil
}

// 修改审核记录成处理中
func (t *WithdrawalTask) updateWithdrawalAudited(withdrawal []mysql.WithdrawRecord) error {
	if len(withdrawal) == 0 {
		return nil
	}
	now := time.Now()
	ids := lo.Map(withdrawal, func(item mysql.WithdrawRecord, _ int) uint64 {
		return item.ID
	})
	err := mysql.GetDB().Model(&mysql.WithdrawRecord{}).Where("id IN (?)", ids).Updates(map[string]interface{}{
		"status":   WithdrawalStatusAudited,
		"audit_at": now,
	}).Error
	if err != nil {
		return err
	}

	return nil
}

func (t *WithdrawalTask) ExecuteProd(ctx context.Context) error {
	logger.Infof("[%s]Prod Starting withdrawal processing...", t.Name())
	// TODO: 后续添加具体的提现处理业务逻辑
	// 1. 从 Redis/DB 查询待处理的提现记录
	// 2. 调用合约或API执行提现
	// 3. 更新提现状态
	// 4. 记录处理结果

	return nil
}
