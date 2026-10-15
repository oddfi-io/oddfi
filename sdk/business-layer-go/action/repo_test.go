package action_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/testdb"
)

func TestRepo_InsertOrLoad_Idempotency(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := action.New(db)
	ctx := context.Background()

	row := &action.Row{
		IdempotencyKey: "test:idem-1",
		Op:             "lockBet",
		ArgsJSON:       `{"foo":"bar"}`,
		Status:         coretypes.StatusPending,
		SignerAddress:  "0x1234567890123456789012345678901234567890",
	}

	id1, existed1, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)
	require.False(t, existed1)
	require.Greater(t, id1, int64(0))

	id2, existed2, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)
	require.True(t, existed2)
	require.Equal(t, id1, id2)
}

func TestRepo_MarkFailed(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := action.New(db)
	ctx := context.Background()

	row := &action.Row{
		IdempotencyKey: "test:fail",
		Op:             "lockBet",
		ArgsJSON:       `{}`,
		Status:         coretypes.StatusPending,
		SignerAddress:  "0x0000000000000000000000000000000000000001",
	}
	id, _, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)

	require.NoError(t, repo.MarkFailed(ctx, id, "sim_failed", &coretypes.ErrSimulationFailed{Method: "lockBet"}))
	got, err := repo.Get(ctx, id)
	require.NoError(t, err)
	require.Equal(t, coretypes.StatusFailed, got.Status)
	require.True(t, got.LastError.Valid)
	require.Equal(t, "sim_failed", got.LastErrorKind.String)
}

func TestRepo_ClaimSubmittedRow_SkipLocked(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := action.New(db)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		row := &action.Row{
			IdempotencyKey: "test:claim:" + time.Now().Format("20060102150405.000000") + "-" + string(rune('a'+i)),
			Op:             "lockBet",
			ArgsJSON:       `{}`,
			Status:         coretypes.StatusSubmitted,
			SignerAddress:  "0x0000000000000000000000000000000000000001",
		}
		id, _, err := repo.InsertOrLoad(ctx, row)
		require.NoError(t, err)
		// Bring row to 'submitted' so the claim query picks it up.
		require.NoError(t, db.Exec(`
			UPDATE chain_actions SET status='submitted', tx_hash=?, submitted_at=NOW() WHERE id=?
		`, "0x"+stringRepeat("aa", 32), id).Error)
	}

	claimed1, err := repo.ClaimSubmittedRow(ctx, "worker-1", 60*time.Second)
	require.NoError(t, err)
	require.NotNil(t, claimed1)
	require.True(t, claimed1.AssignedTo.Valid)
	require.Equal(t, "worker-1", claimed1.AssignedTo.String)

	claimed2, err := repo.ClaimSubmittedRow(ctx, "worker-2", 60*time.Second)
	require.NoError(t, err)
	require.NotNil(t, claimed2)
	require.NotEqual(t, claimed1.ID, claimed2.ID, "different worker should claim a different row")
}

func TestRepo_MarkMined_Confirmed(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := action.New(db)
	ctx := context.Background()

	row := &action.Row{
		IdempotencyKey: "test:lifecycle",
		Op:             "lockBet",
		ArgsJSON:       `{}`,
		Status:         coretypes.StatusPending,
		SignerAddress:  "0x0000000000000000000000000000000000000002",
	}
	id, _, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)

	require.NoError(t, db.Exec(`UPDATE chain_actions SET status='submitted', tx_hash=?, submitted_at=NOW() WHERE id=?`,
		"0x"+stringRepeat("ab", 32), id).Error)

	require.NoError(t, repo.MarkMined(ctx, id, 100, "0x"+stringRepeat("cc", 32), 21000, "1000000000"))
	got, err := repo.Get(ctx, id)
	require.NoError(t, err)
	require.Equal(t, coretypes.StatusMined, got.Status)
	require.Equal(t, int64(100), got.BlockNumber.Int64)

	require.NoError(t, repo.MarkConfirmed(ctx, id))
	got, err = repo.Get(ctx, id)
	require.NoError(t, err)
	require.Equal(t, coretypes.StatusConfirmed, got.Status)
	require.True(t, got.ConfirmedAt.Valid)
}

func TestRepo_InsertMirroredSubmitted(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := action.New(db)
	ctx := context.Background()

	mirror := &action.Row{
		IdempotencyKey: "ms_executed:0xabc",
		Op:             "multisig_executed:settle",
		ArgsJSON:       `{}`,
		SignerAddress:  "0xSAFE0000000000000000000000000000000000000",
	}
	hash := "0x" + stringRepeat("ee", 32)
	id, existed, err := repo.InsertMirroredSubmitted(ctx, mirror, hash)
	require.NoError(t, err)
	require.False(t, existed)

	got, err := repo.Get(ctx, id)
	require.NoError(t, err)
	require.Equal(t, coretypes.StatusSubmitted, got.Status)
	require.Equal(t, hash, got.TxHash.String)

	// Idempotent
	_, existed, err = repo.InsertMirroredSubmitted(ctx, mirror, hash)
	require.NoError(t, err)
	require.True(t, existed)
}

func stringRepeat(s string, n int) string {
	out := ""
	for i := 0; i < n; i++ {
		out += s
	}
	return out
}
