package consts

import "errors"

var (
	ErrInvalidParam                          error = errors.New("invalid param")
	ErrInvalidTopic                          error = errors.New("invalid topic")
	ErrInvalidEvmStandardAddress             error = errors.New("invalid evm standard address")
	ErrIllegalAddress                        error = errors.New("illegal address")
	ErrInvalidDecimals                       error = errors.New("invalid decimals")
	ErrInvalidTotalSupply                    error = errors.New("invalid total supply")
	ErrInvalidOwnerAddress                   error = errors.New("invalid owner address")
	ErrInvalidErc20Balance                   error = errors.New("invalid erc20 balance")
	ErrInvalidErc721Balance                  error = errors.New("invalid erc721 balance")
	ErrInvalidErc1155BalanceOfBatchResult    error = errors.New("invalid erc1155 balanceOfBatch result")
	ErrInvalidErc1155BalanceOfBatchResultLen error = errors.New("invalid erc1155 balanceOfBatch result length")

	ErrResponseBadStatus  error = errors.New("response bad status")
	ErrDBInvalidTableName error = errors.New("invalid table name")

	ErrNotSupportChain error = errors.New("not support this chain")
)
