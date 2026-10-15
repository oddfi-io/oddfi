// Package safetx is a thin client for Gnosis Safe Transaction Service:
//
//	POST /api/v1/safes/{address}/multisig-transactions/   — propose
//	GET  /api/v1/multisig-transactions/{safeTxHash}/      — status
//
// It is intentionally minimal: callers compute safeTxHash and the
// proposer signature themselves (see sdk/multisig/execute.go for the
// EIP-712 math). This package handles HTTP encoding, status polling, and
// surface-area mapping to friendly Go types.
package safetx

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// ── Errors ───────────────────────────────────────────────────────────────────

// ErrServiceRejected is returned when Safe Tx Service responds with a
// non-2xx status that includes a body. The Body field carries the raw
// response (truncated to 1KB) so callers can debug.
type ErrServiceRejected struct {
	StatusCode int
	Body       string
	URL        string
}

func (e *ErrServiceRejected) Error() string {
	return fmt.Sprintf("safetx: service rejected: %s status=%d body=%s", e.URL, e.StatusCode, e.Body)
}

// ErrProposalNotFound is returned by Get when the safeTxHash is not known
// to the service (404). Distinguishable via errors.Is.
var ErrProposalNotFound = errors.New("safetx: proposal not found")

// ── Client ───────────────────────────────────────────────────────────────────

// HTTPClient is the small surface used; *http.Client satisfies it.
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// Client is a thin Safe Tx Service client.
type Client struct {
	baseURL string
	http    HTTPClient
	timeout time.Duration
}

// New constructs a Client. baseURL must NOT have a trailing slash.
// Defaults: http.DefaultClient, 15s timeout.
func New(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    http.DefaultClient,
		timeout: 15 * time.Second,
	}
}

// WithHTTPClient overrides the HTTP transport (tests, custom retries).
func (c *Client) WithHTTPClient(h HTTPClient) *Client {
	c.http = h
	return c
}

// WithTimeout overrides the per-request timeout. <= 0 disables.
func (c *Client) WithTimeout(d time.Duration) *Client {
	c.timeout = d
	return c
}

// BaseURL returns the configured service base URL.
func (c *Client) BaseURL() string { return c.baseURL }

// ── Propose ──────────────────────────────────────────────────────────────────

// ProposeRequest is the SafeTx body the service expects. The field names
// must match Safe Tx Service's JSON exactly (snake/camel and quoted ints
// included — see Safe API docs).
type ProposeRequest struct {
	To                      common.Address `json:"to"`
	Value                   string         `json:"value"`            // decimal string
	Data                    string         `json:"data"`             // 0x-hex
	Operation               uint8          `json:"operation"`
	SafeTxGas               string         `json:"safeTxGas"`        // decimal string
	BaseGas                 string         `json:"baseGas"`
	GasPrice                string         `json:"gasPrice"`
	GasToken                common.Address `json:"gasToken"`
	RefundReceiver          common.Address `json:"refundReceiver"`
	Nonce                   uint64         `json:"nonce"`
	ContractTransactionHash common.Hash    `json:"contractTransactionHash"` // safeTxHash
	Sender                  common.Address `json:"sender"`                  // proposer addr
	Signature               string         `json:"signature"`               // 0x-hex sig of safeTxHash
	Origin                  string         `json:"origin,omitempty"`        // optional UI tag
}

// Propose POSTs the request body for the given Safe address and returns
// the safeTxHash on success (as supplied in the request). Surfaces a
// typed *ErrServiceRejected for non-2xx responses.
func (c *Client) Propose(ctx context.Context, safe common.Address, req *ProposeRequest) (common.Hash, error) {
	url := fmt.Sprintf("%s/api/v1/safes/%s/multisig-transactions/", c.baseURL, safe.Hex())
	body, err := json.Marshal(req)
	if err != nil {
		return common.Hash{}, fmt.Errorf("safetx: marshal: %w", err)
	}

	if c.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.timeout)
		defer cancel()
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return common.Hash{}, fmt.Errorf("safetx: build req: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return common.Hash{}, fmt.Errorf("safetx: POST %s: %w", url, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return common.Hash{}, &ErrServiceRejected{
			StatusCode: resp.StatusCode,
			Body:       truncate(respBody, 1024),
			URL:        url,
		}
	}
	return req.ContractTransactionHash, nil
}

// ── Get (status) ────────────────────────────────────────────────────────────

// GetResponse is the parsed shape returned by GET. Many additional fields
// exist on the wire — we map only what we need.
type GetResponse struct {
	Safe                  common.Address  `json:"safe"`
	To                    common.Address  `json:"to"`
	Value                 string          `json:"value"`
	Data                  string          `json:"data"`
	Nonce                 uint64          `json:"nonce"`
	ExecutionDate         *string         `json:"executionDate"`
	TransactionHash       *common.Hash    `json:"transactionHash"`
	IsExecuted            bool            `json:"isExecuted"`
	IsSuccessful          *bool           `json:"isSuccessful"`
	ConfirmationsRequired *uint           `json:"confirmationsRequired"`
	Confirmations         []Confirmation  `json:"confirmations"`
}

// Confirmation is one owner's signature on a SafeTx.
type Confirmation struct {
	Owner          common.Address `json:"owner"`
	SubmissionDate string         `json:"submissionDate"`
	SignatureType  string         `json:"signatureType"`
	Signature      string         `json:"signature"`
}

// Get fetches the proposal status. Returns ErrProposalNotFound on 404.
func (c *Client) Get(ctx context.Context, safeTxHash common.Hash) (*GetResponse, error) {
	url := fmt.Sprintf("%s/api/v1/multisig-transactions/%s/", c.baseURL, safeTxHash.Hex())

	if c.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.timeout)
		defer cancel()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("safetx: build req: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("safetx: GET %s: %w", url, err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("%w: %s", ErrProposalNotFound, safeTxHash.Hex())
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &ErrServiceRejected{
			StatusCode: resp.StatusCode,
			Body:       truncate(body, 1024),
			URL:        url,
		}
	}
	var out GetResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("safetx: decode response: %w", err)
	}
	return &out, nil
}

// ── helpers ──────────────────────────────────────────────────────────────────

func truncate(b []byte, n int) string {
	s := string(b)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// EncodeData converts data bytes to 0x-hex for ProposeRequest.Data.
// Exposed so callers don't need to import hexutil separately.
func EncodeData(data []byte) string {
	return hexutil.Encode(data)
}
