package safetx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
)

func TestPropose_Happy(t *testing.T) {
	wantHash := common.HexToHash("0x" + strings.Repeat("ab", 32))
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		if !strings.Contains(r.URL.Path, "/api/v1/safes/") {
			t.Errorf("path = %s", r.URL.Path)
		}
		var body ProposeRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body.ContractTransactionHash != wantHash {
			t.Errorf("hash mismatch")
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	c := New(srv.URL)
	got, err := c.Propose(context.Background(), common.HexToAddress("0xabc"), &ProposeRequest{
		ContractTransactionHash: wantHash,
		Sender:                  common.HexToAddress("0xdef"),
		Value:                   "0",
		Data:                    "0xabcd",
		SafeTxGas:               "0",
		BaseGas:                 "0",
		GasPrice:                "0",
		Signature:               "0x" + strings.Repeat("11", 65),
	})
	if err != nil {
		t.Fatalf("Propose: %v", err)
	}
	if got != wantHash {
		t.Errorf("got %x, want %x", got, wantHash)
	}
}

func TestPropose_ServiceError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprint(w, `{"error":"invalid signature"}`)
	}))
	defer srv.Close()

	c := New(srv.URL)
	_, err := c.Propose(context.Background(), common.Address{}, &ProposeRequest{})
	var rej *ErrServiceRejected
	if !errors.As(err, &rej) {
		t.Fatalf("want ErrServiceRejected, got %v", err)
	}
	if rej.StatusCode != 400 {
		t.Errorf("status = %d", rej.StatusCode)
	}
	if !strings.Contains(rej.Body, "invalid signature") {
		t.Errorf("body lost: %q", rej.Body)
	}
}

func TestGet_Happy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{
			"safe": "0x1111111111111111111111111111111111111111",
			"to": "0x2222222222222222222222222222222222222222",
			"value": "0",
			"data": "0xabcd",
			"nonce": 7,
			"isExecuted": false,
			"confirmationsRequired": 2,
			"confirmations": [
				{"owner":"0xaaaa000000000000000000000000000000000000","submissionDate":"2026-04-30T12:00:00Z","signatureType":"EOA","signature":"0xdead"}
			]
		}`)
	}))
	defer srv.Close()

	c := New(srv.URL)
	resp, err := c.Get(context.Background(), common.HexToHash("0x"+strings.Repeat("a", 64)))
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.Nonce != 7 {
		t.Errorf("nonce = %d", resp.Nonce)
	}
	if resp.IsExecuted {
		t.Error("IsExecuted should be false")
	}
	if resp.ConfirmationsRequired == nil || *resp.ConfirmationsRequired != 2 {
		t.Errorf("ConfirmationsRequired = %v", resp.ConfirmationsRequired)
	}
	if len(resp.Confirmations) != 1 {
		t.Fatalf("Confirmations len = %d", len(resp.Confirmations))
	}
	if resp.Confirmations[0].SignatureType != "EOA" {
		t.Errorf("SignatureType = %s", resp.Confirmations[0].SignatureType)
	}
}

func TestGet_NotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c := New(srv.URL)
	_, err := c.Get(context.Background(), common.Hash{})
	if !errors.Is(err, ErrProposalNotFound) {
		t.Errorf("want ErrProposalNotFound, got %v", err)
	}
}

func TestNew_StripsTrailingSlash(t *testing.T) {
	c := New("https://example.com/")
	if c.baseURL != "https://example.com" {
		t.Errorf("baseURL = %q", c.baseURL)
	}
}

func TestEncodeData(t *testing.T) {
	got := EncodeData([]byte{0xab, 0xcd})
	if got != "0xabcd" {
		t.Errorf("EncodeData = %q", got)
	}
}
