// Package action holds the chain_actions row model and Repo.
package action

import (
	"database/sql"
	"time"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// Row maps to the chain_actions table.
type Row struct {
	ID                int64           `gorm:"column:id;primaryKey"`
	IdempotencyKey    string          `gorm:"column:idempotency_key;uniqueIndex"`
	Op                string          `gorm:"column:op"`
	ArgsJSON          string          `gorm:"column:args_json"`
	Status            coretypes.Status `gorm:"column:status"`
	Attempts          uint            `gorm:"column:attempts"`
	TxHash            sql.NullString  `gorm:"column:tx_hash"`
	BlockNumber       sql.NullInt64   `gorm:"column:block_number"`
	BlockHash         sql.NullString  `gorm:"column:block_hash"`
	GasUsed           sql.NullInt64   `gorm:"column:gas_used"`
	EffectiveGasPrice sql.NullString  `gorm:"column:effective_gas_price"` // wei as decimal text
	SignerAddress     string          `gorm:"column:signer_address"`
	Nonce             sql.NullInt64   `gorm:"column:nonce"`
	LastError         sql.NullString  `gorm:"column:last_error"`
	LastErrorKind     sql.NullString  `gorm:"column:last_error_kind"`
	AssignedTo        sql.NullString  `gorm:"column:assigned_to"`
	HeartbeatAt       sql.NullTime    `gorm:"column:heartbeat_at"`
	CreatedAt         time.Time       `gorm:"column:created_at"`
	SubmittedAt       sql.NullTime    `gorm:"column:submitted_at"`
	MinedAt           sql.NullTime    `gorm:"column:mined_at"`
	ConfirmedAt       sql.NullTime    `gorm:"column:confirmed_at"`
	FailedAt          sql.NullTime    `gorm:"column:failed_at"`
	UpdatedAt         time.Time       `gorm:"column:updated_at"`
}

// TableName is fixed (do not let gorm auto-pluralize).
func (Row) TableName() string { return "chain_actions" }
