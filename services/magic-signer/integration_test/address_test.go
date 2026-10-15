package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"

	"github.com/Crypto-Barrett/oddfi-magic-client/client"
)

func newClient(t *testing.T, ts *testServer) *client.Client {
	t.Helper()
	c, err := client.New(client.Config{
		BaseURL:   ts.BaseURL,
		AuthToken: ts.AuthToken,
		Timeout:   5 * time.Second,
	})
	require.NoError(t, err)
	return c
}

func TestAddress_CreateAndDeterministic(t *testing.T) {
	ts := startTestServer(t, "test")
	cli := newClient(t, ts)

	addr1, err := cli.WalletAddress(context.Background(), "user-12345")
	require.NoError(t, err)
	require.True(t, common.IsHexAddress(addr1.Hex()))

	// Second call hits the service-side cache; must return the same address.
	addr2, err := cli.WalletAddress(context.Background(), "user-12345")
	require.NoError(t, err)
	require.Equal(t, addr1, addr2)
}

func TestAddress_DifferentUsersDifferentAddresses(t *testing.T) {
	ts := startTestServer(t, "test")
	cli := newClient(t, ts)

	a, err := cli.WalletAddress(context.Background(), "alice")
	require.NoError(t, err)
	b, err := cli.WalletAddress(context.Background(), "bob")
	require.NoError(t, err)
	require.NotEqual(t, a, b)
}

func TestAddress_Unauthorized(t *testing.T) {
	ts := startTestServer(t, "test")
	cli, err := client.New(client.Config{
		BaseURL:   ts.BaseURL,
		AuthToken: "WRONG-TOKEN",
		Timeout:   2 * time.Second,
	})
	require.NoError(t, err)
	_, err = cli.WalletAddress(context.Background(), "u1")
	require.Error(t, err)
	require.ErrorIs(t, err, client.ErrUnauthorized)
}

func TestAddress_EmptyUserID(t *testing.T) {
	ts := startTestServer(t, "test")
	cli := newClient(t, ts)
	_, err := cli.WalletAddress(context.Background(), "")
	require.Error(t, err)
	require.ErrorIs(t, err, client.ErrBadRequest)
}
