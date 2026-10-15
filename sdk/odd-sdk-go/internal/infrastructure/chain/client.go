package chain

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/ethereum/go-ethereum/ethclient"
)

var errClientClosed = errors.New("chain client is closed")

// Client owns the RPC connection used by infrastructure contract adapters.
// Its exported methods are safe for concurrent use.
type Client struct {
	mu     sync.RWMutex
	rpc    *ethclient.Client
	closed bool
}

// Dial opens a go-ethereum RPC client using ctx for the network dial.
func Dial(ctx context.Context, rpcURL string) (*Client, error) {
	if rpcURL == "" {
		return nil, fmt.Errorf("rpc url: %w", ErrMissingRPCURL)
	}
	rpc, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return nil, fmt.Errorf("dial rpc: %w", err)
	}
	return NewClient(rpc), nil
}

// NewClient wraps an existing go-ethereum client for tests and adapters.
func NewClient(rpc *ethclient.Client) *Client {
	return &Client{rpc: rpc}
}

// Caller returns the underlying read-only contract caller.
func (c *Client) Caller() (*ethclient.Client, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.closed {
		return nil, errClientClosed
	}
	if c.rpc == nil {
		return nil, ErrMissingRPCClient
	}
	return c.rpc, nil
}

// Close closes the underlying RPC connection. ctx is accepted for public
// lifecycle symmetry; go-ethereum close itself is synchronous and nonblocking.
func (c *Client) Close(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return fmt.Errorf("close chain client: %w", ctx.Err())
	default:
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil
	}
	if c.rpc != nil {
		c.rpc.Close()
	}
	c.closed = true
	return nil
}

// ErrMissingRPCURL indicates the RPC URL configuration is empty.
var ErrMissingRPCURL = errors.New("missing rpc url")

// ErrMissingRPCClient indicates an adapter was created without an RPC client.
var ErrMissingRPCClient = errors.New("missing rpc client")
