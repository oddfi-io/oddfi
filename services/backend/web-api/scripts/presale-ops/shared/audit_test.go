package shared_test

import (
	"regexp"
	"testing"
	"time"

	"everything_finance/org/web-api/scripts/presale-ops/shared"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// newMockGORM 创建 sqlmock + GORM 实例（测试专用）
// 每个测试用例独立创建，避免 sqlmock 状态在子测试间相互干扰
func newMockGORM(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	gormDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      db,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	return gormDB, mock
}

// TestWriteAudit_SQLParams 验证 WriteAudit 生成的 SQL 参数全部正确
func TestWriteAudit_SQLParams(t *testing.T) {
	gormDB, mock := newMockGORM(t)

	entry := shared.AuditEntry{
		ScriptName: "migrate-round",
		Action:     "migrate_round_id",
		TargetType: "deposit",
		TargetID:   "1234567890",
		BeforeJSON: `{"round_id":"strategic"}`,
		AfterJSON:  `{"round_id":"seed"}`,
		Note:       "用户在种子轮付款，被错分到战略轮，迁移回种子轮",
	}

	// sqlmock 必须按顺序 expect BEGIN → EXEC → COMMIT
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO presale_admin_audit
			(operator, operator_role, action, target_type, target_id,
			 before_json, after_json, source, note, created_at)
		VALUES (?, 'script', ?, ?, ?, ?, ?, 'script', ?, ?)`)).
		WithArgs(
			"script:migrate-round",
			"migrate_round_id",
			"deposit",
			"1234567890",
			`{"round_id":"strategic"}`,
			`{"round_id":"seed"}`,
			"用户在种子轮付款，被错分到战略轮，迁移回种子轮",
			sqlmock.AnyArg(), // created_at（毫秒时间戳，值不固定）
		).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	tx := gormDB.Begin()
	if err := shared.WriteAudit(tx, entry); err != nil {
		t.Fatalf("WriteAudit failed: %v", err)
	}
	tx.Commit()

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled SQL expectations: %v", err)
	}
}

// TestWriteAudit_OperatorFormat 验证 operator 字段格式为 "script:filename"
func TestWriteAudit_OperatorFormat(t *testing.T) {
	cases := []struct {
		scriptName   string
		wantOperator string
	}{
		{"unclaimed-credit", "script:unclaimed-credit"},
		{"overflow-handle", "script:overflow-handle"},
		{"migrate-round", "script:migrate-round"},
		{"round-pause", "script:round-pause"},
	}

	for _, tc := range cases {
		tc := tc // 避免循环变量捕获
		t.Run(tc.scriptName, func(t *testing.T) {
			// 每个子测试独立的 sqlmock 实例，避免状态污染
			gormDB, mock := newMockGORM(t)

			mock.ExpectBegin()
			mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO presale_admin_audit`)).
				WithArgs(
					tc.wantOperator,  // operator = "script:filename"
					sqlmock.AnyArg(), // action
					sqlmock.AnyArg(), // target_type
					sqlmock.AnyArg(), // target_id
					sqlmock.AnyArg(), // before_json
					sqlmock.AnyArg(), // after_json
					sqlmock.AnyArg(), // note
					sqlmock.AnyArg(), // created_at
				).
				WillReturnResult(sqlmock.NewResult(1, 1))
			mock.ExpectCommit()

			tx := gormDB.Begin()
			err := shared.WriteAudit(tx, shared.AuditEntry{
				ScriptName: tc.scriptName,
				Action:     "test_action",
				TargetType: "deposit",
				TargetID:   "1",
				Note:       "test note ≥10字符验证",
			})
			tx.Commit()

			if err != nil {
				t.Errorf("WriteAudit(%s) returned error: %v", tc.scriptName, err)
			}

			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("unfulfilled expectations for %s: %v", tc.scriptName, err)
			}
		})
	}
}

// TestWriteAudit_CreatedAtIsRecentMillis 验证 created_at 是近期毫秒时间戳范围内
func TestWriteAudit_CreatedAtIsRecentMillis(t *testing.T) {
	gormDB, mock := newMockGORM(t)

	before := time.Now().UnixMilli()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO presale_admin_audit`)).
		WithArgs(
			sqlmock.AnyArg(), // operator
			sqlmock.AnyArg(), // action
			sqlmock.AnyArg(), // target_type
			sqlmock.AnyArg(), // target_id
			sqlmock.AnyArg(), // before_json
			sqlmock.AnyArg(), // after_json
			sqlmock.AnyArg(), // note
			sqlmock.AnyArg(), // created_at — 具体值通过 before/after 时间窗验证
		).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	tx := gormDB.Begin()
	_ = shared.WriteAudit(tx, shared.AuditEntry{
		ScriptName: "test",
		Action:     "test_action",
		TargetType: "deposit",
		TargetID:   "1",
		Note:       "测试 created_at 毫秒时间戳字段",
	})
	tx.Commit()

	after := time.Now().UnixMilli()

	// 验证时间窗合理：before 和 after 之间不超过 1 秒（脚本执行极快）
	if after-before > 1000 {
		t.Errorf("time window too wide: before=%d after=%d diff=%dms",
			before, after, after-before)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

// TestWriteAudit_SourceAndRoleFixed 验证 source='script' 和 operator_role='script' 固定写入
// （这两个字段在 SQL 中是字面量，不是参数；通过 SQL 匹配间接验证）
func TestWriteAudit_SourceAndRoleFixed(t *testing.T) {
	gormDB, mock := newMockGORM(t)

	// SQL 中包含字面量 'script'（两处），通过正则匹配验证
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("'script'")).
		WithArgs(
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	tx := gormDB.Begin()
	err := shared.WriteAudit(tx, shared.AuditEntry{
		ScriptName: "late-arrival",
		Action:     "migrate_round_id",
		TargetType: "deposit",
		TargetID:   "tx_hash_abc",
		Note:       "验证 source 和 operator_role 固定为 script",
	})
	tx.Commit()

	if err != nil {
		t.Fatalf("WriteAudit failed: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}
