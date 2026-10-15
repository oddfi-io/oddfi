package multisig

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/errs"
)

// ── Safe ABI fragment ────────────────────────────────────────────────────────

// safeABIJSON is the minimal Safe v1.x interface we need: nonce(),
// getThreshold(), execTransaction(...). Loaded once at package init.
const safeABIJSON = `[
  {"type":"function","name":"nonce","inputs":[],
   "outputs":[{"name":"","type":"uint256"}],
   "stateMutability":"view"
  },
  {"type":"function","name":"getThreshold","inputs":[],
   "outputs":[{"name":"","type":"uint256"}],
   "stateMutability":"view"
  },
  {"type":"function","name":"execTransaction",
   "inputs":[
     {"name":"to","type":"address"},
     {"name":"value","type":"uint256"},
     {"name":"data","type":"bytes"},
     {"name":"operation","type":"uint8"},
     {"name":"safeTxGas","type":"uint256"},
     {"name":"baseGas","type":"uint256"},
     {"name":"gasPrice","type":"uint256"},
     {"name":"gasToken","type":"address"},
     {"name":"refundReceiver","type":"address"},
     {"name":"signatures","type":"bytes"}
   ],
   "outputs":[{"name":"","type":"bool"}],
   "stateMutability":"payable"
  }
]`

var safeABI abi.ABI

func init() {
	parsed, err := abi.JSON(strings.NewReader(safeABIJSON))
	if err != nil {
		panic("multisig: parse safeABI: " + err.Error())
	}
	safeABI = parsed
}

// ── EIP-712 type hashes ──────────────────────────────────────────────────────

// Per Safe v1.3+ contracts: domain typehash uses (chainId, verifyingContract).
// SafeTx typehash matches Safe's definition.
var (
	domainTypeHash = crypto.Keccak256Hash(
		[]byte("EIP712Domain(uint256 chainId,address verifyingContract)"))
	safeTxTypeHash = crypto.Keccak256Hash(
		[]byte("SafeTx(address to,uint256 value,bytes data,uint8 operation," +
			"uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken," +
			"address refundReceiver,uint256 nonce)"))
)

// SafeTx mirrors the EIP-712 SafeTx payload. All fields are consumed by both
// the safeTxHash computation and the execTransaction calldata, so we keep
// one source of truth.
type SafeTx struct {
	To             common.Address
	Value          *big.Int
	Data           []byte
	Operation      uint8 // 0=Call, 1=DelegateCall
	SafeTxGas      *big.Int
	BaseGas        *big.Int
	GasPrice       *big.Int
	GasToken       common.Address // 0x0 = ETH/native
	RefundReceiver common.Address
	Nonce          *big.Int
}

// SafeTxHash returns the EIP-712 digest a Safe owner must sign.
func (s *SafeTx) SafeTxHash(chainID *big.Int, safeAddr common.Address) common.Hash {
	domainSep := computeDomainSeparator(chainID, safeAddr)
	structHash := s.structHash()
	// EIP-712: keccak256(0x19, 0x01, domainSep, structHash)
	prefixed := append([]byte{0x19, 0x01}, domainSep[:]...)
	prefixed = append(prefixed, structHash[:]...)
	return crypto.Keccak256Hash(prefixed)
}

// computeDomainSeparator: keccak256(abi.encode(typeHash, chainId, safeAddr))
func computeDomainSeparator(chainID *big.Int, safeAddr common.Address) common.Hash {
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	bytes32Ty, _ := abi.NewType("bytes32", "", nil)
	addressTy, _ := abi.NewType("address", "", nil)
	args := abi.Arguments{
		{Type: bytes32Ty}, {Type: uint256Ty}, {Type: addressTy},
	}
	encoded, err := args.Pack(domainTypeHash, chainID, safeAddr)
	if err != nil {
		// can't happen with these types
		panic(fmt.Sprintf("multisig: pack domain: %v", err))
	}
	return crypto.Keccak256Hash(encoded)
}

// structHash: keccak256(abi.encode(typeHash, to, value, keccak256(data),
//   operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce))
func (s *SafeTx) structHash() common.Hash {
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	uint8Ty, _ := abi.NewType("uint8", "", nil)
	bytes32Ty, _ := abi.NewType("bytes32", "", nil)
	addressTy, _ := abi.NewType("address", "", nil)

	args := abi.Arguments{
		{Type: bytes32Ty}, // typeHash
		{Type: addressTy}, // to
		{Type: uint256Ty}, // value
		{Type: bytes32Ty}, // keccak256(data)
		{Type: uint8Ty},   // operation
		{Type: uint256Ty}, // safeTxGas
		{Type: uint256Ty}, // baseGas
		{Type: uint256Ty}, // gasPrice
		{Type: addressTy}, // gasToken
		{Type: addressTy}, // refundReceiver
		{Type: uint256Ty}, // nonce
	}

	dataHash := crypto.Keccak256Hash(s.Data)
	encoded, err := args.Pack(
		safeTxTypeHash,
		s.To,
		s.Value,
		dataHash,
		s.Operation,
		s.SafeTxGas,
		s.BaseGas,
		s.GasPrice,
		s.GasToken,
		s.RefundReceiver,
		s.Nonce,
	)
	if err != nil {
		panic(fmt.Sprintf("multisig: pack SafeTx: %v", err))
	}
	return crypto.Keccak256Hash(encoded)
}

// PackExecTransaction builds the calldata to invoke
// safe.execTransaction(...) with the given signatures bytes.
func (s *SafeTx) PackExecTransaction(signatures []byte) ([]byte, error) {
	method, ok := safeABI.Methods["execTransaction"]
	if !ok {
		return nil, errors.New("multisig: safe ABI missing execTransaction")
	}
	tail, err := method.Inputs.Pack(
		s.To, s.Value, s.Data, s.Operation,
		s.SafeTxGas, s.BaseGas, s.GasPrice, s.GasToken, s.RefundReceiver,
		signatures,
	)
	if err != nil {
		return nil, fmt.Errorf("multisig: pack execTransaction: %w", err)
	}
	return append(append([]byte{}, method.ID...), tail...), nil
}

// ── Execute mode ─────────────────────────────────────────────────────────────

// executeViaSafe wraps innerData as a SafeTx, signs the safeTxHash with the
// configured Safe-owner key, and broadcasts safe.execTransaction(...).
//
// Used for 1-of-1 testnet Safes only; the signature blob is a single ECDSA
// signature. For multi-owner Safes, use Propose mode instead.
func (c *Client) executeViaSafe(
	ctx context.Context,
	to common.Address,
	value *big.Int,
	innerData []byte,
	operation uint8,
	logMethodName string,
) (*types.Transaction, error) {
	if c.safeOwner == nil {
		return nil, &ErrModeNotConfigured{Mode: "execute"}
	}
	safeAddr := c.SafeAddress()
	if safeAddr == (common.Address{}) {
		return nil, errors.New("multisig: Safe address is zero (Connection didn't load it)")
	}

	if _, hasDeadline := ctx.Deadline(); !hasDeadline && c.txTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.txTimeout)
		defer cancel()
	}

	// 1. Read Safe nonce.
	nonce, err := c.readSafeNonce(ctx, safeAddr)
	if err != nil {
		return nil, fmt.Errorf("multisig: read safe nonce: %w", err)
	}

	// 2. Build SafeTx.
	stx := &SafeTx{
		To:             to,
		Value:          value,
		Data:           innerData,
		Operation:      operation,
		SafeTxGas:      big.NewInt(0),
		BaseGas:        big.NewInt(0),
		GasPrice:       big.NewInt(0),
		GasToken:       common.Address{},
		RefundReceiver: common.Address{},
		Nonce:          new(big.Int).SetUint64(nonce),
	}

	// 3. Compute safeTxHash and sign it.
	safeTxHash := stx.SafeTxHash(c.conn.ChainID(), safeAddr)
	var hashArr [32]byte
	copy(hashArr[:], safeTxHash[:])
	sig, err := c.safeOwner.SignHash(ctx, hashArr)
	if err != nil {
		return nil, fmt.Errorf("multisig: sign safeTxHash: %w", err)
	}
	if len(sig) != 65 {
		return nil, fmt.Errorf("multisig: signature length %d != 65", len(sig))
	}

	// 4. Pack execTransaction calldata.
	execData, err := stx.PackExecTransaction(sig)
	if err != nil {
		return nil, err
	}

	// 5. Build a raw tx and send via the underlying eth client + signer.
	from := c.safeOwner.Address()
	chainID := c.conn.ChainID()
	rawNonce, err := c.conn.EthClient().PendingNonceAt(ctx, from)
	if err != nil {
		return nil, fmt.Errorf("multisig: pending nonce: %w", err)
	}
	gasTipCap, _ := c.conn.EthClient().SuggestGasTipCap(ctx)
	if gasTipCap == nil {
		gasTipCap = big.NewInt(1_000_000_000) // 1 gwei fallback
	}
	header, err := c.conn.EthClient().HeaderByNumber(ctx, nil)
	gasFeeCap := new(big.Int)
	if err == nil && header != nil && header.BaseFee != nil {
		// 2x base fee + tip = generous default
		gasFeeCap.Mul(header.BaseFee, big.NewInt(2))
		gasFeeCap.Add(gasFeeCap, gasTipCap)
	} else {
		gasFeeCap = new(big.Int).Mul(gasTipCap, big.NewInt(10))
	}
	// Rough gas: BettingPool methods + Safe overhead. Estimate to be safer.
	gasLimit, err := c.conn.EthClient().EstimateGas(ctx, ethereum.CallMsg{
		From: from, To: &safeAddr, Data: execData,
	})
	if err != nil {
		// EstimateGas reverts surface as typed errors via errs.Wrap.
		return nil, errs.Wrap(err, logMethodName, c.parser)
	}

	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     rawNonce,
		GasTipCap: gasTipCap,
		GasFeeCap: gasFeeCap,
		Gas:       gasLimit,
		To:        &safeAddr,
		Value:     big.NewInt(0),
		Data:      execData,
	})
	signed, err := c.safeOwner.SignTx(ctx, tx, chainID)
	if err != nil {
		return nil, fmt.Errorf("multisig: sign exec tx: %w", err)
	}
	if err := c.conn.EthClient().SendTransaction(ctx, signed); err != nil {
		return nil, errs.Wrap(err, logMethodName, c.parser)
	}
	return signed, nil
}

// readSafeNonce calls Safe.nonce() at safeAddr.
func (c *Client) readSafeNonce(ctx context.Context, safeAddr common.Address) (uint64, error) {
	method := safeABI.Methods["nonce"]
	data := append([]byte{}, method.ID...)
	out, err := c.conn.EthClient().CallContract(ctx, ethereum.CallMsg{
		To: &safeAddr, Data: data,
	}, nil)
	if err != nil {
		return 0, err
	}
	values, err := method.Outputs.Unpack(out)
	if err != nil {
		return 0, err
	}
	if len(values) != 1 {
		return 0, fmt.Errorf("multisig: safe nonce: unexpected return %v", values)
	}
	n, ok := values[0].(*big.Int)
	if !ok || !n.IsUint64() {
		return 0, fmt.Errorf("multisig: safe nonce: not uint64 (%v)", values[0])
	}
	return n.Uint64(), nil
}
